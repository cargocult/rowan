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
 * be built from reusable components. This package contains the core
 * controllers that allow such construction.
 */

// Controllers are actually defined in sub-modules, but are exposed
// here for ease of use.
var core = require('./core');
var serveFile = require('./serve_file');
var generic = require('./generic');
var filters = require('./filters');

exports.createRouter = core.createRouter;
exports.createMethodMap = core.createMethodMap;
exports.createErrorHandler = core.createErrorHandler;
exports.createFallback = core.createFallback;
exports.createSubtreeData = core.createSubtreeData;

exports.createFileServer = serveFile.createFileServer;

exports.createStaticContent = generic.createStaticContent;
exports.createTemplateRenderer = generic.createTemplateRenderer;
exports.createErrorGenerator = generic.createErrorGenerator;

exports.respondWithContent = generic.responseWithContent;
exports.respondWithHTML = generic.respondWithHTML;
exports.respondWithText = generic.respondWithText;
exports.respondWithJSON = generic.respondWithJSON;

exports.ensureValidMethod = filters.ensureValidMethod;
exports.ensureGET = filters.ensureGET;
exports.ensurePOST = filters.ensurePOST;