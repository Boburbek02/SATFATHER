require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const pool = require("./Configurations/mysqlConfiguration");
const crypto = require("crypto");
const axios = require("axios");
const Keyboards = require('./keyboards');
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

const insertQuestionsIntoDB = require("./insertQuestions/insertQuestion");
const { chat } = require("googleapis/build/src/apis/chat");
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

const botToken = process.env.BOT_TOKEN;
const bot = new TelegramBot(botToken, { polling: true });

let userStates = {}; // ✅ Stores user states per chatId

let test = {}
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

const domains = [
  "📘 Information and Ideas",
  "📖 Craft and Structure",
  "📝 Standard English Conventions",
  "✍️ Expression of Ideas",
  "📐 Advanced Math",
  "📊 Problem-Solving and Data Analysis",
  "📏 Geometry and Trigonometry",
  "🔢 Algebra"
];

const difficulty = ["Easy", "Medium", "Hard"]
// ✅ Initialize Superadmin
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
initializeAdmin();

// ✅ `/start` Command - Request Contact
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  // console.log(msg)
  

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
          Keyboards.adminMenu(),
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
});


// ✅ Register User Function
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
// ✅ Handle Contact Sharing & Admin Detection
bot.on("contact", async (msg) => {
  const chatId = msg.chat.id;
  const contact = msg.contact.phone_number.startsWith("+")
    ? msg.contact.phone_number
    : `+${msg.contact.phone_number}`;
  const userId = msg.from.id;
  const username = msg.chat.username || null;
  const fullName = msg.from.last_name
    ? `${msg.from.first_name} ${msg.from.last_name}`
    : msg.from.first_name;

  let sql, result, message;

  try{

  sql = 'SELECT * FROM users WHERE phone_number = ? AND user_id = ?';
  [result]= await pool.query(sql, [contact, userId]);
  // if the user exists in db, find out his role and send him the appropriate keyboard.
  if(result.length!==0){
    const role = result[0].role

    if (role === "superadmin") {
      userStates[userId] = {menu:1}
      bot.sendMessage(
        chatId,
        `Hello ${role} ${fullName}!`,
        adminMenuLevel[userStates[userId].menu],
        
      
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

  const isAdded = await registerUser(username, contact, userId, fullName)

  if(isAdded){
    bot.sendMessage(chatId, `Hello user ${fullName}!`, Keyboards.menuUser());
    return;
  }else{
    bot.sendMessage(chatId, "Error registering user. Please, try again later")
    return;
  }

}catch(error){
  console.log(error)
  bot.sendMessage(chatId, "An error occured. Please, try again later.")
}
})

bot.on("message", async (msg) => {

  if (msg.contact) return;
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;
  let sql, result;
  if (text === "/start") return;

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

  

  if (result[0].role === "superadmin") {
    if (text === "🔙 Back") {
    delete userStates[userId]
    console.log(userStates)
    bot.sendMessage(chatId, "Main Menu", Keyboards.adminMenu())
    }

    
    if (text === "➕ Add Question") {
        userStates[userId] = { status: "awaiting_questions" };
        bot.sendMessage(
          chatId,
          "Please, send your question file in a json format.",
          Keyboards.backToMainMenu()
        );
        return;
    }

    if (text === "➕ Add Practice Test") {
      userStates[userId] = { status: "awaiting_practise_tests"};
      bot.sendMessage(
        chatId,
        "Please, send the practise test first!",
        Keyboards.backToMainMenu()
      );
      return;
    }

    if (text === "🔍 Get User by Contact") {
      userStates[userId] = { status: "awaiting_phone_number"};
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
      userStates[userId] = { status: "awaiting_thematic_test"};
      bot.sendMessage(
        chatId,
        "Please, send the document. ",
        Keyboards.backToMainMenu()
      );
      return;
    }


  if (
  userStates[userId] &&
  userStates[userId].status === "awaiting_practise_name"
  ){
    userStates[userId].practiseTest.testName = text;
    await bot.sendMessage(chatId, "Thank you, now send me the answers of this practise test!!!")

    userStates[userId].status = "awaiting_practise_answers";

    return;
  }
}

  // Handle regular user messages
  if (result[0].role === "user") {

    if (text === "🔙 Back") {
      // Safely reset instead of deleting
      if (userStates[userId]) {
        userStates[userId].status = null;
        userStates[userId].startTime = null;
        // You can reset or preserve other properties as needed
      }

      // Still remove test state if no longer needed
      delete test[userId];

      bot.sendMessage(chatId, "Main Menu", Keyboards.menuUser());
    }
    
    
    if (text === "📚 Solve Random Questions") {
        userStates[userId] = { status: "solving_random_questions" };

        await bot.sendMessage(
          chatId,
          "Please choose your subject:",
          Keyboards.subjectMenu()
        );

        return;
      }
    
    
    if (text === "📂 Thematic Tests") {
      userStates[userId] = { status: "solving_thematic_tests" };
      
      await bot.sendMessage(
        chatId,
        "Please choose your subject.",
        Keyboards.subjectMenu()
      );
      return;
    }

    if (text === "📖 Practise Tests") {
  userStates[userId] = { status: "solving_practise_tests" };
  await bot.sendMessage(msg.chat.id, "Tap below to browse SAT practice tests:", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "📘 Browse Practise Tests",
            switch_inline_query_current_chat: "practise",
          },
        ],
      ],
    },
  });
  return;
    }



    if (text === "📊 My Progress") {
    userStates[userId] = "awaiting_progress_report";
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
     if (
       userStates[userId] &&
       userStates[userId].status == "solving_random_questions"
     ) {
       try {
         userStates[userId].subject = text;
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
         userStates[userId].status = "solving_questions"
         userStates[userId].startTime = Date.now();
       } catch (error) {
         console.error("❌ Error retrieving question:", error);
          if (userStates[userId]) {
            userStates[userId].status = null;
            userStates[userId].startTime = null;
            // You can reset or preserve other properties as needed
          }
         return bot.sendMessage(chatId, "⚠️ Failed to retrieve the question.", Keyboards.menuUser());
       }
     }
    }


     if (
       userStates[userId] &&
       userStates[userId].status == "solving_thematic_tests"
     ) {
       try {
        if(text==="🧮 Math"){
          userStates[userId].domain = "Math"
          await bot.sendMessage(chatId, "Please, choose a skill", Keyboards.mathMenu())
        }
        if(text ==="📖 Reading & Writing"){
          userStates[userId].domain = "Reading and Writing"
          await bot.sendMessage(chatId, "Please, choose a skill", Keyboards.englishMenu())
        }
        
       } catch (error) {
        //  console.log("Error processing the request", error.name)
        //  delete userStates[userId]
         if (userStates[userId]) {
           userStates[userId].status = null;
           userStates[userId].startTime = null;
           // You can reset or preserve other properties as needed
         }
         await bot.sendMessage(chatId, "Error processing your request.", Keyboards.menuUser())
       }
     }

     if (domains.includes(text)) {
      

      if (
        userStates?.[userId]?.domain &&
        userStates?.[userId]?.status === "solving_thematic_tests"
      ){
        try {
          userStates[userId].skill = domainMatch[text];
          await bot.sendMessage(chatId, "Choose the difficulty level.", Keyboards.difficultyMenu());
        } catch (error) {
          
          if (userStates[userId]) {
             userStates[userId].status = null;
             userStates[userId].startTime = null;
             // You can reset or preserve other properties as needed
           }
          await bot.sendMessage(
            chatId,
            "Error processing your request. Please try again.",
            Keyboards.menuUser()
          );
        }
      }
     }

     if(difficulty.includes(text)){
      if (userStates?.[userId]?.domain &&
    userStates?.[userId]?.skill&&
    userStates?.[userId]?.status === "solving_thematic_tests" ){
      try{
      console.log(userStates[userId]);
      userStates[userId].difficulty = text;
      const domain = userStates[userId].skill
      const diffLevel = text
      // fetching fileids from the database;
      sql = "SELECT * FROM thematictests WHERE domain = ? AND difficulty=?"
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
             if (userStates[userId]) {
               userStates[userId].status = null;
               userStates[userId].startTime = null;
               // You can reset or preserve other properties as needed
             }
            bot.sendMessage(
              chatId,
              "Sorry, there was an error sending the document.", Keyboards.menuUser());
          });
      }

      
      }catch(error){
        console.log("error occured!")
        console.log(error.stack)
      }

    }


     }

    }
});
// handling file uploads
bot.on("document", async (msg) => {
  // ✅ Skip documents sent via inline query results
  if (msg.via_bot) {
    console.log("Ignored document sent via inline query.");
    return;
  }

  const chatId = msg.chat.id;
  const userId = msg.from.id;

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

  if (
    userStates[userId] &&
    userStates[userId].status === "awaiting_questions"
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
      userStates[userId] = null;
    } catch (error) {
      console.error("❌ Error:", error.message || error);
      bot.sendMessage(chatId, "❌ Failed to download or process the file.");
    }

    return;
  }

  if (
    userStates[userId] &&
    userStates[userId].status === "awaiting_thematic_test"
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
      userStates[userId] = null;
    } catch (error) {
      console.error("❌ Error:", error.message || error);
      bot.sendMessage(chatId, "❌ Failed to download or read the file.");
    }

    return;
  }

  if (
    userStates[userId] &&
    userStates[userId].status === "awaiting_practise_tests"
  ) {
    const fileId = msg.document.file_id;

    if (!userStates[userId].practiseTest) {
      userStates[userId].practiseTest = {};
    }

    userStates[userId].practiseTest.practise_test = fileId;
    userStates[userId].status = "awaiting_practise_name";

    await bot.sendMessage(
      chatId,
      "Thank you, now send me the description of this practise test!!!"
    );
    return;
  }

  if (
    userStates[userId] &&
    userStates[userId].status === "awaiting_practise_answers"
  ) {
    const fileId = msg.document?.file_id;

    if (!fileId) {
      return bot.sendMessage(chatId, "🚫 Oops! No document detected.");
    }

    if (!userStates[userId].practiseTest) {
      userStates[userId].practiseTest = {};
    }

    userStates[userId].practiseTest.answers = fileId;

    const { testName, practise_test, answers } =
      userStates[userId].practiseTest;

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

      userStates[userId].status = "awaiting_practise_tests";
      userStates[userId].practiseTest = {};

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
});


