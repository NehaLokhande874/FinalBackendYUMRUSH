import express from "express"
import { getProfile, updateProfile, changePassword } from "../controllers/profile.controller.js"
import isAuth from "../middlewares/isAuth.js"
import multer from "multer"

const upload = multer({ storage: multer.memoryStorage() })
const router = express.Router()

router.get("/", isAuth, getProfile)
router.put("/", isAuth, upload.single("profileImage"), updateProfile)
router.put("/change-password", isAuth, changePassword)

export default router
