// Load environment variables FIRST before any other imports
require("dotenv").config();

const { Sequelize } = require("sequelize");
const { getDatabaseConfig } = require("./environmentConfig");

// Create a function to get database connection
let sequelize = null;

function getDatabaseConnection() {
  if (!sequelize) {
    // Get database configuration based on current environment
    const dbConfig = getDatabaseConfig();
    const {
      host: dbHost,
      user: myUser,
      password,
      database: mydb,
      port: dbPort,
    } = dbConfig;

    // Debug: Log what we're getting (remove after fixing)
    console.log("🔍 Debug - DB Config:", {
      host: dbHost,
      user: myUser,
      password: password ? `***${password.length} chars***` : "❌ MISSING",
      database: mydb,
      port: dbPort,
    });

    // ✅ FIXED: Check if password exists before creating connection
    if (!password) {
      throw new Error(
        `Database password is missing for the current environment. Please check your .env file.`
      );
    }

    // Ensure password is a string (PostgreSQL requires string password)
    const stringPassword = String(password);

    // Validate other required fields
    if (!dbHost || !myUser || !mydb || !dbPort) {
      throw new Error(
        `Database configuration is incomplete. Missing: ${[
          !dbHost && "host",
          !myUser && "user",
          !mydb && "database",
          !dbPort && "port",
        ]
          .filter(Boolean)
          .join(", ")}`
      );
    }

    sequelize = new Sequelize(mydb, myUser, stringPassword, {
      host: dbHost,
      port: parseInt(dbPort),
      dialect: "postgres",
      logging: false,
      pool: {
        max: 5,
        min: 1,
        acquire: 30000,
        idle: 10000,
      },
    });
  }
  return sequelize;
}

// Initialize the connection
sequelize = getDatabaseConnection();

sequelize
  .authenticate()
  .then(() => {
    const dbConfig = getDatabaseConfig();
    console.log(
      `Database connected: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`
    );
  })
  .catch((err) => {
    console.error("Database connection failed:", err.message);
  });

// Function to reinitialize database connection for environment switch
async function reinitializeDatabase() {
  try {
    // Close existing connection if it exists
    if (sequelize) {
      try {
        await sequelize.close();
        console.log("Previous database connection closed");
      } catch (closeError) {
        console.log(
          "Error closing previous connection (expected):",
          closeError.message
        );
      }
    }

    // Clear the sequelize instance
    sequelize = null;

    // Wait a moment for the connection to fully close
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Create new connection with current environment settings
    sequelize = getDatabaseConnection();

    // Test the new connection
    await sequelize.authenticate();
    const config = getDatabaseConfig();
    console.log(
      `Database reconnected to: ${config.host}:${config.port}/${config.database}`
    );

    return sequelize;
  } catch (error) {
    console.error("Database reconnection error:", error.message);
    throw error;
  }
}

module.exports = {
  sequelize,
  getDatabaseConnection,
  reinitializeDatabase,
};
