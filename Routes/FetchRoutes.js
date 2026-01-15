import express from "express";
import {
  getData,
  searchColleges,
  searchDegrees,
  searchHobbies,
} from "../controllers/FetchController.js";
const fetchRouter = express.Router();

fetchRouter.get("/signup", getData);
fetchRouter.get("/search/colleges", searchColleges);
fetchRouter.get("/search/degrees", searchDegrees);
fetchRouter.get("/search/hobbies", searchHobbies);

export default fetchRouter;
