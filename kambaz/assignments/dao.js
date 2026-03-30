import { v4 as uuidv4 } from "uuid";

export default function AssignmentsDao(db) {
  function findAssignmentsForCourse(courseId) {
    const { assignments } = db;
    return assignments.filter((a) => a.course === courseId);
  }
  function createAssignment(assignment) {
    const newAssignment = { ...assignment, _id: uuidv4() };
    db.assignments = [...db.assignments, newAssignment];
    return newAssignment;
  }
  function deleteAssignment(assignmentId) {
    const before = db.assignments.length;
    db.assignments = db.assignments.filter((a) => a._id !== assignmentId);
    return db.assignments.length < before;
  }
  function updateAssignment(assignmentId, assignmentUpdates) {
    const assignment = db.assignments.find((a) => a._id === assignmentId);
    if (!assignment) return undefined;
    Object.assign(assignment, assignmentUpdates);
    return assignment;
  }

  return {
    findAssignmentsForCourse,
    createAssignment,
    deleteAssignment,
    updateAssignment,
  };
}
