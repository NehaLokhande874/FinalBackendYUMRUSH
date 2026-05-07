import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const shopSchema = new mongoose.Schema({}, { strict: false })
const Shop = mongoose.model("Shop", shopSchema)

await mongoose.connect(process.env.MONGODB_URL)
console.log("DB connected")

const result = await Shop.updateMany(
  { shopName: { $exists: true } },
  [{ $set: { name: "$shopName" } }, { $unset: "shopName" }]
)

console.log("Updated shops:", result.modifiedCount)
await mongoose.disconnect()
