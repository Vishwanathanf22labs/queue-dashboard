// Load environment variables FIRST before any other imports
require("dotenv").config();

const { Sequelize } = require("sequelize");
const { getDatabaseConfig } = require("./environmentConfig");

const connections = {
  production: null,
  stage: null
};


function createConnection(environment) {
  const dbConfig = getDatabaseConfig(environment);
  const {
    host: dbHost,
    user: myUser,
    password,
    database: mydb,
    port: dbPort,
  } = dbConfig;


  if (!password) {
    throw new Error(
      `Database password is missing for ${environment} environment. Please check your .env file.`
    );
  }

  if (!dbHost || !myUser || !mydb || !dbPort) {
    throw new Error(
      `Database configuration is incomplete for ${environment}. Missing: ${[
        !dbHost && "host",
        !myUser && "user",
        !mydb && "database",
        !dbPort && "port",
      ]
        .filter(Boolean)
        .join(", ")}`
    );
  }

  const stringPassword = String(password);

  return new Sequelize(mydb, myUser, stringPassword, {
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


function getDatabaseConnection(environment = 'production') {
  if (!connections[environment]) {
    connections[environment] = createConnection(environment);
    
    connections[environment]
      .authenticate()
      .then(() => {
        const dbConfig = getDatabaseConfig(environment);
        console.log(
          `Database connected [${environment}]: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`
        );
      })
      .catch((err) => {
        console.error(`Database connection failed [${environment}]:`, err.message);
      });
  }
  return connections[environment];
}


console.log("Initializing database connections for all environments...");
getDatabaseConnection('production');
getDatabaseConnection('stage');


const sequelize = getDatabaseConnection('production');


async function reinitializeDatabase() {

  console.log("reinitializeDatabase called - No action needed (multi-environment support enabled)");
  return sequelize;
}

module.exports = {
  sequelize,
  getDatabaseConnection,
  reinitializeDatabase,
};
