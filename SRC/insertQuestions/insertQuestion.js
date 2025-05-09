const pool = require("../Configurations/mysqlConfiguration");
const { v4: uuidv4 } = require("uuid"); // Import UUID

const insertQuestionsIntoDB = async (questions) => {
  return new Promise(async (resolve, reject) => {
    try {
      let insertedCount = 0;
      let failedCount = 0;

      for (let item of questions) {
        try {
          const {
            subject,
            domain,
            difficulty,
            visuals,
            question: {
              question,
              choices,
              correct_answer,
              explanation,
              paragraph,
            } = {},
          } = item;

          // Validate required fields
          if (
            !subject ||
            !domain ||
            !difficulty ||
            !choices ||
            !correct_answer ||
            !question
          ) {
            console.warn(`⚠ Skipping invalid or incomplete question:`, item);
            failedCount++;
            continue;
          }

          // Handle visuals - store file_id or null
          const visualsValue =
            visuals?.file_id && typeof visuals.file_id === "string"
              ? visuals.file_id
              : null;

          // Construct SQL query
          const insertQuery = `
            INSERT INTO questions (
              subject,
              domain,
              difficulty,
              visuals,
              question_text,
              choices,
              correct_answer,
              explanation,
              paragraph
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              domain = VALUES(domain),
              difficulty = VALUES(difficulty),
              visuals = VALUES(visuals),
              question_text = VALUES(question_text),
              choices = VALUES(choices),
              correct_answer = VALUES(correct_answer),
              explanation = VALUES(explanation),
              paragraph = VALUES(paragraph);
          `;

          // Prepare values
          const values = [
            subject,
            domain,
            difficulty,
            visualsValue,
            question,
            JSON.stringify(choices),
            correct_answer,
            explanation || null,
            paragraph === "null" || paragraph === undefined ? null : paragraph,
          ];

          // Execute the query
          await pool.execute(insertQuery, values);
          insertedCount++;
        } catch (error) {
          failedCount++;
          console.error(
            `❌ Failed to insert question for subject: ${
              item.subject || "UNKNOWN"
            }`
          );
          console.error("Error:", error.message);
        }
      }

      console.log(`✅ Inserted ${insertedCount} questions successfully!`);
      console.log(`❌ Failed to insert ${failedCount} questions.`);

      resolve("All valid questions processed!");
    } catch (error) {
      reject(new Error("Failed to upload the questions: " + error.message));
    }
  });
};



module.exports = insertQuestionsIntoDB;
