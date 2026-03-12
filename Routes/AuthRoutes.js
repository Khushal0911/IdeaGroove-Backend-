import express from "express";
import {
  userLogin,
  userLogout,
  getCurrentSession,
  userRegister,
  forgotPassword,
  resetPassword,
  sendOtp,
  verifyOtp,
  changePassword,
  checkAvailability,
} from "../controllers/AuthController.js";
const authRouter = express.Router();
import { uploadProfilePic } from "../config/cloud.js";
import { updateComplaintStatus } from "../Controllers/AdminController.js";

authRouter.post("/login", userLogin);
authRouter.get("/session", getCurrentSession);
authRouter.post("/signup", uploadProfilePic.single("image"), userRegister);
authRouter.post("/logout", userLogout);
authRouter.post("/forgot-password", forgotPassword);
authRouter.post("/resetPassword/:id/:token", resetPassword);
authRouter.post("/changePassword", changePassword);
authRouter.post("/sendOTP", sendOtp);
authRouter.post("/verifyOTP", verifyOtp);
authRouter.post("/updateComplaintStatus", updateComplaintStatus);
authRouter.get("/check-availability", checkAvailability);

export default authRouter;
