#!/usr/bin/env node

/**
 * Top level testing harness for the Rowan library. Run this with
 *
 *     $ node test.js
 *
 * or
 *
 *     $ ./test.js
 */
// Make sure we can find Rowan.
require.paths.push(__dirname + '/../');
var rowan = require("rowan");

// We are building a complete test-suite.
var suite = new rowan.utils.test.TestSuite(
    [], // We'll add tests below.
    {handle_errors:false, output:'normal'}
);

// Accumulate the tests from each module.
suite.add_suite(require('./test_test').getTests());
suite.add_suite(require('./test_uuid').getTests());
suite.add_suite(require('./test_store_memory').getTests());

// Run the test system.
suite.run();
