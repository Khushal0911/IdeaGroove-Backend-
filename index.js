import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import passport from "passport";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

app.get("/", (req, res) => {
  res.send("Server is Live");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
