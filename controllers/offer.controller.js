import Offer from "../models/offer.model.js";
import Order from "../models/order.model.js";

export const createOffer = async (req, res) => {
  try {
    const offer = await Offer.create(req.body);
    res.status(201).json(offer);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getAllOffers = async (req, res) => {
  try {
    const offers = await Offer.find().sort({ createdAt: -1 });
    res.status(200).json(offers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getActiveOffers = async (req, res) => {
  try {
    const offers = await Offer.find({ 
      isActive: true, 
      expiryDate: { $gt: new Date() } 
    }).select("-totalUsageLimit -usedCount -createdAt -updatedAt -__v").sort({ createdAt: -1 });
    res.status(200).json(offers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const toggleOffer = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) return res.status(404).json({ message: "Offer not found" });
    offer.isActive = !offer.isActive;
    await offer.save();
    res.status(200).json(offer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteOffer = async (req, res) => {
  try {
    await Offer.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Offer deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const validateCoupon = async (req, res) => {
  try {
    const { code, orderAmount } = req.body;
    if (!code) return res.status(400).json({ message: "Coupon code is required" });

    const offer = await Offer.findOne({ code: code.toUpperCase() });

    if (!offer || !offer.isActive) {
      return res.status(200).json({ valid: false, message: "Invalid or inactive coupon" });
    }

    if (new Date(offer.expiryDate) < new Date()) {
      return res.status(200).json({ valid: false, message: "Coupon expired" });
    }

    if (orderAmount < offer.minOrderAmount) {
      return res.status(200).json({ valid: false, message: `Minimum order amount ₹${offer.minOrderAmount} required` });
    }

    if (offer.totalUsageLimit && offer.usedCount >= offer.totalUsageLimit) {
      return res.status(200).json({ valid: false, message: "Coupon usage limit reached" });
    }

    if (offer.isFirstOrderOnly) {
      const orderCount = await Order.countDocuments({ user: req.userId });
      if (orderCount > 0) {
        return res.status(200).json({ valid: false, message: "Coupon only valid for first order" });
      }
    }

    let discount = 0;
    if (offer.discountType === "percentage") {
      discount = (offer.discountValue / 100) * orderAmount;
      if (offer.maxDiscount) discount = Math.min(discount, offer.maxDiscount);
    } else {
      discount = offer.discountValue;
    }

    // Ensure discount doesn't exceed order amount
    discount = Math.min(discount, orderAmount);

    res.status(200).json({
      valid: true,
      code: offer.code,
      discount: Math.round(discount),
      finalAmount: Math.round(orderAmount - discount),
      message: `You saved ₹${Math.round(discount)}!`
    });
  } catch (error) {
    console.error("validateCoupon error:", error);
    res.status(500).json({ message: "Error validating coupon" });
  }
};
