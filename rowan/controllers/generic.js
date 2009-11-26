/**
 * Generic controllers for common output use-cases.
 */

var templ = require('../template');
var core = require('../core');

/**
 * A controller that outputs the given content verbatim. The content type
 * will default to text/plain.
 */
exports.direct_content = function (content, content_type) {
    return function (context) {
        content_type = content_type || 'text/plain';
        context.response.sendHeader(200, {'Content-Type': content_type});
        context.response.sendBody(content);
        context.response.finish();
    };
};

/** 
 * A controller that merges a pre-specified set of data into a template. 
 * The content type defaults to text/html.
 */
exports.direct_to_template = function (template, data_object, content_type) {
    return function (context) {
        // Get the remplate rendering promise;
        var renderer = templ.render_template(template, data_object);

        // Output the result if it succeeds.
        content_type = content_type || 'text/html';
        renderer.addCallback(
            function (result) {
                context.response.sendHeader(200, {'Content-Type':content_type});
                context.response.sendBody(result);
                context.response.finish();
            }
        );

        // Wrap it in a rowan promise.
        return core.promise.wrap(renderer);
    };
};

/**
 * A controller that always generates an error. 
 */
exports.generate_error = function (error_code, description) {
    return function (context) {
        throw new core.errors.HttpError(error_code, description);
    };
}