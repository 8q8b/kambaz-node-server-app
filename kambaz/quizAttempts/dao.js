import { v4 as uuidv4 } from "uuid";
import model from "./model.js";

export default function QuizAttemptsDao() {
  async function countSubmittedAttempts(quizId, userId) {
    return model.countDocuments({ quiz: quizId, user: userId, status: "SUBMITTED" });
  }

  async function findInProgressAttempt(quizId, userId) {
    return model.findOne({ quiz: quizId, user: userId, status: "IN_PROGRESS" }).lean();
  }

  async function findLastSubmittedAttempt(quizId, userId) {
    return model
      .findOne({ quiz: quizId, user: userId, status: "SUBMITTED" })
      .sort({ submittedAt: -1, attemptNumber: -1 })
      .lean();
  }

  async function findAttemptById(attemptId) {
    return model.findById(attemptId).lean();
  }

  async function createAttempt({ quizId, userId, attemptNumber }) {
    const doc = {
      _id: uuidv4(),
      quiz: quizId,
      user: userId,
      attemptNumber,
      status: "IN_PROGRESS",
      startedAt: new Date(),
    };
    const created = await model.create(doc);
    return created.toObject();
  }

  async function submitAttempt(attemptId, userId, { answers, score, maxScore }) {
    const updated = await model.findOneAndUpdate(
      { _id: attemptId, user: userId, status: "IN_PROGRESS" },
      {
        $set: {
          status: "SUBMITTED",
          submittedAt: new Date(),
          answers,
          score,
          maxScore,
        },
      },
      { new: true, runValidators: true }
    );
    return updated ? updated.toObject() : undefined;
  }

  async function deleteAttemptsForQuiz(quizId) {
    return model.deleteMany({ quiz: quizId });
  }

  return {
    countSubmittedAttempts,
    findInProgressAttempt,
    findLastSubmittedAttempt,
    findAttemptById,
    createAttempt,
    submitAttempt,
    deleteAttemptsForQuiz,
  };
}
