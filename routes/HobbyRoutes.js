import express from "express";
import { getAllHobbies } from "../controllers/HobbyController.js";

const hobbyRouter = express.Router();

hobbyRouter.get("/", getAllHobbies);

export default hobbyRouter;
