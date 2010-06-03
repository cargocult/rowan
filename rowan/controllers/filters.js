/**
 * Filters for preventing access to a controller.
 */
var errors = require("../core/errors");

/**
 * Makes sure any requests are made in one of a set of valid HTTP
 * methods. The first argument to this function is an array of valid
 * methods in uppercase.
 */
var ensureValidMethod = function(methods, controller) {
    // Convert from an array to a faster-lookup object.
    var validMethods = {};
    methods.forEach(function (method) {
        validMethods[method] = true;
    });

    return function(context, callback) {
        if (!validMethods[context.request.method]) {
            return callback(new errors.Http405());
        } else {
            return controller(context, callback);
        }
    };
};
exports.ensureValidMethod = ensureValidMethod;

/**
 * Only allows requests that are made with the HTTP GET method,
 * everything else gets Http 405.
 */
exports.ensureGET = function(controller) {
    return ensureValidMethod(['GET'], controller);
};

/**
 * Only allows requests that are made with the HTTP POST method,
 * everything else gets Http 405.
 */
exports.ensurePOST = function(controller) {
    return ensureValidMethod(['POST'], controller);
};
