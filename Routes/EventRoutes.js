import express from "express";
import {
  addEvent,
  deleteEvent,
  getEvents,
  getUserEvents,
  updateEvents,
} from "../controllers/EventController.js";
import { upload } from "../config/cloud.js";

const eventRouter = express.Router();

eventRouter.post("/create", upload.single("Poster_File"), addEvent);
eventRouter.get("/", getEvents);
eventRouter.get("/user/:id", getUserEvents);
eventRouter.post("/update", upload.single("Poster_File"), updateEvents);
eventRouter.get("/delete/:id", deleteEvent);

export default eventRouter;
