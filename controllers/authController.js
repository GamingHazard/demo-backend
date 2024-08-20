const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const { sendVerificationEmail } = require("../utils/email");

const generateSecretKey = () => {
  return crypto.randomBytes(32).toString("hex");
};

const secretKey = generateSecretKey();

exports.register = async (req, res) => {
  try {
    const { username, email, phone, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const newUser = new User({ username, email, phone, password });
    newUser.verificationToken = crypto.randomBytes(20).toString("hex");

    await newUser.save();
    await sendVerificationEmail(newUser.email, newUser.verificationToken);

    res.status(200).json({ message: "Registration successful" });
  } catch (error) {
    console.log("Error registering user", error);
    res.status(500).json({ message: "Error registering user" });
  }
};

exports.verifyEmail = async (req, res) => {
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
};

exports.login = async (req, res) => {
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
};

exports.updateMe = async (req, res, next) => {
  const { username, email } = req.body;
  const newUser = { username, email };
  const updateUser = await User.findByIdAndUpdate(req.user._id, newUser, {
    new: true,
    runValidators: true,
  });
  res.status(200).json({ status: "success", results: { updateUser } });
};
