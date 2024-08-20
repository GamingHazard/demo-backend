const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const { sendVerificationEmail } = require("../utils/email");

const generateSecretKey = () => {
  return crypto.randomBytes(32).toString("hex");
};

const secretKey = generateSecretKey();

// Registration handler
exports.register = async (req, res) => {
  try {
    const { username, email, phone, password } = req.body;

    // Check if email is already registered
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Create new user and generate verification token
    const newUser = new User({ username, email, phone, password });
    newUser.verificationToken = crypto.randomBytes(20).toString("hex");

    // Save new user and send verification email
    await newUser.save();
    await sendVerificationEmail(newUser.email, newUser.verificationToken);

    res.status(201).json({
      message:
        "Registration successful. Please check your email for verification.",
    });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ message: "Error registering user" });
  }
};

// Email verification handler
exports.verifyEmail = async (req, res) => {
  try {
    const token = req.params.token;

    // Find user by verification token
    const user = await User.findOne({ verificationToken: token });
    if (!user) {
      return res.status(404).json({ message: "Invalid or expired token" });
    }

    // Verify user and remove token
    user.verified = true;
    user.verificationToken = undefined;
    await user.save();

    res.status(200).json({ message: "Email verified successfully" });
  } catch (error) {
    console.error("Error verifying token:", error);
    res.status(500).json({ message: "Email verification failed" });
  }
};

// Login handler
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "Invalid email" });
    }

    // Check if password matches
    if (user.password !== password) {
      return res.status(401).json({ message: "Invalid password" });
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, secretKey, {
      expiresIn: "1h",
    });

    // Return user info along with token
    const userInfo = {
      username: user.username,
      email: user.email,
      phone: user.phone,
      token: token,
    };

    res.status(200).json(userInfo);
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ message: "Login failed" });
  }
};

// Update user profile handler
exports.updateMe = async (req, res) => {
  try {
    const { username, email, phone } = req.body;
    const userId = req.user._id;

    // Update user details
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { username, email, phone },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ status: "success", data: { user: updatedUser } });
  } catch (error) {
    console.error("Error updating user profile:", error);
    res.status(500).json({ message: "Failed to update profile" });
  }
};
