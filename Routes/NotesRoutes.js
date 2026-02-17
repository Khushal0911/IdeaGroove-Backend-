import express from "express";
import { upload } from "../config/cloud.js";
import { addNotes, deleteNotes, getNotes, updateNotes } from "../controllers/NotesController.js";

const notesRouter = express.Router();

notesRouter.post("/create",upload.single("Note_File"),addNotes); //working
notesRouter.get("/allNotes",getNotes); //working
notesRouter.post("/update",upload.single("Note_File"),updateNotes); //working
notesRouter.get("/delete/:id",deleteNotes);//working

export default notesRouter;