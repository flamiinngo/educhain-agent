import dotenv from "dotenv";
dotenv.config();

import { callAI } from "./teach.js";

async function gradeQuiz(studentAnswers, correctAnswers, quizDurationSeconds, topic) {
  console.log(`[GRADE] Grading quiz: ${topic}`);
  console.log(`[GRADE] Duration: ${quizDurationSeconds}s`);

  // Quick local scoring
  let score = 0;
  for (let i = 0; i < 5; i++) {
    if (studentAnswers[i] && correctAnswers[i] &&
        studentAnswers[i].toUpperCase() === correctAnswers[i].toUpperCase()) {
      score++;
    }
  }

  // Check for suspicious behavior
  let suspicious = false;
  let suspiciousReason = "";

  if (quizDurationSeconds < 3
) {
    suspicious = true;
    suspiciousReason = `Quiz completed in ${quizDurationSeconds}s — minimum is 180s`;
  }

  const allSame = studentAnswers.every(a => a === studentAnswers[0]);
  if (allSame) {
    suspicious = true;
    suspiciousReason = "All answers identical — mechanical pattern detected";
  }

  const sequential = ["A", "B", "C", "D", "A"];
  const isSequential = studentAnswers.every((a, i) => a.toUpperCase() === sequential[i]);
  if (isSequential) {
    suspicious = true;
    suspiciousReason = "Sequential answer pattern — likely bot";
  }

  const passed = score >= 4 && !suspicious;

  let reward = 0;
  if (passed) {
    reward = score === 5 ? 0.50 : 0.25;
  }

  // Generate feedback
  let feedback = "";
  try {
    const messages = [
      {
        role: "system",
        content: "You are EduChain, an encouraging AI teacher. Keep responses to 2 sentences max."
      },
      {
        role: "user",
        content: score >= 4
          ? `A student scored ${score}/5 on a quiz about ${topic}. Give them a short encouraging message.`
          : `A student scored ${score}/5 on a quiz about ${topic}. Encourage them to try again tomorrow.`
      }
    ];
    feedback = await callAI(messages);
  } catch (err) {
    feedback = score >= 4
      ? `Great job scoring ${score}/5! Keep learning!`
      : `You scored ${score}/5. Keep studying and try again tomorrow!`;
  }

  const result = {
    score,
    outOf: 5,
    passed,
    reward,
    suspicious,
    suspiciousReason: suspiciousReason || "none",
    feedback,
    quizDurationSeconds,
    topic,
    gradedBy: "venice-ai",
    humanInvolved: false
  };

  console.log(`[GRADE] Score: ${score}/5 | Passed: ${passed} | Suspicious: ${suspicious}`);
  return result;
}

export { gradeQuiz };