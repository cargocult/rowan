/**
 * This module provides a controller that serves static files from the 
 * hard-drive.
 */
/*
 * Part of the Rowan Microframework.
 * Copyright (c) 2009 Ian Millington. See the LICENSE file for details.
 */
var fs = require('fs');

var errors = require('../core/errors');
var mime_types = require('../information/mime_types');

/**
 * A controller that serves files from a particular path on the hard-drive.
 * When you create the controller you need to specify the path it will serve
 * from.
 */
exports.create_file_server = function(base_location) {
    if (base_location.substr(base_location.length-1) != '/') {
        base_location += '/';
    }

    return function(context, callback) {
        var path = context.remaining_path;

        // Make sure we've got no directory traversals in the path
        if (traversal_regex.test(path)) {
            callback(new errors.Http403());
        }

        // Build the full path and content type.
        var match = file_extension_regex.exec(path);
        if (!match) {
            callback(new errors.Http404());
        }
        var extension = match[1];
        var mime_type = mime_types.for_extension(extension);
        var encoding = (mime_type.substr(0, 4) == 'text')?"utf8":"binary";
        path = base_location + path;

        // Load and send the file.
        fs.readFile(path, encoding, function (err, file_data) {
            if (err) {
                var err = new errors.Http404();
                err.message = err.toString();
                callback(err);
            } else {
                context.response.writeHead(200, {
                    'Content-Type': mime_type,
                    'Content-Length': file_data.length
                });
                context.response.write(file_data, encoding);
                context.response.end();
                callback(null);
            }
        });
    };
};
var file_extension_regex = /.*(\.\w+)$/;
var traversal_regex = /(^|\/)\.\.\W/;
