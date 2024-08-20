const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

// Register a new user
router.post("/register", authController.register);

// Verify email address
router.get("/verify/:token", authController.verifyEmail);

// Login a user
router.post("/login", authController.login);

// Update user profile
router.patch("/updateProfile", authController.updateMe);

module.exports = router;
