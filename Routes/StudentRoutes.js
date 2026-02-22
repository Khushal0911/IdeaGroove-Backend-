import express from "express";
import {
  getAllStudents,
  getPublicProfile,
  getStudentActivities,
  updateStudent,
} from "../controllers/StudentController.js";
const studentRouter = express.Router();

studentRouter.get("/profile/:id", getPublicProfile);
studentRouter.get("/all", getAllStudents);
studentRouter.get("/:id/activities", getStudentActivities);
studentRouter.post("/update",updateStudent);

export default studentRouter;
