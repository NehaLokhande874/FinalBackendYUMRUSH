import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const migrate = async () => {
    try {
        if (!process.env.MONGODB_URL) {
            console.error("MONGODB_URL not found in .env");
            process.exit(1);
        }
        await mongoose.connect(process.env.MONGODB_URL);
        console.log("DB connected...");

        // Use native collection to force rename
        const db = mongoose.connection.db;
        const result = await db.collection('shops').updateMany(
            {}, 
            { $rename: { "name": "shopName" } }
        );

        console.log(`Forced Migration successful! Updated ${result.modifiedCount} shops.`);
        process.exit(0);
    } catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    }
};

migrate();
