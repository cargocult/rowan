/*
 * Copyright (c) 2009 Ian Millington. See the LICENSE file for details.
 */

var sys = require('sys');
var rowan = require('./rowan');
var controllers = rowan.controllers;

// A controller that shows how to render something to a template.
var display_foo = controllers.shortcuts.create_template_renderer(
    'templates/index.html', 
    {title:'Hello World', items:['a', 'b', 'c']}
);

// A fallback controller based on elements in the URI.
var display_bar = controllers.create_fallback([
    // The first controller checks for the magic word.
    function (context, callback) {
        if (/sesame/.test(context.remaining_path)) {
            context.response.writeHeader(200, {'Content-Type':'text/plain'});
            context.response.write("Opening...");
            context.response.close();
            callback(null);
        } else {
            callback(new rowan.core.errors.Http404());
        }
    },

    // The fallback controller just asks for it.
    controllers.shortcuts.create_static_content("What's the magic word?")
]);

// The URI fragments at the top level and the controllers they map to.
var router = controllers.create_router([
    {
        pattern:/^foo\/$/, 
        view:display_foo
    },
    {
        pattern:/^bar\//, 
        view:display_bar
    },
    {
        pattern:/^media\//,   
        view:controllers.serve_file.create_file_server('media/')
    }
]);

// Build the controller tree.
var root = controllers.create_error_handler([500], router);

// Create and run the server.
rowan.create_rowan_server(root).listen(8080);
sys.puts('Server running at http://127.0.0.1:8080/')