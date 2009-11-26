/**
 * This module provides a simple templating system for Rowan using 
 * Javascript's eval() to run code interleaved with the template.
 * The syntax is inspired by Django / Jinja - double curly braces
 * indicate a variable (something that will evaluate to a value), 
 * and {% ... %} indicates something more complex - in our case a chunk
 * of javascript code.
 *
 * The final template is a compiled function which can be run on an object
 * of data. The properties in that object are the names that the template
 * can refer to.
 *
 * H/T: The micro-templating approach used in this code was inspired by 
 * a blog post by John Resig at 
 * http://ejohn.org/blog/javascript-micro-templating/
 */
/*
 * Part of the Rowan Microframework.
 * Copyright (c) 2009 Ian Millington. See the LICENSE file for details.
 */

var sys = require('sys');
var posix = require('posix');

var template_cache = {};

/**
 * Flushes the template cache.
 */
exports.flush_cache = function () {
    template_cache = {};
};

/**
 * Loads a template from the given template path. The loading is done
 * asynchronously, so this function returns a promise rather than 
 * the template. This function also caches templates so they aren't
 * recompiled each time they are used.
 */
exports.load_template = load_template = function(template_path) {
    var promise = new process.Promise();

    // Pull the template from the cache.
    var template = template_cache[template_path];
    if (template) {
        // We can't emit success immediately, because the code that
        // called us hasn't had time to register its interest yet, so
        // we delay the minimum ammount of time for the event loop to 
        // resume.
        setTimeout(function () {promise.emitSuccess(template)}, 0);
    }
    
    else {
        // We'll have to load it afresh (hence the promise)
        posix.cat(template_path).addCallback(function (content) {
            template = compile(content);
            template_cache[template_path] = template;
            promise.emitSuccess(template);
        });
    }

    return promise;
};

/**
 * Loads the given template and renders it on the given data. Because
 * template loading is asynchronous, this function returns a promise
 * rather than the rendered data.
 */
exports.render_template = function(template_path, data) {
    var promise = new process.Promise();

    load_template(template_path).addCallback(function (template) {
        promise.emitSuccess(template(data));
    });

    return promise;
};

/**
 * Compiles the given template text into a template function. This
 * can be used to build a template from an explicit string. A more common
 * use-case is to load the template from disk using the load_template()
 * function. This function synchronously returns the compiled template,
 * which can have data merged with it by calling it with an object of data.
 */
exports.compile = compile = function(template_text) {
    // Create the source for our template function from the template text
    var source = "var output = []; "+
        "var print = function(content) { output.push(content); }; "+
        "with (data) { output.push('" +

        // Convert the special tag characters into code.
        template_text
            .split('\r').join("\\r") // We can't split strings across lines 
            .split('\n').join("\\n") 
            .split("'").join("\\'") // We need single quotes, so escape them
            .replace(/{{(.*?)}}/g, "',$1,'") // Regular tags are just data
            .split("{%").join("');") // Range open tags end a statement
            .split("%}").join("; output.push('") // And close tags open one

        + "');} return output.join('');";
    
    try {
        return new Function("data", source);
    } catch (err) {
        sys.puts("Compiled template source >>>\n" + source + "\n<<<");
    }
};
 
