import Rating from "../models/rating.model.js";
import Order from "../models/order.model.js";
import Item from "../models/item.model.js";

export const submitRating = async (req, res) => {
    try {
        const { itemId, orderId, rating } = req.body;
        const userId = req.userId;

        if (!itemId || !orderId || !rating) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        // 1. Check order ownership and delivery status
        const order = await Order.findById(orderId);
        if (!order || String(order.user) !== String(userId)) {
            return res.status(403).json({ message: "Invalid order or access denied" });
        }

        // 2. Find the shopOrder containing this item and check its status
        const shopOrder = order.shopOrders.find(so => 
            so.shopOrderItems.some(item => String(item.item) === String(itemId))
        );

        if (!shopOrder) {
            return res.status(400).json({ message: "Item not found in this order" });
        }

        if (shopOrder.status !== "delivered") {
            return res.status(400).json({ message: "Item can only be rated after delivery" });
        }

        // 3. Save the rating (Unique index will prevent duplicates)
        await Rating.create({ userId, itemId, orderId, rating });

        // 4. Update the aggregate rating in the Item model for fast display
        const ratings = await Rating.find({ itemId });
        const total = ratings.reduce((sum, r) => sum + r.rating, 0);
        const average = Number((total / ratings.length).toFixed(1));
        const count = ratings.length;

        await Item.findByIdAndUpdate(itemId, { 
            rating: { average, count } 
        });

        return res.status(201).json({ success: true, message: "Rating submitted successfully" });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: "You have already rated this item for this order" });
        }
        console.error("submitRating error:", error);
        res.status(500).json({ message: "Error submitting rating" });
    }
};

export const getItemRating = async (req, res) => {
    try {
        const { itemId } = req.params;
        
        // Fetch from Item model directly since we are keeping it updated
        const item = await Item.findById(itemId).select("rating");
        
        if (!item) {
            return res.status(404).json({ message: "Item not found" });
        }

        return res.status(200).json(item.rating || { average: 0, count: 0 });
    } catch (error) {
        console.error("getItemRating error:", error);
        res.status(500).json({ message: "Error fetching item rating" });
    }
};
