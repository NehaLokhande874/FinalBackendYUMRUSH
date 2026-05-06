import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

export const verifyAdmin = async (req, res, next) => {
    try {
        const token = req.cookies.token || req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res.status(401).json({ success: false, message: "Authentication token missing" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const user = await User.findById(decoded.userId || decoded.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (user.role !== "admin") {
            return res.status(403).json({ success: false, message: "Access denied. Admin resources only." });
        }

        req.user = user;
        req.userId = user._id;
        next();
    } catch (error) {
        console.error("verifyAdmin middleware error:", error);
        return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }
};

const isAdmin = verifyAdmin;
export default isAdmin;
