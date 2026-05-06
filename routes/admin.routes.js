import express from "express";
import { verifyAdmin } from "../middleware/admin.middleware.js";
import {
    getStats,
    getAllUsers,
    getAllShops,
    getAllOrders,
    banUser,
    deleteUser,
    approveShop,
    adminLogin
} from "../controllers/admin.controller.js";

const router = express.Router();

router.post("/login", adminLogin);
router.get("/stats", verifyAdmin, getStats);
router.get("/users", verifyAdmin, getAllUsers);
router.get("/shops", verifyAdmin, getAllShops);
router.get("/orders", verifyAdmin, getAllOrders);
router.put("/user/ban/:id", verifyAdmin, banUser);
router.delete("/user/:id", verifyAdmin, deleteUser);
router.put("/shop/approve/:id", verifyAdmin, approveShop);

export default router;
