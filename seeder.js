import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User from "./models/user.model.js";

dotenv.config();

const seedAdmin = async () => {
    try {
        console.log("Connecting to Database...");
        await mongoose.connect(process.env.MONGODB_URL);
        
        console.log("Connected. Checking for existing admin...");
        const existingAdmin = await User.findOne({ email: "admin@yumrush.com" });
        if (existingAdmin) {
            console.log("Admin user already exists! ('admin@yumrush.com')");
            process.exit(0);
        }

        console.log("Creating new admin user...");
        const hashedPassword = await bcrypt.hash("admin123", 10);
        
        const adminUser = new User({
            fullName: "System Admin",
            email: "admin@yumrush.com",
            password: hashedPassword,
            mobile: "0000000000",
            role: "admin"
        });

        await adminUser.save();
        console.log("Admin seeded successfully!");
        console.log("Email: admin@yumrush.com | Password: admin123");
        process.exit(0);
    } catch (error) {
        console.error("Error seeding admin:", error);
        process.exit(1);
    }
};

seedAdmin();
