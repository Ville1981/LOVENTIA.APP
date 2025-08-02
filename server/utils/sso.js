// SSO Integration (Server-side)

const passport = require('passport');
const SamlStrategy = require('passport-saml').Strategy;

module.exports = function configureSSO(app) {
  passport.use(
    new SamlStrategy(
      {
        path: '/auth/sso/callback',
        entryPoint: process.env.SSO_ENTRY_POINT,
        issuer: process.env.SSO_ISSUER,
        cert: process.env.SSO_CERT,
      },
      (profile, done) => {
        // Map SAML profile to user object
        const user = {
          id: profile.nameID,
          email:
            profile.email ||
            profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'],
          displayName: profile.displayName || profile.cn,
        };
        return done(null, user);
      }
    )
  );

  app.use(passport.initialize());

  app.get('/auth/sso/login', passport.authenticate('saml'));
  app.post(
    '/auth/sso/callback',
    passport.authenticate('saml', {
      failureRedirect: '/login',
    }),
    (req, res) => {
      // Successful login, redirect home.
      res.redirect('/');
    }
  );
};
