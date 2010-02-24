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
var fs = require('fs');
var core = require('./core');

var template_cache = {};

/**
 * Flushes the template cache.
 */
exports.flush_cache = function () {
    template_cache = {};
};

/**
 * Loads a template from the given template path. The loading is done
 * asynchronously, so this function takes a callback function. The
 * callback takes two params, the first is the error (if any), the
 * second is the loaded template object (on success). Each time you
 * ask to load a template, it is reloaded from scratch. Normally you
 * want to use the get() method, below, which will return the template
 * from the cache. A call to load() updates, but does not query the
 * cache.
 */
exports.load = load = function(template_path, callback) {
    fs.readFile(template_path, function (err, content) {
        if (err) callback(err);
        else {
            // Place it in the cache before returning.
            template = compile(content);
            template_cache[template_path] = template;
            callback(null, template);
        }
    });
};

/**
 * Loads a template from the given template path. The loading is done
 * asynchronously, so this function takes a callback function. The
 * callback takes two params, the first is the error (if any), the
 * second is the loaded template object (on success). This function
 * also caches templates so they aren't recompiled each time they are
 * used.
 */
exports.get = get = function(template_path, callback) {
    // Pull the template from the cache if we can, otherwise load it.
    var template = template_cache[template_path];
    if (template) callback(null, template);
    else load(template_path, callback);
};

/**
 * Loads the given template and renders it on the given data. Because
 * template loading is asynchronous, this function takes a callback
 * function of two args: an error, or the rendered template.
 */
exports.render = function(template_path, data, callback) {
    get(template_path, function (err, template) {
        if (err) callback(err);
        else callback(null, template(data));
    });
};

/**
 * Compiles the given template text into a template function. This can
 * be used to build a template from an explicit string. A more common
 * use-case is to load the template from disk or the cache using the
 * get() function. This function synchronously returns the compiled
 * template, which can have data merged with it by calling it with an
 * object of data.
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
            .split("{%").join("');") // Range open tags end a JS statement
            .split("%}").join("; output.push('") // And close tags open one

        + "');} return output.join('');";
    
    try {
        return new Function("data", source);
    } catch (err) {
        sys.puts("Compiled template source >>>\n" + source + "\n<<<");
    }
};
 
