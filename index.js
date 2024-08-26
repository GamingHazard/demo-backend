const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const crypto = require("crypto");
const bcrypt = require("bcrypt"); // Import bcrypt
const nodemailer = require("nodemailer");
const ws = require("ws");
require("dotenv").config();

const app = express();
const port = 3000;
const cors = require("cors");
app.use(cors());

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
const jwt = require("jsonwebtoken");

mongoose
  .connect(process.env.DB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.log("Error Connecting to MongoDB");
  });

// Create the HTTP server
const server = app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// Create the WebSocket server
const wss = new ws.Server({ server });

// WebSocket connection handling
wss.on("connection", (ws) => {
  console.log("Client connected");

  ws.on("message", (message) => {
    console.log("Received:", message);
    // Handle incoming messages and broadcast them if necessary
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });
});

const User = require("./models/user");

// Endpoint to register a user

app.post("/register", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Hash the password before saving the user
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({ name, email, phone, password: hashedPassword });
    newUser.verificationToken = crypto.randomBytes(20).toString("hex");

    await newUser.save();
    sendVerificationEmail(newUser.email, newUser.verificationToken);

    // Generate JWT token
    const token = jwt.sign({ userId: newUser._id }, secretKey, {
      expiresIn: "1h",
    });

    // Return all user details including user ID and token
    const userDetails = {
      id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      phone: newUser.phone,
      verified: newUser.verified,
      token, // Add the token to the response
    };

    res
      .status(201)
      .json({ message: "Registration successful", user: userDetails });
    console.log("User registered:", userDetails);
  } catch (error) {
    console.log("Error registering user", error);
    res.status(500).json({ message: "Error registering user" });
  }
});

const sendVerificationEmail = async (email, verificationToken) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "democompany150@gmail.com",
      pass: "jonathanharkinsb466882w",
    },
  });

  const mailOptions = {
    from: "democompany150@gmail.com",
    to: email,
    subject: "Email Verification",
    text: `Please click the following link to verify your email: https://auth-db-23ly.onrender.com/verify/${verificationToken}`,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.log("Error sending email", error);
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
    console.log("Error verifying token", error);
    res.status(500).json({ message: "Email verification failed" });
  }
});

const generateSecretKey = () => {
  return crypto.randomBytes(32).toString("hex");
};

const secretKey = generateSecretKey();

//  Endpoint for Users Login
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
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Wrong password, check your password and try again",
      });
    }

    // Generate JWT token with a secret key
    const token = jwt.sign({ userId: user._id }, "your_secret_key_here", {
      expiresIn: "1d",
    });

    // Respond with the token and user information including user ID
    res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
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
const authenticateToken = (req, res, next) => {
  const token = req.header("Authorization")?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Access denied" });

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (error) {
    res.status(400).json({ message: "Invalid token" });
  }
};

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

// DELETE endpoint to delete user account
app.delete("/deleteUser/:userId", async (req, res) => {
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

// PATCH endpoint to update user info
app.patch("/updateUser/:userId", async (req, res) => {
  const { name, email, phone } = req.body;
  const userId = req.params.userId;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  try {
    if (email) {
      const existingEmailUser = await User.findOne({
        email,
        _id: { $ne: userId },
      });
      if (existingEmailUser) {
        return res.status(400).json({ error: "Email is already in use" });
      }
    }

    if (phone) {
      const existingPhoneUser = await User.findOne({
        phone,
        _id: { $ne: userId },
      });
      if (existingPhoneUser) {
        return res
          .status(400)
          .json({ error: "Phone number is already in use" });
      }
    }

    const updateFields = {};
    if (name) updateFields.name = name;
    if (email) updateFields.email = email;
    if (phone) updateFields.phone = phone;

    const updatedUser = await User.findByIdAndUpdate(userId, updateFields, {
      new: true,
      runValidators: true,
    });

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res
      .status(200)
      .json({ message: "User updated successfully", user: updatedUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
      const resetUrl = `https://auth-db-23ly.onrender.com/reset-password/${token}`;
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
