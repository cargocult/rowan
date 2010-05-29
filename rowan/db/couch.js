var couchdb = require("couchdb/couchdb");

/**
 * Returns the current unix timestamp. In seconds since the epoch.
 */
var timestamp = function() {
    return new Date().getTime() * 0.001;
};

/**
 * Manages the loading of data. Data loading is a complex process
 * possibly involving several trips to the underlying data store, with
 * asynchronous waits until that is done.
 */
var DataStore;
exports.DataStore = DataStore = {

    // ----------------------------------------------------------------------
    // Functions for storing and retrieving data.
    // ----------------------------------------------------------------------

    /**
     * Retrieves the object with the given uuid from the data store.
     * The callback has the signature function(err, object). When the
     * object is returned, you know it has been completely loaded, and
     * its dependencies have been loaded also.
     */
    get: function(uuid, callback) {
        var that = this;

        // Check if we've buffered that object already.
        if (this._object_cache[uuid]) {
            // TODO: Check for out of date and invalidate the cache.
            return callback(null, this._object_cache[uuid].object);
        }

        // Extract the JSON from the db.
        var db = this._get_db();
        db.getDoc(uuid, function(err, json_data) {
            if (err) {
                if (err.error == "not_found") {
                    // Make the obvious error a little less terse.
                    return callback({
                        name:"NotInDatabaseError",
                        message:"I couldn't find '"+uuid+"' in the database."
                    });
                } else {
                    // Don't know what kind of error this is, pass it
                    // back unchanged.
                    return callback(err);
                }
            }

            // Convert from json to final object (we know it is an
            // object, so no need to call convert_from_db).
            return that._convert_db_object(json_data, callback);
        });
    },

    /**
     * Notifies the data store that the given object has been changed.
     * The callback has the signature function(err). If no error is
     * given when the callback is called, then the save worked.
     */
    save: function(object, callback) {
        // The object must have an id to be saved.
        if (!object.id) {
            callback({
                name:"DataStoreSaveError",
                message:"To be saved, an object must have an id."
            });
        }

        var revision = this._object_cache[object.id].revision;
        var freeze = object.freeze;
        var json;

        // Try to get the object to freeze itself into raw data.
        if (freeze) {
            json = freeze.call(object);
        } else {
            // We aren't freezing, just copy out the data.
            json = {};
            for (var property in object) {
                if (object.hasOwnProperty(property)) {
                    json[property] = object[property];
                }
            }
        }
        // Add couch's data.
        json._id = json.id;
        delete json.id; // Don't store the id twice.
        if (revision) {
            json._rev = revision;
        }

        db.saveDoc(object.id, json, callback);
    },

    /**
     * Retrieve a list of objects that match the given query. See the
     * register_index method for details of these calls.
     */
    query: function(index_name, criteria, callback, opts) {
        var that = this;

        // We can pass in additional CouchDB query parameters in opts.
        query = {descending:false};
        opts = opts || {};
        for (var opt in opts) {
            query[opt] = opts[opt];
        }

        // Make sure the index has been sent to the DB.
        var index = this._indices[index_name];
        if (!index.registered) {
            return callback({
                name:"DataStoreQueryError",
                message:"Can't query an index until it has been created, "+
                    "call create_indices first."
            });
        }

        // We'll subtract from the count to see if any unused criteria remain.
        var criteria_count = 0;
        for (var criterion_name in criteria) {
            if (criteria.hasOwnProperty(criterion_name)) {
                criteria_count++;
            }
        }

        // Build up the startkey, making sure the criteria match our
        // indexes registration.
        var startkey = [];
        var options = index.optional;
        // Can't use forEach because we need to break.
        for (var i = 0; i < options.length; i++) {
            var option = options[i];
            if (criteria[option]) {
                // Add this criteria's value to the startkey.
                startkey.push(criteria[option]);
                criteria_count--;
            } else {
                // We have no more criteria matching our options.
                break;
            }
        }
        if (criteria_count) {
            // We have some criteria that were out of sequence for the
            // options declared in the index, this is an error.
            return callback({
                name:"DataStoreQueryError",
                message:"Can only query things from the start of index's "+
                    "options list. Options:"+JSON.stringify(options)+
                    ", query:"+JSON.stringify(criteria)+"."
            });
        }

        // Calculate the endkey, by incrementing the last value of the
        // last item in the startkey.
        query.key = startkey;
        query.endkey = startkey.concat("\u9999"); // Is there a better way?

        // Run the query
        var db = this._get_db();
        db.view(
            this._opts.index_dd, index_name, query,
            function(err, result) {
                if (err) return callback(err);

                // Extract the results from the row data structures.
                var objects = [];
                result.rows.forEach(function(row) {
                    objects.push(row.value);
                });

                // Thaw and return them.
                that._convert_db_array(objects, callback);
            }
        );
    },


    // ----------------------------------------------------------------------
    // Functions for creating and initializing a data store.
    // ----------------------------------------------------------------------

    /**
     * Tells the data store that objects it finds with the given
     * type_id should be made into a ready-to-use object by the given
     * thaw function. The thaw function can perform arbitrary
     * transformations.
     */
    register_type: function(type_id, thaw_fn) {
        this._type_to_thaw_fn[type_id] = thaw_fn;
    },

    /**
     * Notifies the store that you may want to search for a particular
     * subset of objects matching some criteria. The first param is a
     * name for the index, to be used later. The second param is a
     * dictionary of things that MUST be true for the indexed objects
     * (typically a type specifier, as here). Further params are
     * strings, representing the properties that you may want to query
     * on. The order is very significant, you can only query on the
     * first 'n' of these properties. So you could query
     * {world:my_world, player:bob.id}, or {world:my_world} or even
     * {}, but not {player: bob.id}. You may need to specify multiple
     * indices to capture all combinations of search you want to
     * perform. Note also, that when querying you have to query for
     * the underlying JSON representation, and not the thawed objects.
     */
    register_index: function(index_name, required /*... optional+ ...*/) {
        var optional = Array.prototype.slice.call(arguments, 2);

        // Compile the boolean expression to test if a document
        // matches our requirements.
        var criteria = [];
        for (var property in required) {
            if (property == 'id') property == '_id';
            criteria.push(
                "doc[\""+property+"\"] == "+JSON.stringify(required[property])
            );
        }
        criteria = criteria.join(" && ");

        // Compile the emission from the set of optional.
        var emit = [];
        optional.forEach(function(option) {
            emit.push('doc["'+option+'"]');
        });
        if (emit) {
            emit = emit.join(",");
        } else {
            emil = "null";
        }

        // Compile the map function
        var map_fn = "function(doc) { ";
        if (criteria) {
            map_fn += "if ("+criteria+") ";
        }
        map_fn += "emit(["+emit+"], doc); }";

        // Store it, until we get the call to create indices.
        this._indices[index_name] = {
            required: required,
            optional: optional,
            map_fn_str: map_fn,
            registered: false
        };
    },

    /**
     * Notifies the store that you've finished creating indices. After
     * calling this, you may use any previously registered indices. If
     * you attempt to call a query on an index before calling this
     * method, an error will be raised. Note that creating indices is
     * a potentially time consuming process, so requires a callback,
     * with signature function(err). If the callback receives no
     * error, then the indices were created correctly.
     */
    create_indices: function(callback) {
        var that = this;

        // Create the design document.
        var dd = {
            _id:"_design/"+this._opts.index_dd,
            views: {}
        };

        // Add in our views
        for (var index_name in this._indices) {
            var index = this._indices[index_name];
            dd.views[index_name] = {
                map: index.map_fn_str
            };
        };

        // Now we can't just push this DD to couch, because it might
        // conflict with one already there. We have to find the
        // revision of the current version before we can remove it.
        var db = this._get_db();
        db.getDoc(dd._id, function(err, old_design_doc) {
            // We're expecting a not found error (if the design
            // document isn't there already).
            if (err) {
                if (err.error != "not_found") {
                    return callback(err);
                }
            } else {
                // TODO: Check for identical DD and don't save.
                dd._rev = old_design_doc._rev;
            }

            db.saveDoc(dd._id, dd, function(err) {
                if (err) return callback(err);

                // We saved okay, so record that our indices are
                // registered (we use the dd.views to loop in case
                // more indices have been added to this._indices while
                // we waited for our callback).
                for (var index_name in dd.views) {
                    that._indices[index_name].registered = true;
                }
                return callback();
            });
        });
    },

    /**
     * Creates a new DataStore to work on the given database. The
     * options dictionary may consist of the following optional
     * properties:
     *
     * - port: The CouchDB port, default 5984.
     *
     * - host: Where CouchDB is running, default 'localhost'.
     *
     * - index_dd: The name of the Design Document to store our indices,
     *             default 'query_indices'.
     */
    create: function(database_name, opts) {
        var my_opts = {
            port: 5984,
            host: "localhost",
            index_dd: "query_indices"
        };
        for (var opt in opts) {
            if (opts.hasOwnProperty(opt)) {
                my_opts[opt] = opts[opt];
            }
        }

        var obj = Object.create(DataStore);
        obj._database_name = database_name;
        obj._opts = my_opts;
        obj._object_cache = {};
        obj._type_to_thaw_fn = {};
        obj._indices = {};

        return obj;
    },


    // ----------------------------------------------------------------------
    // Private functions for internal use.
    // ----------------------------------------------------------------------

    /**
     * Makes sure we have a valid client and returns the DB wrapper object.
     */
    _get_db: function() {
        if (!this._couch_client) {
            // Might storing this forever mean it gets lost and crashes?
            this._couch_client = couchdb.createClient(
                this._opts.port, this._opts.host
            );
        }
        return this._couch_client.db(this._database_name);
    },

    /**
     * Given something retrieved from the database, this method
     * converts it into its equivalent data structure with thawed
     * elements. This method can cope with any type.
     */
    _convert_from_db: function(db_element, callback) {
        if (!db_element || !(typeof db_element == 'object')) {
            // Non-objects get returned without change.
            callback(null, db_element);
        } else if (db_element.constructor == Array) {
            // Arrays get treated specially.
            this._convert_db_array(db_element, callback);
        } else {
            // We have a general object.
            this._convert_db_object(db_element, callback);
        }
    },

    /**
     * Given a document retrieved from the database, this method
     * converts it to a full thawed data structures.
     */
    _convert_db_object: function(db_object, callback) {
        var that = this;

        var thaw_fn;
        if (db_object.type) {
            // We were given a type, so we should have a thaw function.
            thaw_fn = this._type_to_thaw_fn[db_object.type];

            if (thaw_fn === null) {
                // Thaw functions can be null, to say "I'm expecting
                // things with such-and-such a type, but don't worry about
                // finding a thaw function."""
                thaw_fn = this._default_thaw_handler;
            } else if (!thaw_fn) {
                // We found a type, weren't told we could ignore
                // it, and don't have a way of handling it.
                return callback({
                    name:"LoadObjectError",
                    message:"Can't thaw type: '"+db_object.type+"'."
                });
            }
        } else {
            // We don't have a type so we use the default thaw.
            thaw_fn = this._default_thaw_handler;
        }

        // Thaw the object with whatever function we found.
        return this._do_thaw(thaw_fn, db_object, callback);
    },

    /**
     * If a type doesn't have a thaw handler registered, this function
     * will do the job.
     */
    _default_thaw_handler: function(raw_data, context) {
        var new_object = {};

        // Go through each field and notify the context that we want
        // to thaw it.
        for (var property in raw_data) {
            if (db_object.hasOwnProperty(property)) {
                if (property == '_id' || property == '_rev') continue;
                context.thaw(new_object, property, raw_data[property]);
            }
        }
    },

    /**
     * Given an array retrieved from the database, this method
     * converts it, and its contents, into full thawed data
     * structures.
     */
    _convert_db_array: function(db_array, callback) {
        var that = this;

        // Take a copy of the array so we can delete items as we
        // process them. We reverse it so we can pop elements in
        // order.
        var array_copy = [];
        db_array.forEach(function(element) {
            array_copy.push(element);
        });
        array_copy.reverse();

        // Recursively transform each element through the
        // convert_from_db method.
        var result = [];
        var do_next = function() {
            var next = array_copy.pop();
            if (next) {
                that._convert_from_db(next, function(err, object) {
                    if (err) return callback(err);
                    else {
                        result.push(object);
                        if (array_copy) do_next();
                    }
                });
            } else {
                callback(null, result);
            }
        };
        do_next();
    },

    /**
     * Caches the given object in the data store, so that future
     * loads find it.
     */
    _cache_loaded_object: function(uuid, revision, object) {
        this._object_cache[uuid] = {
            object: object,
            revision: revision,
            loaded: timestamp()
        };
    },

    /**
     * Decodes the given json data into a full object.
     */
    _do_thaw: function(thaw_fn, raw_data, callback) {
        var that = this;

        // When thawing, our thaw function can specify properties it
        // thinks also need thawing, and those it needs replacing by
        // loaded content.
        var properties_to_thaw = [];
        var properties_to_load = {};
        var uuids_to_load = [];

        var context = {
            // The thaw function can see who's trying to do the
            // thawing. This is not normally used.
            store: this,

            // A function that allows thaw routines to schedule the
            // loading and connecting further objects in the database.
            load: function(object, property, uuid) {
                var record = that._object_cache[uuid];

                if (record) {
                    // We've got the object already so triviall wire it
                    // up.
                    object[property] = record.object;
                } else {
                    // Store the wiring request for later.
                    if (properties_to_load[uuid]) {
                        properties_to_load[uuid].push([object, property]);
                    } else {
                        properties_to_load[uuid] = [[object, property]];
                        uuids_to_load.push(uuid);
                    }
                }
            },

            // A function that allows thaw routines to work
            // recursively: having their data thawed in turn.
            thaw: function(object, property, raw_value) {
                properties_to_thaw.push([object, property, raw_value]);
            }
        };

        // Get the thaw routine to create us a new object.
        var thawed_object = thaw_fn(raw_data, context);

        // Cache it now, so that our recursive algorithms below don't
        // try to load it again when it sees a reference to it.
        if (raw_data._id && raw_data._rev) {
            that._cache_loaded_object(
                raw_data._id, raw_data._rev, thawed_object
            );
        }

        // The recursive method that can thaw into a property.
        var do_next_thaw = function() {
            var next_property = properties_to_thaw.pop();
            // When we're done here, we're done for good.
            if (!next_property) return callback(null, thawed_object);

            var object = next_property[0];
            var property = next_property[1];
            var raw_datum = next_property[2];
            that._convert_from_db(raw_datum, function(err, converted) {
                if (err) return callback(err);
                object[property] = converted;
                do_next_thaw();
            });
        };
        // The recursive method that loads the required uuids.
        var do_next_uuid = function() {
            var next_uuid = uuids_to_load.pop();
            // When we're done here, we go on to process the thaw
            // properties.
            if (!next_uuid) return do_next_thaw();

            that.get(next_uuid, function(err, result) {
                if (err) return callback(err);

                // Process the writing for this uuid.
                var wirings = properties_to_load[next_uuid];
                for (var i = 0; i < wirings.length; i++) {
                    var spec = wirings[i];
                    var obj = spec[0];
                    var prop = spec[1];
                    obj[prop] = result;
                }

                // Recurse onto the remaining uuids.
                do_next_uuid();
            });
        };
        // Start with the first uuid
        do_next_uuid();
    }
};
