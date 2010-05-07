/**
 * Generic controllers for common output use-cases.
 */

var template = require('../template');
var core = require('../core');


/**
 * A utility function that responds to a request in one call.
 */
response_util = function (context, callback, content, content_type) {
        content_type = content_type || 'text/plain';
        context.response.writeHeader(200, {'Content-Type': content_type});
        context.response.write(content);
        context.response.end();
        callback(null);
    };

/**
 * A controller that outputs the given content verbatim. The content type
 * will default to text/plain.
 */
exports.create_static_content = function (content, content_type) {
    return function (context, callback) {
        response_util(context, callback, content, content_type);
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
exports.create_template_renderer =
    function (template_name, data_object, content_type) {
        var content_type = content_type || 'text/html';
        return function (context, callback) {
            // Render the template.
            template.render(
                template_name, data_object,
                function (err, result) {
                    if (err) callback(err);
                    else {
                        response_util(context, callback, result, content_type);
                    }
                });
        };
    };

/**
 * A controller that always generates an error. This can be useful for
 * debugging complex controller trees.
 */
exports.create_error_generator = function (error_code, description) {
    return function (context, callback) {
        callback(new core.errors.HttpError(error_code, description));
    };
}