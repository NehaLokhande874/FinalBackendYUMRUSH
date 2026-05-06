import express from "express";
import isAuth from "../middlewares/isAuth.js";
import { verifyAdmin } from "../middlewares/admin.middleware.js";
import { createComplaint, getMyComplaints, getAllComplaints, resolveComplaint } from "../controllers/complaint.controllers.js";

const complaintRouter = express.Router();

complaintRouter.post("/create", isAuth, createComplaint);
complaintRouter.get("/my-complaints", isAuth, getMyComplaints);

// Admin routes
complaintRouter.get("/all", verifyAdmin, getAllComplaints);
complaintRouter.put("/resolve/:id", verifyAdmin, resolveComplaint);

export default complaintRouter;