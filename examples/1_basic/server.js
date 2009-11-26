var sys = require('sys');
var rowan = require('./rowan');

var urls = [
    {pattern:/^foo\//, view:function (context) {
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
    }}
];
var root_controller = rowan.controllers.router(urls);
//root_controller = rowan.controllers.error_handler(root_controller);

rowan.createRowanServer(root_controller).listen(8080);
sys.puts('Server running at http://127.0.0.1:8080/')