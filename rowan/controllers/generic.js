/**
 * Generic controllers for common output use-cases.
 */

var template = require('../template');
var core = require('../core');

// ---------------------------------------------------------------------------
// CONVENIENCE RESPONDERS

/**
 * At the end of a controller, you often want to just output some
 * content, with no further headers, and with a 200 status code, then
 * call the callback with no errors. This function does that. Use it
 * at the end of a controller by calling:
 *
 *    return respondWithContent(context, callback, "my content");
 *
 * You can add a 4th argument if you don't want the default content
 * type (text/html). To return JSON, use the respondWithJSON function.
 */
var respondWithContent = function (context, callback, content, contentType) {
    context.response.setStatus(200);
    context.response.addHeaders({"Content-Type":contentType || 'text/html'});
    context.response.write(content);
    context.response.end();
    return callback(null);
};
exports.respondWithContent = respondWithContent;
exports.respondWithHTML = respondWithContent;

/**
 * As respondWithContent, but assumes a text/plain mime type unless
 * another is given.
 */
var respondWithText = function (context, callback, content, contentType) {
    return respondWithContent(
        context, callback, content, contentType || "text/plain"
    );
};
exports.respondWithText = respondWithText;

/**
 * At the end of a controller, you often want to just output some json
 * data, with no further headers, and with a 200 status code, then
 * call the callback with no errors. This function does that. Use it
 * at the end of a controller by calling:
 *
 *    return respondWithJSON(context, callback, {data:"my content"});
 *
 * The json data passed can either be an object (which will be
 * pass to JSON.stringify) or a string.
 */
var respondWithJSON = function (context, callback, data, contentType) {
    if (typeof data == 'object') {
        try {
            data = JSON.stringify(data);
        } catch (err) {
            return callback(err);
        }
    }
    return respondWithContent(
        context, callback, data, contentType || "application/json"
    );
};
exports.respondWithJSON = respondWithJSON;

// ---------------------------------------------------------------------------
// CONTROLLER GENERATORS

/**
 * A controller that outputs the given content verbatim. The content type
 * will default to text/plain.
 */
exports.createStaticContent = function (content, contentType) {
    return function (context, callback) {
        respondWithContent(context, callback, content, contentType);
    };
};

/**
 * A controller that merges a pre-specified set of data into a template.
 * The content type defaults to text/html.
 *
 * Note that the data is only merged into the template when the generated
 * controller is actually called, so while the data object itself can't
 * change, its contents can.
 */
exports.createTemplateRenderer =
    function (templateName, dataObject, contentType) {
        var contentType = contentType || 'text/html';
        return function (context, callback) {
            // Render the template.
            template.render(
                templateName, dataObject,
                function (err, renderedContent) {
                    if (err) callback(err);
                    else {
                        respondWithContent(
                            context, callback, renderedContent, contentType
                        );
                    }
                });
        };
    };

/**
 * A controller that always generates an error. This can be useful for
 * debugging complex controller trees.
 */
exports.createErrorGenerator = function (errorCode, description) {
    return function (context, callback) {
        callback(new core.errors.HttpError(errorCode, description));
    };
}