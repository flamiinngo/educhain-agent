const dotenv = require("dotenv");
dotenv.config();

async function test() {
  console.log("Testing Groq AI connection...\n");

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "user",
          content: "Teach a simple 50-word lesson about clean water for a 10 year old child."
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    })
  });

  if (!response.ok) {
    const err = await response.text();
    console.log("ERROR:", response.status, err);
    return;
  }

  const data = await response.json();
  console.log("✅ AI connected!\n");
  console.log("Response:");
  console.log(data.choices[0].message.content);
  console.log("\nModel:", data.model);
}

test().catch(console.error);