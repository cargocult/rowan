// Internal construtor for our errors.
var RowanResponseError = function(message) {
    this.name = "RowanResponseError";
    this.message = message;
};

/**
 * Wraps the node request with functionality to allow controllers to
 * access data that has already streamed in. A controller may not get
 * to a request until some time has passed, so it needs a way to
 * recover the data.
 */
exports.RowanRequest = function(nodeServerRequest) {
    var nsr = nodeServerRequest;
    var request = Object.create(nsr);

    var bufferedData = [];
    var ended = false;
    request.__defineGetter__('ended', function() { return ended; });

    // Callbacks can register with getAllData to be told when data is
    // loaded.
    var waitingForData = [];

    // Buffer data coming in to the request, to cope when we don'w
    // know the handler immediately.
    var bufferFunction = function(chunk) {
        bufferedData.push(chunk);
    }
    nsr.addListener('data', bufferFunction);
    nsr.addListener('end', function() {
        ended = true;
        bufferedData = bufferedData.join("");
        if (waitingForData) {
            waitingForData.forEach(function(callback) {
                callback(bufferedData);
            });
        }
    });

    // Return the data that's been buffered so far. No need for a
    // callback, as this is just pulling what we've seen so far.
    request.getBufferedData = function() {
        if (ended) {
            return bufferedData;
        } else {
            return bufferedData.join("");
        }
    };

    // When we've pulled the buffered data, we may want the rest to
    // stream normally.
    request.disableBuffering = function() {
        nsr.removeListener('data', bufferFunction);
    };

    // Retrieves all the data in the request, waiting until it is
    // complete if necessary.
    request.getAllData = function(callback) {
        if (ended) {
            callback(null, bufferedData);
        } else {
            waitingForData.push(callback);
        }
    };

    return request;
};

/**
 * Wraps the given node http.ServerResponse object with functionality
 * that buffers the writeHead call to allow additional headers to be
 * added to the response at any point up to its first write() or end()
 * call.
 */
exports.RowanResponse = function(nodeServerResponse) {
    var nsr = nodeServerResponse;
    var response = Object.create(nsr);

    var _sentHead = false;
    var _status = 200;
    var _headers = {};

    // New methods for deferred sending of the head.
    response.setStatus = function(status) {
        if (_sentHead) {
            throw new RowanResponseError(
                "Can't set the status after having sent content."
            );
        } else {
            _status = status;
        }
    };
    response.addHeaders = function(headers) {
        if (_sentHead) {
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
        if (!_sentHead) {
            nsr.writeHead.call(nsr, _status, _headers);
            _sentHead = true;
        }

        // Delegate this to our prototype.
        return nsr.write.apply(nsr, arguments);
    };
    // Use our 2-step structure when we use the Node writeHead method.
    response.writeHead = function(status, headers) {
        response.setStatus(status);
        response.addHeaders(headers);
    };
    response.end = function() {
        if (!_sentHead) {
            nsr.writeHead.call(nsr, _status, _headers);
            _sentHead = true;
        }
        return nsr.end.apply(nsr, arguments);
    };

    return response;
};