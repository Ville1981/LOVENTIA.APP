// src/api/routes/auth/ldapRoutes.js  (Server-side)

import express from 'express';
import { authenticateLdap } from '../../utils/ldapClient.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

/**

LDAP login route
*/
router.post('/auth/ldap', async (req, res, next) => {
const { username, password } = req.body;
try {
await authenticateLdap(username, password);
// Geneerataan JWT
const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '1h' });
res.json({ success: true, token });
} catch (err) {
res.status(401).json({ success: false, message: 'Authentication failed' });
}
});

export default router;