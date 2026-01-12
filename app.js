import "dotenv/config";
import express from "express";
import cors from "cors";
import passport from "passport";
import authRouter from "./routes/AuthRoutes.js";
import { testConnection } from "./config/db.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRouter);

app.get("/", (req, res) => {
  res.send("Server is Live");
});

const PORT = process.env.PORT || 8080;

const startServer = async () => {
  try {
    await testConnection();
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (err) {
    console.error(
      "Failed to start server due to DB connection error. Exiting."
    );
    process.exit(1);
  }
};

startServer();
