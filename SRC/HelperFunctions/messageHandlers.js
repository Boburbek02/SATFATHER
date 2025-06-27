require("dotenv").config();
const pool = require('../Configurations/mysqlConfiguration');
const bot = require('../Configurations/botConfig');
const Keyboards = require('../keyboards')
const axios = require('axios')
const {registerUser, generateQuestion, sendNextQuestion, keyboardAdjustment, escapeMarkdownV2} = require('./botHelperFunctions')
const {setUserState, getUserState, clearUserState} = require("../userStates/userStates");
const insertQuestionsIntoDB = require('./insertQuestion')
const botToken = process.env.BOT_TOKEN;
const domainMatch = {
  "📘 Information and Ideas": "Information and Ideas",
  "📖 Craft and Structure": "Craft and Structure",
  "📝 Standard English Conventions": "Standard English Conventions",
  "✍️ Expression of Ideas": "Expression of Ideas",
  "📐 Advanced Math": "Advanced Math",
  "📊 Problem-Solving and Data Analysis": "Problem-Solving and Data Analysis",
  "📏 Geometry and Trigonometry": "Geometry and Trigonometry",
  "🔢 Algebra": "Algebra",
};

const books = require('../userStates/books.json')

const domains = [
  "📘 Information and Ideas",
  "📖 Craft and Structure",
  "📝 Standard English Conventions",
  "✍️ Expression of Ideas",
  "📐 Advanced Math",
  "📊 Problem-Solving and Data Analysis",
  "📏 Geometry and Trigonometry",
  "🔢 Algebra",
];
const difficulty = ["Easy", "Medium", "Hard"];




//function to handle commands like /start, /help
async function commandHandler(msg){
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    console.log(msg)

    const fullName = msg.from.last_name
      ? `${msg.from.first_name} ${msg.from.last_name}`
      : msg.from.first_name;

    try {
      // Check user's existence using SQL query
      let sql = "SELECT role FROM users WHERE user_id = ?";
      let [result] = await pool.query(sql, [userId]);

      // console.log(result);

      if (result.length !== 0) {
        // User exists, get their role
        const role = result[0].role;

        if (role === "superadmin") {
          bot.sendMessage(
            chatId,
            `Hello ${role} ${fullName}!`,
            Keyboards.adminMenu()
          );
          // console.log(userStates[userId]);
          return;
        }

        // console.log(userStates[userId]);

        if (role === "user") {
          bot.sendMessage(
            chatId,
            `Hello ${role} ${fullName}!`,
            Keyboards.menuUser()
          );
          return;
        }
      } else {
        // If the user does not exist, request their contact
        bot.sendMessage(
          chatId,
          `${fullName}, please, share your contact with us.`,
          Keyboards.contact()
        );
      }
    } catch (error) {
      console.error("Database error:", error);
      bot.sendMessage(chatId, "An error occurred. Please try again later.");
    }

}

