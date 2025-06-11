require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");

const botToken = process.env.BOT_TOKEN;
const bot = new TelegramBot(botToken, { polling: true });

module.exports = bot;