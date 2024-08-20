const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

router.post("/register", authController.register);
router.get("/verify/:token", authController.verifyEmail);
router.post("/login", authController.login);
router.patch("/updateProfile", authController.updateMe);

module.exports = router;
