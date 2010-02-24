/**
 * This module contains the main driver function that creates a rowan
 * server around a controller tree. See the controler module for more
 * information about how a Rowan tree is structured.
 */
/*
 * Part of the Rowan Microframework.
 * Copyright (c) 2009 Ian Millington. See the LICENSE file for details.
 */

var url = require('url');
var sys = require('sys');
var http = require('http');

// Expose sub-modules
exports.controllers = require('./controllers');
exports.template = require('./template');
exports.core = core = require('./core');
exports.information = require('./information');

/**
 * Builds and returns a HTTP server. This doesn't call the server. To
 * start the server call its listen() method.
 */
exports.create_rowan_server = function (root_controller, options) {
    var opts = {crash_on_error:true};
    process.mixin(opts, options);

    return http.createServer(function (request, response) {

        sys.puts(
            '['+(new Date()).toString()+'] "'+
                request.method+' '+request.url+
                ' HTTP/'+request.httpVersion+'"');
        
        // The unprocessed path should exclude the starting slash.
        var url_data = url.parse(request.url);
        var path = url_data.pathname.substr(1); 
        
        // A simple inner function for generating a server error.
        var report_error = function (err) {
            response.writeHeader(err.status_code, {'Context-Type':'text/html'});
            response.write("<h1>"+err.status_code+" "+err.description+"</h1>");
            if (err.information) response.write(err.information);
            response.close();
            if (opts.crash_on_error) throw err;
        };

        // Build the initial context data and call the root controller.
        var context = {
            request:request, 
            response:response, 
            remaining_path:path
        };
        root_controller(context, function(err) {
            if (err) {
                // Check to make sure we have a HttpError (duck-typing).
                if (err.status_code && err.description) {
                    report_error(err);
                } else {
                    var http_error = new core.errors.HttpError(500);
                    http_error.information = err.toString();
                    report_error(http_error);
                }
            } 

            // Do a sanity check to see if we've finished our response.
            if (!response.finished) {
                report_error(new core.errors.HttpError(504));
            }
        });
    });
};
