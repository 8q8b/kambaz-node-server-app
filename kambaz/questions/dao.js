import { v4 as uuidv4 } from "uuid";
import model from "./model.js";

export default function QuestionsDao() {
  async function findQuestionsForQuiz(quizId) {
    return model.find({ quiz: quizId }).sort({ order: 1, _id: 1 }).lean();
  }

  async function findQuestionById(questionId) {
    return model.findById(questionId).lean();
  }

  async function createQuestion(question) {
    const doc = {
      ...question,
      _id: question._id || uuidv4(),
    };
    const created = await model.create(doc);
    return created.toObject();
  }

  async function deleteQuestion(questionId) {
    return model.deleteOne({ _id: questionId });
  }

  async function updateQuestion(questionId, questionUpdates) {
    const { _id, ...rest } = questionUpdates;
    const updated = await model.findOneAndUpdate(
      { _id: questionId },
      { $set: rest },
      { new: true, runValidators: true }
    );
    return updated ? updated.toObject() : undefined;
  }

  async function deleteQuestionsForQuiz(quizId) {
    return model.deleteMany({ quiz: quizId });
  }

  return {
    findQuestionsForQuiz,
    findQuestionById,
    createQuestion,
    deleteQuestion,
    updateQuestion,
    deleteQuestionsForQuiz,
  };
}
