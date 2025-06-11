const pool = require('../Configurations/mysqlConfiguration')
const bot = require('../Configurations/botConfig')
const crypto = require("crypto");
require("dotenv").config();
const Keyboards = require("../keyboards")
const {setUserState, getUserState, clearUserState} = require('../userStates/userStates')

async function initializeAdmin() {
  try {
    const sql = "SELECT * FROM users WHERE phone_number = ? AND username = ?";
    const [result] = await pool.query(sql, [
      process.env.ADMIN_CONTACT,
      process.env.ADMIN_USERNAME,
    ]);

    if (result.length === 0) {
      const superId = crypto.randomBytes(6).toString("hex");
      await pool.query(
        "INSERT INTO users (user_id, uuid, phone_number, username, role, full_name) VALUES (?, ?, ?, ?, ?, ?)",
        [
          process.env.ADMIN_USER_ID,
          superId,
          process.env.ADMIN_CONTACT,
          process.env.ADMIN_USERNAME,
          "superadmin",
          process.env.ADMIN_NAME,
        ]
      );
      console.log("✅ Superadmin added successfully.");
    } else {
      console.log("✅ Superadmin already exists.");
    }
  } catch (error) {
    console.error("❌ Error initializing superadmin:", error);
  }
}

async function registerUser(username, contact, userId, fullName) {
  try {
    const sqlCheck = "SELECT * FROM users WHERE user_id = ?";
    const [existingUser] = await pool.query(sqlCheck, [userId]);

    if (existingUser.length > 0) return true;

    const uuid = crypto.randomBytes(6).toString("hex");
    await pool.query(
      "INSERT INTO users (uuid, username, phone_number, user_id, full_name) VALUES (?, ?, ?, ?, ?)",
      [uuid, username, contact, userId, fullName]
    );

    return true;
  } catch (error) {
    console.error("Database error:", error.message);
    throw error;
  }
}

async function generateQuestion(subject) {
  return new Promise(async (resolve, reject) => {
    try {
      let fan;

      if (subject === "🧮 Math") {
        fan = "math";
      } else {
        fan = "english";
      }

      let sql =
        "SELECT * FROM questions WHERE subject = ? ORDER BY RAND() LIMIT 1";

      let [rows] = await pool.query(sql, [fan]);

      if (rows.length === 0) {
        throw new Error(`No questions found for the subject: ${subject}`);
      }

      const questionData = rows[0];

      return resolve(questionData);
    } catch (error) {
      console.log("Error fetching a question", error.message);
      return reject(error);
    }
  });
}

async function sendNextQuestion(subject, userId, chatId, lastMessageId) {
  return new Promise(async (resolve, reject) => {
    try {
      const question = await generateQuestion(subject);

      if (!question) {
        await bot.sendMessage(chatId, "❌ No question found for this domain.");
        return resolve(null);
      }

      const {
        question_number,
        question_text,
        choices,
        correct_answer,
        explanation,
        difficulty,
        visuals,
        paragraph,
        domain,
      } = question;

      let parsedChoices;
      try {
        parsedChoices = JSON.parse(choices);
      } catch (error) {
        console.error("⚠️ Error parsing choices JSON:", error);
        await bot.sendMessage(
          chatId,
          "⚠️ There was an error with the question choices."
        );
        return resolve(null);
      }

      // 🧹 Delete previous message if message ID is given
      if (lastMessageId) {
        try {
          await bot.deleteMessage(chatId, lastMessageId);
        } catch (err) {
          console.warn("⚠️ Could not delete previous message:", err.message);
        }
      }

      // 📝 Build question text
      let message = `📝 *New Question*\n📌 *Domain:* ${domain}\n⭐ *Difficulty:* ${difficulty}\n\n`;
      if (paragraph && paragraph.trim() !== "")
        message += `📖 *Passage:* ${paragraph}\n\n`;
      message += `❓ *${question_text}*\n\n`;

      Object.entries(parsedChoices).forEach(([key, value]) => {
        message += `🔹 *${key}.* ${value}\n`;
      });

      // 🔘 Inline answer buttons
      const choicesButtons = [
        ["A", "B", "C", "D"].map((key) => ({
          text: key,
          callback_data: `option_${key}_${question_number}`,
        })),
      ];

      let sentMessage;

      // 📷 Image-based question
      if (visuals && visuals.trim() !== "null") {
        try {
          sentMessage = await bot.sendPhoto(chatId, visuals, {
            caption: message,
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: choicesButtons },
          });
        } catch (error) {
          console.error("⚠️ Error sending photo:", error.message);
          await bot.sendMessage(
            chatId,
            "⚠️ Unable to load the question image. Here's the question:"
          );
          sentMessage = await bot.sendMessage(chatId, message, {
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: choicesButtons },
          });
        }
      } else {
        // 📝 Text-only question
        sentMessage = await bot.sendMessage(chatId, message, {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: choicesButtons },
        });
      }

      // 🕒 Track time
      // userStates[userId].startTime = Date.now();
      setUserState(userId, "startTime", Date.now());

      // ✅ Return new message_id for caller to track
      return resolve(sentMessage.message_id);
    } catch (error) {
      console.error("❌ Error retrieving question:", error);
      await bot.sendMessage(chatId, "⚠️ Failed to retrieve the question.");
      return resolve(null);
    }
  });
}

async function keyboardAdjustment(userId) {
  try {
    const sql = "SELECT * FROM users WHERE user_id = ?";
    const [rows] = await pool.query(sql, [userId]);

    if (rows.length === 0) return;

    const user = rows[0];
    const isSuperAdmin = user.role === "superadmin";
    const keyboard = isSuperAdmin
      ? Keyboards.adminMenu()
      : Keyboards.menuUser();

    await bot.sendMessage(
      userId,
      "⚠️ An error occurred. Returning to the main menu.",
      keyboard
    );

    if (getUserState(userId, "state")) {
      // userStates[userId].status = null;
      setUserState(userId, "state", null)
    }
  } catch (error) {
    console.error("Error adjusting the keyboard:", error);
  }
}

async function escapeMarkdownV2(text) {
  if (typeof text !== "string") return "";
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}


module.exports = {initializeAdmin, registerUser, generateQuestion, sendNextQuestion, keyboardAdjustment, escapeMarkdownV2}