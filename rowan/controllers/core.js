/**
 * Core routers that form the boughs of most rowan trees.
 */
var errors = require('../core/errors');

/**
 * A router holds any number of child controllers along with a regular
 * expression that should match their uri. The router tries to match
 * each pattern in turn and calls the corresponding controller for the
 * first one that matches. The router calls-back with a Http404 error
 * if none match.
 */
exports.createRouter = function(routes) {
    return function(context, callback) {
        var path = context.remainingPath;
        for (i in routes) {
            var route = routes[i];
            var match = route.pattern.exec(path)
            if (match) {
                // Add any matched groups.
                if (match.length > 1) {
                    if (!('patternGroups' in context)) {
                        context.patternGroups = [];
                    }
                    context.patternGroups += match.slice(1);
                }

                // Update the unprocessed path.
                context.remainingPath =
                    path.substr(match.index + match[0].length);

                // Call the view.
                return route.view(context, callback);
            }
        }

        // We found no valid patterns to match the url.
        callback(new errors.Http404());
    };
};

/**
 * A method map acts similarly to a router, it can dispatch an incoming
 * request to one of a set of controllers. In this case it maps based on
 * the HTTP method used. To create a controller, specify an object mapping
 * upper case HTTP method names to sub-controllers. The optional second
 * argument can be used to specify a default sub-controller in case the
 * method isn't listed in the map.
 */
exports.createMethodMap = function(map, defaultController) {
    return function(context, callback) {
        var subController = map[context.request.method];
        if (subController) {
            return subController(context, callback);
        } else if (defaultController) {
            return defaultController(context, callback);
        }
        callback(new errors.Http405());
    };
};

/**
 * The error handler delegates to a single sub-controller and absorbs any
 * errors it produces, outputting a simple but sane HTML error message.
 * The method can be given a first, optional, argument which is a list of
 * error status codes not to handle.
 */
exports.createErrorHandler = function(unhandledErrors, subController) {
    // Swap arguments if we were only given one.
    if (!subController) {
        subController = unhandledErrors;
        unhandledErrors = null;
    }

    // A function to do the error response.
    var handleError = function(response, error) {
        var statusCode = error.statusCode || 500;
        if (!unhandledErrors || unhandledErrors.indexOf(statusCode) < 0) {
            var description = error.description || "Server Error";

            response.setStatus(statusCode);
            response.addHeaders({'Content-Type':'text/html'});
            response.write(
                "<h1>"+statusCode.toString()+" "+description+"</h1>"
            );
            response.end();
            return true;
        } else {
            return false;
        }
    };

    return function(context, callback) {
        subController(context, function(err) {
            if (err && !handleError(context.response, err)) {
                // Pass the error on up.
                callback(err);
            } else {
                // Everything is fine, pass success on up.
                callback(null);
            }
        });
    };
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
 */
exports.createFallback = function(validErrors, subControllers) {
    // Swap arguments if we were only given one.
    if (!subControllers) {
        subControllers = validErrors;
        validErrors = null;
    }

    // Can this error be handled or does it need escalating?
    var handleError = function(err) {
        return !validErrors || validErrors.indexOf(err.statusCode) >= 0;
    }

    return function(context, callback) {
        // Take a copy so we don't have changes when waiting for results.
        var subControllersCopy = subControllers.slice();

        // The recursive function that tries to use one sub-controller and
        // recurses to further sub-controllers if it fails.
        var processController = function(index) {
            var subController = subControllersCopy[index];

            subController(context, function(err) {
                if (err) {
                    if (handleError(err)) {
                        // We could handle this error, do we have another
                        // controller to pass on to?
                        if (index+1 < subControllersCopy.length) {
                            processController(index+1);
                        }
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
        if (subControllersCopy) processController(0);
        else callback(new errors.Http404());
    };
};

/**
 * Makes the given data object visible to the subController and its
 * children, removing it before we back out of the tree past this
 * point again. Any data not explicitly overwritten in this data
 * structure will be retained.
 *
 * Only top level changes are supported. So if the data is already
 * {a:{b:1, c:2}} and you pass {a:{d:3}} into this function, then the
 * b and c values for property a will be lost. If the data is already
 * {b:1, c:2}, however, and you pass {d:3}, then the subtree will see
 * 'b', 'c', and 'd'.
 */
exports.createSubtreeData = function(data, subController) {
    return function(context, callback) {
        // Copy the data we're given, with the current data as its
        // prototype.
        var oldData = context.data;
        var newData = Object.create(oldData);
        for (var property in oldData) {
            if (oldData.hasOwnProperty(property)) {
                newData[property] = oldData[property];
            }
        }
        context.data = newData;

        subController(context, function() {
            // Go back to the old data, before calling back to our
            // parent.
            context.data = oldData;
            callback.apply(null, arguments);
        });
    };
};