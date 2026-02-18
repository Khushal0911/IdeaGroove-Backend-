import express from "express";
import {addEvent, deleteEvent, getEvents, updateEvents} from "../controllers/EventController.js"
import {upload} from "../config/cloud.js"

const eventRouter = express.Router();

eventRouter.post("/create",upload.single("Poster_File"),addEvent); //Perfectly working
eventRouter.get("/allEvents",getEvents); //Perfectly working
eventRouter.post("/update",upload.single("Poster_File"),updateEvents); //perfectly working
eventRouter.get("/delete/:id",deleteEvent); //working

export default eventRouter;
