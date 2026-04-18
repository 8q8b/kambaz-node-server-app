import QuizzesDao from "./dao.js";
import QuestionsDao from "../questions/dao.js";
import EnrollmentsDao from "../enrollments/dao.js";

function isFacultyRole(role) {
  return role === "FACULTY" || role === "ADMIN";
}

function getCurrentUser(req, res) {
  const user = req.session["currentUser"];
  if (!user) {
    res.status(401).json({ message: "You must be signed in" });
    return null;
  }
  return user;
}

async function assertEnrolled(enrollmentsDao, userId, courseId, res) {
  const enrollment = await enrollmentsDao.findEnrollment(userId, courseId);
  if (!enrollment) {
    res.status(403).json({ message: "Not enrolled in this course" });
    return false;
  }
  return true;
}

function validateQuestionDoc(doc) {
  if (!doc.type || !["multiple_choice", "true_false", "fill_blank"].includes(doc.type)) {
    return "Invalid or missing question type";
  }
  if (!doc.prompt || String(doc.prompt).trim() === "") {
    return "Question prompt is required";
  }
  if (doc.type === "multiple_choice") {
    const choices = doc.choices || [];
    if (choices.length < 2) {
      return "Multiple choice questions need at least two choices";
    }
    const correctCount = choices.filter((c) => c.isCorrect).length;
    if (correctCount !== 1) {
      return "Multiple choice questions must have exactly one correct choice";
    }
    for (const c of choices) {
      if (!c.text || String(c.text).trim() === "") {
        return "Each choice needs non-empty text";
      }
    }
  } else if (doc.type === "true_false") {
    if (typeof doc.correctBoolean !== "boolean") {
      return "True/false questions require correctBoolean (boolean)";
    }
  } else if (doc.type === "fill_blank") {
    const answers = (doc.acceptableAnswers || []).map((a) => String(a).trim()).filter(Boolean);
    if (!answers.length) {
      return "Fill-in-the-blank questions need at least one acceptable answer";
    }
  }
  return null;
}

