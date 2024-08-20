const nodemailer = require("nodemailer");

exports.sendVerificationEmail = async (email, verificationToken) => {
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
