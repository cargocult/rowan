/**
 * Tests for testing the unit test system itself.
 */
var rowan = require("rowan");

// Build the tests.
var tests = {name:"testUuid.js"};

var UUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
tests.testUUID = function(context) {
    rowan.utils.uuid.createUUID(function(err, uuid) {
        if (err) return context.error(err);

        if (!UUID_RE.test(uuid.toString())) {
            context.failed("Incorrect UUID: "+uuid.toString());
        } else {
            context.passed();
        }
    });
};

// ---------------------------------------------------------------------------
exports.getTests = function() {
    return rowan.utils.test.getModuleTests(tests);
};
