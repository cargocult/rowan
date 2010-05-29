/**
 * Generic controllers for common output use-cases.
 */

var template = require('../template');
var core = require('../core');


/**
 * A utility function that responds to a request in one call.
 */
responseUtil = function (context, callback, content, contentType) {
    contentType = contentType || 'text/plain';

    context.response.setStatus(200);
    context.response.addHeaders({"Content-Type":contentType});

    context.response.write(content);
    context.response.end();
    callback(null);
};

/**
 * A controller that outputs the given content verbatim. The content type
 * will default to text/plain.
 */
exports.createStaticContent = function (content, contentType) {
    return function (context, callback) {
        responseUtil(context, callback, content, contentType);
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
                function (err, result) {
                    if (err) callback(err);
                    else {
                        responseUtil(
                            context, callback, result, contentType
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