/**
 * This module holds Rowan's in-built testing harness, for performing
 * unit-tests.
 */
var sys = require("sys");
var event = require("events");

// Simple function for english plurals, only used in this file.
var plural = function(number, text, plural_form) {
    if (number == 1) return "1 "+text;
    else if (!plural_form) return number+" "+text+"s";
    else return number+" "+plural_form;
};

/**
 * A convenience subclass that avoids us needing to define the error
 * name on each use.
 */
var TestError = function(message) {
    Error.call(this, message || "");
    this.name = "TestError";
}
sys.inherits(TestError, Error);

/**
 * The test suite manages the execution of a series of tests. The
 * tests given should be a list of objects, each object should have
 * the form:
 *
 *     {test_function: function(context) { ... },
 *      name: "human readable string",
 *      self:..., args:[..]}
 *
 * Where the args and self property are optional. If provided, the
 * arguments will be *appended* to the end of the argument list of the
 * test. Test functions should expect the test context as their first
 * argument.
 *
 * The following options are available:
 *
 * output: If false, then the default reporting is disabled for this
 *     suite. You can set it to "quiet" for only final totals,
 *     "normal" for regular, terse, output, or "verbose" for full
 *     output.
 *
 * bash_colors: If true, then any output will be displayed with
 *     colors. This may not work if your shell doesn't use
 *     bash-compatible color escape codes.
 *
 * handle_errors: Normally if an error is thrown during testing, the
 *     test framework copes and treats it as an error event. This can
 *     hide the stacktrace. If this is false then the error is allowed
 *     to propagate normally.
 *
 * The test suite emits the following events:
 *
 * start: Emitted when the testing process starts with 1 argument
 *     which is the test suite.
 *
 * test: Emitted when a new test is started. The event has 2
 *     arguments which are the test definition and the rest suite.
 *
 * pass: Emitted when a test passes with 2 arguments which are the
 *     test definition and the test suite.
 *
 * fail: Emitted when a test fails explicitly. The event has 2
 *     arguments which are the test definition and the rest suite.
 *
 * err: Emitted when a test fails with an error. The event has 2
 *     arguments which are the test definition and the rest suite.
 *
 * complete: Emitted when the testing process is complete with 1
 *     argument which is the test suite.
 */
function TestSuite(tests_to_run, opts) {
    event.EventEmitter.call(this);

    // Override default options with specified options.
    this.opts = {
        output: "normal",
        bash_colors: true,
        handle_errors: true
    };
    for (var opt in opts) this.opts[opt] = opts[opt];

    // Configure starting data.
    this.has_run = false;
    this.tests_to_run = [];
    if (tests_to_run) this.add_tests(tests_to_run);

    // Set up for color, if we need it
    var RED="", NO_COLOR="", GREEN="";
    if (this.opts.bash_colors) {
        GREEN = "\u001b[32m";
        RED = "\u001b[31m";
        NO_COLOR = "\u001b[0m";
    }

    // Configure listeners, if we need them.
    if (this.opts.output) {

        if (this.opts.output != "quiet") {
            this.addListener("pass", function(test_defn, suite) {
                if (this.opts.output == "verbose") {
                    sys.puts(GREEN+"Passed: "+test_defn.name+NO_COLOR);
                } else {
                    sys.print(GREEN+"."+NO_COLOR);
                }
            });
            this.addListener("fail", function(test_defn, suite) {
                if (this.opts.output == "verbose") {
                    sys.puts(RED+"FAILED: "+test_defn.name+NO_COLOR);
                    sys.puts(" - "+test_defn.fail_message.toString());
                } else {
                    sys.print(RED+"X"+NO_COLOR);
                }
            });
            this.addListener("err", function(test_defn, suite) {
                if (this.opts.output == "verbose") {
                    sys.puts(RED+"ERROR: "+test_defn.name+NO_COLOR);
                    sys.puts(" - "+test_defn.error.toString());
                } else {
                    sys.print(RED+"E"+NO_COLOR);
                }
            });
        }
        if (this.opts.output == "verbose") {
            this.addListener("start", function(suite) {
                sys.puts("Beginning tests.");
            });
            this.addListener("test", function(test_defn, suite) {
                sys.puts("Beginning test: "+test_defn.name);
            });
        }
        this.addListener("complete", function(suite) {
            if (this.opts.output != "quiet") {
                sys.print("\n");

                if (this.opts.output == "normal") {
                    // Output the errors and failures now, we didn't
                    // as we went along.
                    for (var i = 0; i < suite.tests_to_run.length; ++i) {
                        var test_defn = suite.tests_to_run[i];
                        switch (test_defn.result) {
                        case 'fail':
                            sys.puts(RED+"FAILED: "+test_defn.name+NO_COLOR);
                            sys.puts(" - "+test_defn.fail_message.toString());
                            break;
                        case 'error':
                            sys.puts(RED+"ERROR: "+test_defn.name+NO_COLOR);
                            sys.puts(" - "+test_defn.error.toString());
                            break;
                        }
                    }
                }

                sys.puts("==========");
                if (suite.failures > 0 || suite.errors > 0) {
                    sys.print(RED+"FAILED");
                } else {
                    sys.print(GREEN+"Passed");
                }
                sys.print(NO_COLOR+": ");
            }
            var results = [GREEN+plural(suite.passes, "pass", "passes")];
            if (suite.failures > 0) {
                results.push(RED+plural(suite.failures, "failure"));
            }
            if (suite.errors > 0) {
                results.push(RED+plural(suite.errors, "error"));
            }
            sys.puts(results.join(", ")+"."+NO_COLOR+"\n");
        });
    }
};
sys.inherits(TestSuite, event.EventEmitter);

