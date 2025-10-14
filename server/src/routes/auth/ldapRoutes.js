// --- REPLACE START: convert ESM import/export to CommonJS; keep logic intact ---
'use strict';

const express = require('express');
const { authenticateLdap } = require('../../utils/ldapClient.js');
const jwt = require('jsonwebtoken');

const router = express.Router();

/**
 * LDAP login route
 */
router.post('/auth/ldap', async (req, res, next) => {
  const { username, password } = req.body;
  try {
    await authenticateLdap(username, password);

    // Generate JWT
    const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ success: true, token });
  } catch (err) {
    // 401 for failed authentication to avoid leaking details
    res.status(401).json({ success: false, message: 'Authentication failed' });
  }
});

module.exports = router;
// --- REPLACE END ---
