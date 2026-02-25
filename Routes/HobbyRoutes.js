import express from "express";
import { getAllHobbies } from "../Controllers/HobbyController.js";

const hobbyRouter = express.Router();

hobbyRouter.get("/", getAllHobbies);

export default hobbyRouter;
