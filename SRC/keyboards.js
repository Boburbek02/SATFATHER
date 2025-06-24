class Keyboards {
  static contact() {
    return {
      reply_markup: {
        keyboard: [[{ text: "📞 Share Contact", request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true, // Hides the keyboard after use
      },
    };
  }

  static adminMenu() {
    // Renamed to be consistent with other methods
    return {
      reply_markup: {
        keyboard: [
          [{ text: "➕ Add Question" }, { text: "➕ Add Practice Test" }],
          [
            { text: "🔍 Get User by Contact" },
            { text: "📂 Add Thematic Tests" },
          ],
        ],
        resize_keyboard: true, // Added to make sure the keyboard fits the screen
      },
    };
  }

  static menuUser() {
    return {
      reply_markup: {
        keyboard: [
          [{ text: "📚 Daily Challenges" }, { text: "🧠 Study Materials" }],
          [{ text: "📖 Practice Tests" }, { text: "📂 Thematic Tests" }],
          [{ text: "📊 My Progress" }, { text: "💬 Q&A" }],
        ],
        resize_keyboard: true,
      },
    };
  }

  static subjectMenu() {
    return {
      reply_markup: {
        keyboard: [
          [{ text: "🧮 Math" }, { text: "📖 Reading & Writing" }],
          [{ text: "🔙 Back" }],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    };
  }

  static backToMainMenu() {
    return {
      reply_markup: {
        keyboard: [["🔙 Back"]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    };
  }

  static mathMenu() {
    return {
      reply_markup: {
        keyboard: [
          [
            { text: "📐 Advanced Math" },
            { text: "📊 Problem-Solving and Data Analysis" },
          ],
          [{ text: "📏 Geometry and Trigonometry" }, { text: "🔢 Algebra" }],
          [{ text: "🔙 Back" }],
        ],
        resize_keyboard: true,
      },
    };
  }

  static englishMenu() {
    return {
      reply_markup: {
        keyboard: [
          [
            { text: "📘 Information and Ideas" },
            { text: "📖 Craft and Structure" },
          ],
          [
            { text: "📝 Standard English Conventions" },
            { text: "✍️ Expression of Ideas" },
          ],
          [{ text: "🔙 Back" }],
        ],
        resize_keyboard: true,
      },
    };
  }

  static difficultyMenu() {
    return {
      reply_markup: {
        keyboard: [
          [{ text: "Easy" }, { text: "Medium" }, { text: "Hard" }],
          [{ text: "🔙 Back" }],
        ],
        resize_keyboard: true,
      },
    };
  }
}

module.exports = Keyboards;
