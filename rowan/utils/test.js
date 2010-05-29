/**
 * This module holds Rowan's in-built testing harness, for performing
 * unit-tests.
 */
var sys = require("sys");
var event = require("events");

// Simple function for english plurals, only used in this file.
var plural = function(number, text, pluralForm) {
    if (number == 1) return "1 "+text;
    else if (!pluralForm) return number+" "+text+"s";
    else return number+" "+pluralForm;
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
 *     {testFunction: function(context) { ... },
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
 * bashColors: If true, then any output will be displayed with
 *     colors. This may not work if your shell doesn't use
 *     bash-compatible color escape codes.
 *
 * handleErrors: Normally if an error is thrown during testing, the
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
function TestSuite(testsToRun, opts) {
    event.EventEmitter.call(this);

    // Override default options with specified options.
    this.opts = {
        output: "normal",
        bashColors: true,
        handleErrors: true
    };
    for (var opt in opts) this.opts[opt] = opts[opt];

    // Configure starting data.
    this.hasRun = false;
    this.testsToRun = [];
    if (testsToRun) this.addTests(testsToRun);

    // Set up for color, if we need it
    var RED="", NO_COLOR="", GREEN="";
    if (this.opts.bashColors) {
        GREEN = "\u001b[32m";
        RED = "\u001b[31m";
        NO_COLOR = "\u001b[0m";
    }

    // Configure listeners, if we need them.
    if (this.opts.output) {

        if (this.opts.output != "quiet") {
            this.addListener("pass", function(testDefn, suite) {
                if (this.opts.output == "verbose") {
                    sys.puts(GREEN+"Passed: "+testDefn.name+NO_COLOR);
                } else {
                    sys.print(GREEN+"."+NO_COLOR);
                }
            });
            this.addListener("fail", function(testDefn, suite) {
                if (this.opts.output == "verbose") {
                    sys.puts(RED+"FAILED: "+testDefn.name+NO_COLOR);
                    sys.puts(" - "+testDefn.failMessage.toString());
                } else {
                    sys.print(RED+"X"+NO_COLOR);
                }
            });
            this.addListener("err", function(testDefn, suite) {
                if (this.opts.output == "verbose") {
                    sys.puts(RED+"ERROR: "+testDefn.name+NO_COLOR);
                    sys.puts(" - "+testDefn.error.toString());
                } else {
                    sys.print(RED+"E"+NO_COLOR);
                }
            });
        }
        if (this.opts.output == "verbose") {
            this.addListener("start", function(suite) {
                sys.puts("Beginning tests.");
            });
            this.addListener("test", function(testDefn, suite) {
                sys.puts("Beginning test: "+testDefn.name);
            });
        }
        this.addListener("complete", function(suite) {
            if (this.opts.output != "quiet") {
                sys.print("\n");

                if (this.opts.output == "normal") {
                    // Output the errors and failures now, we didn't
                    // as we went along.
                    for (var i = 0; i < suite.testsToRun.length; ++i) {
                        var testDefn = suite.testsToRun[i];
                        switch (testDefn.result) {
                        case 'fail':
                            sys.puts(RED+"FAILED: "+testDefn.name+NO_COLOR);
                            sys.puts(" - "+testDefn.failMessage.toString());
                            break;
                        case 'error':
                            sys.puts(RED+"ERROR: "+testDefn.name+NO_COLOR);
                            sys.puts(" - "+JSON.stringify(testDefn.error));
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
TestSuite.prototype.addTests = function(testsToRun) {
    if (this.hasRun) {
        throw new TestError("Can't add tests after they've been run.");
    }
    for (var i = 0; i < testsToRun.length; i++) {
        var testDefn = testsToRun[i];

        // Make a copy of the test definition so we can store some
        // local data in it.
        var myDefn = {};
        for (var key in testDefn) {
            myDefn[key] = testDefn[key];
        }

        // Store it for later running.
        this.testsToRun.push(myDefn);
    }
};

/**
 * Adds another test suite to this one. The options and event
 * listeners of the given test suite will be ignored.
 */
TestSuite.prototype.addSuite = function(otherSuite) {
    if (this.hasRun) {
        throw new TestError("Can't add tests after they've been run.");
    }
    this.addTests(otherSuite.testsToRun);
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
    for (var i = 0; i < this.testsToRun.length; i++) {
        var testDefn = this.testsToRun[i];

        // Build the argument list for the test.
        var context = new TestContext(testDefn, this);
        var args = [context];
        if (testDefn.args) {
            args = args.concat(testDefn.args);
        }

        // Create the "this" pointer.
        var self = testDefn.self;
        if (self === undefined) { // Only undefined, so user can specify null.
            self = context;
        }

        // Run the test
        ++this.running;
        ++this.started;
        testDefn.running = true;

        this.emit("test", testDefn, this);

        if (this.opts.handleErrors) {
            try {
                testDefn.testFunction.apply(self, args);
            } catch (err) {
                if (testDefn.running) {
                    context.error(err);
                }
            }
        } else {
            testDefn.testFunction.apply(self, args);
        }
    }
};

/**
 * Returns true if all the tests have run to completion.
 */
TestSuite.prototype.isComplete = function() {
    return this.running == 0 && this.started == this.testsToRun.length;
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
    context.testDefn.result = 'pass';
    context.testDefn.running = false;
    this.emit("pass", context.testDefn, this);
    if (this.isComplete()) this._finish();
};
TestSuite.prototype._failed = function(context) {
    ++this.failures;
    --this.running;
    context.testDefn.result = 'fail';
    context.testDefn.running = false;
    this.emit("fail", context.testDefn, this);
    if (this.isComplete()) this._finish();
};
TestSuite.prototype._error = function(context) {
    ++this.errors;
    --this.running;
    context.testDefn.result = 'error';
    context.testDefn.running = false;
    this.emit("err", context.testDefn, this);
    if (this.isComplete()) this._finish();
};


/**
 * A test context allows a test to notify the system that it is
 * complete, or that some problem has occurred. It should not be
 * constructed manually.
 */
function TestContext(testDefn, testSuite) {
    this.testDefn = testDefn;
    this.suite = testSuite;
};
/**
 * Call this function if your test function is complete and passed.
 */
TestContext.prototype.passed = function() {
    if (!this.testDefn.running) {
        throw new TestError("Test context has already been given a result.");
    }
    this.suite._passed(this);
};
/**
 * Call this function if your test function is complete but failed.
 */
TestContext.prototype.failed = function(failMessage) {
    if (!this.testDefn.running) {
        throw new TestError("Test context has already been given a result.");
    }
    this.testDefn.failMessage = failMessage;
    this.suite._failed(this);
};
/**
 * Call this function if your test function crashes.
 */
TestContext.prototype.error = function(error) {
    if (!this.suite.opts.handleErrors) {
        throw error;
    }
    if (!this.testDefn.running) {
        throw new TestError("Test context has already been given a result.");
    }
    this.testDefn.error = error;
    this.suite._error(this);
};

/**
 * Extracts all the tests in the given module and returns a test
 * suite containing them.
 */
var getModuleTests = function(mod, opts) {
    // Accumualate the tests in the module.
    var testsToRun = [];
    var exportNames = Object.keys(mod);
    for (var i = 0; i < exportNames.length; i++) {
        var exportName = exportNames[i];
        if (exportName.substr(0, 4) == "test") {
            var definition = {};
            definition.name = exportName + " in " + mod.name;
            definition.testFunction = mod[exportName];
            testsToRun.push(definition);
        }
    }

    return new TestSuite(testsToRun, opts);
};

exports.getModuleTests = getModuleTests;
exports.TestError = TestError;
exports.TestSuite = TestSuite;