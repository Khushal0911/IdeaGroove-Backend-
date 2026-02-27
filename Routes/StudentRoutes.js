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
<<<<<<< HEAD
} from "../controllers/StudentController.js";
=======
} from "../Controllers/StudentController.js";
import { upload } from "../config/cloud.js";
>>>>>>> df2d7c351fa17a36fb1109e30746181693db5a58

const studentRouter = express.Router();

studentRouter.get("/profile/:id", getPublicProfile);
studentRouter.get("/search", searchStudents);
studentRouter.get("/all", getAllStudents);
studentRouter.get("/:id/activities", getStudentActivities);
studentRouter.post("/update", upload.single("profile_pic"), updateStudent);
studentRouter.delete("/:id", deleteStudent);
studentRouter.get("/me/:id", getCurrentStudent);

studentRouter.get("/meta/colleges", getColleges);
studentRouter.get("/meta/degrees", getDegrees);
studentRouter.get("/meta/hobbies", getHobbies);

export default studentRouter;
