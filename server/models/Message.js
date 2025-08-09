// server/models/Message.js
// --- REPLACE START: ESM wrapper that default-exports the CommonJS Message model ---
//
// Why this file exists:
// - Your project runs ESM ("type": "module").
// - The actual Mongoose model implementation is CommonJS at server/models/Message.cjs
// - Code imports this file like:  import Message from '../models/Message.js'
//   This wrapper performs safe ESM <-> CJS interop.
//
// What changed:
// - We use createRequire() to pull in the CJS model.
// - We default-export it for ESM consumers and also provide named exports.
// - We add clear error messages if loading fails or returns an unexpected shape.
//

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

let LoadedMessage;

try {
  // eslint-disable-next-line import/no-commonjs
  const maybeModule = require('./Message.cjs');
  LoadedMessage = maybeModule && maybeModule.default ? maybeModule.default : maybeModule;

  if (typeof LoadedMessage !== 'function') {
    throw new TypeError(
      '[models/Message.js] Loaded Message model is not a constructor/function. ' +
      'Ensure server/models/Message.cjs exports the Mongoose model via module.exports = MessageModel;'
    );
  }
} catch (err) {
  const details = (err && err.message) ? `\nOriginal error: ${err.message}` : '';
  throw new Error(
    '[models/Message.js] Failed to load CommonJS model from ./Message.cjs. ' +
    'This ESM wrapper requires the CJS file to exist and export the model via module.exports.' +
    details
  );
}

// ESM default export
export default LoadedMessage;

// Optional named exports
export const Message = LoadedMessage;
export const MessageModel = LoadedMessage;

// --- REPLACE END ---
