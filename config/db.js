const mongoose = require("mongoose");

// MongoDB Connection String from Environment Variables
const dbUrl = process.env.DB_URL;
// "mongodb+srv://auth:b466882w@starter.ytwyuog.mongodb.net/demo?retryWrites=true&w=majority&appName=Starter";

// Mongoose Connection Options
const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  // Removed deprecated options
};

// Establishing the Connection
mongoose
  .connect(dbUrl, options)
  .then(() => {
    console.log(`Connected to MongoDB`);
  })
  .catch((err) => {
    console.error("Error Connecting to MongoDB:", err);
    process.exit(1); // Exit the process with failure (non-zero code) if unable to connect
  });

// Handling Connection Events
mongoose.connection.on("connected", () => {
  console.log("Mongoose connected to DB");
});

mongoose.connection.on("error", (err) => {
  console.error(`Mongoose connection error: ${err}`);
});

mongoose.connection.on("disconnected", () => {
  console.log("Mongoose disconnected from DB");
});

// Graceful Shutdown
const gracefulShutdown = (msg, callback) => {
  mongoose.connection.close(() => {
    console.log(`Mongoose disconnected through ${msg}`);
    callback();
  });
};

// For nodemon restarts
process.once("SIGUSR2", () => {
  gracefulShutdown("nodemon restart", () => {
    process.kill(process.pid, "SIGUSR2");
  });
});

// For app termination
process.on("SIGINT", () => {
  gracefulShutdown("app termination", () => {
    process.exit(0);
  });
});

// For Heroku app termination
process.on("SIGTERM", () => {
  gracefulShutdown("Heroku app termination", () => {
    process.exit(0);
  });
});
