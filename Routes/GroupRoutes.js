import express from "express";
import { addGroup, deleteGroup, getGroups, getUserGroups, joinGroup, leaveGroup, updateGroup, viewMembers } from "../controllers/GroupController.js";

const groupRouter = express.Router();

groupRouter.get("/", getGroups);

groupRouter.get("/user/:id", getUserGroups);
groupRouter.post("/create",addGroup);//working
groupRouter.post("/joinGroup",joinGroup); //working
groupRouter.post("/leaveGroup",leaveGroup); //working
groupRouter.post("/update",updateGroup);//working
groupRouter.get("/delete/:Room_ID",deleteGroup);//working
groupRouter.get("/viewMembers/:Room_ID",viewMembers);
export default groupRouter;