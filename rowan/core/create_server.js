/**
 * This module contains the main driver function that creates a rowan
 * server around a controller tree. See the controler module for more
 * information about how a Rowan tree is structured.
 */
var url = require('url');
var sys = require('sys');
var http = require('http');
var errors = require('./errors');
var rowanHttp = require('./http');

/**
 * Builds and returns a HTTP server. This doesn't call the server. To
 * start the server call its listen() method.
 */
exports.createRowanServer = function (rootController, options) {
    // Shallow copy explicit options, overriding defaults.
    var opts = {quitOnError:true};
    for (var key in options) opts[key] = options[key];

    var server = http.createServer(function (request, response) {
        sys.puts(
            '['+(new Date()).toString()+'] "'+
                request.method+' '+request.url+
                ' HTTP/'+request.httpVersion+'"');

        // The unprocessed path should exclude the starting slash.
        var urlData = url.parse(request.url);
        request.urlData = urlData;
        var path = urlData.pathname.substr(1);

        // A simple inner function for generating a server error.
        var reportError = function (err) {
            var errCode = err.statusCode;
            // Here we do want writeHead because we're dealing with
            // the node http.ServerResponse object passed into
            // http.createServer's callback.
            response.writeHead(errCode, {'Context-Type':'text/html'});
            response.write("<h1>"+errCode+" "+err.description+"</h1>");
            if (err.message) {
                response.write("\n<p>"+err.message.toString()+"</p>");
            }
            response.end();
            if (opts.quitOnError) {
                sys.puts("Quitting (unhandled error and quitOnError=true).");
                server.close();
            }
        };

        // Build the initial context data and call the root controller.
        var context = {
            request:rowanHttp.RowanRequest(request),
            response:rowanHttp.RowanResponse(response),
            remainingPath:path,
            // A structure for holding internal data. This is used by
            // the blackboard controllers to add and remove data.
            data:{}
        };
        rootController(context, function(err) {
            if (err) {
                // Check to make sure we have a HttpError (duck-typing).
                var httpError = err;
                if (!err.statusCode) {
                    httpError = new errors.HttpError(500);
                    httpError.message = err.name+": "+err.message;
                }
                return reportError(httpError);
            }

            // Do a sanity check to see if we've finished our response.
            if (!response.finished) {
                return reportError(new errors.HttpError(504));
            }
        });
    });

    // Override listen to notify the user that we're listening.
    var listen = server.listen;
    server.listen = function(port, hostname) {
        hostname = hostname || "0.0.0.0";
        sys.puts("Server running at http://"+hostname+":"+port+"/");
        listen.call(server, port, hostname);
    };

    return server;
};
