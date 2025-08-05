// Default cookie options for refreshToken
// The replacement region is marked between // --- REPLACE START and // --- REPLACE END so you can verify exactly what changed

// --- REPLACE START: define default cookie options including path ---
export const cookieOptions = {
  httpOnly: true,                           // inaccessible to JS
  sameSite: 'None',                         // allow cross-site usage
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  path: '/',                                // ensures cookie is sent on all routes
};
// --- REPLACE END ---