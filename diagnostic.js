import mongoose from "mongoose";
import dotenv from "dotenv";
import Order from "./models/order.model.js";
import Shop from "./models/shop.model.js";

dotenv.config();

const diagnose = async () => {
    try {
        if (!process.env.MONGODB_URL) {
            console.error("MONGODB_URL not found in .env");
            process.exit(1);
        }
        await mongoose.connect(process.env.MONGODB_URL);
        console.log("DB connected for diagnosis...");

        const shopCount = await Shop.countDocuments();
        console.log(`Total Shops: ${shopCount}`);

        const sampleShop = await Shop.findOne();
        console.log("Sample Shop Data:", sampleShop);

        const orderCount = await Order.countDocuments();
        console.log(`Total Orders: ${orderCount}`);

        const sampleOrder = await Order.findOne().populate("shopOrders.shop");
        console.log("Sample Order with populated shop:", JSON.stringify(sampleOrder?.shopOrders?.[0]?.shop, null, 2));

        process.exit(0);
    } catch (error) {
        console.error("Diagnosis failed:", error);
        process.exit(1);
    }
};

diagnose();
