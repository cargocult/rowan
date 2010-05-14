/**
 * Tests for testing the in memory object store.
 */
var test = require("rowan/core/test");
var store = require("rowan/store/memory");
var sys = require('sys');

// Build a list of tests.
var tests = {name:"test_store_memory.js"};

tests.testCreateStore = function(context) {
    // Smoke-test creating a store.
    var s = new store.ObjectStore();
    return context.passed();
};

tests.testSetObject = function(context) {
    var s = new store.ObjectStore();
    s.set("object-1", {foo:1, bar:[1,2,3]}, null, function(err) {
        if (err) return context.error(err);
        context.passed();
    });
};

// Objects should be retrievable.
tests.testGetObject = function(context) {
    var s = new store.ObjectStore();
    s.set("object-1", {foo:1, bar:[1,2,3]}, null, function(err) {
        if (err) return context.error(err);

        s.get("object-1", function(err, data) {
            if (err) return context.error(err);

            if (!data) return context.failed("No data returned.");
            if (data.foo != 1 && data.bar[0] == 1 &&
                data.bar.length == 3) {
                return context.failed("Incorrect data returned.");
            }
            context.passed();
        });
    });
};

// Set only works when the object doesn't exist, other wise use update.
tests.testCantSetAgain = function(context) {
    var s = new store.ObjectStore();
    s.set("object-1", {foo:1, bar:[1,2,3]}, null, function(err) {
        if (err) return context.error(err);

        s.set("object-1", {sun:1, dock:2}, null, function(err, data) {
            if (err) return context.passed();

            context.failed("Should raise an error when setting again.");
        });
    });
};

// Updating replaces the old object with a new object.
tests.testUpdate = function(context) {
    var s = new store.ObjectStore();
    s.set("object-1", {foo:1, bar:[1,2,3]}, null, function(err) {
        if (err) return context.error(err);

        s.update("object-1", {foo:2, dock:2}, null, function(err, data) {
            if (err) return context.error(err);

            s.get("object-1", function(err, data) {
                if (err) return context.error(err);

                if (!data) return context.failed("No data returned.");
                if (data.foo != 2 && !data.bar && data.dock == 2) {
                    return context.failed("Incorrect data returned.");
                }
                context.passed();
            });
        });
    });
};

// Accessing a removed object returns null.
tests.testRemove = function(context) {
    var s = new store.ObjectStore();
    s.set("object-1", {foo:1, bar:[1,2,3]}, null, function(err) {
        if (err) return context.error(err);

        s.remove("object-1", function(err, data) {
            if (err) return context.error(err);

            s.get("object-1", function(err, data) {
                if (err) return context.error(err);

                if (data !== null) {
                    return context.failed("Data should be deleted.");
                }
                context.passed();
            });
        });
    });
};

// Emptying removes everything
tests.testEmpty = function(context) {
    var s = new store.ObjectStore();
    s.set("object-1", {foo:1}, null, function(err) {
        if (err) return context.error(err);

        s.set("object-2", {foo:2}, null, function(err) {
            if (err) return context.error(err);

            s.empty(function(err, data) {
                if (err) return context.error(err);

                s.get("object-1", function(err, data) {
                    if (err) return context.error(err);

                    if (data !== null) {
                        return context.failed("Data should be deleted.");
                    }
                    context.passed();
                });
            });
        });
    });
};

// All object store methods should be run with a callback, even those without
// a return value (in case of error).
tests.testMustHaveCallback = function(context) {
    var s = new store.ObjectStore();
    try {
        s.set("object-1", {foo:1, bar:[1,2,3]}, null, null);
    } catch(err) {
        return context.passed();
    }
    context.failed("Should raise an error if a callback isn't given.");
};

// The key index should be settable.
tests.testSetIndex = function(context) {
    var s = new store.ObjectStore();
    s.set("object-1", {foo:12938}, {keys:{key1:'foo'}}, function(err) {
        if (err) return context.error(err);
        context.passed();
    });
};

// We should be able to query the uuids matching the given key index.
tests.testQueryIndexUUIDs = function(context) {
    var s = new store.ObjectStore();
    s.set("object-1", {foo:12938}, {keys:{key1:'foo'}}, function(err) {
        if (err) return context.error(err);

        s.query_uuids('key1', 12938, function(err, uuids) {
            if (err) return context.error(err);

            if (!uuids) {
                return context.failed("Should return data.");
            } else if (uuids.length != 1) {
                return context.failed(
                    "Should have one result, has "+uuids.length+"."
                );
            }
            context.passed();
        });
    });
};

// When an indexed value changes, the old one should be deleted.
tests.testUpdateIndexNewValue = function(context) {
    var s = new store.ObjectStore();
    s.set("object-1", {foo:12938}, {keys:{key1:'foo'}}, function(err) {
        if (err) return context.error(err);

        s.update("object-1", {foo:12238}, {keys:{key1:'foo'}}, function(err) {
            if (err) return context.error(err);

            s.query_uuids('key1', 12938, function(err, uuids) {
                if (err) return context.error(err);

                // Check if the old one has gone.
                if (!uuids) {
                    return context.failed("Should return data.");
                } else if (uuids.length != 0) {
                    return context.failed(
                        "Should have no results, has "+uuids.length+"."
                    );
                }

                s.query_uuids('key1', 12238, function(err, uuids) {
                    if (err) return context.error(err);

                    // Check if the new one is there.
                    if (!uuids) {
                        return context.failed("Should return data.");
                    } else if (uuids.length != 1) {
                        return context.failed(
                            "Should have 1 result, has "+uuids.length+"."
                        );
                    }
                    context.passed();
                });
            });
        });
    });
};

