const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
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
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
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

    const newUser = new User({ username, email, phone, password });
    newUser.verificationToken = crypto.randomBytes(20).toString("hex");

    await newUser.save();
    sendVerificationEmail(newUser.email, newUser.verificationToken);

    res.status(200).json({ message: "Registration successful" });
  } catch (error) {
    console.log("Error registering user", error);
    res.status(500).json({ message: "Error registering user" });
  }
});

const sendVerificationEmail = async (email, verificationToken) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: "auth-app",
    to: email,
    subject: "Email Verification",
    text: `Please click the following link to verify your email: https://demo-backend-85jo.onrender.com/verify/${verificationToken}`,
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

// Endpoint for logging in users

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

    const token = jwt.sign({ userId: user._id }, secretKey);

    // Send back user information along with the token
    const userInfo = {
      username: user.username,
      email: user.email,
      phone: user.phone,
      token: token,
    };

    res.status(200).json(userInfo);
  } catch (error) {
    console.log("Error during login:", error);
    res.status(500).json({ message: "Login failed" });
  }
});

// Endpoint for updating user profile
app.put("/update", async (req, res) => {
  try {
    const { userId, username, email, phone, password } = req.body;

    // Find the user by ID and update the fields
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        username: username || undefined,
        email: email || undefined,
        phone: phone || undefined,
        password: password || undefined,
      },
      { new: true, omitUndefined: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Return updated user information (excluding password for security)
    const {
      username: updatedUsername,
      email: updatedEmail,
      phone: updatedPhone,
    } = updatedUser;
    res.status(200).json({
      username: updatedUsername,
      email: updatedEmail,
      phone: updatedPhone,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update profile" });
  }
});
