import express from "express";
import {
  adminLogin,
  adminLogout,
  blockContent,
  blockStudent,
  getAtRiskStudents,
  getComplaintsReport,
  getContentBlockIndex,
  getDashboardStats,
  getInactiveStudents,
  getMostComplainedStudents,
  getNotes,
  getPlatformHealthScore,
  getRecentActivity,
  getTopContributor,
  toggleBlock,
  unblockContent,
  unblockStudent,
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

adminRouter.get("/platform-health-score", getPlatformHealthScore);
adminRouter.get("/at-risk-students", getAtRiskStudents); // ?days=30
adminRouter.get("/inactive-students", getInactiveStudents); // ?days=60
adminRouter.get("/most-complained-students", getMostComplainedStudents);
adminRouter.get("/content-block-index", getContentBlockIndex);
adminRouter.get("/complaints-report", getComplaintsReport);

adminRouter.post("/block-student", blockStudent);
adminRouter.post("/unblock-student", unblockStudent);
export default adminRouter;
