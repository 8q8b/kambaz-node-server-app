import QuizzesDao from "./dao.js";
import QuestionsDao from "../questions/dao.js";
import EnrollmentsDao from "../enrollments/dao.js";
import QuizAttemptsDao from "../quizAttempts/dao.js";
import { buildGradedAnswers } from "../quizAttempts/scoring.js";

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

function maxAttemptsForQuiz(quiz) {
  if (!quiz.multipleAttempts) {
    return 1;
  }
  const n = Number(quiz.howManyAttempts);
  if (!Number.isFinite(n) || n < 1) {
    return 1;
  }
  return Math.min(100, Math.floor(n));
}

function isWithinAvailabilityWindow(quiz, at = new Date()) {
  if (quiz.availableFrom) {
    const from = new Date(quiz.availableFrom);
    if (!Number.isNaN(from.getTime()) && at < from) {
      return false;
    }
  }
  if (quiz.availableUntil) {
    const until = new Date(quiz.availableUntil);
    if (!Number.isNaN(until.getTime()) && at > until) {
      return false;
    }
  }
  return true;
}

function redactAttemptForStudent(attempt, quiz) {
  if (quiz.showCorrectAnswers) {
    return attempt;
  }
  const answers = (attempt.answers || []).map((a) => {
    const { isCorrect, pointsEarned, pointsPossible, ...rest } = a;
    return rest;
  });
  return { ...attempt, answers };
}

function normalizeYesNoBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value !== "string") {
    return value;
  }
  const normalized = value.trim().toUpperCase();
  if (normalized === "YES" || normalized === "TRUE") {
    return true;
  }
  if (normalized === "NO" || normalized === "FALSE") {
    return false;
  }
  return value;
}

function normalizeQuizType(value) {
  if (typeof value !== "string") {
    return value;
  }
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  const allowed = new Set([
    "GRADED_QUIZ",
    "PRACTICE_QUIZ",
    "GRADED_SURVEY",
    "UNGRADED_SURVEY",
  ]);
  return allowed.has(normalized) ? normalized : value;
}

function normalizeAssignmentGroup(value) {
  if (typeof value !== "string") {
    return value;
  }
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  const allowed = new Set(["QUIZZES", "EXAMS", "ASSIGNMENTS", "PROJECT"]);
  return allowed.has(normalized) ? normalized : value;
}

