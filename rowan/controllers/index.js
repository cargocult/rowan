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
var errors = require('../core/errors');

// Include sub-modules.
exports.serve_file = require('./serve_file');
exports.shortcuts = require('./shortcuts');

/**
 * A router holds any number of child controllers along with a regular
 * expression that should match their uri. The router tries to match
 * each pattern in turn and calls the corresponding controller for the
 * first one that matches. The router calls-back with a Http404 error
 * if none match.
 */
exports.create_router = function(routes) {
    var fn = function(context, callback) {
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
                return route.view(context, callback);
            }
        }

        // We found no valid patterns to match the url.
        callback(new errors.Http404());
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
exports.create_method_map = function(map, default_controller) {
    var fn = function(context, callback) {
        var sub_controller = map[context.request.method];
        if (sub_controller) {
            return sub_controller(context, callback);
        } else if (default_controller) {
            return default_controller(context, callback);
        }
        callback(new errors.Http405());
    };
    return fn;
};

/**
 * The error handler delegates to a single sub-controller and absorbs any
 * errors it produces, outputting a simple but sane HTML error message.
 * The method can be given a first, optional, argument which is a list of
 * error status codes not to handle.
 */
exports.create_error_handler = function(unhandled_errors, sub_controller) {
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

            response.writeHeader(status_code, {'Content-Type':'text/html'});
            response.write(
                "<h1>"+status_code.toString()+" "+description+"</h1>"
            );
            response.end();
            return true;
        } else {
            return false;
        }
    };

    var fn = function(context, callback) {
        sub_controller(context, function(err) {
            if (err && !handle_error(context.response, err)) {
                // Pass the error on up.
                callback(err);
            } else {
                // Everything is fine, pass success on up.
                callback(null);
            }
        });
    };
    return fn;
};

/**
 * The fallback controller tries each of a list of sub-controllers in
 * turn until one of them does not callback with an error. It can be
 * given an optional list of error status values that it will
 * absorb. If this list is given then any other error will be passed
 * up the tree immediately. If the list is not given (i.e. the
 * function is called with only one argument) then all errors will be
 * absorbed. If none of the controllers in the fallback succeed, then
 * the error from the last controller in the list will be passed
 * up. If no controllers are given, a Http 404 error is called-back.
 *
 * This function recurses through the sub-controllers in order, rather
 * than iterating through them. Because Javascript doesn't support
 * tail-calls, huge numbers of sub-controllers may cause a stack-overflow.
 * Instead split the fallbacks into a tree, with only a couple of hundred
 * controllers per fallback.
 */
exports.create_fallback = function(valid_errors, sub_controllers) {
    // Swap arguments if we were only given one.
    if (!sub_controllers) {
        sub_controllers = valid_errors;
        valid_errors = null;
    }

    // Can this error be handled or does it need escalating?
    var handle_error = function(err) {
        return !valid_errors || valid_errors.indexOf(err.status_code) >= 0;
    }

    var fn = function(context, callback) {
        // Take a copy so we don't have changes when waiting for results.
        var sub_controllers_copy = sub_controllers.slice();

        // The recursive function that tries to use one sub-controller and
        // recurses to further sub-controllers if it fails.
        var process_controller = function(index) {
            var sub_controller = sub_controllers_copy[index];

            sub_controller(context, function(err) {
                if (err) {
                    if (handle_error(err)) {
                        // We could handle this error, do we have another
                        // controller to pass on to?
                            if (index+1 < sub_controllers_copy.length) {
                            }
                        process_controller(index+1);
                    } else {
                        // We need to report this error.
                        callback(err);
                    }
                } else {
                    // Pass success directly back up.
                    callback(null);
                }
            });
        };

        // Start by trying the base controller, and let it recurse from
        // there.
        if (sub_controllers_copy) process_controller(0);
        else callback(new errors.Http404());
    };
    return fn;
};

