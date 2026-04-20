import mongoose from "mongoose";

const quizSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    course: { type: String, ref: "CourseModel", required: true },
    title: { type: String, required: true },
    description: String,
    published: { type: Boolean, default: false },
    availableFrom: String,
    availableUntil: String,
    dueDate: String,
    quizType: {
      type: String,
      enum: ["GRADED_QUIZ", "PRACTICE_QUIZ", "GRADED_SURVEY", "UNGRADED_SURVEY"],
      default: "GRADED_QUIZ",
    },
    assignmentGroup: {
      type: String,
      enum: ["QUIZZES", "EXAMS", "ASSIGNMENTS", "PROJECT"],
      default: "QUIZZES",
    },
    timeLimitMinutes: { type: Number, default: 0 },
    shuffleQuestions: { type: Boolean, default: false },
    oneQuestionAtATime: { type: Boolean, default: false },
    multipleAttempts: { type: Boolean, default: false },
    howManyAttempts: { type: Number, default: 1 },
    accessCode: String,
    showCorrectAnswers: { type: Boolean, default: true },
    webcamRequired: { type: Boolean, default: false },
    lockQuestionsAfterAnswering: { type: Boolean, default: false },
  },
  { collection: "quizzes" }
);

quizSchema.index({ course: 1, published: 1 });

export default quizSchema;
