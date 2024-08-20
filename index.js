const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware Setup
app.use(cors()); // Enable CORS for all requests
app.use(helmet()); // Secure your app by setting various HTTP headers
app.use(bodyParser.urlencoded({ extended: false })); // Parse application/x-www-form-urlencoded
app.use(bodyParser.json()); // Parse application/json
app.use(morgan("tiny")); // Log HTTP requests

// Database Configuration
require("./config/db"); // Separate file for DB connection logic

// Route Imports
const authRoutes = require("./routes/authRoutes");

// Route Setup
app.use("/auth", authRoutes);

// Error Handling Middleware
// 404 Route Not Found
app.use((req, res, next) => {
  res.status(404).json({ message: "Route not found" });
});

// General Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack); // Log error stack trace
  res.status(500).json({ message: "Internal Server Error" });
});

// Start the Server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
