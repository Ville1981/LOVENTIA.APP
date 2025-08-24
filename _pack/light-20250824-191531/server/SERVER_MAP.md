SERVER_MAP.md
Overview

This document maps Routes → Controllers → Middleware → Models for the Loventia backend.
It also lists unmounted (legacy) files and provides verification commands to keep imports wired correctly.
Mounted routes (as of current startup log)

    Startup log showed these endpoints:

POST /api/payment/stripe-webhook
POST /api/payment/paypal-webhook
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/messages/conversations
GET  /api/messages/:partnerId
POST /api/messages/:partnerId
POST /api/users/register
POST /api/users/login
GET  /api/users/me
GET  /api/users/profile
PUT  /api/users/profile
POST /api/users/like/:id
POST /api/users/superlike/:id
POST /api/users/block/:id
POST /api/users/upgrade-premium
GET  /api/users/matches
GET  /api/users/who-liked-me
GET  /api/users/nearby
POST /api/users/:id/upload-avatar
POST /api/users/:id/upload-photos
POST /api/users/:id/upload-photo-step
DELETE /api/users/:id/photos/:slot
OPTIONS /api/images/:userId/photos/upload-photo-step
POST   /api/images/:userId/upload-avatar
POST   /api/images/:userId/photos
POST   /api/images/:userId/photos/upload-photo-step
DELETE /api/images/:userId/photos/:slot

index.js mounts (current branch):

    app.use('/api/auth', authRoutes);                 // server/src/routes/authRoutes.js
    app.use('/api/messages', authenticate, messageRoutes); // server/routes/messageRoutes.js
    app.use('/api/users',    authenticate, userRoutes);    // server/routes/userRoutes.js
    app.use('/api/images',   authenticate, imageRoutes);   // server/routes/imageRoutes.js
    app.use('/api/payment/stripe-webhook', stripeWebhookRouter); // server/routes/stripeWebhook.js
    app.use('/api/payment/paypal-webhook',  paypalWebhookRouter); // server/routes/paypalWebhook.js

Route → Controller → Middleware → Models
Route mount (prefix)	Route file	Controller(s) (imported in route)	Middleware used (at mount or per-route)	Models (imported in controller)	Notes
/api/auth	server/src/routes/authRoutes.js	server/src/api/controllers/authController.js	(optional validators if present)	server/src/models/User.js or server/models/User.js (controller resolves both; also uses cookieOptions)	Confirm that authRoutes.js imports ../api/controllers/authController.js (ESM).
/api/users	server/routes/userRoutes.js	server/controllers/userController.js (or server/src/controllers/userController.js if route uses src)	server/middleware/authenticate.js (at mount), plus per-route validators/upload if used	Typically server/models/User.js, server/models/Image.js	Check the top of userRoutes.js for actual controller import path.
/api/messages	server/routes/messageRoutes.js	server/controllers/messageController.js	server/middleware/authenticate.js (at mount)	server/models/Message.js, possibly server/models/User.js	—
/api/images	server/routes/imageRoutes.js	server/controllers/imageController.js	server/middleware/authenticate.js (at mount), plus upload.js if used	server/models/Image.js, possibly server/models/User.js	—
/api/payment/stripe-webhook	server/routes/stripeWebhook.js	(usually inline handlers or controllers/payment/stripeController.js)	must use raw body for signature verification	—	File exists since route is registered; ensure it’s under server/routes/stripeWebhook.js (Windows paths can hide if extension differs).
/api/payment/paypal-webhook	server/routes/paypalWebhook.js	(usually inline handlers or controllers/payment/paypalController.js)	may require raw body	—	Same as above.

    If any route file uses server/src/... vs server/..., prefer one consistent layout. Current index.js mixes src (for auth) and root routes for others; it works, but pick one convention long-term.

Legacy / unmounted (present in repo but not mounted by index.js)

These files exist per your find output but are not mounted in the current index.js:
Routes (unmounted)

    server/src/api/routes/auth/ldapRoutes.js

    server/src/api/routes/authRoutes.js (duplicate of the mounted server/src/routes/authRoutes.js)

    server/src/api/routes/featureFlagRoutes.js

    server/src/api/routes/referralRoutes.js

    server/src/api/routes/socialRoutes.js

    server/routes/auth.js (older variant, not mounted)

Controllers (additional/duplicate)

    server/controllers/discoverController.js (no discoverRoutes mounted)

    server/controllers/moderationController.js (no route visible for moderation)

    server/src/controllers/userController.js (duplicate? main one used likely server/controllers/userController.js)

    server/src/api/controllers/ReferralController.js (related to unmounted referral routes)

Middleware (available but may be unused in mounted routes)

    server/middleware/auth.js, server/middleware/authMiddleware.js (older variants)

    server/middleware/authorize.js, server/middleware/metricsMiddleware.js, server/middleware/moderation.js, server/middleware/profileValidator.js, server/middleware/sanitizer.js, server/middleware/upload.js

    server/src/middleware/authenticate.js (duplicate of server/middleware/authenticate.js; index.js uses the root one)

    server/src/middleware/* (xssSanitizer, sqlSanitizer, validateRequest, etc.)

Models (extra / duplicated under src)

    Root: server/models/User.js, Image.js, Message.js, RefreshToken.js, Subscription.js

    Src: server/src/models/User.js, Message.js

    API models: server/src/api/models/ReferralBonus.js, RewardLog.js (used by referral routes, currently unmounted)

Path consistency recommendations

    Stick to one tree for runtime imports (either server/ or server/src/).

        Currently mounted: auth from server/src/..., others from server/....

        Suggestion: move authRoutes.js to server/routes/ (or flip others to server/src/routes/) to be consistent.

    Deduplicate authenticate middleware

        Keep server/middleware/authenticate.js, remove or archive server/src/middleware/authenticate.js.

        Ensure all routes import the same file.

    Decide the source of User model

        Prefer server/models/User.js (root).

        If authController’s CJS version does dynamic/fallback loading between src and root, keep that logic but migrate towards a single model path.

    Webhooks

        The server registered /api/payment/stripe-webhook and /api/payment/paypal-webhook, so files exist at runtime.

        Verify on disk: ensure server/routes/stripeWebhook.js and server/routes/paypalWebhook.js exist and include the raw-body handling needed by Stripe/PayPal.
