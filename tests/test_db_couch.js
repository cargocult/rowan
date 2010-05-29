/**
 * Tests for testing the in memory object store.
 */
var rowan = require("rowan");
var DataStore = rowan.db.couch.DataStore;

var sys = require('sys');

/**
 * A sequence wrapper that creates a database initially and can report
 * an error to the given test_runner. This sequence will clean up after
 * itself on failure, so don't use this.abort() with this.
 */
var test_sequence = function(test_runner) {
    return rowan.utils.sequence.create_wrapped_sequence(
        [
            function() {
                rowan.utils.uuid.createUUID(this);
            },
            function(err, uuid) {
                if (err) {
                    test_runner.error(err);
                    return this.abort();
                }
                this.store = DataStore.create('test-'+uuid);
                this.store.wipe(this);
            }
        ],
        [
            function(err) {
                if (err) {
                    test_runner.error(err);
                } else {
                    test_runner.passed(err);
                }
                return true;
            }
        ],
        {
            finally_do: function(err) {
                if (this.store) {
                    this.store.destroy(this);
                }
            }
        }
    );
};

// Build a list of tests.
var tests = {name:__filename};

// Smoke test for just creating a database.
tests.testCreateStore = function(test_runner) {
    test_sequence(test_runner)();
};

// Test the simplest single data call.
tests.testSetObject = function(test_runner) {
    test_sequence(test_runner)(
        function(err) {
            if (err) throw err;
            this.store.save({id:"object-a", foo:1, bar:[1,2,3]}, this);
        }
    );
};

// Objects should be retrievable.
tests.testGetObject = function(test_runner) {
    test_sequence(test_runner)(
        function(err) {
            if (err) throw err;
            this.store.save({id:"object-b", foo:1, bar:[1,2,3]}, this);
        },
        function(err) {
            if (err) throw err;
            this.store.get("object-b", this);
        },
        function(err, data) {
            if (err) throw err;

            if (!data) {
                test_runner.failed("No data returned.");
                return this.abort();
            }
            if (data.foo != 1 || data.bar[0] != 1 || data.bar.length != 3) {
                test_runner.failed("Incorrect data returned.");
                return this.abort();
            }
            return true;
        }
    );
};

// Replace an old version with a new version.
tests.testUpdate = function(test_runner) {
    test_sequence(test_runner)(
        function(err) {
            if (err) throw err;
            this.store.save({id:"object-c", foo:1, bar:[1,2,3]}, this);
        },
        function(err) {
            if (err) throw err;
            this.store.save({id:"object-c", foo:2, dock:2}, this);
        },
        function(err) {
            if (err) throw err;
            this.store.get("object-c", this);
        },
        function(err, data) {
            if (err) throw err;

            if (!data) {
                test_runner.failed("No data returned.");
                return this.abort();
            }
            if (data.foo != 2 && !data.bar && data.dock == 2) {
                test_runner.failed("Incorrect data returned.");
                return this.abort();
            }
            return true;
        }
    );
};


// Removing an object really removes it.
tests.testRemove = function(test_runner) {
    test_sequence(test_runner)(
        function(err) {
            if (err) throw err;
            this.store.save({id:"object-d", foo:1, bar:[1,2,3]}, this);
        },
        function(err) {
            if (err) throw err;
            this.store.remove("object-d", this);
        },
        function(err) {
            if (err) throw err;
            this.store.get("object-d", this);
        },
        function(err, data) {
            if (!err || err.name != "NotInDatabaseError") {
                test_runner.failed("Found data after delete.");
                return this.abort();
            }
            return true;
        }
    );
};

// Wiping removes everything
tests.testEmpty = function(test_runner) {
    test_sequence(test_runner)(
        function(err) {
            if (err) throw err;
            this.store.save({id:"object-e", foo:1, bar:[1,2,3]}, this);
        },
        function(err) {
            if (err) throw err;
            this.store.wipe(this);
        },
        function(err) {
            if (err) throw err;
            this.store.get("object-e", this);
        },
        function(err, data) {
            if (!err || err.name != "NotInDatabaseError") {
                test_runner.failed("Found data after wipe.");
                return this.abort();
            }
            return true;
        }
    );
};

// All object store methods should be run with a callback, even those
// without a return value (in case of error).
tests.testMustHaveCallback = function(test_runner) {
    test_sequence(test_runner)(
        function(err) {
            if (err) throw err;
            this.store.save({id:"object-e", foo:1, bar:[1,2,3]}, null);
            return true;
        },
        function(err) {
            if (!err || err.name != "CallbackRequiredError") {
                test_runner.failed(
                    "Expecting an error when callback is missing."
                );
                return this.abort();
            }
            return true;
        }
    );
};


// ---------------------------------------------------------------------------
exports.getTests = function() {
    return rowan.utils.test.getModuleTests(tests);
};
