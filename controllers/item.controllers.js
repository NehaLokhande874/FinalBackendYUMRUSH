import Item from "../models/item.model.js";
import Shop from "../models/shop.model.js";
import uploadOnCloudinary from "../utils/cloudinary.js";
import Anthropic from '@anthropic-ai/sdk';

export const addItem = async (req, res) => {
    try {
        const { name, category, foodType, price } = req.body
        let image;
        if (req.file) {
            image = await uploadOnCloudinary(req.file.path)
        }
        const shop = await Shop.findOne({ owner: req.userId })
        if (!shop) {
            return res.status(400).json({ message: "shop not found" })
        }
        const item = await Item.create({
            name, category, foodType, price, image, shop: shop._id
        })

        shop.items.push(item._id)
        await shop.save()
        await shop.populate("owner")
        await shop.populate({
            path: "items",
            options: { sort: { updatedAt: -1 } }
        })
        return res.status(201).json(shop)

    } catch (error) {
        return res.status(500).json({ message: `add item error ${error}` })
    }
}

export const editItem = async (req, res) => {
    try {
        const itemId = req.params.itemId
        const { name, category, foodType, price } = req.body
        let image;
        if (req.file) {
            image = await uploadOnCloudinary(req.file.path)
        }

        // ✅ Keep old image if no new image uploaded
        const existingItem = await Item.findById(itemId)
        if (!existingItem) {
            return res.status(400).json({ message: "item not found" })
        }

        const item = await Item.findByIdAndUpdate(itemId, {
            name,
            category,
            foodType,
            price,
            image: image || existingItem.image  // ✅ keep old image
        }, { new: true })

        const shop = await Shop.findOne({ owner: req.userId }).populate({
            path: "items",
            options: { sort: { updatedAt: -1 } }
        })
        return res.status(200).json(shop)

    } catch (error) {
        return res.status(500).json({ message: `edit item error ${error}` })
    }
}

export const updateItem = async (req, res) => {
    return editItem(req, res)
}

export const getItemById = async (req, res) => {
    try {
        const itemId = req.params.itemId
        const item = await Item.findById(itemId)
        if (!item) {
            return res.status(400).json({ message: "item not found" })
        }
        return res.status(200).json(item)
    } catch (error) {
        return res.status(500).json({ message: `get item error ${error}` })
    }
}

export const deleteItem = async (req, res) => {
    try {
        const itemId = req.params.itemId
        const item = await Item.findByIdAndDelete(itemId)
        if (!item) {
            return res.status(400).json({ message: "item not found" })
        }
        const shop = await Shop.findOne({ owner: req.userId })
        // ✅ Fixed: use toString() for proper ObjectId comparison
        shop.items = shop.items.filter(i => i.toString() !== item._id.toString())
        await shop.save()
        await shop.populate({
            path: "items",
            options: { sort: { updatedAt: -1 } }
        })
        return res.status(200).json(shop)

    } catch (error) {
        return res.status(500).json({ message: `delete item error ${error}` })
    }
}

export const getItemByCity = async (req, res) => {
    try {
        const { city } = req.params
        if (!city) {
            return res.status(400).json({ message: "city is required" })
        }
        const shops = await Shop.find({
            city: { $regex: new RegExp(`^${city}$`, "i") }
        }).populate('items')

        if (!shops || shops.length === 0) {
            return res.status(400).json({ message: "shops not found" })
        }
        const shopIds = shops.map((shop) => shop._id)
        const items = await Item.find({ shop: { $in: shopIds } })
        return res.status(200).json(items)

    } catch (error) {
        return res.status(500).json({ message: `get item by city error ${error}` })
    }
}

export const getItemsByShop = async (req, res) => {
    try {
        const { shopId } = req.params
        const shop = await Shop.findById(shopId).populate("items")
        if (!shop) {
            return res.status(400).json({ message: "shop not found" })
        }
        return res.status(200).json({
            shop, items: shop.items
        })
    } catch (error) {
        return res.status(500).json({ message: `get item by shop error ${error}` })
    }
}

export const searchItems = async (req, res) => {
    try {
        const { query, city } = req.query
        if (!query) {
            return res.status(400).json({ message: "query is required" })
        }

        // Find shops by city, unless city is "All" or empty
        let shopQuery = {}
        if (city && city !== "All") {
            shopQuery.city = { $regex: new RegExp(`^${city}$`, "i") }
        }

        // If query matches a shop name, we should include all its items
        const matchingShopsByName = await Shop.find({ ...shopQuery, name: { $regex: query, $options: "i" } })
        const matchingShopIdsByName = matchingShopsByName.map(s => s._id)

        // Find all available shops in the target city to filter items
        const allAvailableShopsInCity = await Shop.find(shopQuery)
        const allAvailableShopIdsInCity = allAvailableShopsInCity.map(s => s._id)

        // Find items:
        // Case 1: item name or category matches query, AND it belongs to a shop in the target city
        // Case 2: shop name matches query AND it meets city filter (matchingShopIdsByName)
        const items = await Item.find({
            $or: [
                {
                    shop: { $in: allAvailableShopIdsInCity },
                    $or: [
                        { name: { $regex: query, $options: "i" } },
                        { category: { $regex: query, $options: "i" } }
                    ]
                },
                {
                    shop: { $in: matchingShopIdsByName }
                }
            ]
        }).populate("shop", "name image city")

        return res.status(200).json(items)

    } catch (error) {
        return res.status(500).json({ message: `search item error ${error}` })
    }
}

