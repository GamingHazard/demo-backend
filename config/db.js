const mongoose = require("mongoose");

// MongoDB Connection String from Environment Variables
const dbUrl =
  process.env.DB_URL ||
  "mongodb+srv://auth:b466882w@starter.ytwyuog.mongodb.net/demo?retryWrites=true&w=majority&appName=Starter";

// Mongoose Connection Options
const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
};

// Establishing the Connection
mongoose
  .connect(dbUrl, options)
  .then(() => {
    console.log(`Connected to MongoDB at ${dbUrl}`);
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
const gracefulShutdown = (msg) => {
  mongoose.connection
    .close()
    .then(() => {
      console.log(`Mongoose disconnected through ${msg}`);
      process.exit(0); // Ensure the process exits properly
    })
    .catch((err) => {
      console.error("Error during Mongoose disconnection", err);
      process.exit(1);
    });
};

// For nodemon restarts
process.once("SIGUSR2", () => {
  gracefulShutdown("nodemon restart");
});

// For app termination
process.on("SIGINT", () => {
  gracefulShutdown("app termination");
});

// For Heroku app termination
process.on("SIGTERM", () => {
  gracefulShutdown("Heroku app termination");
});
