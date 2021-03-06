/**
 * This module provides error constructors for Http errors such as
 * 404 Not Found, or 401 Unauthorized.
 */
/*
 * Part of the Rowan Microframework.
 * Copyright (c) 2009 Ian Millington. See the LICENSE file for details.
 */
var sys = require('sys');
var httpCodes = require('../information/http_codes');

/**
 * Creates a new error object for returning when a controller can't
 * complete its responsibility. Some sub-classes for specific http
 * response codes are also provided.
 */
exports.HttpError = HttpError = function(
    statusCode, description, headers, message
) {
    Error.call(this, message || "");
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.description =
        description || httpCodes.httpStatusCodes[statusCode] || "Unknown";
    this.headers = headers;
}
sys.inherits(HttpError, Error);

/** An 'Unauthorized' error. */
exports.Http401 = Http401 = function(description, headers, message) {
    HttpError.call(this, 401, description, headers, message);
};
sys.inherits(Http401, HttpError);

/** A 'Forbidden' error. */
exports.Http403 = Http403 = function(description, headers, message) {
    HttpError.call(this, 403, description, headers, message);
};
sys.inherits(Http403, HttpError);

/** A 'Not Found' error. */
exports.Http404 = Http404 = function(description, headers, message) {
    HttpError.call(this, 404, description, headers, message);
};
sys.inherits(Http404, HttpError);

/** A 'Method Not Allowed' error. */
exports.Http405 = Http405 = function(description, headers, message) {
    HttpError.call(this, 405, description, headers, message);
};
sys.inherits(Http405, HttpError);

/** A general server error. */
exports.Http500 = Http500 = function(description, headers, message) {
    HttpError.call(this, 500, description, headers, message);
};
sys.inherits(Http500, HttpError);
