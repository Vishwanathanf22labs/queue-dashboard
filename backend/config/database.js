const { Sequelize } = require("sequelize");
require("dotenv").config();
const { getDatabaseConfig } = require("./environmentConfig");

// Create a function to get database connection
let sequelize = null;

function getDatabaseConnection() {
  if (!sequelize) {
    // Get database configuration based on current environment
    const dbConfig = getDatabaseConfig();
    const { host: dbHost, user: myUser, password, database: mydb, port: dbPort } = dbConfig;

    sequelize = new Sequelize(mydb, myUser, password, {
      host: dbHost,
      port: dbPort,
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
    console.log(`Database connected: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
  })
  .catch((err) => {
    console.error("Database connection error:", err);
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
        console.log("Error closing previous connection (expected):", closeError.message);
      }
    }
    
    // Clear the sequelize instance
    sequelize = null;
    
    // Wait a moment for the connection to fully close
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Create new connection with current environment settings
    sequelize = getDatabaseConnection();
    
    // Test the new connection
    await sequelize.authenticate();
    const config = getDatabaseConfig();
    console.log(`Database reconnected to: ${config.host}:${config.port}/${config.database}`);
    
    return sequelize;
  } catch (error) {
    console.error("Database reconnection error:", error);
    throw error;
  }
}

module.exports = {
  sequelize,
  getDatabaseConnection,
  reinitializeDatabase
};
