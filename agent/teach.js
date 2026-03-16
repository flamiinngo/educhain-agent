import dotenv from "dotenv";
dotenv.config();

const API_KEY = process.env.GROQ_API_KEY;
const API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

async function callAI(messages) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages: messages,
      temperature: 0.7,
      max_tokens: 2000
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Generate a lesson on any topic
async function generateLesson(topic, age = 12) {
  console.log(`[TEACH] Generating lesson: ${topic}`);

  const messages = [
    {
      role: "system",
      content: "You are EduChain, an AI teacher for children in underserved communities worldwide."
    },
    {
      role: "user",
      content: `Teach a clear, simple, engaging lesson about ${topic} suitable for a student aged approximately ${age}. Keep it under 300 words. Use simple language. No jargon. Make it interesting. End with one encouraging sentence about learning.`
    }
  ];

  const lesson = await callAI(messages);
  console.log(`[TEACH] Lesson generated ✓`);
  return lesson;
}

// Generate a 5-question quiz based on the lesson
async function generateQuiz(lesson) {
  console.log(`[TEACH] Generating quiz...`);

  const messages = [
    {
      role: "system",
      content: "You are a quiz generator. Return ONLY valid JSON. No extra text before or after the JSON."
    },
    {
      role: "user",
      content: `Generate exactly 5 multiple choice questions testing understanding of this lesson:

${lesson}

Each question must have 4 options: A, B, C, D.
Mark the correct answer clearly.
Return ONLY a JSON array. No extra text. No markdown. No code blocks.
Format: [{"question":"...","options":{"A":"...","B":"...","C":"...","D":"..."},"answer":"A"}]`
    }
  ];

  const raw = await callAI(messages);

  // Clean the response — remove markdown code blocks if present
  let cleaned = raw.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  }
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  try {
    const quiz = JSON.parse(cleaned);

    if (!Array.isArray(quiz) || quiz.length !== 5) {
      throw new Error("Quiz must be exactly 5 questions");
    }

    console.log(`[TEACH] Quiz generated ✓ (5 questions)`);
    return quiz;
  } catch (err) {
    console.error(`[TEACH] Quiz parse error, retrying...`);
    const retry = await callAI(messages);
    let retryClean = retry.trim();
    if (retryClean.startsWith("```json")) retryClean = retryClean.slice(7);
    if (retryClean.startsWith("```")) retryClean = retryClean.slice(3);
    if (retryClean.endsWith("```")) retryClean = retryClean.slice(0, -3);
    retryClean = retryClean.trim();

    const retryQuiz = JSON.parse(retryClean);
    console.log(`[TEACH] Quiz generated on retry ✓`);
    return retryQuiz;
  }
}

// Full lesson flow — generate lesson + quiz together
async function generateFullLesson(topic, age = 12) {
  const lesson = await generateLesson(topic, age);
  const quiz = await generateQuiz(lesson);

  const quizId = `quiz_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return {
    quizId,
    topic,
    lesson,
    quiz,
    quizStartTime: new Date().toISOString(),
    generatedBy: "venice-ai",
    model: "llama-3.3-70b",
    humanInvolved: false
  };
}

export { generateLesson, generateQuiz, generateFullLesson, callAI };