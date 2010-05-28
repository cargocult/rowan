/*
 * Part of the Rowan Microframework.
 * Copyright (c) 2009 Ian Millington. See the LICENSE file for details.
 */

// Expose sub-modules
exports.controllers = require('./controllers');
exports.core = require('./core');
exports.db = require('./db');
exports.information = require('./information');
exports.template = require('./template');
exports.utils = require('./utils');

// This is the main entry point for Rowan - creating a server.
exports.create_server = exports.core.create_server.create_rowan_server;