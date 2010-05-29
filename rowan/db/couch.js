var couchdb = require("couchdb/couchdb");
var sys = require('sys');

/**
 * Returns the current unix timestamp. In seconds since the epoch.
 */
var timestamp = function() {
    return new Date().getTime() * 0.001;
};

/**
 * All functions that take a callback, require it.
 */
var CallbackRequiredError = {
    name:"CallbackRequiredError",
    message:"You must give a valid callback, to be notified of errors."
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
        if (!callback) throw CallbackRequiredError;

        var that = this;

        // Check if we've buffered that object already.
        if (this._objectCache[uuid]) {
            // TODO: Check for out of date and invalidate the cache.
            return callback(null, this._objectCache[uuid].object);
        }

        // Extract the JSON from the db.
        var db = this._getDb();
        db.getDoc(uuid, function(err, jsonData) {
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
            // object, so no need to call convertFromDb).
            return that._convertDbObject(jsonData, callback);
        });
    },

    /**
     * Notifies the data store that the given object has been changed.
     * The callback has the signature function(err). If no error is
     * given when the callback is called, then the save worked.
     */
    save: function(object, callback) {
        if (!callback) throw CallbackRequiredError;

        // The object must have an id to be saved.
        if (!object.id) {
            callback({
                name:"DataStoreSaveError",
                message:"To be saved, an object must have an id."
            });
        }

        var json;
        var cacheData = this._objectCache[object.id]
        var freeze = object.freeze;

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
        if (cacheData && cacheData.revision) {
            json._rev = cacheData.revision;
        }

        var that = this;
        this._getDb().saveDoc(object.id, json, function(err, result) {
            if (!err) {
                // Store the new revision, so we can write it again.
                that._cacheLoadedObject(object.id, result.rev, object);
            }
            callback(err);
        });
    },

    /**
     * Removes the given object from the database.
     */
    remove: function(uuid, callback) {
        if (!callback) throw CallbackRequiredError;

        var that = this;

        // We need the revision number in order to delete.
        var revision = null;

        var db = this._getDb();
        var cacheData = this._objectCache[uuid]
        if (!cacheData) {
            // We don't have a version of it, so do we force through
            // the delete?
            if (this._opts.forceOverwrite) {
                db.getDoc(uuid, function(err, data) {
                    if (err) return callback(err);
                    db.removeDoc(uuid, data._rev, callback);
                });
            } else {
                callback({
                    name:"DataStoreDeleteError",
                    message:"Can't delete unloaded object "+
                        "(without forceOverwrite)."
                });
            }
        } else {
            // We have a revision, try to use it.
            db.removeDoc(uuid, cacheData.revision, function(err) {
                if (err) {
                    if (err.rerror == "conflict" &&
                        that._opts.forceOverwrite) {
                        // Load the revision just so we can delete.
                        db.getDoc(uuid, function(err, data) {
                            if (err) return callback(err);
                            db.removeDoc(uuid, data._rev, callback);
                        });
                    } else {
                        callback(err);
                    }
                } else {
                    callback();
                }
            });

            delete this._objectCache[uuid];
        }
    },

    /**
     * Retrieve a list of objects that match the given query. See the
     * registerIndex method for details of these calls.
     */
    query: function(indexName, criteria, callback, opts) {
        if (!callback) throw CallbackRequiredError;

        var that = this;

        // We can pass in additional CouchDB query parameters in opts.
        query = {descending:false};
        opts = opts || {};
        for (var opt in opts) {
            query[opt] = opts[opt];
        }

        // Make sure the index has been sent to the DB.
        var index = this._indices[indexName];
        if (!index.registered) {
            return callback({
                name:"DataStoreQueryError",
                message:"Can't query an index until it has been created, "+
                    "call createIndices first."
            });
        }

        // We'll subtract from the count to see if any unused criteria remain.
        var criteriaCount = 0;
        for (var criterionName in criteria) {
            if (criteria.hasOwnProperty(criterionName)) {
                criteriaCount++;
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
                criteriaCount--;
            } else {
                // We have no more criteria matching our options.
                break;
            }
        }
        if (criteriaCount) {
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
        var db = this._getDb();
        db.view(
            this._opts.indexDd, indexName, query,
            function(err, result) {
                if (err) return callback(err);

                // Extract the results from the row data structures.
                var objects = [];
                result.rows.forEach(function(row) {
                    objects.push(row.value);
                });

                // Thaw and return them.
                that._convertDbArray(objects, callback);
            }
        );
    },


    // ----------------------------------------------------------------------
    // Functions for creating and initializing a data store.
    // ----------------------------------------------------------------------

    /**
     * Wipes and recreates the entire database and all the data within
     * it. This is used mainly for testing.
     */
    wipe: function(callback) {
        if (!callback) throw CallbackRequiredError;

        var db = this._getDb();
        db.exists(function(err, bool) {
            if (bool) {
                db.remove(function(err) {
                    if (err) return callback(err);
                    db.create(callback);
                });
            } else {
                db.create(callback);
            }
        });
        this._objectCache = {};
    },

    /**
     * Deletes the whole database, after use. This irreversibly
     * destroys all the data in the database.
     */
    destroy: function(callback) {
        if (!callback) throw CallbackRequiredError;

        this._getDb().remove(callback);
    },

    /**
     * Tells the data store that objects it finds with the given
     * typeId should be made into a ready-to-use object by the given
     * thaw function. The thaw function can perform arbitrary
     * transformations.
     */
    registerType: function(typeId, thawFn) {
        this._typeToThawFn[typeId] = thawFn;
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
     * {world:myWorld, player:bob.id}, or {world:myWorld} or even
     * {}, but not {player: bob.id}. You may need to specify multiple
     * indices to capture all combinations of search you want to
     * perform. Note also, that when querying you have to query for
     * the underlying JSON representation, and not the thawed objects.
     */
    registerIndex: function(indexName, required /*... optional+ ...*/) {
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
        var mapFn = "function(doc) { ";
        if (criteria) {
            mapFn += "if ("+criteria+") ";
        }
        mapFn += "emit(["+emit+"], doc); }";

        // Store it, until we get the call to create indices.
        this._indices[indexName] = {
            required: required,
            optional: optional,
            mapFnStr: mapFn,
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
    createIndices: function(callback) {
        if (!callback) throw CallbackRequiredError;

        var that = this;

        // Create the design document.
        var dd = {
            _id:"_design/"+this._opts.indexDd,
            views: {}
        };

        // Add in our views
        for (var indexName in this._indices) {
            var index = this._indices[indexName];
            dd.views[indexName] = {
                map: index.mapFnStr
            };
        };

        // Now we can't just push this DD to couch, because it might
        // conflict with one already there. We have to find the
        // revision of the current version before we can remove it.
        var db = this._getDb();
        db.getDoc(dd._id, function(err, oldDesignDoc) {
            // We're expecting a not found error (if the design
            // document isn't there already).
            if (err) {
                if (err.error != "not_found") {
                    return callback(err);
                }
            } else {
                // TODO: Check for identical DD and don't save.
                dd._rev = oldDesignDoc._rev;
            }

            db.saveDoc(dd._id, dd, function(err) {
                if (err) return callback(err);

                // We saved okay, so record that our indices are
                // registered (we use the dd.views to loop in case
                // more indices have been added to this._indices while
                // we waited for our callback).
                for (var indexName in dd.views) {
                    that._indices[indexName].registered = true;
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
     * - indexDd: The name of the Design Document to store our indices,
     *             default 'queryIndices'.
     *
     * - forceOverwrite: Forces the system to ignore MVCC tags in
     *   couch, and always overwrite or delete documents, even when we
     *   don't have their latest revisions.
     */
    create: function(databaseName, opts) {
        var myOpts = {
            port: 5984,
            host: "localhost",
            indexDd: "queryIndices",
            forceOverwrite: false
        };
        for (var opt in opts) {
            if (opts.hasOwnProperty(opt)) {
                myOpts[opt] = opts[opt];
            }
        }

        var obj = Object.create(DataStore);
        obj._databaseName = databaseName;
        obj._opts = myOpts;
        obj._objectCache = {};
        obj._typeToThawFn = {};
        obj._indices = {};

        return obj;
    },


    // ----------------------------------------------------------------------
    // Private functions for internal use.
    // ----------------------------------------------------------------------

    /**
     * Makes sure we have a valid client and returns the DB wrapper object.
     */
    _getDb: function() {
        if (!this._couchClient) {
            // Might storing this forever mean it gets lost and crashes?
            this._couchClient = couchdb.createClient(
                this._opts.port, this._opts.host
            );
        }
        return this._couchClient.db(this._databaseName);
    },

    /**
     * Given something retrieved from the database, this method
     * converts it into its equivalent data structure with thawed
     * elements. This method can cope with any type.
     */
    _convertFromDb: function(dbElement, callback) {
        if (!dbElement || !(typeof dbElement == 'object')) {
            // Non-objects get returned without change.
            callback(null, dbElement);
        } else if (dbElement.constructor == Array) {
            // Arrays get treated specially.
            this._convertDbArray(dbElement, callback);
        } else {
            // We have a general object.
            this._convertDbObject(dbElement, callback);
        }
    },

    /**
     * Given a document retrieved from the database, this method
     * converts it to a full thawed data structures.
     */
    _convertDbObject: function(dbObject, callback) {
        var that = this;

        var thawFn;
        if (dbObject.type) {
            // We were given a type, so we should have a thaw function.
            thawFn = this._typeToThawFn[dbObject.type];

            if (thawFn === null) {
                // Thaw functions can be null, to say "I'm expecting
                // things with such-and-such a type, but don't worry about
                // finding a thaw function."""
                thawFn = this._defaultThawHandler;
            } else if (!thawFn) {
                // We found a type, weren't told we could ignore
                // it, and don't have a way of handling it.
                return callback({
                    name:"LoadObjectError",
                    message:"Can't thaw type: '"+dbObject.type+"'."
                });
            }
        } else {
            // We don't have a type so we use the default thaw.
            thawFn = this._defaultThawHandler;
        }

        // Thaw the object with whatever function we found.
        return this._doThaw(thawFn, dbObject, callback);
    },

    /**
     * Given an array retrieved from the database, this method
     * converts it, and its contents, into full thawed data
     * structures.
     */
    _convertDbArray: function(dbArray, callback) {
        var that = this;

        // Take a copy of the array so we can delete items as we
        // process them. We reverse it so we can pop elements in
        // order.
        var arrayCopy = [];
        dbArray.forEach(function(element) {
            arrayCopy.push(element);
        });
        arrayCopy.reverse();

        // Recursively transform each element through the
        // convertFromDb method.
        var result = [];
        var doNext = function() {
            var next = arrayCopy.pop();
            if (next) {
                that._convertFromDb(next, function(err, object) {
                    if (err) return callback(err);
                    else {
                        result.push(object);
                        if (arrayCopy) doNext();
                    }
                });
            } else {
                callback(null, result);
            }
        };
        doNext();
    },

    /**
     * If a type doesn't have a thaw handler registered, this function
     * will do the job.
     */
    _defaultThawHandler: function(rawData, context) {
        var newObject = {};

        // Go through each field and notify the context that we want
        // to thaw it.
        for (var property in rawData) {
            if (rawData.hasOwnProperty(property)) {
                if (property == '_id' || property == '_rev') continue;
                context.thaw(newObject, property, rawData[property]);
            }
        }

        return newObject;
    },

    /**
     * Decodes the given json data into a full object.
     */
    _doThaw: function(thawFn, rawData, callback) {
        var that = this;

        // When thawing, our thaw function can specify properties it
        // thinks also need thawing, and those it needs replacing by
        // loaded content.
        var propertiesToThaw = [];
        var propertiesToLoad = {};
        var uuidsToLoad = [];

        var context = {
            // The thaw function can see who's trying to do the
            // thawing. This is not normally used.
            store: this,

            // A function that allows thaw routines to schedule the
            // loading and connecting further objects in the database.
            load: function(object, property, uuid) {
                var record = that._objectCache[uuid];

                if (record) {
                    // We've got the object already so triviall wire it
                    // up.
                    object[property] = record.object;
                } else {
                    // Store the wiring request for later.
                    if (propertiesToLoad[uuid]) {
                        propertiesToLoad[uuid].push([object, property]);
                    } else {
                        propertiesToLoad[uuid] = [[object, property]];
                        uuidsToLoad.push(uuid);
                    }
                }
            },

            // A function that allows thaw routines to work
            // recursively: having their data thawed in turn.
            thaw: function(object, property, rawValue) {
                propertiesToThaw.push([object, property, rawValue]);
            }
        };

        // Get the thaw routine to create us a new object.
        var thawedObject = thawFn(rawData, context);

        // Cache it now, so that our recursive algorithms below don't
        // try to load it again when it sees a reference to it.
        if (rawData._id && rawData._rev) {
            that._cacheLoadedObject(
                rawData._id, rawData._rev, thawedObject
            );
        }

        // The recursive method that can thaw into a property.
        var doNextThaw = function() {
            var nextProperty = propertiesToThaw.pop();
            // When we're done here, we're done for good.
            if (!nextProperty) return callback(null, thawedObject);

            var object = nextProperty[0];
            var property = nextProperty[1];
            var rawDatum = nextProperty[2];
            that._convertFromDb(rawDatum, function(err, converted) {
                if (err) return callback(err);
                object[property] = converted;
                doNextThaw();
            });
        };
        // The recursive method that loads the required uuids.
        var doNextUuid = function() {
            var nextUuid = uuidsToLoad.pop();
            // When we're done here, we go on to process the thaw
            // properties.
            if (!nextUuid) return doNextThaw();

            that.get(nextUuid, function(err, result) {
                if (err) return callback(err);

                // Process the writing for this uuid.
                var wirings = propertiesToLoad[nextUuid];
                for (var i = 0; i < wirings.length; i++) {
                    var spec = wirings[i];
                    var obj = spec[0];
                    var prop = spec[1];
                    obj[prop] = result;
                }

                // Recurse onto the remaining uuids.
                doNextUuid();
            });
        };
        // Start with the first uuid
        doNextUuid();
    },

    /**
     * Caches the given object in the data store, so that future
     * loads find it.
     */
    _cacheLoadedObject: function(uuid, revision, object) {
        this._objectCache[uuid] = {
            object: object,
            revision: revision,
            upToDate: timestamp()
        };
    }
};
