const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const queueRoutes = require("./routes/queueRoutes");
const adminRoutes = require("./routes/adminRoutes");
const pipelineStatusRoutes = require("./routes/pipelineStatus");

const sequelize = require("./config/database");
const redis = require("./config/redis");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT;

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(express.static("public"));

sequelize
  .authenticate()
  .then(() => {
    console.log("Database connection verified");
  })
  .catch((err) => {
    console.error("Database connection failed:", err);
  });

app.use("/api/queue", queueRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/pipeline-status", pipelineStatusRoutes);

const server = app.listen(PORT, () => {
  console.log(`Queue Dashboard API running on port ${PORT}`);
});

redis.on("ready", async () => {
  console.log("Redis is ready for operations");
  // Scraper status initialization removed - status will be set manually through API
});

process.on("SIGTERM", () => {
  console.log("Shutting down gracefully...");
  sequelize.close();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("Shutting down gracefully...");
  sequelize.close();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

module.exports = app;
