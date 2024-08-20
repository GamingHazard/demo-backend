const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: String,
  email: { type: String, unique: true },
  phone: String,
  password: String,
  verificationToken: String,
  verified: { type: Boolean, default: false },
});

module.exports = mongoose.model("User", userSchema);
