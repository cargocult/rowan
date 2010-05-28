#!/usr/bin/env node

/**
 * This example shows a fairly minimal, but typical structure for a Rowan
 * project. It exposes three URLs:
 *
 * /foo/ - This shows a very simple templated output, merging in a set
 *         of static data.
 *
 * /media/... - This exposes the media sub-directory in the example
 *              directory.  Visiting /foo/ should also display the
 *              Rowan logo, which is being served in this way. Serving
 *              media is a common requirement in the development phase
 *              of a user-facing web-site, but should be removed
 *              before deployment.
 *
 * /bar/... - This URL is designed to show static content output and
 *            the fallback system. The preferred view checks if
 *            'sesame' is part of the path (it can be anywhere below
 *            '/bar/' in the main path section). If so it outputs a
 *            message, if not the fallback controller passes on to the
 *            second sub-controller, which outputs a message asking
 *            for the magic word.
 *
 * There are three parts to this file. The first part defines the
 * controllers responsible for outputting content. The second defines
 * the router that maps URLs to code capable of generating a
 * response. Finally a couple of lines set up any top level behavior
 * (error handling in our case) and initialize the server.
 *
 * Note that all three of these sections do the same thing: they
 * create controllers. In other frameworks these units would be the
 * responsibility of diverse structures: a custom routing system, a
 * top level set of configuration settings, and so on. In Rowan
 * everything is a controller, which gives the framework its
 * power. However, because the three sections correspond to different
 * tasks in the development process, they are often
 * distinguished. Here I've done so using headings in the comments, in
 * larger projects they may be in different files.
 */
 /*
 * Copyright (c) 2009 Ian Millington. See the LICENSE file for details.
 */

var sys = require('sys');
var rowan = require('./rowan');
var controllers = rowan.controllers;


// OUTPUT CONTROLLERS

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
            context.response.writeHead(200, {'Content-Type':'text/plain'});
            context.response.write("Opening...");
            context.response.end();
            callback(null);
        } else {
            // If there's no magic word, we send and error, so the
            // fallback controller, below, will be called.
            callback(new rowan.core.errors.Http404());
        }
    },

    // The fallback controller asks for the magic word.
    controllers.shortcuts.create_static_content("What's the magic word?")
]);


// URLS

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


// ENTRY POINT

// Create and run the server.
var root = controllers.create_error_handler([500], router);
rowan.create_rowan_server(root).listen(8080);
