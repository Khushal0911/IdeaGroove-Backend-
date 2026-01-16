import express from "express";
import {
  userLogin,
  userLogout,
  userRegister,
} from "../controllers/AuthController.js";
const authRouter = express.Router();
const {upload} = require('../config/cloud.js');

authRouter.post("/login", userLogin);
authRouter.post("/signup",upload.single('image'), userRegister);
authRouter.post("/logout", userLogout);

export default authRouter;