bot.on("callback_query", async (query) => {
  const userId = query.from.id;
  const chatId = query.message?.chat?.id;
  const messageId = query.message?.message_id;

  console.log("Callback query data:", query.data);
  console.log("User ID:", userId);
  console.log("Chat ID:", chatId);
  console.log("Message ID:", messageId);

  try {
    // ✅ Acknowledge callback query right away to prevent button spinning
    await bot.answerCallbackQuery(query.id);

    // "Continue" button
    if (
      userStates[userId].status === "solving_questions" &&
      query.data === "next_question"
    ) {
      const subject = userStates[userId]?.subject;
      if (!subject) {
           userStates[userId].status = null;
           userStates[userId].startTime = null;
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
    if (userStates[userId].status === "solving_questions" && query.data === "stop") {
      userStates[userId].status = null;
      userStates[userId].startTime = null;

      await bot.deleteMessage(chatId || userId, messageId)
      await bot.sendMessage(
        chatId || userId,
        "Main menu",
        Keyboards.menuUser()
      );
      return;
    }

   

    if (
      userStates[userId] &&
      query.data.startsWith("option_") &&
      userStates[userId].status === "solving_questions"
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

        userStates[userId].status = null;
        userStates[userId].startTime = null;
        return;
      }

      const correctAnswer = question[0].correct_answer;
      const explanation = question[0].explanation;
      const difficulty = question[0].difficulty;
      const startTime = userStates[userId].startTime || Date.now();
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
    if (
      userStates[userId] &&
      userStates[userId].status === "solving_thematic_tests" &&
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
    if (userStates[userId]&& 
      userStates[userId].status === "solving_practise_tests"&&
      query.data.startsWith("answers_")) {
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
    if (userStates[userId] && 
      userStates[userId].status === "solving_practise_tests"&&
      query.data === "search_again") {
      await bot.sendMessage(userId, "🔍 What would you like to search for?", {
        reply_markup: { force_reply: true },
      });
      return;
    }
  } catch (error) {
    console.error(
      "Error handling callback query:",
      error,
      "Query data:",
      query.data
    );

    try {
      await bot.sendMessage(
        chatId || userId,
        "⚠️ An error occurred. Returning to the main menu.",
        Keyboards.menuUser()
      );
    } catch (sendError) {
      console.error("Failed to send error message:", sendError);
    }

    delete userStates[userId];
  }
});



async function generateQuestion(subject){
  return new Promise( async(resolve, reject)=>{
    try{

      let fan;

      if(subject==="🧮 Math"){
        fan = "math"
        
      }else{
        fan = "english"
      }



      let sql =
        "SELECT * FROM questions WHERE subject = ? ORDER BY RAND() LIMIT 1";


      let [rows] = await pool.query(sql, [fan]);

       if (rows.length === 0) {
         throw new Error(`No questions found for the subject: ${subject}`);
       }

       const questionData = rows[0];

       return resolve(questionData);



    }catch(error){
      console.log("Error fetching a question", error.message)
      return reject(error)
      
    }
  })
}



// const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID; // Admin ID
const CHANNEL_ID = "-100xxxxxxxxxx"; // Replace with your Channel ID

bot.on("channel_post", async (msg) => {
  console.log(msg);
  if (msg.document) {
    const document = msg.document;
    const fileId = document.file_id;
    const fileName = document.file_name || "Unnamed Document";

    await bot.sendDocument(ADMIN_CHAT_ID, fileId, {
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

});


// async function sendNextQuestion(subject, userId, chatId){
//   return new Promise(async(resolve, reject)=>{
//     try {
      
//       const question = await generateQuestion(subject);
      
//       if (!question) {
//         await bot.sendMessage(chatId, "❌ No question found for this domain.");
//         return;
//       }

//       const {
//         question_number,
//         question_text,
//         choices,
//         correct_answer,
//         explanation,
//         difficulty,
//         visuals,
//         paragraph,
//         domain,
//       } = question;

//       let parsedChoices;
//       try {
//         parsedChoices = JSON.parse(choices);
//       } catch (error) {
//         console.error("⚠️ Error parsing choices JSON:", error);
//         return bot.sendMessage(
//           chatId,
//           "⚠️ There was an error with the question choices."
//         );
//       }

//       // 📝 Formatting the question text
//       let message = `📝 *New Question*\n📌 *Domain:* ${domain}\n⭐ *Difficulty:* ${difficulty}\n\n`;
//       if (paragraph && paragraph.trim() !== "")
//         message += `📖 *Passage:* ${paragraph}\n\n`;
//       message += `❓ *${question_text}*\n\n`;

//       // 🔹 Adding multiple-choice options
//       Object.entries(parsedChoices).forEach(([key, value]) => {
//         message += `🔹 *${key}.* ${value}\n`;
//       });

//       // 🟢 Creating compact inline buttons: A B C D in one row
//       const choicesButtons = [
//         ["A", "B", "C", "D"].map((key) => ({
//           text: key,
//           callback_data: `option_${key}_${question_number}`,
//         })),
//       ];

//       // 📷 If visual exists, send image with caption
//       if (visuals && visuals.trim() !== "null") {
//         try {
//           await bot.sendPhoto(chatId, visuals, {
//             caption: message,
//             parse_mode: "Markdown",
//             reply_markup: { inline_keyboard: choicesButtons },
//           });
//         } catch (error) {
//           console.error("⚠️ Error sending photo:", error.message);
//           await bot.sendMessage(
//             chatId,
//             "⚠️ Unable to load the question image. Here's the question:"
//           );
//           await bot.sendMessage(chatId, message, {
//             parse_mode: "Markdown",
//             reply_markup: { inline_keyboard: choicesButtons },
//           });
//         }
//       } else {
//         // ❌ No image: just send the message with text
//         await bot.sendMessage(chatId, message, {
//           parse_mode: "Markdown",
//           reply_markup: { inline_keyboard: choicesButtons },
//         });
//       }

//       userStates[userId].startTime = Date.now();
//     } catch (error) {
//       console.error("❌ Error retrieving question:", error);
//       return bot.sendMessage(chatId, "⚠️ Failed to retrieve the question.");
//     }
//   })
// }

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
      userStates[userId].startTime = Date.now();

      // ✅ Return new message_id for caller to track
      return resolve(sentMessage.message_id);
    } catch (error) {
      console.error("❌ Error retrieving question:", error);
      await bot.sendMessage(chatId, "⚠️ Failed to retrieve the question.");
      return resolve(null);
    }
  });
}





bot.on("inline_query", async (query) => {
  try {
    const userId = query.from.id; // Get the user ID from the query
    const search = query.query.toLowerCase();
    console.log(userStates)

    let sql = "SELECT role FROM users WHERE user_id = ?";
    let [result] = await pool.query(sql, [userId]);

    // console.log(result);

  if (
    result.length > 0 &&
    result[0].role === "superadmin" &&
    userStates[userId]?.status === "awaiting_phone_number" &&
    search === "users"
  ) {

    console.log("whatup")
    // Query all users
    const [users] = await pool.execute("SELECT * FROM users");

    if (users.length === 0) {
      await bot.answerInlineQuery(query.id, [], { cache_time: 0 });
    } else {
      const results = users.map((user, index) => ({
        type: "article",
        id: String(user.id),
        title: `${index + 1}. ${escapeMarkdown(user.full_name || "No Name")}`,
        description: `Role: ${user.role}, Phone: ${user.phone_number}`,
        input_message_content: {
          message_text:
            `👤 *${escapeMarkdown(
              user.full_name || "No Name"
            )}* (@${escapeMarkdown(user.username || "no_username")})\n` +
            `📞 ${escapeMarkdown(user.phone_number)}\n🆔 ${escapeMarkdown(
              user.user_id
            )}\n` +
            `🔐 Role: ${escapeMarkdown(
              user.role
            )}\n🕓 Created: ${escapeMarkdown(user.created_at)}`,
          parse_mode: "MarkdownV2",
        },
      }));



      await bot.answerInlineQuery(query.id, results, { cache_time: 0 });
      userStates[userId].status = "done"; // optional: move to next state
    }

    return; // prevent fall-through to "else"
  }



    // Check if the user is in the "solving_practice_tests" state and the search query is exactly "practise"
    if (
      userStates[userId]?.status === "solving_practise_tests" &&
      search === "practise"
    ) {
      // Execute the query to get practice tests
      const [rows] = await pool.execute(
        `SELECT id, testName, practise_test FROM practice_tests`
      );

      if (rows.length === 0) {
        console.log("No results found.");
        await bot.answerInlineQuery(query.id, [], { cache_time: 0 });
        return;
      }

      // Prepare results for inline query
      const results = rows.map((row) => {
        return {
          type: "document",
          id: String(row.id),
          title: row.testName,
          document_file_id: row.practise_test, // Telegram file_id
          description: "Click to open the SAT practice test",
          caption: `📘 *${row.testName}*\nYour SAT practice test.`,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Search Again",
                  switch_inline_query_current_chat: "practise", // Sets the inline query to search for "practise"
                },
                {
                  text: "Answers",
                  callback_data: `answers_${row.id}`,
                },
              ],
            ],
          },
        };
      });

      // Return results to the inline query
      bot.answerInlineQuery(query.id, results, { cache_time: 0 });
    } else {
      // If the user is not solving practice tests or the search is not "practise", return no results
      console.log("here");
      await bot.answerInlineQuery(query.id, [], { cache_time: 0 });
    }
  } catch (error) {
    console.error("Error handling inline query:", error);
  }
});


function escapeMarkdown(text) {
  return String(text || "").replace(/([*_`\[\]()~>#+\-=|{}.!])/g, "\\$1");
}












console.log("🤖 Bot started...");


