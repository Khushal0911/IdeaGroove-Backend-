import { addAnswer, addQuestion, deleteAnswer, deleteQuestion, getQnA, updateAnswer, updateQuestion } from "../controllers/QnAController.js";
import express from "express";

const qnaRouter = express.Router();

qnaRouter.get("/allQnA",getQnA); //working

//question
qnaRouter.post("/createQuestion",addQuestion); //working
qnaRouter.post("/updateQuestion",updateQuestion); //working
qnaRouter.get("/deleteQuestion/:Q_ID",deleteQuestion); //working

//answer
qnaRouter.post("/createAnswer",addAnswer); //working
qnaRouter.post("/updateAnswer",updateAnswer);//working
qnaRouter.get("/deleteAnswer/:A_ID",deleteAnswer); //working


export default qnaRouter;