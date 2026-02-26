import express from "express";
import { addComplaint, deleteComplaint, getAllComplaints, getUserComplaints } from "../controllers/ComplaintController.js";

const complaintRouter = express.Router();

complaintRouter.get("/",getAllComplaints);
complaintRouter.get("/user/:id",getUserComplaints);
complaintRouter.post("/create",addComplaint);
complaintRouter.delete("/delete/:id",deleteComplaint);

export default complaintRouter;
