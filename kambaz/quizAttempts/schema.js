import mongoose from "mongoose";

const attemptAnswerSchema = new mongoose.Schema(
  {
    question: { type: String, ref: "QuestionModel", required: true },
    selectedChoiceId: String,
    booleanAnswer: Boolean,
    textAnswer: String,
    isCorrect: Boolean,
    pointsEarned: Number,
    pointsPossible: Number,
  },
  { _id: false }
);

const quizAttemptSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    quiz: { type: String, ref: "QuizModel", required: true },
    user: { type: String, ref: "UserModel", required: true },
    attemptNumber: { type: Number, required: true },
    status: {
      type: String,
      enum: ["IN_PROGRESS", "SUBMITTED"],
      default: "IN_PROGRESS",
    },
    startedAt: { type: Date, default: Date.now },
    submittedAt: Date,
    score: Number,
    maxScore: Number,
    answers: [attemptAnswerSchema],
  },
  { collection: "quizAttempts" }
);

quizAttemptSchema.index(
  { quiz: 1, user: 1, attemptNumber: 1 },
  { unique: true }
);
quizAttemptSchema.index({ quiz: 1, user: 1, submittedAt: -1 });
quizAttemptSchema.index({ quiz: 1, user: 1, startedAt: -1 });

export default quizAttemptSchema;
