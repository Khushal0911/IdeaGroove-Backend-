import express from "express";
import {
  adminLogin,
  adminLogout,
  blockContent,
  getDashboardStats,
  getNotes,
  getRecentActivity,
  getTopContributor,
  toggleBlock,
  unblockContent,
} from "../Controllers/AdminController.js";
const adminRouter = express.Router();

adminRouter.post("/login", adminLogin);
adminRouter.post("/logout", adminLogout);
adminRouter.get("/dashboard-stats", getDashboardStats);
adminRouter.get("/top-contributor", getTopContributor);
adminRouter.get("/recent-activity", getRecentActivity);
adminRouter.get("/notes", getNotes);

adminRouter.post("/block", blockContent);
adminRouter.post("/unblock", unblockContent);
adminRouter.post("/toggle-block", toggleBlock);
export default adminRouter;
