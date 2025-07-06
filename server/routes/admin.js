const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/authorize');

// Admin routes
// Dashboard: only accessible by admin users
router.get(
  '/dashboard',
  authenticate,
  authorizeRoles('admin'),
  (req, res) => {
    return res.json({ message: 'Welcome to the admin dashboard' });
  }
);

// Additional admin operations (e.g., user management)
// router.get(
//   '/users',
//   authenticate,
//   authorizeRoles('admin'),
//   adminController.listUsers
// );

module.exports = router;
