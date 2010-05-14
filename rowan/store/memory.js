/**
 * A version of the object-store that keeps data in memory in Javascript
 * dictionaries. This version is simple in that it has no external
 * dependencies, but is also not optimized in any way.
 */
var sys = require('sys');
var base = require('./base');

/**
 * An implementation of the object store that stores its data in an
 * in-memory object. This is obviously not suitable for any kind of
 * persistence or error-handling, but can be useful for testing with
 * minimal dependencies and for some applications with inherently
 * volatile or low-value data.
 */
function InMemoryStore() {
    base.ObjectStore.call(this)
    // Store data in a regular dictionary.
    this.data = {};
};
sys.inherits(InMemoryStore, base.ObjectStore);

/* Generates index names for lookup in the same data dictionary. */
var create_index = function(index, value) {
    return "index:"+escape(index)+":"+escape(value);
};

// See the base.js file for detailed documentation on these methods.
InMemoryStore.prototype.remove = function(uuid, callback) {
    delete this.data[escape(uuid)];
    callback(null);
};
InMemoryStore.prototype.empty = function(callback) {
    this.data = {};
    callback(null);
};
InMemoryStore.prototype.query_uuids = function(index, value, callback) {
    var result = this.data[create_index(index, value)];
    if (result && result.split) {
        // Strings represent keys, they have one item only.
        callback(null, [result]);
    } else if (result) {
        // Objects are sets, their ids are their keys.
        callback(null, Object.keys(result));
    } else {
        //If we can't find the index, return the empty list.
        callback(null, []);
    }
};

InMemoryStore.prototype._set = function(uuid, raw_content, callback) {
    this.data[escape(uuid)] = raw_content;
    callback(null);
};
InMemoryStore.prototype._get = function(uuid, callback) {
    callback(null, this.data[escape(uuid)]);
};
InMemoryStore.prototype._set_key = function(uuid, index, value, callback) {
    var index = create_index(index, value);
    if (this.data[index]) {
        return callback(new Error("Can't set a currently set key."));
    }
    this.data[index] = uuid;
    callback(null);
};
InMemoryStore.prototype._add_to_set = function(uuid, index, value, callback) {
    var index = create_index(index, value);
    if (!this.data[index]) {
        this.data[index] = {};
    }
    this.data[index][uuid] = true;
    callback(null);
};
InMemoryStore.prototype._rm_index = function(uuid, index, value, callback) {
    var index = create_index(index, value);
    var entry = this.data[index];
    if (entry && entry.split) {
        // We have a regular key, delete it.
        delete this.data[index];
    } else if (entry) {
        // We have an object, remove the entry.
        delete entry[uuid];
    } else {
        // We have nothing.
        return callback(new Error("Can't delete a non-existent index."));
    }
    return callback(null);
};

exports.ObjectStore = InMemoryStore;

