/**
 * This module provides error constructors for Http errors such as 
 * 404 Not Found, or 401 Unauthorized.
 */
/*
 * Part of the Rowan Microframework.
 * Copyright (c) 2009 Ian Millington. See the LICENSE file for details.
 */
var sys = require('sys');
var http_codes = require('../information/http_codes');

/**
 * Creates a new error object for throwing when a controller can't complete
 * its responsibility. Some sub-classes for specific http response codes are 
 * also provided.
 */
exports.HttpError = HttpError = function(status_code, description, headers) {
    this.status_code = status_code;
    this.description = 
        description || http_codes.http_status_codes[status_code] || "Unknown";
    this.headers = headers;
}

/** An 'Unauthorized' error. */
exports.Http401 = Http401 = function(description) {
    HttpError.apply(this, [401, description]);
};
sys.inherits(Http401, HttpError);

/** A 'Forbidden' error. */
exports.Http403 = Http403 = function(description) {
    HttpError.apply(this, [403, description]);
};
sys.inherits(Http403, HttpError);

/** A 'Not Found' error. */
exports.Http404 = Http404 = function(description) {
    HttpError.apply(this, [404, description]);
};
sys.inherits(Http404, HttpError);

/** A 'Method Not Allowed' error. */
exports.Http405 = Http405 = function(description) {
    HttpError.apply(this, [405, description]);
};
sys.inherits(Http405, HttpError);

/** A general server error. */
exports.Http500 = Http500 = function(description) {
    HttpError.apply(this, [500, description]);
};
sys.inherits(Http500, HttpError);
