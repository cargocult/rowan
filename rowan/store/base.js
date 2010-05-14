var sys = require('sys');

/**
 * The basic interface for object stores.
 *
 * All methods take a final callback argument. The callback argument
 * is always function(err, result), where the type and meaning of
 * `result` depends on the method.
 *
 * Objects in the store must be JSON-serializable elements. They
 * should not have associated functions or constructor detail, this
 * may be lost or mangled.
 *
 * Each object should have a globally unique id value, this is the
 * 'primary key' for the object. It need not be a property of the
 * object itself, but it is the primary mechanism for lookup. It may
 * be any string.
 *
 * In addition, the object store maintains a list of additional routes
 * to query data called 'indices'. These are in two categories:
 * indices and sets.
 *
 * - Keys are, like the UUID, a unique mapping from some property
 *   value to an object. If you query the object store with this value
 *   then you get zero or one object's back.
 *
 * - Sets are a non-unique mapping from some property value to a set
 *   of objects.
 *
 * All indices consist of a name (the unique name of that index -
 * unique among both sets and indices), and a property, which is the
 * property of the object that is used to query.
 */
function ObjectStore() {
};

/**
 * Sets the new given object in the database. To update an item in
 * the dabase, use `update`. The opts dictionary may contain the
 * given options:
 *
 * - `keys` A dictionary that maps unique index names to the
 *   property of the object that should be used for querying. See
 *   the documentation for `ObjectStore` for more details on indexes.
 *
 * - `sets` A dictionary that maps unique index names to the
 *   property of the object that should be used for querying. See
 *   the documentation for more details on indexes.
 */
ObjectStore.prototype.set = function(uuid, object, opts, callback) {
    var self = this;

    // First see if the key is already in the store.
    this._get(uuid, function(err, data) {
        if (data) {
            callback(
                new Error("Can't set an existing uuid: update it instead.")
            );
        } else {
            opts = opts || {};

            // Create the wrapped object we will actually store.
            var obj_store = {
                object: object,

                // Mappings from the index name to the *value* we indexed
                // by - we don't need to track the property we got that
                // from.
                keys: {},
                sets: {}
            };

            // Set the things we want to index by.
            var changes = [];
            var _process_index = function(index_type, add_function) {
                for (var index in opts[index_type]) {
                    var property = opts[index_type][index];
                    var value = object[property];
                    obj_store[index_type][index] = value;
                    changes.push([add_function, uuid, index, value]);
                }
            };
            _process_index('keys', self._set_key);
            _process_index('sets', self._add_to_set);

            // Go through and add these indices
            self._process_changes(changes, function(err) {
                if (err) return callback(err);
                else {
                    // Save the object last.
                    self._set(uuid, JSON.stringify(obj_store), callback);
                }
            });
        }
    });
},

/**
 * Retrieves the object with the given uuid from the store.
 */
ObjectStore.prototype.get = function(uuid, callback) {
    // Get the object store
    this._get(uuid, function(err, raw_data) {
        if (err) return callback(err);
        else if (raw_data) {
            // Pull out the object and return it via the callback.
            var object_store = JSON.parse(raw_data);
            callback(null, object_store.object);
        } else {
            callback(null, null);
        }
    });
},

/**
 * Updates the given object in the database with the given id. The
 * options dictionary contains the same options as for the `set`
 * method.
 *
 * The options are usually the same from a `set`ting an object to
 * a following `update`. But this isn't required.
 */
