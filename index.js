const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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

const User = require("./models/user");

// Endpoint to register a user with an optional profile picture upload
app.post("/register", async (req, res) => {
  try {
    const { username, email, phone, password, imagePath } = req.body;

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Upload profile picture to Cloudinary if provided
    let profileImageUrl;
    if (imagePath) {
      const uploadResponse = await cloudinary.uploader.upload(imagePath, {
        folder: "user_profiles",
      });
      profileImageUrl = uploadResponse.secure_url;
    }

    // Create a new user
    const newUser = new User({
      username,
      email,
      phone,
      password, // Ensure password is hashed before saving
      verificationToken: crypto.randomBytes(20).toString("hex"),
      profileImageUrl, // Save the profile picture URL if available
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
        profileImageUrl: newUser.profileImageUrl, // Include profile picture URL
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
    from: process.env.EMAIL_USER,
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
    from: process.env.EMAIL_USER,
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

// Verify email endpoint
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
      return res.status(401).json({
        message: "Wrong password, check your password and try again",
      });
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, secretKey, {
      expiresIn: "1h",
    });

    res.status(200).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        profileImageUrl: user.profileImageUrl, // Include profile picture URL
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
  const { username, email, phone, imagePath } = req.body;
  const userId = req.user.userId; // Use the userId from the token

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  try {
    const updateFields = {};
    if (username) updateFields.username = username;
    if (email) updateFields.email = email;
    if (phone) updateFields.phone = phone;

    // Upload new profile picture to Cloudinary if provided
    if (imagePath) {
      const uploadResponse = await cloudinary.uploader.upload(imagePath, {
        folder: "user_profiles",
      });
      updateFields.profileImageUrl = uploadResponse.secure_url;
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updateFields, {
      new: true,
      runValidators: true,
    });

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating user", error);
    res.status(500).json({ error: "Error updating user" });
  }
});

// DELETE endpoint to remove a user
app.delete("/deleteUser", authenticateToken, async (req, res) => {
  const userId = req.user.userId; // Use the userId from the token

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  try {
    const deletedUser = await User.findByIdAndDelete(userId);

    if (!deletedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user", error);
    res.status(500).json({ error: "Error deleting user" });
  }
});

// Cloudinary image upload endpoint
const multer = require("multer");
const upload = multer({ dest: "uploads/" }); // 'uploads/' is a temporary directory

// PATCH endpoint to update user info, including the profile image
app.patch(
  "/imageUrl",
  authenticateToken,
  upload.single("image"),
  async (req, res) => {
    const { username, email, phone } = req.body;
    const userId = req.user.userId; // Use the userId from the token

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    try {
      const updateFields = {};
      if (username) updateFields.username = username;
      if (email) updateFields.email = email;
      if (phone) updateFields.phone = phone;

      // Upload new profile picture to Cloudinary if provided
      if (req.file) {
        const uploadResponse = await cloudinary.uploader.upload(req.file.path, {
          folder: "user_profiles",
        });
        updateFields.profileImageUrl = uploadResponse.secure_url;

        // Delete the file from the server after uploading to Cloudinary
        fs.unlinkSync(req.file.path);
      }

      const updatedUser = await User.findByIdAndUpdate(userId, updateFields, {
        new: true,
        runValidators: true,
      });

      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      res.status(200).json({
        message: "User updated successfully",
        user: updatedUser,
      });
    } catch (error) {
      console.error("Error updating user", error);
      res.status(500).json({ error: "Error updating user" });
    }
  }
);

module.exports = app;
