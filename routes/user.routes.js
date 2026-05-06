import express from "express"
import { getCurrentUser, updateUserLocation, getUserProfile, updateProfile, changePassword, toggleFavourite, getFavourites } from "../controllers/user.controllers.js"
import isAuth from "../middlewares/isAuth.js"
import { upload } from "../middlewares/multer.js"

const userRouter = express.Router()

userRouter.get("/current", isAuth, getCurrentUser)
userRouter.post('/update-location', isAuth, updateUserLocation)
userRouter.get('/profile', isAuth, getUserProfile)
userRouter.put('/profile', isAuth, upload.single('profileImage'), updateProfile)
userRouter.put('/change-password', isAuth, changePassword)
userRouter.post('/favourite/:itemId', isAuth, toggleFavourite)
userRouter.get('/favourites', isAuth, getFavourites)

export default userRouter
