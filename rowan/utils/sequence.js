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
 */
var sequence = exports.sequence = function() {
    // Create the reversed list of actions to take.
    var all_calls = Array.prototype.slice.call(arguments);
    all_calls.reverse();

    // Create a function that can do just the next action.
    var do_next = function(err) {
        var next_call = all_calls.pop();
        if (!next_call) {
            // Now we can throw the error, if we got one.
            if (err) {
                sys.puts(JSON.stringify(err));
                //throw err;
            }
            return;
        }

        // Call the next function in the chain.
        var result;
        try {
            result = next_call.apply(do_next, arguments);
        } catch (err) {
            // Pass on errors down the chain.
            return do_next(err);
        }

        // If we got a result then the last function was probably
        // synchronous, so we move along. Otherwise we wait to be
        // called asynchronously.
        if (result !== undefined) {
            do_next(null, result);
        }
    };

    // We can call this.abort to finish at the next callback.
    do_next.abort = function() {
        // Clear the pending list.
        all_calls = [];

        // This allows us to use abort in the idiom:
        // return this.abort();
        return true;
    };

    // Start it off.
    do_next(null);
};

/**
 * Creates a custom sequence that has the given fixed before and after
 * steps. This is useful for automating set-up, tear-down behavior.
 */
exports.create_wrapped_sequence = function(before_steps, after_steps) {
    return function () {
        var args = Array.prototype.slice.call(arguments);
        args = Array.prototype.concat(before_steps, args, after_steps);
        return sequence.apply(this, args);
    }
};
