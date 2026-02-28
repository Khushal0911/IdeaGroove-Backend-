import express from "express";
import {
  createChatRoom,
  getUserChatRooms,
  sendMessage,
  getMessagesByRoom,
  deleteMessage,
} from "../controllers/chatController.js";

import authMiddleware from "../middleware/authMiddleware.js";

const chatrouter = express.Router();

chatrouter.post("/create-room", authMiddleware, createChatRoom);
chatrouter.get("/my-rooms", authMiddleware, getUserChatRooms);
chatrouter.post("/send", authMiddleware, sendMessage);
chatrouter.get("/messages/:roomId", authMiddleware, getMessagesByRoom);
chatrouter.put("/delete/:messageId", authMiddleware, deleteMessage);

export default chatrouter;