// File: server/routes/admin.js

// --- REPLACE START: switch to ESM import for express ---
import express from "express";
// --- REPLACE END ---
const router = express.Router();

// --- REPLACE START: switch middleware imports to project-standard ESM paths ---
import authenticate from "../middleware/authenticate.js";
import roleAuthorization from "../middleware/roleAuthorization.js";
// --- REPLACE END ---

// Admin routes
// Dashboard: only accessible by admin users
router.get(
  "/dashboard",
  // --- REPLACE START: use authenticate + roleAuthorization('admin') consistently ---
  authenticate,
  roleAuthorization("admin"),
  // --- REPLACE END ---
  (req, res) => {
    return res.json({ message: "Welcome to the admin dashboard" });
  }
);

// Additional admin operations (e.g., user management)
// router.get(
//   '/users',
//   authenticate,
//   roleAuthorization('admin'),
//   adminController.listUsers
// );

// --- REPLACE START: switch to ESM default export ---
export default router;
// --- REPLACE END ---
