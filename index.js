const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const crypto = require("crypto");
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
    console.error("Error Connecting to MongoDB", err);
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
    const { username, email, phone, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const newUser = new User({
      username,
      email,
      phone,
      password,
      verificationToken: crypto.randomBytes(20).toString("hex"),
    });

    await newUser.save();

    sendVerificationEmail(newUser.email, newUser.verificationToken);

    res.status(200).json({
      message: "Registration successful",
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        phone: newUser.phone,
        // Include other fields as necessary
      },
    });
  } catch (error) {
    console.error("Error registering user", error);
    res.status(500).json({ message: "Error registering user" });
  }
});

// Verify user email
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
  if (token == null)
    return res.status(401).json({ status: "fail", message: "Token required" });

  jwt.verify(token, process.env.SECRET_KEY, (err, user) => {
    if (err)
      return res.status(403).json({ status: "fail", message: "Invalid token" });
    req.user = user;
    next();
  });
};

// Endpoint to login users
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "Invalid email" });
    }

    if (user.password !== password) {
      return res.status(404).json({ message: "Invalid password" });
    }

    const token = jwt.sign({ userId: user._id }, process.env.SECRET_KEY, {
      expiresIn: "1h",
    });

    res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.username,
        email: user.email,
        phone: user.phone,
        // Include other fields as necessary
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
app.delete("/deleteUser", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId; // Use userId from the token
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
