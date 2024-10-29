const { Client } = require("ps-client");
const dotenv = require("dotenv");

dotenv.config();
const CACHE = {};
const { BOT_USERNAME: username, BOT_PASSWORD: password } = process.env;
const config = require("./config.js");

require("./globals.js");

const DB = require("./database.js");
const messageHandler = require("./messagehandler.js");

const client = new Client({
  username,
  password,
  rooms: config.rooms,
  debug: true,
});
client.connect();

client.on("message", async (message) => {
  await messageHandler.handleMessage(message, client, DB);
});

// Attempt to rejoin room upon leave
client.on("leaveRoom", async (room) => {
  if (config.rooms.includes(room)) {
    client.send("|/j " + room);
  }
});

// Unga bunga
client.on("connect", async () => {
  setInterval(() => {
    for (const room of config.rooms) {
      client.send("|/j " + room);
    }
  }, 15 * 1000);
});
