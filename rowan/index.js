/**
 * This module contains the main driver function that creates a rowan
 * server around a controller tree. See the controler module for more
 * information about how a Rowan tree is structured.
 */
/*
 * Part of the Rowan Microframework.
 * Copyright (c) 2009 Ian Millington. See the LICENSE file for details.
 */

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
exports.createRowanServer = function (root_controller, options) {
    var opts = {crash_on_error:true};
    process.mixin(opts, options);

    return http.createServer(function (request, response) {
        sys.puts(
            '['+(new Date()).toString()+'] "'+
                request.method+' '+request.uri.full+
                ' HTTP/'+request.httpVersion+'"');
        
        // The unprocessed path should exclude the starting slash.
        var path = request.uri.path.substr(1); 
        
        // A simple inner function for generating a server error.
        var report_error = function (err) {
            response.sendHeader(500, {'Context-Type':'text/html'});
            response.sendBody("<h1>500 Server Error</h1>");
            response.finish();
            if (opts.crash_on_error) throw err;
        };

        // Build the initial context data and call the root controller.
        var context = {
            request:request, 
            response:response, 
            remaining_path:path
        };
        try {
            var promise = root_controller(context);
        } catch (err) {
            return report_error(err);
        }

        // A sanity check function if we haven't sent a response and we've got
        // no promise pending, then we need to send an error.
        var ensure_finish = function () {
            if (!response.finished) {
                report_error(new core.errors.HttpError(504));
            }
        };
        if (promise) {
            promise.addErrback(report_error);
            promise.addCallback(ensure_finish);
        } else {
            ensure_finish();
        }
    });
};