export default function QuizRoutes(app, db) {
  const quizzesDao = QuizzesDao(db);
  const questionsDao = QuestionsDao(db);
  const enrollmentsDao = EnrollmentsDao(db);

  const findQuizzesForCourse = async (req, res) => {
    const { courseId } = req.params;
    const user = getCurrentUser(req, res);
    if (!user) {
      return;
    }
    if (!(await assertEnrolled(enrollmentsDao, user._id, courseId, res))) {
      return;
    }
    const publishedOnly = !isFacultyRole(user.role);
    const quizzes = await quizzesDao.findQuizzesForCourse(courseId, { publishedOnly });
    res.json(quizzes);
  };

  const createQuizForCourse = async (req, res) => {
    const { courseId } = req.params;
    const user = getCurrentUser(req, res);
    if (!user) {
      return;
    }
    if (!isFacultyRole(user.role)) {
      res.status(403).json({ message: "Only faculty can create quizzes" });
      return;
    }
    if (!(await assertEnrolled(enrollmentsDao, user._id, courseId, res))) {
      return;
    }
    const quiz = {
      ...req.body,
      course: courseId,
    };
    if (!quiz.title || String(quiz.title).trim() === "") {
      res.status(400).json({ message: "Quiz title is required" });
      return;
    }
    const created = await quizzesDao.createQuiz(quiz);
    res.json(created);
  };

  const findQuizById = async (req, res) => {
    const { quizId } = req.params;
    const user = getCurrentUser(req, res);
    if (!user) {
      return;
    }
    const quiz = await quizzesDao.findQuizById(quizId);
    if (!quiz) {
      res.sendStatus(404);
      return;
    }
    if (!(await assertEnrolled(enrollmentsDao, user._id, quiz.course, res))) {
      return;
    }
    if (!isFacultyRole(user.role) && !quiz.published) {
      res.status(403).json({ message: "Quiz is not available" });
      return;
    }
    const questions = await questionsDao.findQuestionsForQuiz(quizId);
    const pointsPossible = questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0);
    res.json({ ...quiz, pointsPossible });
  };

  const updateQuiz = async (req, res) => {
    const { quizId } = req.params;
    const user = getCurrentUser(req, res);
    if (!user) {
      return;
    }
    if (!isFacultyRole(user.role)) {
      res.status(403).json({ message: "Only faculty can update quizzes" });
      return;
    }
    const existing = await quizzesDao.findQuizById(quizId);
    if (!existing) {
      res.sendStatus(404);
      return;
    }
    if (!(await assertEnrolled(enrollmentsDao, user._id, existing.course, res))) {
      return;
    }
    const { course: _dropCourse, _id: _dropId, ...updates } = req.body;
    const updated = await quizzesDao.updateQuiz(quizId, updates);
    res.json(updated);
  };

  const deleteQuiz = async (req, res) => {
    const { quizId } = req.params;
    const user = getCurrentUser(req, res);
    if (!user) {
      return;
    }
    if (!isFacultyRole(user.role)) {
      res.status(403).json({ message: "Only faculty can delete quizzes" });
      return;
    }
    const existing = await quizzesDao.findQuizById(quizId);
    if (!existing) {
      res.sendStatus(404);
      return;
    }
    if (!(await assertEnrolled(enrollmentsDao, user._id, existing.course, res))) {
      return;
    }
    const result = await quizzesDao.deleteQuiz(quizId);
    if (!result.deletedCount) {
      res.sendStatus(404);
      return;
    }
    res.sendStatus(204);
  };

  const publishQuiz = async (req, res) => {
    const { quizId } = req.params;
    const user = getCurrentUser(req, res);
    if (!user) {
      return;
    }
    if (!isFacultyRole(user.role)) {
      res.status(403).json({ message: "Only faculty can publish quizzes" });
      return;
    }
    const existing = await quizzesDao.findQuizById(quizId);
    if (!existing) {
      res.sendStatus(404);
      return;
    }
    if (!(await assertEnrolled(enrollmentsDao, user._id, existing.course, res))) {
      return;
    }
    const { published } = req.body;
    if (typeof published !== "boolean") {
      res.status(400).json({ message: "Body must include published (boolean)" });
      return;
    }
    const updated = await quizzesDao.setQuizPublished(quizId, published);
    res.json(updated);
  };

  const findQuestionsForQuiz = async (req, res) => {
    const { quizId } = req.params;
    const user = getCurrentUser(req, res);
    if (!user) {
      return;
    }
    const quiz = await quizzesDao.findQuizById(quizId);
    if (!quiz) {
      res.sendStatus(404);
      return;
    }
    if (!(await assertEnrolled(enrollmentsDao, user._id, quiz.course, res))) {
      return;
    }
    if (!isFacultyRole(user.role) && !quiz.published) {
      res.status(403).json({ message: "Quiz is not available" });
      return;
    }
    const questions = await questionsDao.findQuestionsForQuiz(quizId);
    res.json(questions);
  };

  const createQuestionForQuiz = async (req, res) => {
    const { quizId } = req.params;
    const user = getCurrentUser(req, res);
    if (!user) {
      return;
    }
    if (!isFacultyRole(user.role)) {
      res.status(403).json({ message: "Only faculty can create questions" });
      return;
    }
    const quiz = await quizzesDao.findQuizById(quizId);
    if (!quiz) {
      res.sendStatus(404);
      return;
    }
    if (!(await assertEnrolled(enrollmentsDao, user._id, quiz.course, res))) {
      return;
    }
    const question = {
      ...req.body,
      quiz: quizId,
    };
    const err = validateQuestionDoc(question);
    if (err) {
      res.status(400).json({ message: err });
      return;
    }
    const created = await questionsDao.createQuestion(question);
    res.json(created);
  };

  const updateQuestion = async (req, res) => {
    const { questionId } = req.params;
    const user = getCurrentUser(req, res);
    if (!user) {
      return;
    }
    if (!isFacultyRole(user.role)) {
      res.status(403).json({ message: "Only faculty can update questions" });
      return;
    }
    const existing = await questionsDao.findQuestionById(questionId);
    if (!existing) {
      res.sendStatus(404);
      return;
    }
    const quiz = await quizzesDao.findQuizById(existing.quiz);
    if (!quiz) {
      res.sendStatus(404);
      return;
    }
    if (!(await assertEnrolled(enrollmentsDao, user._id, quiz.course, res))) {
      return;
    }
    const { quiz: _q, _id: _i, ...updates } = req.body;
    const merged = { ...existing, ...updates };
    const err = validateQuestionDoc(merged);
    if (err) {
      res.status(400).json({ message: err });
      return;
    }
    const updated = await questionsDao.updateQuestion(questionId, updates);
    res.json(updated);
  };

  const deleteQuestion = async (req, res) => {
    const { questionId } = req.params;
    const user = getCurrentUser(req, res);
    if (!user) {
      return;
    }
    if (!isFacultyRole(user.role)) {
      res.status(403).json({ message: "Only faculty can delete questions" });
      return;
    }
    const existing = await questionsDao.findQuestionById(questionId);
    if (!existing) {
      res.sendStatus(404);
      return;
    }
    const quiz = await quizzesDao.findQuizById(existing.quiz);
    if (!quiz) {
      res.sendStatus(404);
      return;
    }
    if (!(await assertEnrolled(enrollmentsDao, user._id, quiz.course, res))) {
      return;
    }
    const result = await questionsDao.deleteQuestion(questionId);
    if (!result.deletedCount) {
      res.sendStatus(404);
      return;
    }
    res.sendStatus(204);
  };

  app.get("/api/courses/:courseId/quizzes", findQuizzesForCourse);
  app.post("/api/courses/:courseId/quizzes", createQuizForCourse);

  app.get("/api/quizzes/:quizId", findQuizById);
  app.put("/api/quizzes/:quizId", updateQuiz);
  app.delete("/api/quizzes/:quizId", deleteQuiz);
  app.patch("/api/quizzes/:quizId/publish", publishQuiz);

  app.get("/api/quizzes/:quizId/questions", findQuestionsForQuiz);
  app.post("/api/quizzes/:quizId/questions", createQuestionForQuiz);
  app.put("/api/questions/:questionId", updateQuestion);
  app.delete("/api/questions/:questionId", deleteQuestion);
}