ObjectStore.prototype.update = function(uuid, object, opts, callback) {
    var self = this;

    // First we get the current version of the object.
    this._get(uuid, function(err, raw_data) {
        if (err) return callback(err);

        opts = opts || {};

        // Find the original object.
        var object_store = JSON.parse(raw_data);
        var old_object = object_store.object;

        // Accumulate the changes we need.
        var changes = [];
        var _process_index = function(index_type, add_function) {
            // Go through the new keys and check if any have changed.
            for (var index in opts[index_type]) {
                var old_value = object_store[index_type][index];
                if (old_value) {
                    if (old_value == new_value) continue;

                    // Remove the old index
                    changes.push([self._rm_index, uuid, index, old_value]);
                }

                // Add the current index value.
                var new_property = opts[index_type][index];
                var new_value = object[new_property];

                changes.push([add_function, uuid, index, new_value]);
                object_store[index_type][index] = new_value;
            }
            // Go through the old indices and see if there's any to
            // delete.
            for (var index in object_store[index_type]) {
                // Check if we've already considered this one.
                if (!opts[index_type][index]) {
                    // Delete the old index.
                    var old_value = object_store[index_type][index];
                    changes.push([self._rm_index, uuid, index, old_value]);
                    delete object_store[index_type][index];
                }
            }
        };
        _process_index('keys', self._set_key);
        _process_index('sets', self._add_to_set);

        // Now act on the changes.
        self._process_changes(changes, function(err) {
            if (err) return callback(err);
            else {
                // Save the object last.
                self._set(uuid, JSON.stringify(object_store), callback);
            }
        });
    });
},

/**
 * Deletes the object associated with the given uuid in the database.
 */
ObjectStore.prototype.remove = function(uuid, callback) {
    throw new Error("Base ObjectStore doesn't have implementations.");
},

/**
 * Deletes everything in the data store.
 */
ObjectStore.prototype.empty = function(callback) {
    throw new Error("Base ObjectStore doesn't have implementations.");
},

// Index specific methods.

/**
 * Returns a list of uuids for objects that match the given index. If
 * the index is a key, this method still returns a list.
 */
ObjectStore.prototype.query_uuids = function(index, value, callback) {
    throw new Error("Base ObjectStore doesn't have implementations.");
},

/**
 * Returns a list of objects that match the given index. If the index
 * is a key, this method still returns a list.
 */
ObjectStore.prototype.query = function(index, value, callback) {
    var self = this;

    // First get the query as a set of uuids.
    this.query_uuids(index, value, function(err, uuids) {
        if (err) return callback(err);

        // Recursively turn the list of uuids into a list of objects.
        var results = [];
        var _pull_result = function(err, object) {
            if (err) return callback(err);

            if (object) results.push(object);
            var next_uuid = uuids.pop();
            if (next_uuid) {
                // Recurse.
                self.get(next_uuid, _pull_result);
            } else {
                // We've got the full list, return it.
                return callback.call(self, null, results);
            }
        };
        _pull_result();
    });
},

// -----------------------------------------------------------------------
// Internal methods to be implemented in specific store types.

/**
 * Sets the raw content for a given uuid.
 */
ObjectStore.prototype._set = function(uuid, content, callback) {
    throw new Error("Base ObjectStore doesn't have implementations.");
}

/**
 * Gets the raw content for a given uuid.
 */
ObjectStore.prototype._get = function(uuid, callback) {
    throw new Error("Base ObjectStore doesn't have implementations.");
}

/**
 * Sets the object with the gives uuid to the given key index.
 */
ObjectStore.prototype._set_key = function(uuid, index, value, callback) {
    throw new Error("Base ObjectStore doesn't have implementations.");
},

/**
 * Adds the object with the given uuid to the given set index.
 */
ObjectStore.prototype._add_to_set = function(uuid, index, value, callback) {
    throw new Error("Base ObjectStore doesn't have implementations.");
},

/**
 * Removes the given object from the given index.
 */
ObjectStore.prototype._rm_index = function(uuid, index, value, callback) {
    throw new Error("Base ObjectStore doesn't have implementations.");
},

// -----------------------------------------------------------------------
// Other internal methods

/**
 * A utility function that takes a list of function calls and
 * makes them in series.
 */
ObjectStore.prototype._process_changes = function(changes, callback) {
    if (!changes) callback.call(self, null);

    var self = this;
    var _make_next_change = function(err, result) {
        if (err) return callback.call(self, err);

        var change = changes.pop();
        if (change) {
            var args = change.slice(1).concat([_make_next_change]);
            change[0].apply(self, args);
        } else {
            // We're done, callback with no error.
            callback.call(self, null);
        }
    };
    if (changes) _make_next_change.call(self, null);
}

exports.ObjectStore = ObjectStore;

