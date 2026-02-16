import express from "express";
import {createEvent, getEvents} from "../controllers/EventController.js"
import {upload} from "../config/cloud.js"

const eventRouter = express.Router();

eventRouter.post("/create",upload.single("Poster_File"),createEvent);
eventRouter.get("/allEvents",getEvents);

export default eventRouter;