//function to handle contact and register users
async function contactHandler(msg){
      const chatId = msg.chat.id;
      const contact = msg.contact.phone_number.startsWith("+")
        ? msg.contact.phone_number
        : `+${msg.contact.phone_number}`;
      const userId = msg.from.id;
      const username = msg.chat.username || null;
      const fullName = msg.from.last_name
        ? `${msg.from.first_name} ${msg.from.last_name}`
        : msg.from.first_name;

        console.log(msg)

      let sql, result, message;

      try {
        sql = "SELECT * FROM users WHERE phone_number = ? AND user_id = ?";
        [result] = await pool.query(sql, [contact, userId]);
        // if the user exists in db, find out his role and send him the appropriate keyboard.
        if (result.length !== 0) {
          const role = result[0].role;

          if (role === "superadmin") {
            bot.sendMessage(
              chatId,
              `Hello ${role} ${fullName}!`,
              Keyboards.adminMenu()
            );
            return;
          }

          if (role === "user") {
            bot.sendMessage(
              chatId,
              `Hello ${role} ${fullName}!`,
              Keyboards.menuUser()
            );
            return;
          }
        }

        const isAdded = await registerUser(username, contact, userId, fullName);

        if (isAdded) {
          bot.sendMessage(
            chatId,
            `Hello user ${fullName}!`,
            Keyboards.menuUser()
          );
          return;
        } else {
          bot.sendMessage(
            chatId,
            "Error registering user. Please, try again later"
          );
          return;
        }
      } catch (error) {
        console.log(error);
        bot.sendMessage(chatId, "An error occured. Please, try again later.");
      }
};
// function to hande text messages
async function textHandler (msg){
  if (msg.via_bot) {
    console.log("Ignored message sent via inline query.");
    return;
  }

 

  if (msg.contact) return;
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;
  try {
    let sql, result;
    // if (text.startsWith("/")) return;

    // Check if this user is an admin
    sql = "SELECT * FROM users WHERE user_id = ?";
    [result] = await pool.query(sql, [userId]);

    if (!result.length) {
      bot.sendMessage(
        chatId,
        "You are not registered, please get registered.",
        Keyboards.contact()
      );
      return;
    }

    // handling admin replies in Q&A
    if (Number(msg.chat.id) === Number(process.env.GROUP_ID)) {
      const replyTo = msg.reply_to_message;
      if (!replyTo) return; // Only handle replies

      const repliedMessageId = replyTo.message_id;

      try {
        const [rows] = await pool.query(
          `SELECT original_chat_id, original_message_id FROM copied_messages WHERE copied_message_id = ?`,
          [repliedMessageId]
        );

        if (!rows.length) {
          console.log("No original message mapping found for admin reply.");
          return;
        }

        const originalUserId = rows[0].original_chat_id;
        const originalMessageId = rows[0].original_message_id;

        const sent = await bot.copyMessage(
          originalUserId,
          msg.chat.id,
          msg.message_id,
          {
            reply_to_message_id: originalMessageId,
          }
        );

        if (sent?.message_id) {
          await pool.query(
            `INSERT INTO copied_messages 
         (original_chat_id, original_message_id, copied_message_id, status, created_at)
         VALUES (?, ?, ?, 'admin_reply', NOW())`,
            [process.env.BOT_USER_ID, msg.message_id, sent.message_id]
          );

          console.log("✅ Admin reply forwarded to user:", originalUserId);
        }
      } catch (err) {
        console.error("❌ Error replying to user:", err.message);
      }
    }


    if (result[0].role === "superadmin") {
      if (text === "🔙 Back") {
        // delete userStates[userId];
        setUserState(userId, "state", null)
        bot.sendMessage(chatId, "Main Menu", Keyboards.adminMenu());
      }

      if (text === "➕ Add Question") {
        // userStates[userId] = { status: "awaiting_questions" };
        setUserState(userId, "state" ,'awaiting_questions')
        bot.sendMessage(
          chatId,
          "Please, send your question file in a json format.",
          Keyboards.backToMainMenu()
        );
        return;
      }

      if (text === "➕ Add Practice Test") {
        // userStates[userId] = { status: "awaiting_practise_tests" };
        setUserState(userId, "state" , 'awaiting_practise_tests')
        bot.sendMessage(
          chatId,
          "Please, send the practise test first!",
          Keyboards.backToMainMenu()
        );
        return;
      }

      if (text === "🔍 Get User by Contact") {
        // userStates[userId] = { status: "awaiting_phone_number" };
        setUserState(userId, "state" , 'awaiting_phone_number');
        await bot.sendMessage(
          msg.chat.id,
          "Tap below to browse SAT practice tests:",
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "🔍 BROWSE ALL THE USERS",
                    switch_inline_query_current_chat: "users",
                  },
                ],
              ],
            },
          }
        );
        return;
      }

      if (text === "📂 Add Thematic Tests") {
        // userStates[userId] = { status: "awaiting_thematic_test" };
        setUserState(userId, "state" , "awaiting_thematic_test");
        bot.sendMessage(
          chatId,
          "Please, send the document. ",
          Keyboards.backToMainMenu()
        );
        return;
      }

      if (getUserState(userId, "state" )==="awaiting_practise_name"
      ) {
        // userStates[userId].practiseTest.testName = text;
        setUserState(userId, "testName", text)
        await bot.sendMessage(
          chatId,
          "Thank you, now send me the answers of this practise test!!!"
        );

        // userStates[userId].status = "awaiting_practise_answers";
        setUserState(userId, "state", "awaiting_practise_answers");

        return;
      }
    }

    // Handle regular user messages
    if (result[0].role === "user") {
      if (text === "🔙 Back") {
        // Safely reset instead of deleting
        if (getUserState(userId, "state")) {
          // userStates[userId].status = null;
          // userStates[userId].startTime = null;
          // You can reset or preserve other properties as needed

          setUserState(userId, "state", null)
          setUserState(userId, "startTime", null)
        }

        // Still remove test state if no longer needed

        bot.sendMessage(chatId, "Main Menu", Keyboards.menuUser());
      }

      if (text === "📚 Daily Challenges") {
        // userStates[userId] = { status: "solving_random_questions" };
        setUserState(userId, "state", "solving_random_questions");
        await bot.sendMessage(
          chatId,
          "Please choose your subject:",
          Keyboards.subjectMenu()
        );

        return;
      }

      if (text === "📂 Thematic Tests") {
        // userStates[userId] = { status: "solving_thematic_tests" };
        setUserState(userId, "state", "solving_thematic_tests");

        await bot.sendMessage(
          chatId,
          "Please choose your subject.",
          Keyboards.subjectMenu()
        );
        return;
      }

      if (text === "📖 Practice Tests") {
        // userStates[userId] = { status: "solving_practise_tests" };
        setUserState(userId, "state", "solving_practise_tests");
        await bot.sendMessage(
          msg.chat.id,
          "Tap below to browse SAT practice tests:",
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "📘 Browse Practice Tests",
                    switch_inline_query_current_chat: "practice",
                  },
                ],
              ],
            },
          }
        );
        return;
      }

      if (text === "📊 My Progress") {
        // userStates[userId] = "awaiting_progress_report";
        setUserState(userId, "state", "awaiting_progress_report");
        const sql = `
        SELECT 
            u.full_name,
            up.score,
            up.total_score,
            up.number_of_questions_solved,
            up.average_time_spent,
            up.last_active,
            ROUND((up.score / up.total_score) * 100, 2) AS success_rate
        FROM user_performance up
        JOIN users u ON up.userId = u.user_id
        WHERE up.userId = ?
    `;

        try {
          const [userData] = await pool.query(sql, [userId]);
          //  const [difficultyData] = await pool.query(difficultySql, [userId]);

          if (!userData.length) {
            await bot.sendMessage(
              chatId,
              "❌ No progress data found. Start solving questions to track your performance."
            );
            return;
          }

          const {
            full_name,
            score,
            total_score,
            number_of_questions_solved,
            average_time_spent,
            last_active,
            success_rate,
          } = userData[0];

          let report = `📊 *${full_name}'s Progress Report*\n\n`;
          report += `🟢 *Total Score:* ${score}\n`;
          report += `📋 *Total Questions Solved:* ${number_of_questions_solved}\n`;
          report += `⏳ *Average Time Spent:* ${average_time_spent.toFixed(
            2
          )} seconds\n`;
          report += `📅 *Last Active:* ${new Date(
            last_active
          ).toLocaleString()}\n`;
          report += `🎯 *Success Rate:* ${success_rate}%\n\n`;
          await bot.sendMessage(chatId, report, { parse_mode: "Markdown" });
        } catch (error) {
          console.error("Error fetching performance data:", error);
          await bot.sendMessage(
            chatId,
            "❌ Error fetching progress report. Please try again later."
          );
        }
      }

      const subjects = ["🧮 Math", "📖 Reading & Writing"];
      if (subjects.includes(text)) {
        console.log(getUserState(userId, "state"))
        if (getUserState(userId, "state") === "solving_random_questions") {
          console.log("here")
          try {
            setUserState(userId, "subject", text);
            const question = await generateQuestion(text);

            if (!question) {
              await bot.sendMessage(
                chatId,
                "❌ No question found for this domain."
              );
              return;
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
              return bot.sendMessage(
                chatId,
                "⚠️ There was an error with the question choices."
              );
            }

            // 📝 Formatting the question text
            let message = `📝 *New Question*\n📌 *Domain:* ${domain}\n⭐ *Difficulty:* ${difficulty}\n\n`;
            if (paragraph && paragraph.trim() !== "")
              message += `📖 *Passage:* ${paragraph}\n\n`;
            message += `❓ *${question_text}*\n\n`;

            // 🔹 Adding multiple-choice options
            Object.entries(parsedChoices).forEach(([key, value]) => {
              message += `🔹 *${key}.* ${value}\n`;
            });

            // 🟢 Creating compact inline buttons: A B C D in one row
            const choicesButtons = [
              ["A", "B", "C", "D"].map((key) => ({
                text: key,
                callback_data: `option_${key}_${question_number}`, // "option_A_3", for example
              })),
            ];

            // 📷 If visual exists, send image with caption
            if (visuals && visuals.trim() !== "null") {
              try {
                await bot.sendPhoto(chatId, visuals, {
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
                await bot.sendMessage(chatId, message, {
                  parse_mode: "Markdown",
                  reply_markup: { inline_keyboard: choicesButtons },
                });
              }
            } else {
              // ❌ No image: just send the message with text
              await bot.sendMessage(chatId, message, {
                parse_mode: "Markdown",
                reply_markup: { inline_keyboard: choicesButtons },
              });
            }
            // userStates[userId].status = "solving_questions";
            // userStates[userId].startTime = Date.now();
            setUserState(userId, "state", "solving_questions");
            setUserState(userId, "startTime", Date.now());
          } catch (error) {
            console.error("❌ Error retrieving question:", error);
            if (getUserState(userId, "state")) {
              // userStates[userId].status = null;
              // userStates[userId].startTime = null;
              // You can reset or preserve other properties as needed
              setUserState(userId, "state", null);
              setUserState(userId, "startTime", null);
            }
            return bot.sendMessage(
              chatId,
              "⚠️ Failed to retrieve the question.",
              Keyboards.menuUser()
            );
          }
        }
      }

      if (getUserState(userId, "state")=== "solving_thematic_tests"
      ) {
        try {
          if (text === "🧮 Math") {
            // userStates[userId].domain = "Math";
            setUserState(userId, "domain", "Math")
            await bot.sendMessage(
              chatId,
              "Please, choose a skill",
              Keyboards.mathMenu()
            );
          }
          if (text === "📖 Reading & Writing") {
            // userStates[userId].domain = "Reading and Writing";
            setUserState(userId, "domain", "Reading and Writing");
            await bot.sendMessage(
              chatId,
              "Please, choose a skill",
              Keyboards.englishMenu()
            );
          }
        } catch (error) {
          //  console.log("Error processing the request", error.name)
          //  delete userStates[userId]
          if (getUserState(userId, "state")) {
            // userStates[userId].status = null;
            // userStates[userId].startTime = null;
            // You can reset or preserve other properties as needed
            setUserState(userId, "state", null);
            setUserState(userId, "startTime", null);
          }
          await bot.sendMessage(
            chatId,
            "Error processing your request.",
            Keyboards.menuUser()
          );
        }
      }

      if (domains.includes(text)) {
        if (
          getUserState(userId, "domain") &&
          getUserState(userId, "state")=== "solving_thematic_tests"
        ) {
          try {
            // userStates[userId].skill = domainMatch[text];
            setUserState(userId, "skill", domainMatch[text] )
            await bot.sendMessage(
              chatId,
              "Choose the difficulty level.",
              Keyboards.difficultyMenu()
            );
          } catch (error) {
            if (getUserState(userId, "state")) {
              // userStates[userId].status = null;
              // userStates[userId].startTime = null;
              // You can reset or preserve other properties as needed
              setUserState(userId, "state", null);
              setUserState(userId, "startTime", null);
            }
            await bot.sendMessage(
              chatId,
              "Error processing your request. Please try again.",
              Keyboards.menuUser()
            );
          }
        }
      }

      if (difficulty.includes(text)) {
        if (
          getUserState(userId, "domain") &&
          getUserState(userId, "skill") &&
          getUserState(userId,"state")=== "solving_thematic_tests"
        ) {
          try {
            // console.log(userStates[userId]);
            // userStates[userId].difficulty = text;
            setUserState(userId, "difficulty", text)
            const domain = getUserState(userId, "skill");
            const diffLevel = text;
            // fetching fileids from the database;
            sql =
              "SELECT * FROM thematictests WHERE domain = ? AND difficulty=?";
            const [result] = await pool.query(sql, [domain, diffLevel]);
            for (const element of result) {
              const captionText = `📄 *Here's the document you requested!*

📝 *Subject:* _${element.subject}_
📚 *Domain:* _${element.domain}_
🎯 *Skill:* _${element.skill}_
💪 *Difficulty:* _${element.difficulty}_

👇 Click the button below for the explanation!`;

              const inlineKeyboard = {
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: "📖 View Explanation",
                        callback_data: `answer_${element.id}`,
                      },
                    ],
                  ],
                },
              };

              // await bot.sendMessage(chatId, captionText, inlineKeyboard)

              await bot
                .sendDocument(chatId, element.test, {
                  caption: captionText,
                  parse_mode: "Markdown",
                  ...inlineKeyboard,
                })
                .then(() => {
                  console.log("Document sent successfully using file_id!");
                })
                .catch((error) => {
                  console.error("Error sending document:", error);
                  if (getUserState(userId, "state")) {
                    // userStates[userId].status = null;
                    // userStates[userId].startTime = null;
                    // You can reset or preserve other properties as needed
                    setUserState(userId, "state", null)
                    setUserState(userId, "startTime", null)
                  }
                  bot.sendMessage(
                    chatId,
                    "Sorry, there was an error sending the document.",
                    Keyboards.menuUser()
                  );
                });
            }
          } catch (error) {
            console.log("error occured!");
            console.log(error.stack);
          }
        }
      }

      if (text === "🧠 Study Materials") {
        setUserState(userId, "state", "awaiting_vocabulary_book");

        // bot.copyMessage(chatId, process.env.CHANNEL_ID, 100);
        // bot.copyMessage(chatId, process.env.CHANNEL_ID, 102);
        await bot.sendMessage(
          msg.chat.id,
          "Tap below to browse Study materials",
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "🔍 BROWSE ALL THE BOOKS",
                    switch_inline_query_current_chat: "books",
                  },
                ],
              ],
            },
          }
        );
        return;
      }
      
      // handling Q&A section
      if(text ==="💬 Q&A"){
        const message = "Feel free to ask what you want!"
        setUserState(userId, "state", "awaiting_messages_from_user");
        bot.sendMessage(userId, message, Keyboards.backToMainMenu())
      }
      
      if (getUserState(userId, "state") === "awaiting_messages_from_user") {
        try {
          const messageId = msg.message_id;
          const replyToId = msg.reply_to_message?.message_id ?? null;
          const isReplyToSelf = msg.reply_to_message?.from?.id === userId;

          const sentId = isReplyToSelf
            ? userId.toString()
            : process.env.BOT_USER_ID;
          const fromChatId = userId;
          const toChatId = process.env.GROUP_ID;

          console.log(
            `Reply from user ID: ${msg.reply_to_message?.from?.id}, userId: ${userId}`
          );

          let copied_message;

          // Helper function to perform copy and log
          async function copyAndLog(
            originalChatId,
            originalMessageId,
            replyToCopiedId = null
          ) {
            try {
              const options = replyToCopiedId
                ? { reply_to_message_id: replyToCopiedId }
                : {};

              const copied = await bot.copyMessage(
                toChatId,
                originalChatId,
                originalMessageId,
                options
              );

              if (copied?.message_id) {
                await pool.query(
                  `INSERT INTO copied_messages 
             (original_chat_id, original_message_id, copied_message_id, status, created_at)
             VALUES (?, ?, ?, 'success', NOW())`,
                  [originalChatId, originalMessageId, copied.message_id]
                );
                console.log("Copied and logged message:", copied.message_id);
              }

              return copied;
            } catch (error) {
              console.error("Error during copyAndLog:", error.message);
              return null;
            }
          }

          if (replyToId) {
            if (isReplyToSelf) {
              const [rows] = await pool.query(
                `SELECT * FROM copied_messages WHERE original_message_id = ? AND original_chat_id = ? LIMIT 1`,
                [replyToId, userId]
              );

              if (rows.length) {
                copied_message = await copyAndLog(
                  fromChatId,
                  messageId,
                  rows[0].copied_message_id
                );
              } else {
                copied_message = await copyAndLog(fromChatId, messageId);
              }
            } else {
              const [rows] = await pool.query(
                `SELECT * FROM copied_messages WHERE copied_message_id = ? AND original_chat_id = ? LIMIT 1`,
                [replyToId, process.env.BOT_USER_ID]
              );

              if (rows.length) {
                copied_message = await copyAndLog(
                  fromChatId,
                  messageId,
                  rows[0].original_message_id
                );
              } else {
                copied_message = await copyAndLog(fromChatId, messageId);
              }
            }
          } else {
            // Not a reply, copy normally
            copied_message = await copyAndLog(fromChatId, messageId);
          }
        } catch (err) {
          console.error("Error handling message copy:", err.message);
        }
      }



    }
  } catch (error) {
    console.log(error);

    await keyboardAdjustment(userId);
  }
};

