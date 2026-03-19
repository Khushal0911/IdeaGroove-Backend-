import express from "express";
import {
  adminLogin,
  adminLogout,
  blockContent,
  blockStudent,
  getComplaintsReport,
  getDashboardStats,
  getEventsReport,
  getGroupsReport,
  getNotes,
  getNotesReport,
  getQnAReport,
  getRecentActivity,
  getTopContributor,
  getUsersReport,
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

adminRouter.post("/users-report", getUsersReport);
adminRouter.post("/events-report", getEventsReport);
adminRouter.post("/groups-report", getGroupsReport);
adminRouter.post("/notes-report", getNotesReport);
adminRouter.post("/qna-report", getQnAReport);
adminRouter.post("/complaints-report", getComplaintsReport);

adminRouter.post("/block-student", blockStudent);
adminRouter.post("/unblock-student", unblockStudent);
export default adminRouter;