function normalizeQuizEditableFields(payload = {}) {
  const normalized = { ...payload };
  if (normalized.quizType != null) {
    normalized.quizType = normalizeQuizType(normalized.quizType);
  }
  if (normalized.assignmentGroup != null) {
    normalized.assignmentGroup = normalizeAssignmentGroup(normalized.assignmentGroup);
  }
  if (normalized.webcamRequired != null) {
    normalized.webcamRequired = normalizeYesNoBoolean(normalized.webcamRequired);
  }
  if (normalized.lockQuestionsAfterAnswering != null) {
    normalized.lockQuestionsAfterAnswering = normalizeYesNoBoolean(
      normalized.lockQuestionsAfterAnswering
    );
  }
  return normalized;
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
  const quizAttemptsDao = QuizAttemptsDao();

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
      ...normalizeQuizEditableFields(req.body),
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
    const { course: _dropCourse, _id: _dropId, ...updates } = normalizeQuizEditableFields(req.body);
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

  const startQuizAttempt = async (req, res) => {
    const { quizId } = req.params;
    const user = getCurrentUser(req, res);
    if (!user) {
      return;
    }
    if (isFacultyRole(user.role)) {
      res.status(403).json({ message: "Faculty cannot start graded quiz attempts" });
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
    if (!quiz.published) {
      res.status(403).json({ message: "Quiz is not available" });
      return;
    }
    if (!isWithinAvailabilityWindow(quiz)) {
      res.status(403).json({ message: "Quiz is not available at this time" });
      return;
    }
    if (quiz.accessCode && String(quiz.accessCode).trim() !== "") {
      const code = req.body?.accessCode;
      if (code !== quiz.accessCode) {
        res.status(403).json({ message: "Invalid or missing access code" });
        return;
      }
    }
    const maxAttempts = maxAttemptsForQuiz(quiz);
    const inProgress = await quizAttemptsDao.findInProgressAttempt(quizId, user._id);
    if (inProgress) {
      res.json(inProgress);
      return;
    }
    const submittedCount = await quizAttemptsDao.countSubmittedAttempts(quizId, user._id);
    if (submittedCount >= maxAttempts) {
      res.status(403).json({ message: "No attempts remaining" });
      return;
    }
    const attempt = await quizAttemptsDao.createAttempt({
      quizId,
      userId: user._id,
      attemptNumber: submittedCount + 1,
    });
    res.json(attempt);
  };

  const getInProgressQuizAttempt = async (req, res) => {
    const { quizId } = req.params;
    const user = getCurrentUser(req, res);
    if (!user) {
      return;
    }
    if (isFacultyRole(user.role)) {
      res.status(403).json({ message: "Only students have in-progress attempts" });
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
    const attempt = await quizAttemptsDao.findInProgressAttempt(quizId, user._id);
    if (!attempt) {
      res.sendStatus(404);
      return;
    }
    const { answers: _a, score: _s, maxScore: _m, ...meta } = attempt;
    res.json(meta);
  };

  const getLastQuizAttempt = async (req, res) => {
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
    const attempt = await quizAttemptsDao.findLastSubmittedAttempt(quizId, user._id);
    if (!attempt) {
      res.sendStatus(404);
      return;
    }
    if (isFacultyRole(user.role)) {
      res.status(403).json({ message: "Only students have graded attempts" });
      return;
    }
    res.json(redactAttemptForStudent(attempt, quiz));
  };

  const getQuizAttemptById = async (req, res) => {
    const { attemptId } = req.params;
    const user = getCurrentUser(req, res);
    if (!user) {
      return;
    }
    const attempt = await quizAttemptsDao.findAttemptById(attemptId);
    if (!attempt || attempt.user !== user._id) {
      res.sendStatus(404);
      return;
    }
    const quiz = await quizzesDao.findQuizById(attempt.quiz);
    if (!quiz) {
      res.sendStatus(404);
      return;
    }
    if (!(await assertEnrolled(enrollmentsDao, user._id, quiz.course, res))) {
      return;
    }
    if (isFacultyRole(user.role)) {
      res.status(403).json({ message: "Faculty cannot view student attempt records here" });
      return;
    }
    if (!quiz.published && attempt.status === "IN_PROGRESS") {
      res.status(403).json({ message: "Quiz is not available" });
      return;
    }
    if (attempt.status === "SUBMITTED") {
      res.json(redactAttemptForStudent(attempt, quiz));
      return;
    }
    const { answers: _a, score: _s, maxScore: _m, ...meta } = attempt;
    res.json(meta);
  };

  const submitQuizAttempt = async (req, res) => {
    const { attemptId } = req.params;
    const user = getCurrentUser(req, res);
    if (!user) {
      return;
    }
    if (isFacultyRole(user.role)) {
      res.status(403).json({ message: "Faculty cannot submit graded quiz attempts" });
      return;
    }
    const attempt = await quizAttemptsDao.findAttemptById(attemptId);
    if (!attempt || attempt.user !== user._id) {
      res.sendStatus(404);
      return;
    }
    if (attempt.status !== "IN_PROGRESS") {
      res.status(400).json({ message: "Attempt is not in progress" });
      return;
    }
    const quiz = await quizzesDao.findQuizById(attempt.quiz);
    if (!quiz) {
      res.sendStatus(404);
      return;
    }
    if (!(await assertEnrolled(enrollmentsDao, user._id, quiz.course, res))) {
      return;
    }
    if (!quiz.published) {
      res.status(403).json({ message: "Quiz is not available" });
      return;
    }
    const limitMin = Number(quiz.timeLimitMinutes) || 0;
    if (limitMin > 0 && attempt.startedAt) {
      const deadline = new Date(attempt.startedAt).getTime() + limitMin * 60_000;
      if (Date.now() > deadline) {
        res.status(400).json({ message: "Time limit exceeded" });
        return;
      }
    }
    const questions = await questionsDao.findQuestionsForQuiz(attempt.quiz);
    const { gradedAnswers, score, maxScore } = buildGradedAnswers(questions, req.body?.answers);
    const submitted = await quizAttemptsDao.submitAttempt(attemptId, user._id, {
      answers: gradedAnswers,
      score,
      maxScore,
    });
    if (!submitted) {
      res.status(400).json({ message: "Unable to submit attempt" });
      return;
    }
    res.json(redactAttemptForStudent(submitted, quiz));
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

  app.get("/api/quizzes/:quizId/attempts/in-progress", getInProgressQuizAttempt);
  app.get("/api/quizzes/:quizId/attempts/last", getLastQuizAttempt);
  app.post("/api/quizzes/:quizId/attempts", startQuizAttempt);
  app.get("/api/quiz-attempts/:attemptId", getQuizAttemptById);
  app.post("/api/quiz-attempts/:attemptId/submit", submitQuizAttempt);

  app.get("/api/quizzes/:quizId/questions", findQuestionsForQuiz);
  app.post("/api/quizzes/:quizId/questions", createQuestionForQuiz);
  app.put("/api/questions/:questionId", updateQuestion);
  app.delete("/api/questions/:questionId", deleteQuestion);
}
