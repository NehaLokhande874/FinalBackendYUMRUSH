import express from "express"
import isAuth from "../middlewares/isAuth.js"
import { addItem, deleteItem, editItem, updateItem, getItemByCity, getItemById, getItemsByShop, rating, searchItems, getAllItems, generateMealPlan } from "../controllers/item.controllers.js"
import { upload } from "../middlewares/multer.js"

const itemRouter = express.Router()

itemRouter.post("/add-item", isAuth, upload.single("image"), addItem)
itemRouter.post("/edit-item/:itemId", isAuth, upload.single("image"), editItem)
itemRouter.post("/update-item/:itemId", isAuth, upload.single("image"), updateItem)
itemRouter.get("/get-by-id/:itemId", isAuth, getItemById)
itemRouter.get("/delete/:itemId", isAuth, deleteItem)
itemRouter.get("/get-by-city/:city", isAuth, getItemByCity)
itemRouter.get("/get-all-items", getAllItems)  // ✅ new route added
itemRouter.get("/get-by-shop/:shopId", isAuth, getItemsByShop)
itemRouter.get("/search-items", isAuth, searchItems)
itemRouter.post("/rating", isAuth, rating)
itemRouter.post("/ai-meal-plan", isAuth, generateMealPlan)

export default itemRouter