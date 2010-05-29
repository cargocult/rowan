var sys = require('sys');

// Internal construtor for our errors.
var RowanResponseError = function(message) {
    this.name = "RowanResponseError";
    this.message = message;
};

/**
 * Wraps the given node http.ServerResponse object with functionality
 * that buffers the writeHead call to allow additional headers to be
 * added to the response at any point up to its first write() or end()
 * call.
 */
exports.RowanResponse = function(node_server_response) {
    var nsr = node_server_response;
    var response = Object.create(nsr);

    var _sent_head = false;
    var _status = 200;
    var _headers = {};

    // New methods for deferred sending of the head.
    response.set_status = function(status) {
        if (_sent_head) {
            throw new RowanResponseError(
                "Can't set the status after having sent content."
            );
        } else {
            _status = status;
        }
    };
    response.add_headers = function(headers) {
        if (_sent_head) {
            throw new RowanResponseError(
                "Can't set the status after having sent content."
            );
        } else {
            // Overwrite any existing headers.
            for (var header in headers) {
                if (headers.hasOwnProperty(header)) {
                    _headers[header] = headers[header];
                }
            }
        }
    };

    // Override existing response methods:
    response.write = function() {
        // First make sure we write the head.
        if (!_sent_head) {
            nsr.writeHead.call(nsr, _status, _headers);
            _sent_head = true;
        }

        // Delegate this to our prototype.
        return nsr.write.apply(nsr, arguments);
    };
    response.writeHead = function() {
        throw new RowanResponseError(
            "Rowan responses replace writeHead() with "+
                "set_status() and add_headers()"
        );
    };
    response.end = function() {
        if (!_sent_head) {
            nsr.writeHead.call(nsr, _status, _headers);
            _sent_head = true;
        }
        return nsr.end.apply(nsr, arguments);
    };

    return response;
};