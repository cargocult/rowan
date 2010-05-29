var sys = require('sys');

/**
 * Runs a series of functions in turn, passing the result (or error)
 * of each one onto the next. Each function can either return some
 * non-undefined value, throw an error, or call the function given to
 * it as the 'this' pointer. Any other behavior may cause the sequence
 * to stall and not continue to completion.
 *
 * In addition, the 'this' pointer has a 'abort' method. If called
 * this indicates that no further steps in the sequence should be
 * processed. This is not an alternative to one of the three return
 * methods above, however. You still need to return a value, throw an
 * error or call this(). The abort() method returns true, however, so
 * you can use the idiom: return this.abort();
 *
 * You can pass an options object as the first argument to this
 * function, the following options are available:
 *
 * - finallyDo: A function object that will always get run as the
 *   last in the sequence, even if a previous function calls
 *   this.abort();
 *
 * - throwError: If an error makes it to the end of the sequence,
 *   then it will be ignored by default. Set this to true if you want
 *   the error to be thrown. Be aware, however, that throwing an error
 *   in a callback (i.e. if ANY of the functions in your sequence use
 *   a callback) is dangerous, as there is no way for Node to work out
 *   what bit of code the error belongs to. It normally causes the
 *   script to terminate. Use the 'finally' clause to do any
 *   last-ditch tidying up, and make sure it doesn't throw an error.
 */
var sequence = exports.sequence = function(opts) {
    var allCalls;
    var myOpts = {
        throwError: false,
        finallyDo: null
    };

    // Check if we were given options, if so override the defaults.
    if (typeof opts === 'object' && opts.constructor !== Function) {
        for (var opt in opts) {
            if (opts.hasOwnProperty(opt)) {
                myOpts[opt] = opts[opt];
            }
        }
        allCalls = Array.prototype.slice.call(arguments, 1);
    } else {
        allCalls = Array.prototype.slice.call(arguments);
    }

    // We need to reverse the list of actions so we pop them in order.
    allCalls.reverse();

    // Create a function that can do just the next action.
    var finallyDone = false;
    var doNext = function(err) {
        var nextCall = allCalls.pop();
        if (!nextCall) {
            // We're out of sequence calls, check for a finally in our
            // options.
            if (myOpts.finallyDo && !finallyDone) {
                nextCall = myOpts.finallyDo;
                finallyDone = true;
            } else {
                // We really are at the end of the line, so check if
                // we need to throw any errors.
                if (err && myOpts.throwError) {
                    throw err;
                }
                return;
            }
        }

        // Call the next function in the chain.
        var result;
        try {
            result = nextCall.apply(doNext, arguments);
        } catch (err) {
            // Pass on errors down the chain.
            return doNext(err);
        }

        // If we got a result then the last function was probably
        // synchronous, so we move along. Otherwise we wait to be
        // called asynchronously.
        if (result !== undefined) {
            doNext(null, result);
        }
    };

    // We can call this.abort to finish at the next callback.
    doNext.abort = function() {
        // Clear the pending list.
        allCalls = [];

        // This allows us to use abort in the idiom:
        // return this.abort();
        return true;
    };

    // Start it off.
    doNext(null);
};

/**
 * Creates a custom sequence that has the given fixed before and after
 * steps. This is useful for automating set-up, tear-down behavior.
 */
exports.createWrappedSequence = function(beforeSteps, afterSteps, opts) {
    return function () {
        var args = Array.prototype.slice.call(arguments);
        args = Array.prototype.concat(beforeSteps, args, afterSteps);
        if (opts) args.unshift(opts);
        return sequence.apply(this, args);
    }
};
