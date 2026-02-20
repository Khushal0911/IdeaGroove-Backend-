import express from "express";
import { upload } from "../config/cloud.js";
import { addNotes, deleteNotes, getNotes, getUserNotes, updateNotes } from "../controllers/NotesController.js";

const notesRouter = express.Router();

notesRouter.get("/",getNotes); //working
notesRouter.get("/user/:id", getUserNotes);//working
notesRouter.post("/create",upload.single("Note_File"),addNotes); //working
notesRouter.post("/update",upload.single("Note_File"),updateNotes); //working
notesRouter.get("/delete/:id",deleteNotes);//working

export default notesRouter;