// function to handle documents
async function documentHandler(msg){
  // ✅ Skip documents sent via inline query results
  if (msg.via_bot) {
    console.log("Ignored document sent via inline query.");
    return;
  }

  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (getUserState(userId, "state") === "awaiting_messages_from_user") return;

  

  // Check user role
  let sql = "SELECT * FROM users WHERE user_id = ?";
  let [result] = await pool.query(sql, [userId]);

  if (!result.length) {
    bot.sendMessage(
      chatId,
      "You are not registered, please get registered.",
      Keyboards.contact()
    );
    return;
  }

  if (result[0].role !== "superadmin") {
    bot.sendMessage(
      chatId,
      "You are not authorized to upload files.",
      Keyboards.menuUser()
    );
    return;
  }

  if (getUserState(userId, "state")=== "awaiting_questions"
  ) {
    const { file_id, file_size, file_name, mime_type } = msg.document;

    if (!mime_type.includes("json") && !file_name.endsWith(".json")) {
      return bot.sendMessage(
        chatId,
        "❌ Invalid file type! Please upload a JSON file."
      );
    }

    if (file_size > 5 * 1024 * 1024) {
      return bot.sendMessage(
        chatId,
        "❌ File too large! Please upload a smaller JSON file."
      );
    }

    try {
      const file = await bot.getFile(file_id);
      const fileUrl = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;
      const response = await axios.get(fileUrl, { responseType: "text" });

      let questions;
      try {
        questions = JSON.parse(response.data);
      } catch {
        return bot.sendMessage(
          chatId,
          "❌ Invalid JSON format! Please check your file."
        );
      }

      if (!Array.isArray(questions) || questions.length === 0) {
        return bot.sendMessage(chatId, "❌ No valid questions found.");
      }

      await insertQuestionsIntoDB(questions);

      bot.sendMessage(
        chatId,
        `✅ Successfully added ${questions.length} questions!`
      );
      setUserState(userId, "state", null)
    } catch (error) {
      console.error("❌ Error:", error.message || error);
      bot.sendMessage(chatId, "❌ Failed to download or process the file.");
    }

    return;
  }

  if (getUserState(userId, "state")=== "awaiting_thematic_test"
  ) {
    const { file_id, file_size, file_name, mime_type } = msg.document;

    if (!mime_type.includes("json") && !file_name.endsWith(".json")) {
      return bot.sendMessage(
        chatId,
        "❌ Invalid file type! Please upload a JSON file."
      );
    }

    if (file_size > 5 * 1024 * 1024) {
      return bot.sendMessage(
        chatId,
        "❌ File too large! Please upload a smaller JSON file."
      );
    }

    try {
      const file = await bot.getFile(file_id);
      const fileUrl = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;
      const response = await axios.get(fileUrl, { responseType: "text" });

      let data;
      try {
        data = JSON.parse(response.data);
      } catch {
        return bot.sendMessage(chatId, "❌ Invalid JSON format!");
      }

      if (!Array.isArray(data)) {
        return bot.sendMessage(
          chatId,
          "❌ JSON should be an array of questions."
        );
      }

      let insertedCount = 0;
      for (const question of data) {
        const { subject, domain, skill, difficulty, test, answer } = question;

        if (!subject || !domain || !skill || !difficulty || !test || !answer) {
          bot.sendMessage(chatId, "❌ A question is missing required fields.");
          continue;
        }

        const sql = `INSERT INTO thematictests (subject, domain, skill, difficulty, test, answer) VALUES (?, ?, ?, ?, ?, ?)`;
        await pool.query(sql, [
          subject,
          domain,
          skill,
          difficulty,
          test,
          answer,
        ]);
        insertedCount++;
      }

      bot.sendMessage(
        chatId,
        `✅ Added ${insertedCount} tests to the database!`
      );
      // userStates[userId] = null;
      setUserState(userId, "state", null)
    } catch (error) {
      console.error("❌ Error:", error.message || error);
      bot.sendMessage(chatId, "❌ Failed to download or read the file.");
    }

    return;
  }

  if (getUserState(userId, "state")=== "awaiting_practise_tests"
  ) {
    const fileId = msg.document.file_id;

    // if (!userStates[userId].practiseTest) {
    //   userStates[userId].practiseTest = {};
    // }

    // userStates[userId].practiseTest.practise_test = fileId;
    // userStates[userId].status = "awaiting_practise_name";
    setUserState(userId, "practiseFile", fileId);
    // setUserState(userId, "state", "awaiting_practise_name");

    await bot.sendMessage(
      chatId,
      "Thank you, now send me the description of this practise test!!!"
    );

    setUserState(userId, "state", "awaiting_practise_name");
    return;
  }

  if (getUserState(userId, "state")=== "awaiting_practise_answers"
  ) {
    const fileId = msg.document?.file_id;

    if (!fileId) {
      return bot.sendMessage(chatId, "🚫 Oops! No document detected.");
    }

    // if (!userStates[userId].practiseTest) {
    //   userStates[userId].practiseTest = {};
    // }

    // userStates[userId].practiseTest.answers = fileId;
    setUserState(userId, "answerFile", fileId);

    const testName = getUserState(userId, "testName");
    const practise_test = getUserState(userId, "practiseFile")
    const answers = getUserState(userId, "answerFile");

    if (!testName || !practise_test || !answers) {
      return bot.sendMessage(
        chatId,
        "⚡ Missing information. Please complete all fields."
      );
    }

    try {
      const query = `
        INSERT INTO practice_tests (testName, practise_test, explanation)
        VALUES (?, ?, ?)
      `;

      await pool.execute(query, [testName, practise_test, answers]);

      // userStates[userId].status = "awaiting_practise_tests";
      // userStates[userId].practiseTest = {};

      setUserState(userId, "state", "awaiting_practise_tests");
      setUserState(userId, "testName", null)
      setUserState(userId, "practiseFile", null);
      setUserState(userId, "answerFile", null);
      await bot.sendMessage(
        chatId,
        "🎯 Answers saved! Send the next practice test."
      );
    } catch (err) {
      console.error("❌ Insert error:", err);
      bot.sendMessage(
        chatId,
        "🔥 Something went wrong while saving. Try again."
      );
    }

    return;
  }
};