/**
 * Adds any number of additional tests to this suite. The tests given
 * should be in the same form as those given to the constructor.
 */
TestSuite.prototype.add_tests = function(tests_to_run) {
    if (this.has_run) {
        throw new TestError("Can't add tests after they've been run.");
    }
    for (var i = 0; i < tests_to_run.length; i++) {
        var test_defn = tests_to_run[i];

        // Make a copy of the test definition so we can store some
        // local data in it.
        var my_defn = {};
        for (var key in test_defn) {
            my_defn[key] = test_defn[key];
        }

        // Store it for later running.
        this.tests_to_run.push(my_defn);
    }
};

/**
 * Adds another test suite to this one. The options and event
 * listeners of the given test suite will be ignored.
 */
TestSuite.prototype.add_suite = function(other_suite) {
    if (this.has_run) {
        throw new TestError("Can't add tests after they've been run.");
    }
    this.add_tests(other_suite.tests_to_run);
}

/**
 * Begins running the tests asynchronously.
 */
TestSuite.prototype.run = function() {
    this.passes = 0;
    this.failures = 0;
    this.errors = 0;

    this.running = 0;
    this.started = 0;

    this.emit("start", this);
    for (var i = 0; i < this.tests_to_run.length; i++) {
        var test_defn = this.tests_to_run[i];

        // Build the argument list for the test.
        var context = new TestContext(test_defn, this);
        var args = [context];
        if (test_defn.args) {
            args = args.concat(test_defn.args);
        }

        // Create the "this" pointer.
        var self = test_defn.self;
        if (self === undefined) { // Only undefined, so user can specify null.
            self = context;
        }

        // Run the test
        ++this.running;
        ++this.started;
        test_defn.running = true;

        this.emit("test", test_defn, this);

        if (this.opts.handle_errors) {
            try {
                test_defn.test_function.apply(self, args);
            } catch (err) {
                if (test_defn.running) {
                    context.error(err);
                }
            }
        } else {
            test_defn.test_function.apply(self, args);
        }
    }
};

/**
 * Returns true if all the tests have run to completion.
 */
TestSuite.prototype.is_complete = function() {
    return this.running == 0 && this.started == this.tests_to_run.length;
};

/* Finishes up the test process after all tests are complete. */
TestSuite.prototype._finish = function() {
    this.emit("complete", this);
}

/* Called by the context to tell the suite that test has passed or
 * failed. These should not need to be called manually. Use the
 * context's `passed` or `failed` methods instead.
 */
TestSuite.prototype._passed = function(context) {
    ++this.passes;
    --this.running;
    context.test_defn.result = 'pass';
    context.test_defn.running = false;
    this.emit("pass", context.test_defn, this);
    if (this.is_complete()) this._finish();
};
TestSuite.prototype._failed = function(context) {
    ++this.failures;
    --this.running;
    context.test_defn.result = 'fail';
    context.test_defn.running = false;
    this.emit("fail", context.test_defn, this);
    if (this.is_complete()) this._finish();
};
TestSuite.prototype._error = function(context) {
    ++this.errors;
    --this.running;
    context.test_defn.result = 'error';
    context.test_defn.running = false;
    this.emit("err", context.test_defn, this);
    if (this.is_complete()) this._finish();
};


/**
 * A test context allows a test to notify the system that it is
 * complete, or that some problem has occurred. It should not be
 * constructed manually.
 */
function TestContext(test_defn, test_suite) {
    this.test_defn = test_defn;
    this.suite = test_suite;
};
/**
 * Call this function if your test function is complete and passed.
 */
TestContext.prototype.passed = function() {
    if (!this.test_defn.running) {
        throw new TestError("Test context has already been given a result.");
    }
    this.suite._passed(this);
};
/**
 * Call this function if your test function is complete but failed.
 */
TestContext.prototype.failed = function(fail_message) {
    if (!this.test_defn.running) {
        throw new TestError("Test context has already been given a result.");
    }
    this.test_defn.fail_message = fail_message;
    this.suite._failed(this);
};
/**
 * Call this function if your test function crashes.
 */
TestContext.prototype.error = function(error) {
    if (!this.suite.opts.handle_errors) {
        throw error;
    }
    if (!this.test_defn.running) {
        throw new TestError("Test context has already been given a result.");
    }
    this.test_defn.error = error;
    this.suite._error(this);
};

/**
 * Extracts all the tests in the given module and returns a test
 * suite containing them.
 */
var getModuleTests = function(mod, opts) {
    // Accumualate the tests in the module.
    var tests_to_run = [];
    var export_names = Object.keys(mod);
    for (var i = 0; i < export_names.length; i++) {
        var export_name = export_names[i];
        if (export_name.substr(0, 4) == "test") {
            var definition = {};
            definition.name = export_name + " in " + mod.name;
            definition.test_function = mod[export_name];
            tests_to_run.push(definition);
        }
    }

    return new TestSuite(tests_to_run, opts);
};

exports.getModuleTests = getModuleTests;
exports.TestError = TestError;
exports.TestSuite = TestSuite;