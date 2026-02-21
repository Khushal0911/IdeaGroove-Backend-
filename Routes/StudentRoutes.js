import express from "express";
import {
  getAllStudents,
  getPublicProfile,
  getStudentActivities,
} from "../controllers/StudentController.js";
const studentRouter = express.Router();

studentRouter.get("/profile/:id", getPublicProfile);
studentRouter.get("/all", getAllStudents);
studentRouter.get("/:id/activities", getStudentActivities);

export default studentRouter;
