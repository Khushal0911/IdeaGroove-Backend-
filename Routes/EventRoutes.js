import express from "express";
import {
  addEvent,
  deleteEvent,
  getEvents,
  getUserEvents,
  updateEventReaction,
  updateEvents,
} from "../controllers/EventController.js";
import { uploadEvent } from "../config/cloud.js";

const eventRouter = express.Router();

eventRouter.post("/create", uploadEvent.single("Poster_File"), addEvent);
eventRouter.get("/", getEvents);
eventRouter.get("/user/:id", getUserEvents);
eventRouter.put("/update/:id", uploadEvent.single("Poster_File"), updateEvents);
eventRouter.get("/delete/:id", deleteEvent);
eventRouter.post("/react", updateEventReaction);

export default eventRouter;
