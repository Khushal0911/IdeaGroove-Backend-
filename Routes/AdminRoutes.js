import express from "express";
import {
  adminLogin,
  adminLogout,
  getDashboardStats,
  getTopContributor,
} from "../Controllers/AdminController.js";
const adminRouter = express.Router();

adminRouter.post("/login", adminLogin);
adminRouter.post("/logout", adminLogout);
adminRouter.get("/dashboard-stats", getDashboardStats);
adminRouter.get("/top-contributor", getTopContributor);
export default adminRouter;
