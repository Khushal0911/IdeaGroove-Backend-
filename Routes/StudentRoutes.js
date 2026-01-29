import express from "express";
import {
  getAllStudents,
  getPublicProfile,
} from "../controllers/StudentController.js";
const studentRouter = express.Router();

studentRouter.get("/profile/:id", getPublicProfile);
studentRouter.get("/all", getAllStudents);

export default studentRouter;
