import express from "express";
import {
  userLogin,
  userLogout,
  userRegister,
  forgotPassword,
  resetPassword,
  sendOtp,
  verifyOtp,
  changePassword,
} from "../controllers/AuthController.js";
const authRouter = express.Router();
import { upload } from "../config/cloud.js";
import { updateComplaintStatus } from "../Controllers/AdminController.js";

authRouter.post("/login", userLogin);
authRouter.post("/signup", upload.single("image"), userRegister);
authRouter.post("/logout", userLogout);
authRouter.post("/forgot-password", forgotPassword);
authRouter.post("/resetPassword/:id/:token", resetPassword);
authRouter.post("/changePassword",changePassword);
authRouter.post("/sendOTP", sendOtp);
authRouter.post("/verifyOTP", verifyOtp);
authRouter.post("/updateComplaintStatus", updateComplaintStatus);

export default authRouter;