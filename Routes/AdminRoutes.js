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

adminRouter.get("/users-report", getUsersReport);
adminRouter.get("/events-report", getEventsReport);
adminRouter.get("/groups-report", getGroupsReport);
adminRouter.get("/notes-report", getNotesReport);
adminRouter.get("/qna-report", getQnAReport);
adminRouter.get("/complaints-report", getComplaintsReport);

adminRouter.post("/block-student", blockStudent);
adminRouter.post("/unblock-student", unblockStudent);
export default adminRouter;
