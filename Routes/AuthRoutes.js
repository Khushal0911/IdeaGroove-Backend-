import express from "express";
import {
  userLogin,
  userLogout,
  userRegister,
} from "../controllers/AuthController.js";
const authRouter = express.Router();

authRouter.post("/login", userLogin);
authRouter.post("/signup", userRegister);
authRouter.post("/logout", userLogout);

export default authRouter;
