/*
 * Part of the Rowan Microframework.
 * Copyright (c) 2009 Ian Millington. See the LICENSE file for details.
 */

// Expose sub-modules
exports.core = require('./core');
exports.utils = require('./utils');
exports.information = require('./information');
exports.controllers = require('./controllers');
exports.template = require('./template');
exports.store = require('./store');

// This is the main entry point for Rowan - creating a server.
exports.create_server = exports.core.create_server.create_rowan_server;