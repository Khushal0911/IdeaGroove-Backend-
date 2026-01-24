import express from "express";
import {
  userLogin,
  userLogout,
  userRegister,
  forgotPassword,
  resetPassword,
} from "../controllers/AuthController.js";
const authRouter = express.Router();
import { upload } from "../config/cloud.js";

authRouter.post("/login", userLogin);
authRouter.post("/signup", upload.single("image"), userRegister);
authRouter.post("/logout", userLogout);
authRouter.post("/forgot-password", forgotPassword);
authRouter.post("/resetPassword/:id/:token", resetPassword);

export default authRouter;
