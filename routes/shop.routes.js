import express from "express"
import { createEditShop, getMyShop, getShopByCity, registerShop, getAllShops } from "../controllers/shop.controllers.js"
import isAuth from "../middlewares/isAuth.js"
import { upload } from "../middlewares/multer.js"

const shopRouter = express.Router()

shopRouter.post("/register", isAuth, upload.single("image"), registerShop)
shopRouter.post("/create-edit", isAuth, upload.single("image"), createEditShop)
shopRouter.get("/get-my", isAuth, getMyShop)
shopRouter.get("/get-by-city/:city", getShopByCity)
shopRouter.get("/get-all", getAllShops)  // ✅ new

export default shopRouter