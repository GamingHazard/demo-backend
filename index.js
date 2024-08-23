// Required modules
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
const multer = require("multer");
const fileType = require("file-type");

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

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Set the destination folder
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Set the file name
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
  fileFilter: async (req, file, cb) => {
    const type = await fileType.fromBuffer(file.buffer);
    if (type && ["image/jpeg", "image/png", "image/gif"].includes(type.mime)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, and GIF are allowed."));
    }
  },
});

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

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

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
      password: hashedPassword, // Save hashed password
      verificationToken: crypto.randomBytes(20).toString("hex"),
      profileImageUrl,
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
        profileImageUrl: newUser.profileImageUrl,
      },
      token,
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
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Wrong password, check your password and try again",
      });
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, secretKey, {
      expiresIn: "1h",
    });

    res.status(200).json({
      message: "Login successful",
      token,
    });
  } catch (error) {
    console.error("Error logging in", error);
    res.status(500).json({ message: "Error logging in" });
  }
});

// Route to update user profile
app.put(
  "/update-profile",
  authenticateToken,
  upload.single("profileImage"),
  async (req, res) => {
    try {
      const { username, email, phone } = req.body;
      const userId = req.user.userId;

      // Find user and update fields
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (username) user.username = username;
      if (email) user.email = email;
      if (phone) user.phone = phone;
      if (req.file) {
        // If a new profile picture is uploaded, update the URL
        const uploadResponse = await cloudinary.uploader.upload(req.file.path, {
          folder: "user_profiles",
        });
        user.profileImageUrl = uploadResponse.secure_url;
      }

      await user.save();

      res.status(200).json({
        message: "Profile updated successfully",
        user,
      });
    } catch (error) {
      console.error("Error updating profile", error);
      res.status(500).json({ message: "Error updating profile" });
    }
  }
);

// Route to delete user profile
app.delete("/delete-profile", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Delete user from database
    const result = await User.findByIdAndDelete(userId);
    if (!result) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "Profile deleted successfully" });
  } catch (error) {
    console.error("Error deleting profile", error);
    res.status(500).json({ message: "Error deleting profile" });
  }
});

// Route to handle forgot password
app.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate reset token and URL
    const resetToken = crypto.randomBytes(20).toString("hex");
    user.resetToken = resetToken;
    user.resetTokenExpiry = Date.now() + 3600000; // 1 hour
    await user.save();

    const resetUrl = `https://demo-backend-85jo.onrender.com/reset-password/${resetToken}`;

    // Send reset password email
    await sendResetPasswordEmail(user.email, resetUrl);

    res.status(200).json({ message: "Reset password email sent" });
  } catch (error) {
    console.error("Error handling forgot password", error);
    res.status(500).json({ message: "Error handling forgot password" });
  }
});

// Route to handle reset password
app.post("/reset-password/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    // Find user by reset token
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() },
    });
    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Error resetting password", error);
    res.status(500).json({ message: "Error resetting password" });
  }
});
