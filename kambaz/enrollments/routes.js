import EnrollmentsDao from "./dao.js";

export default function EnrollmentsRoutes(app, db) {
  const dao = EnrollmentsDao(db);

  const resolveUserId = (req) => {
    let { userId } = req.params;
    if (userId === "current") {
      const currentUser = req.session["currentUser"];
      if (!currentUser) {
        return null;
      }
      userId = currentUser._id;
    }
    return userId;
  };

  const findEnrollmentsForUser = (req, res) => {
    const userId = resolveUserId(req);
    if (!userId) {
      res.sendStatus(401);
      return;
    }
    const enrollments = dao.findEnrollmentsForUser(userId);
    res.json(enrollments);
  };

  const enrollInCourse = (req, res) => {
    const userId = resolveUserId(req);
    if (!userId) {
      res.sendStatus(401);
      return;
    }
    const { course } = req.body;
    if (!course) {
      res.status(400).json({ message: "Missing course id" });
      return;
    }
    const enrollment = dao.enrollUserInCourse(userId, course);
    res.json(enrollment);
  };

  const unenrollFromCourse = (req, res) => {
    const userId = resolveUserId(req);
    if (!userId) {
      res.sendStatus(401);
      return;
    }
    const { courseId } = req.params;
    const removed = dao.unenrollUserFromCourse(userId, courseId);
    if (!removed) {
      res.sendStatus(404);
      return;
    }
    res.sendStatus(204);
  };

  app.get("/api/users/:userId/enrollments", findEnrollmentsForUser);
  app.post("/api/users/:userId/enrollments", enrollInCourse);
  app.delete("/api/users/:userId/enrollments/:courseId", unenrollFromCourse);
}
