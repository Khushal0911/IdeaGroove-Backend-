import express from "express";
import {addEvent, getEvents} from "../controllers/EventController.js"
import {upload} from "../config/cloud.js"

const eventRouter = express.Router();

eventRouter.post("/create",upload.single("Poster_File"),addEvent);
eventRouter.get("/allEvents",getEvents);

export default eventRouter;
