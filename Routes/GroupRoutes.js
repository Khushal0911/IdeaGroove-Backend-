import express from "express";
import { addGroup } from "../controllers/GroupController.js";

const groupRouter = express.Router();

groupRouter.post("/create",addGroup);

export default groupRouter;