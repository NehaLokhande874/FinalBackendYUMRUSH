import express from "express";
import { 
  createOffer, 
  getAllOffers, 
  getActiveOffers, 
  toggleOffer, 
  deleteOffer, 
  validateCoupon 
} from "../controllers/offer.controller.js";
import isAuth from "../middlewares/isAuth.js";
import { verifyAdmin } from "../middlewares/admin.middleware.js";

const router = express.Router();

router.post("/create", verifyAdmin, createOffer);
router.get("/all", verifyAdmin, getAllOffers);
router.get("/active", getActiveOffers);
router.put("/toggle/:id", verifyAdmin, toggleOffer);
router.delete("/delete/:id", verifyAdmin, deleteOffer);
router.post("/validate", isAuth, validateCoupon);

export default router;
