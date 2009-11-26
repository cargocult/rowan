/**
 * Wrappers that allow you to create a controller-friendly promise from
 * an arbitrary one.
 */
/*
 * Copyright (c) 2009 Ian Millington. See the LICENSE file for details.
 */

var errors = require('./errors');

exports.wrap = function(promise, error_code, description) {
    var our_promise = new process.Promise();
    error_code = error_code || 500;
    promise.addCallback(function () {
        our_promise.emitSuccess();
    });
    promise.addErrback(function () {
        our_promise.emitError(new errors.HttpError(error_code, description));
    });
    return our_promise;
};
