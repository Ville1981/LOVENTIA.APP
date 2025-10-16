# Pure ESM refactor — ready

- All new files use import/export only.
- package.json has `"type": "module"` and scripts to run `server.js`.

## Run
```bash
npm run server
# or: npm start
```

## Notes
- If any legacy routes are CommonJS, Node ESM will import their default export.
- Add/keep Stripe raw-body handlers in `webhooks/stripe.js`.
- Put helmet/xss/rateLimit/mongoSanitize/hpp etc. into `middleware/security.js`.
