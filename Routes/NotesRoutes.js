import express from "express";
import { uploadNote } from "../config/cloud.js";
import {
  addNotes,
  deleteNotes,
  getNotes,
  getUserNotes,
  updateNotes,
} from "../controllers/NotesController.js";

const notesRouter = express.Router();

notesRouter.get("/", getNotes); //working
notesRouter.get("/user/:id", getUserNotes); //working
notesRouter.post("/create", uploadNote.single("Note_File"), addNotes); //working
notesRouter.post("/update", uploadNote.single("Note_File"), updateNotes); //working
notesRouter.get("/delete/:id", deleteNotes); //working

export default notesRouter;
