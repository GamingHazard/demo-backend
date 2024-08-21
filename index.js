const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
require("dotenv").config();
const fs = require("fs");
const path = require("path");

const app = express();
const port = 3000;
const cors = require("cors");
app.use(cors());

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
const jwt = require("jsonwebtoken");

// Check if SECRET_KEY exists in environment variables, if not, generate and save it
const secretKeyPath = path.join(__dirname, ".secret-key");
let secretKey;

if (fs.existsSync(secretKeyPath)) {
  secretKey = fs.readFileSync(secretKeyPath, "utf8");
} else {
  secretKey = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(secretKeyPath, secretKey, "utf8");
}

// Connect to MongoDB
mongoose
  .connect(process.env.DB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.error("Error Connecting to MongoDB", err);
  });

// HTTP Server
const server = app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// WebSocket Server (removed as per previous discussion)
const User = require("./models/user");

// Endpoint to register a user
app.post("/register", async (req, res) => {
  try {
    const { username, email, phone, password } = req.body;

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Create a new user
    const newUser = new User({
      username,
      email,
      phone,
      password, // Ensure password is hashed before saving
      verificationToken: crypto.randomBytes(20).toString("hex"),
    });

    await newUser.save();

    // Generate JWT token
    const token = jwt.sign({ userId: newUser._id }, secretKey, {
      expiresIn: "1h",
    });

    // Send verification email
    sendVerificationEmail(newUser.email, newUser.verificationToken);

    // Send response with user data and token
    res.status(200).json({
      message: "Registration successful",
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        phone: newUser.phone,
      },
      token, // Include the token in the response
    });
  } catch (error) {
    console.error("Error registering user", error);
    res.status(500).json({ message: "Error registering user" });
  }
});

// Email Verification Function
const sendVerificationEmail = async (email, verificationToken) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: "Uga-Cycle",
    to: email,
    subject: "Email Verification",
    text: `Please click the following link to verify your email: https://demo-backend-85jo.onrender.com/verify/${verificationToken}`,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Error sending email", error);
  }
};

// Function to send reset password email
const sendResetPasswordEmail = async (email, resetUrl) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: "company name",
    to: email,
    subject: "Password Reset Request",
    text: `You are receiving this email because you (or someone else) have requested to reset the password for your account.\n\nPlease click on the following link, or paste it into your browser, to complete the process:\n\n${resetUrl}\n\nIf you did not request this, please ignore this email and your password will remain unchanged.`,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Error sending reset password email", error);
  }
};

app.get("/verify/:token", async (req, res) => {
  try {
    const token = req.params.token;
    const user = await User.findOne({ verificationToken: token });

    if (!user) {
      return res.status(404).json({ message: "Invalid token" });
    }

    user.verified = true;
    user.verificationToken = undefined;
    await user.save();

    res.status(200).json({ message: "Email verified successfully" });
  } catch (error) {
    console.error("Error verifying token", error);
    res.status(500).json({ message: "Email verification failed" });
  }
});

// Middleware to authenticate and get user from token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (token == null) {
    console.log("Token missing");
    return res.status(401).json({ status: "fail", message: "Token required" });
  }

  jwt.verify(token, secretKey, (err, user) => {
    if (err) {
      console.log("Token invalid:", err);
      return res.status(403).json({ status: "fail", message: "Invalid token" });
    }
    req.user = user;
    next();
  });
};

// Endpoint to login users
app.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;

    // Find user by email or phone
    const user = await User.findOne({
      $or: [{ email: identifier }, { phone: identifier }],
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if the password matches
    if (user.password !== password) {
      return res
        .status(401)
        .json({ message: "wrong password,Check your password and try again" });
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, secretKey, {
      expiresIn: "1h",
    });

    res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.username,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error("Error during login", error);
    res.status(500).json({ message: "Login failed" });
  }
});
// Endpoint to get user profile
app.get("/profile/:userId", authenticateToken, async (req, res) => {
  try {
    const userId = req.params.userId;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ user });
  } catch (error) {
    console.error("Error while getting the profile", error);
    res.status(500).json({ message: "Error while getting the profile" });
  }
});

// PATCH endpoint to update user info
app.patch("/updateUser", authenticateToken, async (req, res) => {
  try {
    const { username, email, phone } = req.body;
    const userId = req.user.userId; // Use userId from the token

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { username, email, phone },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedUser) {
      return res
        .status(404)
        .json({ status: "fail", message: "User not found" });
    }

    res.status(200).json({ status: "success", results: { updatedUser } });
  } catch (error) {
    console.error("Error updating user info", error);
    res
      .status(500)
      .json({ status: "error", message: "Failed to update user info" });
  }
});

// DELETE endpoint to delete user account
app.delete("/deleteUser/:userId", authenticateToken, async (req, res) => {
  try {
    const userId = req.params.userId; // Get userId from URL
    const deleteUser = await User.findByIdAndDelete(userId);

    if (!deleteUser) {
      return res
        .status(404)
        .json({ status: "fail", message: "User not found" });
    }

    res
      .status(200)
      .json({ status: "success", message: "Account deleted successfully" });
  } catch (error) {
    console.log("Error deleting user account", error);
    res
      .status(500)
      .json({ status: "error", message: "Failed to delete account" });
  }
});

// Endpoint to request a password reset
app.post("/forgot-password", async (req, res) => {
  try {
    const { identifier } = req.body; // Accept either email or phone number

    // Check if identifier is a valid email or phone number
    const user = await User.findOne({
      $or: [{ email: identifier }, { phoneNumber: identifier }], // Search by email or phone number
    });

    if (!user) {
      return res.status(404).json({
        message: "No account found with this email address or phone number.",
      });
    }

    // Generate a reset token and expiration
    const token = crypto.randomBytes(20).toString("hex");
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

    await user.save();

    // Send email with the token if email is provided
    if (user.email) {
      const resetUrl = `https://your-frontend-url/reset-password/${token}`;
      await sendResetPasswordEmail(user.email, resetUrl);
    }

    // Respond with the token
    res.status(200).json({ token });
  } catch (error) {
    console.error("Error in /forgot-password", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Endpoint to reset password
app.patch("/reset-password/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    // Find user with the provided token and check if it is still valid
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Password reset token is invalid or has expired." });
    }

    // Update the user's password and clear the reset token
    user.password = password; // Note: Storing plaintext passwords is not secure
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    // Save the updated user
    await user.save();

    res
      .status(200)
      .json({ message: "Password has been updated successfully." });
  } catch (error) {
    console.error("Error in /reset-password/:token", error);
    res.status(500).json({ message: "Server error" });
  }
});
