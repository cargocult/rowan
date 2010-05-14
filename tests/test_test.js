/**
 * Tests for testing the unit test system itself.
 */
var test = require("rowan/core/test");

// Build a list of tests.
var tests = {name:"test_test.js"};

tests.testSuccess = function(context) {
    return context.passed();
};

// ---------------------------------------------------------------------------
exports.getTests = function() {
    return test.getModuleTests(tests);
};
