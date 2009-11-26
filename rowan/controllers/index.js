/**
 * This module supports the Rowan tree structure of elements in a web
 * application. The tree is made up of 'controllers' that are
 * functions which can be called with a single 'context'
 * argument. Each controller is responsible for either providing the
 * correct response through the 'context.response' object (which is
 * the regular node.js response object), or it may throw a HttpError.
 * Specific versions of the HttpError are provided for different error 
 * cases.
 *
 * There are two styles of defining controllers. They may either
 * return null/undefined, or they may return a process.Promise
 * instance. If they return a promise it indicates that the controller
 * didn't run synchronously. The controller may then later call the
 * emitSuccess or emitError methods of the active promise. If an error
 * occurs in a promise, the promise MUST NOT throw the HttpError, but
 * instead should pass it to emitError. Note that controllers shouldn't
 * pass down the promises they receieve from posix operations or other
 * parts of Node.js, because they won't call the error callbacks with the
 * correct argument. Instead wrap the promise with your own.
 *
 * With controllers that follow this structure, a web application can be
 * built from reusable components.
 */
var errors = require('../core/errors');

// Include sub-modules.
exports.serve_file = require('./serve_file');
exports.generic = require('./generic');

/**
 * A router holds any number of child controllers along with a regular
 * expression that should match their uri. The router tries to match
 * each pattern in turn and calls the corresponding controller for the
 * first one that matches. The router throws a Http404 error if none match.
 */
exports.router = function(routes) {
    var fn = function(context) {
        var path = context.remaining_path;
        for (i in routes) {
            var route = routes[i];
            var match = route.pattern.exec(path)
            if (match) {
                // Add any matched groups.
                if (match.length > 1) {
                    if (!('pattern_groups' in context)) {
                        context.pattern_groups = [];
                    }
                    context.pattern_groups += match.slice(1);
                }

                // Update the unprocessed path.
                context.remaining_path = 
                    path.substr(match.index + match[0].length);

                // Call the view.
                return route.view(context);
            }
        }

        // We found no valid patterns to match the url.
        throw new errors.Http404();
    };
    return fn;
};

/**
 * A method map acts similarly to a router, it can dispatch an incoming
 * request to one of a set of controllers. In this case it maps based on
 * the HTTP method used. To create a controller, specify an object mapping
 * upper case HTTP method names to sub-controllers. The optional second
 * argument can be used to specify a default sub-controller in case the
 * method isn't listed in the map.
 */
exports.method_map = function(map, default_controller) {
    var fn = function(context) {
        var sub_controller = map[context.request.method];
        if (sub_controller) {
            return sub_controller(context);
        } else if (default_controller) {
            return default_controller(context);
        }
        throw new errors.Http405();
    };
    return fn;
};

/**
 * The error handler delegates to a single sub-controller and absorbs any
 * errors it produces, outputting a simple but sane HTML error message.
 * The method can be given a first, optional, argument which is a list of
 * error status codes not to handle.
 */
exports.error_handler = function(unhandled_errors, sub_controller) {
    // Swap arguments if we were only given one.
    if (!sub_controller) {
        sub_controller = unhandled_errors;
        unhandled_errors = null;
    }

    // A function to do the error response.
    var handle_error = function(response, error) {
        var status_code = error.status_code || 500;
        if (!unhandled_errors || unhandled_errors.indexOf(status_code) < 0) {
            var description = error.description || "Server Error";

            response.sendHeader(status_code, {'Content-Type':'text/html'});
            response.sendBody(
                "<h1>"+status_code.toString()+" "+description+"</h1>"
            );
            response.finish();
            return true;
        } else {
            return false;
        }
    };

    var fn = function(context) {
        try {
            var promise = sub_controller(context);
        } catch (err) {
            // Rethrow if we can't handle it, otherwise we're done.
            if (handle_error(context.response, err)) {
                return;
            } else {
                throw err;
            }
        };

        // If we get here there was no error thrown on the initial run.
        if (promise) {
            var our_promise = new process.Promise();

            // We have to cope with deferred errors.
            promise.addErrback(function (err) {
                if (handle_error(context.response, err)) {
                    our_promise.emitSuccess();
                } else {
                    our_promise.emitError(err);
                }
            });

            return our_promise;
        }
    };
    return fn;
};