// When an index request changes, the old one should be deleted.
tests.testUpdateIndexNewKey = function(context) {
    var s = new store.ObjectStore();
    s.set("object-1", {foo:12938}, {keys:{key1:'foo'}}, function(err) {
        if (err) return context.error(err);

        s.update("object-1", {foo:12938}, {keys:{key2:'foo'}}, function(err) {
            if (err) return context.error(err);

            s.query_uuids('key1', 12938, function(err, uuids) {
                if (err) return context.error(err);

                // Check if the old one has gone.
                if (!uuids) {
                    return context.failed("Should return data.");
                } else if (uuids.length != 0) {
                    return context.failed(
                        "Should have no results, has "+uuids.length+"."
                    );
                }

                s.query_uuids('key2', 12938, function(err, uuids) {
                    if (err) return context.error(err);

                    // Check if the new one is there.
                    if (!uuids) {
                        return context.failed("Should return data.");
                    } else if (uuids.length != 1) {
                        return context.failed(
                            "Should have 1 result, has "+uuids.length+"."
                        );
                    }
                    context.passed();
                });
            });
        });
    });
};

// We can index more than one thing in a set.
tests.testSetsStoreMultiple = function(context) {
    var s = new store.ObjectStore();

    var indices = {sets:{group:'group'}};

    s.set("object-1", {group:12938}, indices, function(err) {
        if (err) return context.error(err);

        s.set("object-2", {group:12938}, indices, function(err) {
            if (err) return context.error(err);

            s.query_uuids('group', 12938, function(err, uuids) {
                if (err) return context.error(err);

                if (!uuids) {
                    return context.failed("Should return data.");
                } else if (uuids.length != 2) {
                    return context.failed(
                        "Should have 2 results, has "+uuids.length+"."
                    );
                }
                context.passed();
            });
        });
    });
};

// We should be able to change the index for sets as well as keys.
tests.testUpdateIndexNewSet = function(context) {
    var s = new store.ObjectStore();
    s.set("object-1", {foo:12938}, {sets:{set1:'foo'}}, function(err) {
        if (err) return context.error(err);

        s.update("object-1", {foo:12938}, {sets:{set2:'foo'}}, function(err) {
            if (err) return context.error(err);

            s.query_uuids('set1', 12938, function(err, uuids) {
                if (err) return context.error(err);

                // Check if the old one has gone.
                if (!uuids) {
                    return context.failed("Should return data.");
                } else if (uuids.length != 0) {
                    return context.failed(
                        "Should have no results, has "+uuids.length+"."
                    );
                }

                s.query_uuids('set2', 12938, function(err, uuids) {
                    if (err) return context.error(err);

                    // Check if the new one is there.
                    if (!uuids) {
                        return context.failed("Should return data.");
                    } else if (uuids.length != 1) {
                        return context.failed(
                            "Should have 1 result, has "+uuids.length+"."
                        );
                    }
                    context.passed();
                });
            });
        });
    });
};

tests.testCantReuseIndex = function(context) {
    var s = new store.ObjectStore();

    var indices = {keys:{key1:'foo'}};

    s.set("object-1", {foo:12938}, indices, function(err) {
        if (err) return context.error(err);

        s.set("object-2", {foo:12938}, indices, function(err) {
            if (err) return context.passed();
            else {
                return context.failed(
                    "Should raise an error with a clashing key index."
                );
            }
        });
    });
};

// A key query should return just one result.
tests.testQueryByKey = function(context) {
    var s = new store.ObjectStore();

    var indices = {keys:{key1:'foo'}};

    s.set("object-1", {foo:12938, id:1}, indices, function(err) {
        if (err) return context.error(err);

        s.set("object-2", {foo:12238, id:2}, indices, function(err) {
            if (err) return context.error(err);

            s.query('key1', 12938, function(err, results) {
                if (err) return context.error(err);

                // Check if the new one is there.
                if (!results) {
                    return context.failed("Should return a list of objects.");
                } else if (results.length != 1) {
                    return context.failed(
                        "Should have 1 result, has "+results.length+"."
                    );
                } else {
                    var object = results[0];
                    if (!object.id || object.id != 1) {
                        sys.puts(JSON.stringify(object));
                        return context.failed("Incorrect object returned.");
                    }
                }
                context.passed();
            });
        });
    });
};

// A set query may return any number of results.
tests.testQueryBySet = function(context) {
    var s = new store.ObjectStore();

    var indices = {sets:{group:'group'}};

    s.set("object-1", {group:12938, id:1}, indices, function(err) {
        if (err) return context.error(err);

        s.set("object-2", {group:12938, id:2}, indices, function(err) {
            if (err) return context.error(err);

            s.query('group', 12938, function(err, results) {
                if (err) return context.error(err);

                // Check if the new one is there.
                if (!results) {
                    return context.failed("Should return a list of objects.");
                } else if (results.length != 2) {
                    return context.failed(
                        "Should have 2 results, has "+results.length+"."
                    );
                }
                context.passed();
            });
        });
    });
};


// ---------------------------------------------------------------------------
exports.getTests = function() {
    return test.getModuleTests(tests);
};
