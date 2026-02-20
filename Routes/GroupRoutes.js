import express from "express";
import { addGroup, deleteGroup, getGroups, getUserGroups, joinGroup, leaveGroup, updateGroup } from "../controllers/GroupController.js";

const groupRouter = express.Router();

groupRouter.post("/create",addGroup);//working
groupRouter.post("/joinGroup",joinGroup); //working
groupRouter.post("/leaveGroup",leaveGroup); //working
groupRouter.post("/update",updateGroup);//working
groupRouter.get("/delete/:Room_ID",deleteGroup);
groupRouter.get("/user/:id", getUserGroups);
groupRouter.get("/",getGroups);
export default groupRouter;