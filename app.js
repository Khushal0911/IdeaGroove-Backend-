import "dotenv/config";
import http from "http";
import express from "express";
import cors from "cors";
import passport from "passport";
import cookieSession from "cookie-session";
import authRouter from "./routes/AuthRoutes.js";
import { testConnection } from "./config/db.js";
import "./config/passport.js";
import axios from "axios";
import fetchRouter from "./routes/FetchRoutes.js";
import uploadRoutes from "./routes/upload.js";
import adminRouter from "./routes/AdminRoutes.js";
import studentRouter from "./routes/StudentRoutes.js";
import eventRouter from "./routes/EventRoutes.js";
import notesRouter from "./routes/NotesRoutes.js";
import qnaRouter from "./routes/QnARoutes.js";
import degreeSubjectRouter from "./routes/DegreeSubjectRoutes.js";
import groupRouter from "./routes/GroupRoutes.js";
import hobbyRouter from "./Routes/HobbyRoutes.js";
import complaintRouter from "./routes/ComplaintRoutes.js";
import chatRouter from "./routes/ChatsRoutes.js";
import { initSocket } from "./socket/socketServer.js";

const app = express();
// Create raw http.Server so Socket.io can attach to the same port
const httpServer = http.createServer(app);

axios.defaults.withCredentials = true;

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: "GET,POST,PUT,DELETE",
    credentials: true,
  }),
);

app.use(express.json());

app.use(
  cookieSession({
    name: "session",
    keys: [process.env.COOKIE_KEY || "idea-groove-secret-key"],
    maxAge: 24 * 60 * 60 * 1000,
  }),
);

app.use((req, res, next) => {
  if (req.session) {
    const originalSession = req.session;
    if (!req.session.regenerate) {
      req.session.regenerate = (cb) => {
        req.session = originalSession;
        cb();
      };
    }
    if (!req.session.save) {
      req.session.save = (cb) => {
        cb();
      };
    }
  }
  next();
});

app.use(passport.initialize());
app.use(passport.session());

app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/upload", uploadRoutes);
app.use("/api/students", studentRouter);
app.use("/api", fetchRouter);
app.use("/api/events", eventRouter);
app.use("/api/notes", notesRouter);
app.use("/api/qna", qnaRouter);
app.use("/api/degreeSubject", degreeSubjectRouter);
app.use("/api/groups", groupRouter);
app.use("/api/hobbies", hobbyRouter);
app.use("/api/complaints", complaintRouter);
app.use("/api/chats", chatRouter);

app.get("/", (req, res) => {
  res.send("Server is Live");
});

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await testConnection();
    // Listen on httpServer (not app) so Socket.io shares the same port
    httpServer.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      // Attach Socket.io after server is listening
      initSocket(httpServer);
      console.log(`Socket.io initialised on port ${PORT}`);
    });
  } catch (err) {
    console.error(
      "Failed to start server due to DB connection error. Exiting.",
    );
    process.exit(1);
  }
};

startServer();
