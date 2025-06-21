require("dotenv").config();
const pool = require("./SRC/Configurations/mysqlConfiguration");
const crypto = require("crypto");
const Keyboards = require("./SRC/keyboards");
const bot = require("./SRC/Configurations/botConfig");
const {
  commandHandler,
  contactHandler,
  textHandler,
  documentHandler,
  callbackHandler,
  inlineQueryHandler,
  channelPostHandler,
  menuHandler,
  helpCommand,
  aboutCommand,
} = require("./SRC/HelperFunctions/messageHandlers");
const { initializeAdmin } = require("./SRC/HelperFunctions/botHelperFunctions");
// initialize superadmin;
initializeAdmin();

// handling Commands
bot.onText(/\/start/, commandHandler);

bot.onText(/\/menu/, menuHandler);

bot.onText(/\/help/, helpCommand);

bot.onText(/\/about/, aboutCommand)

// Handling Contact Sharing & Admin Detection
bot.on("contact", contactHandler);

// handling text messages
bot.on("message", textHandler);

// handling file uploads
bot.on("document", documentHandler);

// handling callback queries
bot.on("callback_query", callbackHandler);

// handling channel posts
bot.on("channel_post", channelPostHandler);

// handling inline queries
bot.on("inline_query", inlineQueryHandler);

// connection check
console.log("🤖 Bot started...");