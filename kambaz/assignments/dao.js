import { v4 as uuidv4 } from "uuid";
import model from "./model.js";

export default function AssignmentsDao() {
  async function findAssignmentsForCourse(courseId) {
    return model.find({ course: courseId }).sort({ title: 1 }).lean();
  }

  async function createAssignment(assignment) {
    const doc = {
      ...assignment,
      _id: assignment._id || uuidv4(),
    };
    const created = await model.create(doc);
    return created.toObject();
  }

  async function deleteAssignment(assignmentId) {
    return model.deleteOne({ _id: assignmentId });
  }

  async function updateAssignment(assignmentId, assignmentUpdates) {
    const { _id, ...rest } = assignmentUpdates;
    const updated = await model.findOneAndUpdate(
      { _id: assignmentId },
      { $set: rest },
      { new: true, runValidators: true }
    );
    return updated ? updated.toObject() : undefined;
  }

  async function deleteAssignmentsForCourse(courseId) {
    return model.deleteMany({ course: courseId });
  }

  return {
    findAssignmentsForCourse,
    createAssignment,
    deleteAssignment,
    updateAssignment,
    deleteAssignmentsForCourse,
  };
}
