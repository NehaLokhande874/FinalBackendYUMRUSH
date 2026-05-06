import express from "express";
import { submitRating, getItemRating } from "../controllers/rating.controller.js";
import isAuth from "../middlewares/isAuth.js";

const router = express.Router();

router.post("/submit", isAuth, submitRating);
router.get("/item/:itemId", getItemRating);

export default router;
