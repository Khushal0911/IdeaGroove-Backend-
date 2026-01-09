import "dotenv/config.js"
import express from "express";
import cors from "cors";
import passport from "passport";
import authRouter from "./Routes/AuthRoutes";

const app = express();
app.use(cors);

app.use("/api/auth", authRouter);

app.get("/", (req, res) => {
  res.send("Server is Live");
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