// function to handle buttons
async function callbackHandler (query){
  const userId = query.from.id;
  const chatId = query.message?.chat?.id;
  const messageId = query.message?.message_id;

  console.log("User ID:", userId);
  console.log("Chat ID:", chatId);
  console.log("Message ID:", messageId);

  // if (!userStates[userId]) {
  //   userStates[userId] = { status: null };
  // } else {
  //   userStates[userId].status = null;
  // }

  try {
    // ✅ Acknowledge callback query right away to prevent button spinning
    await bot.answerCallbackQuery(query.id);

    // "Continue" button
    if (
      getUserState(userId, "state")=== "solving_questions" &&
      query.data === "next_question"
    ) {
      // const subject = userStates[userId]?.subject;
      const subject = getUserState(userId, "subject")
      if (!subject) {
        // userStates[userId].status = null;
        // userStates[userId].startTime = null;
        setUserState(userId, "state", null)
        setUserState(userId, "startTime", null)
        // You can reset or preserve other properties as needed
        await bot.sendMessage(
          chatId || userId,
          "⚠️ Session expired. Please start again.",
          Keyboards.menuUser()
        );
        return;
      }
      await sendNextQuestion(subject, userId, chatId || userId, messageId);
      return;
    }

    // "Stop" button
    if (
      getUserState(userId, "state")=== "solving_questions" &&
      query.data === "stop"
    ) {
      // userStates[userId].status = null;
      // userStates[userId].startTime = null;
      setUserState(userId, "state", null);
      setUserState(userId, "startTime", null);

      await bot.deleteMessage(chatId || userId, messageId);
      await bot.sendMessage(
        chatId || userId,
        "Main menu",
        Keyboards.menuUser()
      );
      return;
    }

    if (query.data.startsWith("option_") &&
      getUserState(userId, "state")=== "solving_questions"
    ) {
      const { data, message } = query;
      const parts = data.split("_");
      const key = parts[1]; // A, B, C, or D
      const question_number = parts[2];

      // Get question from DB
      let sql = "SELECT * FROM questions WHERE question_number = ?";
      const [question] = await pool.query(sql, [question_number]);

      if (question.length === 0) {
        try {
          await bot.deleteMessage(message.chat.id, message.message_id);
        } catch (err) {
          console.warn("Could not delete message:", err.message);
        }

        await bot.sendMessage(
          chatId || userId,
          "⚠️ Question not found. Returning to the main menu.",
          Keyboards.menuUser()
        );

        setUserState(userId, "state", null);
        setUserState(userId, "startTime", null);
        return;
      }

      const correctAnswer = question[0].correct_answer;
      const explanation = question[0].explanation;
      const difficulty = question[0].difficulty;
      const startTime = getUserState(userId, "startTime") || Date.now();
      const timeSpent = Math.floor((Date.now() - startTime) / 1000);

      const isCorrect = key === correctAnswer ? 1 : 0;
      const scoreMap = { Easy: 1, Medium: 2, Hard: 3 };
      const points = isCorrect ? scoreMap[difficulty] : 0;

      // Update performance
      const performanceSql = `
    INSERT INTO user_performance (
      userId, 
      score, 
      total_score, 
      number_of_questions_solved, 
      average_time_spent, 
      last_active
    )
    VALUES (?, ?, ?, 1, ?, NOW())
    ON DUPLICATE KEY UPDATE 
      score = score + VALUES(score),
      total_score = total_score + VALUES(total_score),
      number_of_questions_solved = number_of_questions_solved + 1,
      average_time_spent = (average_time_spent * (number_of_questions_solved - 1) + VALUES(average_time_spent)) / number_of_questions_solved,
      last_active = VALUES(last_active);
  `;

      await pool.query(performanceSql, [
        userId,
        points,
        scoreMap[difficulty],
        timeSpent,
      ]);

      // Prepare feedback text
      const resultText = isCorrect
        ? `🎉 *Correct! Great job!*\n\n✅ *Correct Answer:* \`${correctAnswer}\`\n📖 *Explanation:* ${explanation}`
        : `❌ *Incorrect answer.*\n\n✅ *Correct Answer:* \`${correctAnswer}\`\n📖 *Explanation:* ${explanation}`;

      const continueButtons = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🔄 Continue", callback_data: "next_question" },
              { text: "⬅️ Stop", callback_data: "stop" },
            ],
          ],
        },
      };

      // Delete the original message (with photo/buttons)
      try {
        await bot.deleteMessage(message.chat.id, message.message_id);
      } catch (err) {
        console.warn(
          "⚠️ Failed to delete original question message:",
          err.message
        );
      }

      // Send new feedback message
      await bot.sendMessage(chatId || userId, resultText, {
        parse_mode: "Markdown",
        ...continueButtons,
      });

      return;
    }

    // Thematic test answer button
    if (getUserState(userId, "state")=== "solving_thematic_tests" &&
      query.data.startsWith("answer_")
    ) {
      const elementId = query.data.split("_")[1];
      const sql = "SELECT * FROM thematictests WHERE id = ?";
      const [result] = await pool.query(sql, [elementId]);

      const targetId = chatId || userId;
      const options = {
        caption: "📘 Here's the explanation for the document.",
      };

      if (chatId && messageId) {
        options.reply_to_message_id = messageId;
      }

      if (result[0]) {
        await bot.sendDocument(targetId, result[0].answer, options);
      } else {
        await bot.sendMessage(targetId, "❌ Sorry, explanation not found.");
      }
      return;
    }

    // Practice test explanation button
    if (query.data.startsWith("answers_")) {
      const elementId = query.data.split("_")[1];
      const sql = "SELECT * FROM practice_tests WHERE id = ?";
      const [result] = await pool.query(sql, [elementId]);

      if (result[0]) {
        await bot.sendDocument(userId, result[0].explanation, {
          caption: "📘 Here's the explanation for the document.",
        });
      } else {
        await bot.sendMessage(userId, "❌ Sorry, explanation not found.");
      }
      return;
    }

    // Search again button
    if (query.data === "search_again") {
      await bot.sendMessage(userId, "🔍 What would you like to search for?", {
        reply_markup: { force_reply: true },
      });
      return;
    }

    if (getUserState(userId, "state")=== "done" &&
      query.data.startsWith("user_info_")
    ) {
      const userId = query.data.split("_")[2]; // Extract user ID from the callback data

      // Query the database to get full user info (adjust your SQL query as necessary)
      let [user] = await pool.query("SELECT * FROM users WHERE user_id = ?", [
        userId,
      ]);

      if (user && user.length > 0) {
        const userInfo = user[0]; // Assuming your query returns an array of user objects

        // Construct the detailed user info message
        const detailedMessage =
          `👤 Full Name: ${escapeMarkdownV2(
            userInfo.full_name || "No Name"
          )}\n` +
          `📞 Phone: ${escapeMarkdownV2(userInfo.phone_number)}\n` +
          `🆔 User ID: ${escapeMarkdownV2(userInfo.user_id)}\n` +
          `🔐 Role: ${escapeMarkdownV2(userInfo.role)}\n` +
          `🕓 Created At: ${escapeMarkdownV2(userInfo.created_at)}`;

        // Send the detailed info to the user who clicked the button
        await bot.sendMessage(userId, detailedMessage, {
          parse_mode: "MarkdownV2",
        });

        // Optionally: Acknowledge the callback query (it removes the "loading" state of the button)
        await bot.answerCallbackQuery(query.id, {
          text: "Here is the full info!",
        });
      } else {
        // If user doesn't exist or can't find the user info
        await bot.sendMessage(userId, "User information not found.");
      }
    }
  } catch (error) {
    console.error(
      "Error handling callback query:",
      error,
      "Query data:",
      query.data
    );
    await keyboardAdjustment(userId);
  }
};

