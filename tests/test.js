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
    {handleErrors:true, output:'normal'}
);

// Accumulate the tests from each module.
suite.addSuite(require('./test_test').getTests());
suite.addSuite(require('./test_uuid').getTests());
suite.addSuite(require('./test_db_couch').getTests());

// Run the test system.
suite.run();
