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
var mimeTypes = require('../information/mime_types');

/**
 * A controller that serves files from a particular path on the hard-drive.
 * When you create the controller you need to specify the path it will serve
 * from.
 */
exports.createFileServer = function(baseLocation) {
    if (baseLocation.substr(baseLocation.length-1) != '/') {
        baseLocation += '/';
    }

    return function(context, callback) {
        var path = context.remainingPath;

        // Make sure we've got no directory traversals in the path
        if (traversalRegex.test(path)) {
            callback(new errors.Http403());
        }

        // Build the full path and content type.
        var match = fileExtensionRegex.exec(path);
        if (!match) {
            callback(new errors.Http404());
        }
        var extension = match[1];
        var mimeType = mimeTypes.forExtension(extension);
        var encoding = (mimeType.substr(0, 4) == 'text')?"utf8":"binary";
        path = baseLocation + path;

        // Load and send the file.
        fs.readFile(path, encoding, function (err, fileData) {
            if (err) {
                var err = new errors.Http404();
                err.message = err.toString();
                callback(err);
            } else {
                context.response.setStatus(200);
                context.response.addHeaders({
                    'Content-Type': mimeType,
                    'Content-Length': fileData.length
                });
                context.response.write(fileData, encoding);
                context.response.end();
                callback(null);
            }
        });
    };
};
var fileExtensionRegex = /.*(\.\w+)$/;
var traversalRegex = /(^|\/)\.\.\W/;
