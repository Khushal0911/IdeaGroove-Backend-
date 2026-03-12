import express from "express";
import { uploadNote } from "../config/cloud.js";
import {
  addNotes,
  deleteNotes,
  getNoteDownloadUrl,
  getNotes,
  getUserNotes,
  updateNotes,
} from "../Controllers/NotesController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const notesRouter = express.Router();

notesRouter.get("/", getNotes); //working
notesRouter.get("/user/:id", getUserNotes); //working
notesRouter.get("/download/:id", authMiddleware, getNoteDownloadUrl);
notesRouter.post("/create", uploadNote.single("Note_File"), addNotes); //working
notesRouter.post("/update", uploadNote.single("Note_File"), updateNotes); //working
notesRouter.get("/delete/:id", deleteNotes); //working

export default notesRouter;
