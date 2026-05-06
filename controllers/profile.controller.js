import User from "../models/user.model.js"
import bcrypt from "bcryptjs"
import { v2 as cloudinary } from "cloudinary"

export const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select("-password")
        if (!user) return res.status(404).json({ success: false, message: "User not found" })
        let extraStats = {}
        if (user.role === "owner") {
            const Shop = (await import("../models/shop.model.js")).default
            const shop = await Shop.findOne({ owner: req.userId }).select("name city")
            extraStats.shop = shop
        }
        res.status(200).json({ success: true, user, ...extraStats })
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error" })
    }
}

export const updateProfile = async (req, res) => {
    try {
        const { fullName, mobile } = req.body
        const updateData = {}
        if (fullName) updateData.fullName = fullName
        if (mobile) updateData.mobile = mobile
        if (req.file) {
            const base64 = req.file.buffer.toString("base64")
            const dataUri = "data:" + req.file.mimetype + ";base64," + base64
            const result = await cloudinary.uploader.upload(dataUri, { folder: "yumrush/profiles" })
            updateData.profileImage = result.secure_url
        }
        const updatedUser = await User.findByIdAndUpdate(req.userId, { $set: updateData }, { new: true }).select("-password")
        res.status(200).json({ success: true, message: "Profile updated successfully", user: updatedUser })
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error" })
    }
}

export const changePassword = async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body
        const user = await User.findById(req.userId)
        if (!user) return res.status(404).json({ success: false, message: "User not found" })
        const isMatch = await bcrypt.compare(oldPassword, user.password)
        if (!isMatch) return res.status(400).json({ success: false, message: "Old password is incorrect" })
        if (newPassword.length < 6) return res.status(400).json({ success: false, message: "Password must be at least 6 characters" })
        user.password = await bcrypt.hash(newPassword, 10)
        await user.save()
        res.status(200).json({ success: true, message: "Password changed successfully" })
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error" })
    }
}
