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

    // Return all user details including user ID
    const userDetails = {
      id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      phone: newUser.phone,
      verified: newUser.verified,
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
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "Invalid email" });
    }

    // Compare the hashed password with the provided password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(404).json({ message: "Invalid password" });
    }

    const token = jwt.sign({ userId: user._id }, secretKey);

    // Return all user details including user ID
    const userDetails = {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      verified: user.verified,
      token: token, // Include the JWT token in the response
    };

    res.status(200).json({ message: "Login successful", user: userDetails });
    console.log("User logged in:", userDetails);
  } catch (error) {
    console.log("Error logging in", error);
    res.status(500).json({ message: "Login failed" });
  }
});

// Endpoint to get user profile
app.get("/profile/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ message: "Error while getting the profile" });
  }
});
