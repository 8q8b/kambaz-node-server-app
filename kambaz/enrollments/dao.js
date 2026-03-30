import { v4 as uuidv4 } from "uuid";

export default function EnrollmentsDao(db) {
  function findEnrollmentsForUser(userId) {
    return db.enrollments.filter((e) => e.user === userId);
  }

  function enrollUserInCourse(userId, courseId) {
    const { enrollments } = db;
    const existing = enrollments.find(
      (e) => e.user === userId && e.course === courseId
    );
    if (existing) {
      return existing;
    }
    const enrollment = { _id: uuidv4(), user: userId, course: courseId };
    enrollments.push(enrollment);
    return enrollment;
  }

  function unenrollUserFromCourse(userId, courseId) {
    const { enrollments } = db;
    const before = enrollments.length;
    db.enrollments = enrollments.filter(
      (e) => !(e.user === userId && e.course === courseId)
    );
    return db.enrollments.length < before;
  }

  return {
    findEnrollmentsForUser,
    enrollUserInCourse,
    unenrollUserFromCourse,
  };
}
