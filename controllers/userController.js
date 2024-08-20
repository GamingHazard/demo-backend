const User = require("../models/user");

exports.updateUser = async (req, res) => {
  try {
    const { userId, username, email, phone, password } = req.body;

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
};