// function to handle inline queries

async function inlineQueryHandler(query) {
  const userId = query.from.id;
  const search = query.query.toLowerCase();

  try {
    // Check if user is superadmin requesting user list
    const [userResult] = await pool.query(
      "SELECT * FROM users WHERE user_id = ?",
      [userId]
    );
    const user = userResult[0];

    if (user && user.role === "superadmin" && search === "users") {
      const [users] = await pool.execute("SELECT * FROM users LIMIT 50");

      if (!users.length) {
        await bot.answerInlineQuery(query.id, [], { cache_time: 0 });
        return;
      }

      const results = await Promise.all(
        // Add 'await Promise.all'
        users.map(async (u, index) => {
          const fullName = u.full_name ?? "Unknown"; // Use nullish coalescing
          const phone = u.phone_number ?? "Not provided"; // Use nullish coalescing
          const chatId = u.user_id ?? "N/A";
          const phoneCall = await escapeMarkdownV2(String(phone));
          const userName = await escapeMarkdownV2(String(u.username));
          return {
            type: "article",
            id: String(u.id),
            title: `${index + 1}. Chat ID: ${chatId}`, // Use template literals correctly
            description: `Name: ${fullName}`, // Use template literals correctly
            input_message_content: {
              message_text:
                `📞 Phone: ${phoneCall}\n` + // Use template literals
                `🆔 Username: ${userName}`,
              parse_mode: "MarkdownV2",
            },
          };
        })
      );

      console.log(results); //  'results' will now be the array of objects.

      await bot.answerInlineQuery(query.id, results, { cache_time: 0 });
      return;
    }


    // Practice tests
    if (search === "practice") {
      const [rows] = await pool.execute(
        "SELECT id, testName, practise_test FROM practice_tests"
      );

      if (rows.length === 0) {
        await bot.answerInlineQuery(query.id, [], { cache_time: 0 });
        return;
      }

      const results = rows.map((row) => ({
        type: "document",
        id: String(row.id),
        title: row.testName,
        document_file_id: row.practise_test,
        description: "Click to open the SAT practice test",
        caption: `📘 *${row.testName}*\nYour SAT practice test.`,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Search Again",
                switch_inline_query_current_chat: "practice",
              },
              {
                text: "Answers",
                callback_data: `answers_${row.id}`,
              },
            ],
          ],
        },
      }));

      await bot.answerInlineQuery(query.id, results, { cache_time: 0 });
      return;
    }

    // Books
    if (search === "books") {
      const results = books.map((book, index) => ({
        type: "document",
        id: String(index),
        title: book.title,
        document_file_id: book.file_id,
        caption: `📘 *${book.title}*\n👤 _${book.source}_`,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Search More",
                switch_inline_query_current_chat: "books",
              },
            ],
          ],
        },
      }));

      await bot.answerInlineQuery(query.id, results.slice(0, 50));
      return;
    }

    // Fallback for unmatched queries
    await bot.answerInlineQuery(query.id, [], { cache_time: 0 });
  } catch (error) {
    console.error("Error handling inline query:", error);
    await keyboardAdjustment(userId);
  }
}


