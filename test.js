require('dotenv').config();
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function run() {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "user", content: "Write a haiku about AI" },
      ],
    });

    console.log(completion.choices[0].message.content);
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
