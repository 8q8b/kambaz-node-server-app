function normalizeFillBlankAnswer(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function scoreQuestionAnswer(question, answerPayload) {
  const pointsPossible = Number(question.points) || 0;
  if (!answerPayload) {
    return { isCorrect: false, pointsEarned: 0, pointsPossible };
  }

  if (question.type === "multiple_choice") {
    const selectedId = answerPayload.selectedChoiceId;
    if (!selectedId) {
      return { isCorrect: false, pointsEarned: 0, pointsPossible };
    }
    const choice = (question.choices || []).find((c) => c._id === selectedId);
    if (!choice || !choice.isCorrect) {
      return { isCorrect: false, pointsEarned: 0, pointsPossible };
    }
    return { isCorrect: true, pointsEarned: pointsPossible, pointsPossible };
  }

  if (question.type === "true_false") {
    if (typeof answerPayload.booleanAnswer !== "boolean") {
      return { isCorrect: false, pointsEarned: 0, pointsPossible };
    }
    if (answerPayload.booleanAnswer === question.correctBoolean) {
      return { isCorrect: true, pointsEarned: pointsPossible, pointsPossible };
    }
    return { isCorrect: false, pointsEarned: 0, pointsPossible };
  }

  if (question.type === "fill_blank") {
    const raw = answerPayload.textAnswer;
    if (raw == null || String(raw).trim() === "") {
      return { isCorrect: false, pointsEarned: 0, pointsPossible };
    }
    const normalized = normalizeFillBlankAnswer(raw);
    const acceptable = (question.acceptableAnswers || []).map((a) => normalizeFillBlankAnswer(a));
    if (acceptable.some((a) => a === normalized)) {
      return { isCorrect: true, pointsEarned: pointsPossible, pointsPossible };
    }
    return { isCorrect: false, pointsEarned: 0, pointsPossible };
  }

  return { isCorrect: false, pointsEarned: 0, pointsPossible };
}

export function buildGradedAnswers(questions, answersInput) {
  const byQuestion = new Map(
    (answersInput || [])
      .filter((a) => a && a.question)
      .map((a) => [a.question, a])
  );
  let score = 0;
  let maxScore = 0;
  const graded = [];
  for (const q of questions) {
    maxScore += Number(q.points) || 0;
    const input = byQuestion.get(q._id);
    const base = {
      question: q._id,
      selectedChoiceId: input?.selectedChoiceId,
      booleanAnswer: input?.booleanAnswer,
      textAnswer: input?.textAnswer,
    };
    const { isCorrect, pointsEarned, pointsPossible } = scoreQuestionAnswer(q, input);
    graded.push({
      ...base,
      isCorrect,
      pointsEarned,
      pointsPossible,
    });
    score += pointsEarned;
  }
  return { gradedAnswers: graded, score, maxScore };
}
