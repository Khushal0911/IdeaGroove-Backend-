import express from "express";
import {
  addEvent,
  deleteEvent,
  getEvents,
  getUserEvents,
  updateEventEngagement,
  updateEventReaction,
  updateEvents,
} from "../controllers/EventController.js";
import { upload } from "../config/cloud.js";

const eventRouter = express.Router();

eventRouter.post("/create", upload.single("Poster_File"), addEvent);
eventRouter.get("/", getEvents);
eventRouter.get("/user/:id", getUserEvents);
eventRouter.put("/update/:id", upload.single("Poster_File"), updateEvents);
eventRouter.get("/delete/:id", deleteEvent);
eventRouter.post("/engagement", updateEventEngagement);
eventRouter.post("/react", updateEventReaction);

export default eventRouter;
