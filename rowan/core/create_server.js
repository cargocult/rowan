/**
 * This module contains the main driver function that creates a rowan
 * server around a controller tree. See the controler module for more
 * information about how a Rowan tree is structured.
 */
var url = require('url');
var sys = require('sys');
var http = require('http');
var errors = require('./errors');
var rowan_http = require('./http');

/**
 * Builds and returns a HTTP server. This doesn't call the server. To
 * start the server call its listen() method.
 */
exports.create_rowan_server = function (root_controller, options) {
    // Shallow copy explicit options, overriding defaults.
    var opts = {quit_on_error:true};
    for (var key in options) opts[key] = options[key];

    var server = http.createServer(function (request, response) {
        sys.puts(
            '['+(new Date()).toString()+'] "'+
                request.method+' '+request.url+
                ' HTTP/'+request.httpVersion+'"');

        // The unprocessed path should exclude the starting slash.
        var url_data = url.parse(request.url);
        var path = url_data.pathname.substr(1);

        // A simple inner function for generating a server error.
        var report_error = function (err) {
            var err_code = err.status_code;
            // Here we do want writeHead because we're dealing with
            // the node http.ServerResponse object passed into
            // http.createServer's callback.
            response.writeHead(err_code, {'Context-Type':'text/html'});
            response.write("<h1>"+err_code+" "+err.description+"</h1>");
            if (err.message) {
                response.write("\n<p>"+err.message.toString()+"</p>");
            }
            response.end();
            if (opts.quit_on_error) {
                sys.puts("Quitting (unhandled error and quit_on_error=true).");
                server.close();
            }
        };

        // Build the initial context data and call the root controller.
        var context = {
            request:request,
            response:rowan_http.RowanResponse(response),
            remaining_path:path
        };
        root_controller(context, function(err) {
            if (err) {
                // Check to make sure we have a HttpError (duck-typing).
                var http_error = err;
                if (!err.status_code) {
                    http_error = new errors.HttpError(500);
                    http_error.message = err.name+": "+err.message;
                }
                return report_error(http_error);
            }

            // Do a sanity check to see if we've finished our response.
            if (!response.finished) {
                return report_error(new errors.HttpError(504));
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
