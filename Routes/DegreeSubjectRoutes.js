import express from "express";
import { allDegreeSubject } from "../controllers/DegreeSubjectController.js";

const degreeSubjectRouter = express.Router();

degreeSubjectRouter.get("/allDegreeSubject",allDegreeSubject);

export default degreeSubjectRouter;