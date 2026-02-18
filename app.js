import "dotenv/config";
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

const app = express();
axios.defaults.withCredentials = true;

app.use(
  cors({
    origin: "http://localhost:5173",
    methods: "GET,POST,PUT,DELETE",
    credentials: true, // Required for cookies to be sent/received
  }),
);

app.use(express.json());

app.use(
  cookieSession({
    name: "session",
    // Use an env variable for security, fallback to a string for dev
    keys: [process.env.COOKIE_KEY || "idea-groove-secret-key"],
    maxAge: 24 * 60 * 60 * 1000, // Session valid for 24 hours
  }),
);

app.use((req, res, next) => {
  if (req.session && !req.session.regenerate) {
    req.session.regenerate = (cb) => {
      cb();
    };
  }
  if (req.session && !req.session.save) {
    req.session.save = (cb) => {
      cb();
    };
  }
  next();
});

// 4. Initialize Passport (Required if using sessions)
app.use(passport.initialize());
app.use(passport.session());

app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/upload", uploadRoutes);
app.use("/api/students", studentRouter);
app.use("/api", fetchRouter);
app.use("/api/events", eventRouter);
app.use("/api/notes",notesRouter);
app.use("/api/qna",qnaRouter);
app.use("/api/degreeSubject",degreeSubjectRouter);
app.use("/api/groups",groupRouter);

app.get("/", (req, res) => {
  res.send("Server is Live");
});

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await testConnection();
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (err) {
    console.error(
      "Failed to start server due to DB connection error. Exiting.",
    );
    process.exit(1);
  }
};

startServer();