// a function to handle channel posts

async function channelPostHandler(msg){
  console.log(msg);
  if (msg.document) {
    const document = msg.document;
    const fileId = document.file_id;
    const fileName = document.file_name || "Unnamed Document";

    await bot.sendDocument(process.env.ADMIN_CHAT_ID, fileId, {
      caption: `📄 *New Document from Channel*\n\n**File Name:** ${fileName}\n**File ID:** \`${fileId}\``,
      parse_mode: "Markdown",
    });

    console.log(
      `Document received from channel: ${fileName} (File ID: ${fileId})`
    );
  }

  if (msg.photo && msg.photo.length > 0) {
    const photo = msg.photo[msg.photo.length - 1]; // Get the highest resolution photo (last one in the array)
    const fileId = photo.file_id;
    const fileName = "something"; // You can dynamically set this based on your use case

    await bot.sendPhoto(ADMIN_CHAT_ID, fileId, {
      caption: `📄 *New Document from Channel*\n\n**File Name:** ${fileName}\n**File ID:** \`${fileId}\``,
      parse_mode: "Markdown",
    });
  }
};

// a function to handle main menu
async function menuHandler(msg){
  const userId = msg.from.id
  const chatId = msg.chat.id
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
      "Main menu",
      keyboard
    );

    if (getUserState(userId, "state")) {
      // userStates[userId].status = null;
      setUserState(userId, "state", null);
    }
  } catch (error) {
    console.error("Error adjusting the keyboard:", error);
  }
}

// a function to handle help command 
async function helpCommand(msg){
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  bot.copyMessage(chatId, -1002347780372, 98);
}

// a function to handle about command 
async function aboutCommand(msg){
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  bot.copyMessage(chatId, -1002347780372, 99);
}



module.exports = {commandHandler, contactHandler, textHandler, documentHandler, callbackHandler, inlineQueryHandler, channelPostHandler, menuHandler, helpCommand, aboutCommand}