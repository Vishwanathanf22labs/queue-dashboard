const { Sequelize } = require("sequelize");
require("dotenv").config();

const env = process.env.NODE_ENV;

let mydb, myUser, password, dbHost, dbPort;

if (env === "production") {
  mydb = process.env.DB_NAME_LIVE;
  myUser = process.env.DB_USER_LIVE;
  password = process.env.DB_PASSWORD_LIVE;
  dbHost = process.env.DB_HOST_LIVE;
  dbPort = process.env.DB_PORT_LIVE;
} else {
  mydb = process.env.DB_NAME;
  myUser = process.env.DB_USER;
  password = process.env.DB_PASSWORD;
  dbHost = process.env.DB_HOST;
  dbPort = process.env.DB_PORT;
}

const sequelize = new Sequelize(mydb, myUser, password, {
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

sequelize
  .authenticate()
  .then(() => {
    console.log(`Database connected: ${dbHost}:${dbPort}/${mydb}`);
  })
  .catch((err) => {
    console.error("Database connection error:", err);
  });

module.exports = sequelize;
