/**
 * This module supports the Rowan tree structure of elements in a web
 * application. The tree is made up of `controllers' that are
 * functions which can be called with two arguments:
 *
 * `context' encapsulates all the information about the request being
 * made and the response that should be generated.
 *
 * `callback' should be called *in all cases* from the controller,
 * when the controller has completed processing. The callback takes at
 * most one argument, which (if provided) should be an error object, and
 * notifies the caller than something went wrong. If no error is provided,
 * the request is considered complete, and Rowan will do some end-of-request
 * bookkeeping and checking. If you do not call the callback in all cases,
 * this code will not be run, this could cause problems later in the
 * program's execution. Unfortunately there is no way that Rowan can
 * detect whether you are waiting to respond, or if you've forgotten to
 * callback.
 *
 * With controllers that follow this structure, a web application can
 * be built from reusable components. This file contains the core
 * controllers that allow such construction.
 */

// Controllers are actually defined in sub-modules, but are exposed
// here for ease of use.
var core = require('./core');
var serve_file = require('./serve_file');
var generic = require('./generic');

exports.create_router = core.create_router;
exports.create_method_map = core.create_method_map;
exports.create_error_handler = core.create_error_handler;
exports.create_fallback = core.create_fallback;

exports.create_file_server = serve_file.create_file_server;

exports.create_static_content = generic.create_static_content;
exports.create_template_renderer = generic.create_template_renderer;
exports.create_error_generator = generic.create_error_generator;

