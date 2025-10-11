const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const queueRoutes = require("./routes/queueRoutes");
const adminRoutes = require("./routes/adminRoutes");
const pipelineStatusRoutes = require("./routes/pipelineStatus");
const madanglesRoutes = require("./routes/madanglesRoutes");
const scrapedBrandsRoutes = require("./routes/scrapedBrandsRoutes");
const environmentRoutes = require("./routes/environmentRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const ipStatsRoutes = require("./routes/ipStatsRoutes");
const environmentMiddleware = require("./middleware/environmentMiddleware");

const { sequelize } = require("./config/database");
const { globalRedis, watchlistRedis, regularRedis } = require("./config/redis");
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
app.use(environmentMiddleware);

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
app.use("/api/madangles", madanglesRoutes);
app.use("/api/scraped-brands", scrapedBrandsRoutes);
app.use("/api/environment", environmentRoutes);
app.use("/api/queue/settings", settingsRoutes);
app.use("/api/ip-stats", ipStatsRoutes);

const server = app.listen(PORT, () => {
  console.log(`Queue Dashboard API running on port ${PORT}`);
});

Promise.all([
  new Promise((resolve) => globalRedis.on("ready", resolve)),
  new Promise((resolve) => watchlistRedis.on("ready", resolve)),
  new Promise((resolve) => regularRedis.on("ready", resolve))
]).then(() => {
  console.log("All Redis instances are ready for operations");
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
