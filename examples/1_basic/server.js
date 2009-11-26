/*
 * Copyright (c) 2009 Ian Millington. See the LICENSE file for details.
 */

var sys = require('sys');
var rowan = require('./rowan');

// Controller functions for generating output.
var display_foo = function (context) {
    rowan.template.render_template(
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

// Create a mapping from urls to controllers.
var urls = [
    {pattern:/^foo\//, view:display_foo}
];

// Build the controller tree.
var router = rowan.controllers.router(urls);
var root = rowan.controllers.error_handler([500], router);

// Create and run the server.
rowan.createRowanServer(root).listen(8080);
sys.puts('Server running at http://127.0.0.1:8080/')