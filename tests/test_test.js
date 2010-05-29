/**
 * Tests for testing the unit test system itself.
 */
var rowan = require("rowan");

// Build a list of tests.
var tests = {name:"testTest.js"};

tests.testSuccess = function(context) {
    return context.passed();
};

// ---------------------------------------------------------------------------
exports.getTests = function() {
    return rowan.utils.test.getModuleTests(tests);
};
