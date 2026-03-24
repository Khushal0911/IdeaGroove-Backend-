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
import { updateComplaintStatus } from "../controllers/AdminController.js";

authRouter.post("/login", userLogin);
authRouter.get("/session", getCurrentSession);
authRouter.post(
  "/signup",
  uploadProfilePic.fields([
    { name: "profile_pic", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  userRegister,
);
authRouter.post("/logout", userLogout);
authRouter.post("/forgot-password", forgotPassword);
authRouter.post("/resetPassword/:id/:token", resetPassword);
authRouter.post("/changePassword", changePassword);
authRouter.post("/sendOTP", sendOtp);
authRouter.post("/verifyOTP", verifyOtp);
authRouter.post("/updateComplaintStatus", updateComplaintStatus);
authRouter.get("/check-availability", checkAvailability);

export default authRouter;
