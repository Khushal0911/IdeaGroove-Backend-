import express from "express";
import {
  deleteStudent,
  getAllStudents,
  getColleges,
  getCurrentStudent,
  getDegrees,
  getHobbies,
  getPublicProfile,
  getStudentActivities,
  searchStudents,
  updateStudent,
} from "../Controllers/StudentController.js";

const studentRouter = express.Router();

studentRouter.get("/profile/:id", getPublicProfile);
studentRouter.get("/search", searchStudents);
studentRouter.get("/all", getAllStudents);
studentRouter.get("/:id/activities", getStudentActivities);
studentRouter.post("/update", updateStudent);
studentRouter.delete("/:id", deleteStudent);
studentRouter.get("/me/:id", getCurrentStudent);

studentRouter.get("/meta/colleges", getColleges);
studentRouter.get("/meta/degrees", getDegrees);
studentRouter.get("/meta/hobbies", getHobbies);

export default studentRouter;
