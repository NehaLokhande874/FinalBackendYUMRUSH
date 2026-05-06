import mongoose from "mongoose";

const offerSchema = new mongoose.Schema({
  code: { 
    type: String, 
    required: true, 
    unique: true, 
    uppercase: true,
    trim: true 
  },
  description: { 
    type: String, 
    required: true 
  },
  discountType: { 
    type: String, 
    enum: ["percentage", "flat"], 
    required: true 
  },
  discountValue: { 
    type: Number, 
    required: true 
  },
  minOrderAmount: { 
    type: Number, 
    default: 0 
  },
  maxDiscount: { 
    type: Number, 
    default: null 
  },
  totalUsageLimit: { 
    type: Number, 
    default: null 
  },
  usedCount: { 
    type: Number, 
    default: 0 
  },
  isFirstOrderOnly: { 
    type: Boolean, 
    default: false 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  expiryDate: { 
    type: Date, 
    required: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
}, { timestamps: true });

const Offer = mongoose.model("Offer", offerSchema);
export default Offer;
