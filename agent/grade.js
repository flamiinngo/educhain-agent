import dotenv from "dotenv";
dotenv.config();
import { callAI } from "./teach.js";

async function gradeQuiz(studentAnswers, correctAnswers, quizDurationSeconds, topic) {
  console.log(`[GRADE] Grading quiz: ${topic}`);
  console.log(`[GRADE] Duration: ${quizDurationSeconds}s`);

  // Score — compare numeric indices
  let score = 0;
  for (let i = 0; i < 5; i++) {
    if (studentAnswers[i] !== undefined && correctAnswers[i] !== undefined &&
        String(studentAnswers[i]) === String(correctAnswers[i])) {
      score++;
    }
  }

  // Suspicious detection
  let suspicious = false;
  let suspiciousReason = "";

  if (quizDurationSeconds < 3) {
    suspicious = true;
    suspiciousReason = `Quiz completed in ${quizDurationSeconds}s — minimum is 180s`;
  }

  // Only flag identical answers if they're all 0 AND score is 0 (likely default/untouched)
  // Don't flag if the correct answers happen to all be the same index
  const allSame = studentAnswers.every(a => a === studentAnswers[0]);
  if (allSame && score === 0) {
    suspicious = true;
    suspiciousReason = "All answers identical and all wrong — mechanical pattern detected";
  }

  const passed = score >= 4 && !suspicious;
  const reward = passed ? (score === 5 ? 0.50 : 0.25) : 0;

  // Feedback
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
