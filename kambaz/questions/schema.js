import mongoose from "mongoose";

const choiceSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    text: { type: String, required: true },
    isCorrect: { type: Boolean, default: false },
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    quiz: { type: String, ref: "QuizModel", required: true },
    type: {
      type: String,
      enum: ["multiple_choice", "true_false", "fill_blank"],
      required: true,
    },
    prompt: { type: String, required: true },
    points: { type: Number, default: 1 },
    order: { type: Number, default: 0 },
    choices: [choiceSchema],
    correctBoolean: Boolean,
    acceptableAnswers: [String],
  },
  { collection: "questions" }
);

questionSchema.index({ quiz: 1, order: 1 });

export default questionSchema;
