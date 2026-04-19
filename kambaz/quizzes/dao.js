import { v4 as uuidv4 } from "uuid";
import model from "./model.js";
import questionModel from "../questions/model.js";
import quizAttemptModel from "../quizAttempts/model.js";

export default function QuizzesDao() {
  async function findQuizzesForCourse(courseId, { publishedOnly } = {}) {
    const filter = { course: courseId };
    if (publishedOnly) {
      filter.published = true;
    }
    return model.find(filter).sort({ title: 1 }).lean();
  }

  async function findQuizById(quizId) {
    return model.findById(quizId).lean();
  }

  async function createQuiz(quiz) {
    const doc = {
      ...quiz,
      _id: quiz._id || uuidv4(),
    };
    const created = await model.create(doc);
    return created.toObject();
  }

  async function deleteQuiz(quizId) {
    await questionModel.deleteMany({ quiz: quizId });
    await quizAttemptModel.deleteMany({ quiz: quizId });
    return model.deleteOne({ _id: quizId });
  }

  async function updateQuiz(quizId, quizUpdates) {
    const { _id, ...rest } = quizUpdates;
    const updated = await model.findOneAndUpdate(
      { _id: quizId },
      { $set: rest },
      { new: true, runValidators: true }
    );
    return updated ? updated.toObject() : undefined;
  }

  async function setQuizPublished(quizId, published) {
    const updated = await model.findOneAndUpdate(
      { _id: quizId },
      { $set: { published } },
      { new: true, runValidators: true }
    );
    return updated ? updated.toObject() : undefined;
  }

  async function deleteQuizzesForCourse(courseId) {
    const ids = await model.distinct("_id", { course: courseId });
    if (ids.length) {
      await questionModel.deleteMany({ quiz: { $in: ids } });
      await quizAttemptModel.deleteMany({ quiz: { $in: ids } });
    }
    return model.deleteMany({ course: courseId });
  }

  return {
    findQuizzesForCourse,
    findQuizById,
    createQuiz,
    deleteQuiz,
    updateQuiz,
    setQuizPublished,
    deleteQuizzesForCourse,
  };
}
