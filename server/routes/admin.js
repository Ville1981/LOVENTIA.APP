const express = require('express');
const router = express.Router();
const { authenticate, authorizeAdmin } = require('../middleware/authMiddleware');

// Admin-reitit
// Dashboard: vain admin-käyttäjille
router.get(
  '/dashboard',
  authenticate,
  authorizeAdmin,
  (req, res) => {
    return res.json({ message: 'Welcome to the admin dashboard' });
  }
);

// Voit lisätä tänne lisää admin-toimintoja, esim. käyttäjähallinnan
// router.get('/users', authenticate, authorizeAdmin, adminController.listUsers);

module.exports = router;
