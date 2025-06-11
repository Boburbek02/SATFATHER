require("dotenv").config();
const pool = require("./Configurations/mysqlConfiguration");
const crypto = require("crypto");
const Keyboards = require("./keyboards");
const bot = require("./Configurations/botConfig");
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
} = require("./HelperFunctions/messageHandlers");
const { initializeAdmin } = require("./HelperFunctions/botHelperFunctions");
const { getUserState } = require("./userStates/userStates");
const {keyboardAdjustment} = require('./HelperFunctions/botHelperFunctions')

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;





const difficulty = ["Easy", "Medium", "Hard"];
// ✅ Initialize Superadmin
initializeAdmin();

// ✅ `/start` Command
bot.onText(/\/start/, commandHandler);

bot.onText(/\/menu/, menuHandler);

bot.onText(/\/help/, helpCommand);

// ✅ Handle Contact Sharing & Admin Detection
bot.on("contact", contactHandler);

// handling text messages
bot.on("text", textHandler);

// handling file uploads
bot.on("document", documentHandler);

// handling callback queries
bot.on("callback_query", callbackHandler);

// handling channel posts
bot.on("channel_post", channelPostHandler);

// handling inline queries
bot.on("inline_query", inlineQueryHandler);

console.log("🤖 Bot started...");
