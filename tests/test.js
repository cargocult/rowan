/**
 * Top level testing harness for the Rowan library. Run this with
 *
 *     $ node test.js
 */
// Make sure we can find Rowan.
require.paths.push(__dirname + '/../');
var test = require("rowan/core/test");

// We are building a complete test-suite.
var suite = new test.TestSuite([], {handle_errors:false, output:'verbose'});

// Accumulate the tests from each module.
suite.add_suite(require('./test_test').getTests());
suite.add_suite(require('./test_store_memory').getTests());

// Run the test system.
suite.run();
