import express from "express";
import { uploadChat } from "../config/cloud.js";

const router = express.Router();

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
