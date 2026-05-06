import User from "../models/user.model.js";
import Shop from "../models/shop.model.js";
import Order from "../models/order.model.js";
import bcrypt from "bcryptjs";
import uploadOnCloudinary from "../utils/cloudinary.js";

export const getCurrentUser = async (req, res) => {
    try {
        const userId = req.userId
        if (!userId) return res.status(400).json({ message: "userId is not found" })
        const user = await User.findById(userId)
        if (!user) return res.status(400).json({ message: "user is not found" })
        return res.status(200).json(user)
    } catch (error) {
        return res.status(500).json({ message: `get current user error ${error}` })
    }
}

export const updateUserLocation = async (req, res) => {
    try {
        const { lat, lon } = req.body
        const user = await User.findByIdAndUpdate(req.userId, {
            location: { type: 'Point', coordinates: [lon, lat] }
        }, { new: true })
        if (!user) return res.status(400).json({ message: "user is not found" })
        return res.status(200).json({ message: 'location updated' })
    } catch (error) {
        return res.status(500).json({ message: `update location user error ${error}` })
    }
}

export const getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select("-password -resetOtp -isOtpVerified -otpExpires");
        if (!user) return res.status(404).json({ message: "User not found" });

        let extraData = {};
        if (user.role === "owner") {
            const shop = await Shop.findOne({ owner: user._id });
            if (shop) { extraData.shopName = shop.name; extraData.shopCity = shop.city; }
        } else if (user.role === "deliveryBoy") {
            const orders = await Order.find({ "shopOrders.assignedDeliveryBoy": user._id, "shopOrders.status": "delivered" });
            extraData.totalDeliveries = orders.length;
            let earnings = 0;
            orders.forEach(o => { earnings += (o.deliveryFee || 20); });
            extraData.totalEarnings = earnings;
        }
        return res.status(200).json({ success: true, user: { ...user.toObject(), ...extraData } });
    } catch (error) {
        res.status(500).json({ message: `getUserProfile error: ${error.message}` });
    }
};

export const updateProfile = async (req, res) => {
    try {
        const { fullName, mobile } = req.body;
        let updateData = { fullName, mobile };
        if (req.file) {
            const uploadedUrl = await uploadOnCloudinary(req.file.path);
            if (uploadedUrl) updateData.profileImage = uploadedUrl;
        }
        const user = await User.findByIdAndUpdate(req.userId, updateData, { new: true }).select("-password");
        res.status(200).json({ success: true, user, message: "Profile updated successfully" });
    } catch (error) {
        res.status(500).json({ message: `updateProfile error: ${error.message}` });
    }
};

export const changePassword = async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ message: "User not found" });
        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) return res.status(400).json({ message: "Incorrect old password" });
        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();
        res.status(200).json({ success: true, message: "Password changed successfully" });
    } catch (error) {
        res.status(500).json({ message: `changePassword error: ${error.message}` });
    }
};

export const toggleFavourite = async (req, res) => {
    try {
        const { itemId } = req.params
        const user = await User.findById(req.userId)
        if (!user) return res.status(404).json({ message: "User not found" })
        const index = user.favourites.findIndex(id => id.toString() === itemId)
        if (index === -1) {
            user.favourites.push(itemId)
        } else {
            user.favourites.splice(index, 1)
        }
        await user.save()
        return res.status(200).json({ success: true, favourites: user.favourites })
    } catch (error) {
        return res.status(500).json({ message: `toggleFavourite error ${error}` })
    }
}

export const getFavourites = async (req, res) => {
    try {
        const user = await User.findById(req.userId).populate("favourites")
        if (!user) return res.status(404).json({ message: "User not found" })
        return res.status(200).json({ success: true, favourites: user.favourites })
    } catch (error) {
        return res.status(500).json({ message: `getFavourites error ${error}` })
    }
}
