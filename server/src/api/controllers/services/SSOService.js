// --- REPLACE START: convert ESM to CommonJS; keep logic intact ---
'use strict';

/**
 * SSO (SAML) service using passport-saml.
 */
const passport = require('passport');
const { Strategy: SamlStrategy } = require('passport-saml');
const User = require('../../models/User.js');

// SAML strategy configuration
passport.use(new SamlStrategy(
  {
    entryPoint: process.env.SSO_ENTRY_POINT,
    issuer: process.env.SSO_ISSUER,
    callbackUrl: process.env.SSO_CALLBACK_URL,
    cert: process.env.SSO_CERT,
  },
  async (profile, done) => {
    try {
      const email =
        profile.email ||
        profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'];

      let user = await User.findOne({ email });
      if (!user) {
        user = await User.create({ email, name: profile.cn });
      }
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

class SSOService {
  static initialize(app) {
    app.use(passport.initialize());
    app.get('/auth/sso', passport.authenticate('saml'));
    app.post(
      '/auth/sso/callback',
      passport.authenticate('saml', { failureRedirect: '/login' }),
      (req, res) => {
        res.redirect('/');
      }
    );
  }
}

module.exports = { SSOService };
// --- REPLACE END ---