export const rating = async (req, res) => {
    try {
        const { itemId, rating } = req.body

        if (!itemId || !rating) {
            return res.status(400).json({ message: "itemId and rating is required" })
        }
        if (rating < 1 || rating > 5) {
            return res.status(400).json({ message: "rating must be between 1 to 5" })
        }

        const item = await Item.findById(itemId)
        if (!item) {
            return res.status(400).json({ message: "item not found" })
        }

        const newCount = item.rating.count + 1
        const newAverage = (item.rating.average * item.rating.count + rating) / newCount

        item.rating.count = newCount
        item.rating.average = newAverage
        await item.save()

        return res.status(200).json({ rating: item.rating })

    } catch (error) {
        return res.status(500).json({ message: `rating error ${error}` })
    }
}

// ✅ New - Get ALL items across all cities
export const getAllItems = async (req, res) => {
    try {
        const items = await Item.find().populate("shop", "name image city")
        return res.status(200).json(items)
    } catch (error) {
        return res.status(500).json({ message: `get all items error ${error}` })
    }
}

// ✅ AI Meal Planner Controller
export const generateMealPlan = async (req, res) => {
    try {
        const { budget, mood, diet, hunger, replaceItemId, currentComboIds, previousComboIds = [] } = req.body;

        if (!budget || !mood || !diet || !hunger) {
            return res.status(400).json({ message: "budget, mood, diet, and hunger are required" });
        }

        let query = {};
        if (diet === "Veg") {
            query.foodType = "veg";
        } else if (diet === "Non-Veg") {
            query.foodType = "non-veg";
        }

        let allItems = await Item.find(query).populate("shop", "name");

        if (replaceItemId && currentComboIds) {
            allItems = allItems.filter(item => item._id.toString() !== replaceItemId);
        }

        const availableItems = allItems.map(item => ({
            id: item._id,
            n: item.name,
            p: item.price,
            c: item.category,
            s: item.shop?.name,
            v: item.foodType === "veg" ? "V" : "NV",
            price: item.price // Add price for fallback logic
        }));

        // Limit the maximum number of items forwarded to avoid high token costs or limits
        const shuffled = availableItems.sort(() => 0.5 - Math.random());
        const selectedSlice = shuffled.slice(0, 100);

        const anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY || "DUMMY_KEY_TO_PREVENT_CRASH",
        });

        let selectedIds = [];

        try {
            const prompt = `You are an expert AI meal planner. Given the following available restaurant items, pick a combo of items that perfectly matches the user preferences.
Preferences:
- Budget: ${budget} (Total cost MUST be <= ${budget})
- Mood: ${mood}
- Diet: ${diet}
- Hunger Level: ${hunger}
${replaceItemId && currentComboIds ? `- Note: The user wants to replace item ID '${replaceItemId}' from their current combo: ${JSON.stringify(currentComboIds)}. Ensure the new combo still fits the budget and preferences.` : ""}
${previousComboIds.length > 0 ? `- IMPORTANT: Do NOT suggest any items from this list of previously shown items: ${JSON.stringify(previousComboIds)}` : ""}

Only use items from this list:
${JSON.stringify(selectedSlice)}

Requirements:
- Ensure the total price of the selected combo is strictly <= ${budget}.
- For "Light" hunger, suggest 1-2 items (e.g. snack + drink). For "Medium", suggest 2-3 items. For "Heavy", suggest 3-4 items.
- Output ONLY a valid JSON array of the selected item IDs. Example: ["id1", "id2"]. No explanation, no markdown blocks, just the raw JSON array.`;

            const response = await anthropic.messages.create({
                model: "claude-sonnet-4-20250514",
                max_tokens: 500,
                messages: [{ role: "user", content: prompt }]
            });

            let jsonStr = response.content[0].text.trim();
            if (jsonStr.startsWith("\`\`\`")) {
                jsonStr = jsonStr.replace(/\`\`\`json/g, "").replace(/\`\`\`/g, "").trim();
            }

            selectedIds = JSON.parse(jsonStr);

            if (!Array.isArray(selectedIds) || selectedIds.length === 0) {
                throw new Error("AI could not find a suitable combo.");
            }
        } catch (apiError) {
            console.log("Anthropic API Key failed or missing. Generating smart heuristic fallback combo natively...");
            
            // Build a fallback combo manually mathematically based on budget, diet, hunger
            let fallbackItems = [];
            let currentTotal = 0;
            const targetCount = hunger === "Light" ? 2 : hunger === "Medium" ? 3 : 4;
            
            // Filter out previously shown items for the fallback logic
            const filteredForFallback = availableItems.filter(item => !previousComboIds.includes(item.id.toString()));

            // Randomly shuffle filtered items so "Try Different Combo" gives different results
            const shuffledFallback = [...filteredForFallback].sort(() => 0.5 - Math.random());
            
            for (const item of shuffledFallback) {
                if (fallbackItems.length >= targetCount) break;
                if (currentTotal + item.price <= budget) {
                    fallbackItems.push(item);
                    currentTotal += item.price;
                }
            }
            
            // Fallback to absolute cheapest item available if budget is too strict
            if (fallbackItems.length === 0 && filteredForFallback.length > 0) {
                 const cheapest = [...filteredForFallback].sort((a,b) => a.price - b.price)[0];
                 if (cheapest.price <= budget) { // Ensure even the cheapest fits budget
                    fallbackItems.push(cheapest);
                 }
            }

            selectedIds = fallbackItems.map(i => i.id.toString());
        }

        const mealCombo = await Item.find({ _id: { $in: selectedIds } }).populate("shop", "name image city");
        return res.status(200).json(mealCombo);

    } catch (error) {
        console.error("AI Meal Plan Error:", error);
        return res.status(500).json({ message: "Failed to generate AI meal plan.", error: error.message });
    }
}