/**
 * The fallback controller tries each of a list of sub-controllers in
 * turn until one of them does not throw an error. It can be given an
 * optional list of error status values that it will absorb. If this
 * list is given then any other error will be re-thrown
 * immediately. If the list is not given (i.e. the function is called
 * with only one argument) then all errors will be absorbed. If none
 * of the controllers in the fallback succeed, then it will re-throw
 * the error generated by the last controller in the list.
 *
 * This function recurses through the sub-controllers in order, rather
 * than iterating through them. Because Javascript doesn't support 
 * tail-calls, huge numbers of sub-controllers may cause a stack-overflow.
 * Instead split the fallbacks into a tree, with only a couple of hundred
 * controllers per fallback.
 */
exports.fallback = function(valid_errors, sub_controllers) {
    // Swap arguments if we were only given one.
    if (!sub_controllers) {
        sub_controllers = valid_errors;
        valid_errors = null;
    }
    
    // Can this error be handled or does it need escalating?
    var handle_error = function(err) {
        return !valid_errors || valid_errors.indexOf(err.status_code) >= 0;
    }

    var fn = function(context) {
        // Take a copy so we don't have changes when waiting for promises.
        var sub_controllers_copy = sub_controllers.slice();

        // We'll try not to need a promise, but if we do, it will be set 
        // in this variable.
        var main_promise = null;

        // The recursive function that tries to use one sub-controller and
        // recurses to further sub-controllers if it fails. 
        var process_controller = function(index) {
            var sub_controller = sub_controllers_copy[index];
            
            try {
                var sub_promise = sub_controller(context);
            } catch (err) {
                // The sub-controller may have errored immediately.
                if (!handle_error(err)) {
                    // We need to report this error.
                    if (main_promise) {
                        main_promise.emitError(err);
                        return;
                    } else {
                        // We don't have a main promise yet, so we can 
                        // just throw the error.
                        throw err;
                    }
                } else {
                    // We can handle the error, so just recurse.
                    if (index < sub_controllers_copy.length-1) {
                        process_controller(index+1, main_promise);
                    } else if (main_promise) {
                        // We're done, so emit the error after all.
                        main_promise.emitError(err);
                        return;
                    } else {
                        // We're done, but we have no promise, so throw
                        // the last error.
                        throw err;
                    }
                }
            }
            
            if (sub_promise) {
                // This controller is deferring, so we need to wait for it,
                // and in turn that means whoever called us needs to wait too.
                if (!main_promise) {
                    main_promise = process.Promise();
                }
                
                // Wait for the sub-controller to be done.
                sub_promise.addCallback(function () {
                    // Success bubbles up immediately.
                    main_promise.emitSuccess();
                });
                sub_promise.addErrback(function (err) {
                    // Errors may be handled by considering the next 
                    // controller.
                    if (handle_error(context.response, err)) {
                        // We are fine with this error. Do we have another
                        // sub-controller to try?
                        if (index < sub_controllers_copy.length-1) {
                            process_controller(index+1, main_promise);
                        } else {
                            // We're done, so emit the error after all.
                            main_promise.emitError(err);
                        }
                    } else {
                        // We can't handle this error, so report it.
                        main_promise.emitError(err);
                    }
                });
            } else {
                // We're done and fine to return, but we may still be
                // part of a main promise that needs notifying.
                if (main_promise) {
                    main_promise.emitSuccess();
                }
            }
        }; // end function - process_controller
            
        // Start by trying the base controller, and let it recurse from 
        // there.
        process_controller(0);
        return main_promise;
    };   
    return fn;
};

