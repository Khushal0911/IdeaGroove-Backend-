import express from "express";
import {
  uploadProfilePic,
  uploadNote,
  uploadEvent,
  uploadChat,
} from "../config/cloudinary.js";

const router = express.Router();

// ─── Profile Picture ──────────────────────────────────────────────────────────
router.post("/profile-pic", uploadProfilePic.single("image"), (req, res) => {
  try {
    if (!req.file)
      return res
        .status(400)
        .json({ status: false, message: "No file uploaded" });
    res
      .status(200)
      .json({ status: true, url: req.file.path, public_id: req.file.filename });
  } catch (err) {
    res.status(500).json({ status: false, error: err.message });
  }
});

// ─── Notes ────────────────────────────────────────────────────────────────────
router.post("/note", uploadNote.single("image"), (req, res) => {
  try {
    if (!req.file)
      return res
        .status(400)
        .json({ status: false, message: "No file uploaded" });
    res
      .status(200)
      .json({ status: true, url: req.file.path, public_id: req.file.filename });
  } catch (err) {
    res.status(500).json({ status: false, error: err.message });
  }
});

// ─── Events ───────────────────────────────────────────────────────────────────
router.post("/event", uploadEvent.single("image"), (req, res) => {
  try {
    if (!req.file)
      return res
        .status(400)
        .json({ status: false, message: "No file uploaded" });
    res
      .status(200)
      .json({ status: true, url: req.file.path, public_id: req.file.filename });
  } catch (err) {
    res.status(500).json({ status: false, error: err.message });
  }
});

// ─── Chat Attachments ─────────────────────────────────────────────────────────
router.post("/chat", uploadChat.single("image"), (req, res) => {
  try {
    if (!req.file)
      return res
        .status(400)
        .json({ status: false, message: "No file uploaded" });
    res
      .status(200)
      .json({ status: true, url: req.file.path, public_id: req.file.filename });
  } catch (err) {
    res.status(500).json({ status: false, error: err.message });
  }
});

export default router;
