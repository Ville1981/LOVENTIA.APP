// --- REPLACE START: path helpers to avoid brittle ../../ hops ---
'use strict';
const path = require('path');

// __dirname = server/src/utils
const SRC_ROOT     = path.resolve(__dirname, '..');       // server/src
const SERVER_ROOT  = path.resolve(__dirname, '..', '..'); // server

const fromSrc     = (...segments)    => path.resolve(SRC_ROOT, ...segments);
const fromServer  = (...segments)    => path.resolve(SERVER_ROOT, ...segments);

const PATHS = {
  SRC_ROOT,
  SERVER_ROOT,
  models:  fromServer('models'),       // server/models
  routes:  fromSrc('routes'),          // server/src/routes
  api:     fromSrc('api'),
  utils:   fromSrc('utils'),
  mw:      fromSrc('middleware'),
  cfg:     fromSrc('config'),
  vals:    fromSrc('validators'),
};

module.exports = { fromSrc, fromServer, PATHS };
// --- REPLACE END ---
