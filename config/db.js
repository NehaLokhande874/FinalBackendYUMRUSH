import mongoose from "mongoose"

const connectDb = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URL)
        console.log("db connected")
        return true
    } catch (error) {
        console.error("db error:", error.message || error)
        // do not crash server - return false and allow startup
        return false
    }
}

export default connectDb