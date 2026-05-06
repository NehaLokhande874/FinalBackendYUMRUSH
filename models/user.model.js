import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
    },
    mobile: {
        type: String,
        required: true,
    },
    profileImage: {
        type: String,
        default: ""
    },
    role: {
        type: String,
        enum: ["user", "owner", "deliveryBoy", "admin"],
        required: true
    },
    resetOtp: {
        type: String
    },
    isOtpVerified: {
        type: Boolean,
        default: false
    },
    otpExpires: {
        type: Date
    },
    socketId: {
        type: String,
    },
    isOnline: {
        type: Boolean,
        default: false
    },
    favourites: [{ type: mongoose.Schema.Types.ObjectId, ref: "Item" }],
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] }
    }
}, { timestamps: true })

userSchema.index({ location: '2dsphere' })

const User = mongoose.model("User", userSchema)
export default User
