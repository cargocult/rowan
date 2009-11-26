/*
 * Copyright (c) 2009 Ian Millington. See the LICENSE file for details.
 */

var sys = require('sys');
var rowan = require('./rowan');

// A controller that shows how to render something to a template.
var display_foo = function (context) {
    return rowan.template.render_template(
        'templates/index.html', 
        {title:'Hello World', items:['a', 'b', 'c']}
    ).addCallback(
        function (result) {
            context.response.sendHeader(200, {'Content-Type':'text/html'});
            context.response.sendBody(result);
            context.response.finish();
        }
    );
};

// A fallback controller based on elements in the URI.
var display_bar = rowan.controllers.fallback([
    // The first controller checks for the magic word.
    function (context) {
        if (/sesame/.test(context.remaining_path)) {
            context.response.sendHeader(200, {'Content-Type':'text/plain'});
            context.response.sendBody("Opening...");
            context.response.finish();
        } else {
            throw rowan.core.errors.Http404();
        }
    },

    // The fallback controller just asks for it.
    function (context) {
        context.response.sendHeader(200, {'Content-Type':'text/plain'});
        context.response.sendBody("What's the magic word?");
        context.response.finish();
    }
]);

// The URI fragments at the top level and the controllers they map to.
var urls = [
    {pattern:/^foo\//, view:display_foo},
    {pattern:/^bar\//, view:display_bar},
    {pattern:/^media\//, view:rowan.controllers.serve_file.serve('media/')}
];

// Build the controller tree.
var router = rowan.controllers.router(urls);
var root = router;//rowan.controllers.error_handler([500], router);

// Create and run the server.
rowan.createRowanServer(root).listen(8080);
sys.puts('Server running at http://127.0.0.1:8080/')