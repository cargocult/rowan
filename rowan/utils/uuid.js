/**
 * Generates a new UUID and passes it to the given callback function.
 *
 * Uses the a command-line uuid generator. Caches UUIDs to avoid
 * unneccessary spawning of new processes.
 *
 * You can easily adjust the script used to create the UUID. By
 * default I am using the OSSP uuid program, which is available in
 * most linux distro's package managers (e.g. `sudo apt-get install
 * uuid` on ubuntu).
 *
 * Callback signature is function(err, uuid).
 *
 * Credits:
 *   Ian Millington
 *   Steve Brewer
 */
var createUUID = (function() {
    // We create and execute this outside function immediately. Doing
    // this provides us with a secure inner scope to store our uuid
    // cache, preventing other code from accessing it. The result of
    // this outmost function call is to return the actual getUuid()
    // function which is assigned to the getUuid name.

    var UUIDError = function(message) {
        Error.call(this, message);
        this.name = "UUIDError";
    };

    // Adjust these constants to tweak the uuid generation process.
    // This version uses the OSSP uuid program, but you could also
    // replace the script with your own uuidgen wrapper as per
    // http://www.redleopard.com/2010/03/bash-uuid-generator/
    var UUID_SCRIPT = "uuid";
    var UUID_ARGS = ['-v', 4 /* uuid version */,
                     '-n', 100 /* per call */];

    // Alias the spawn function for our cache top-up routine.
    var spawn = require('child_process').spawn;

    // The uuid stack. Pop UUIDs from this as they are needed.
    var uuids = [];

    // Track if we're currently generating, so we don't spawn new UUID
    // generators if one is pending.
    var spooledCallbacks = [];
    var generating = false;

    // Handle error notification of the spooled callbacks.
    var notifyCallbacksOfError = function(error) {
        while (spooledCallbacks.length > 0) {
            spooledCallbacks.pop()(error, null);
        }
    }

    // Updates the cache with another batch of UUIDs.
    var topUpCache = function() {

        // Create the shell call to uuid.
        var uuidCall = spawn(UUID_SCRIPT, UUID_ARGS);

        // When data arrives split it and cache it.
        uuidCall.stdout.addListener('data', function(data) {
            var result = data.toString();
            // Strip whitespace from start and end of the data.
            result = result.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
            // Assume we got one UUID per line.
            var uuidsReturned = result.split('\n');
            uuids = uuids.concat(uuidsReturned);
        });

        // Pass errors up to the spooled callbacks, these are then
        // popped, so they receive at most one error.
        uuidCall.stderr.addListener('data', function(data) {
            notifyCallbacksOfError(new UUIDError("uuid process error: "+data));
        });

        // If we're done, call the callback with the uuid.
        uuidCall.addListener('exit', function(code) {
            if (code != 0) {
                notifyCallbacksOfError(new UUIDError("uuid generation failed"));
            } else {
                // Send as many UUIDs as we can.
                while(spooledCallbacks.length > 0 & uuids.length > 0) {
                    spooledCallbacks.pop()(null, uuids.pop());
                }

                if (spooledCallbacks.length > 0) {
                    // We didn't have enough uuids, so top up again.
                    topUpCache();
                } else {
                    // We're done.
                    generating = false;
                }
            }
        });
    };

    // Calls the given function with a UUID when one is calculated.
    // Callback signature is function(err, uuid).
    return function(callback) {
        if (uuids.length > 0) {
            // We can immediately send back a UUID.
            callback(null, uuids.pop());
        } else {
            // We need to top up our cache before notifying the callback.
            spooledCallbacks.push(callback);

            // Check if we need to start a new cache update. If not,
            // then just adding the callback to the spooled list will
            // mean it gets called when UUIDs are available.
            if (!generating) {
                generating = true;
                topUpCache();
            }
        }
    };
})();

// Delete this line if you just want the function in your own code,
// add it if you want to use this file as a module and require() it
// into your program.
exports.createUUID = createUUID;
