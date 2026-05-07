import Shop from "../models/shop.model.js";
import User from "../models/user.model.js";
import uploadOnCloudinary from "../utils/cloudinary.js";

export const createEditShop = async (req, res) => {
  try {
    const { name, city, state, address } = req.body
    let shop = await Shop.findOne({ owner: req.userId })
    let image;
    if (req.file) {
      image = await uploadOnCloudinary(req.file.path)
    }
    if (!shop) {
      if (!image) {
        return res.status(400).json({ message: "Shop image is required!" })
      }
      shop = await Shop.create({
        name, city, state, address, image, owner: req.userId
      })
    } else {
      shop = await Shop.findByIdAndUpdate(
        shop._id,
        { name, city, state, address, image: image || shop.image },
        { new: true }
      )
    }
    await shop.populate("owner items")
    return res.status(201).json(shop)
  } catch (error) {
    return res.status(500).json({ message: `create shop error ${error}` })
  }
}

export const getMyShop = async (req, res) => {
  try {
    const shop = await Shop.findOne({ owner: req.userId }).populate("owner").populate({
      path: "items",
      options: { sort: { updatedAt: -1 } }
    })
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" })
    }
    return res.status(200).json(shop)
  } catch (error) {
    return res.status(500).json({ message: `get my shop error ${error}` })
  }
}

export const getShopByCity = async (req, res) => {
  try {
    const { city } = req.params
    const shops = await Shop.find({
      city: { $regex: new RegExp(`^${city}$`, "i") }
    }).populate('items')
    if (!shops || shops.length === 0) {
      return res.status(200).json([])
    }
    return res.status(200).json(shops)
  } catch (error) {
    return res.status(500).json({ message: `get shop by city error ${error}` })
  }
}

export const registerShop = async (req, res) => {
  try {
    const { name, city, state, address } = req.body
    let image
    if (req.file) {
      image = await uploadOnCloudinary(req.file.path)
    }
    if (!image) {
      return res.status(400).json({ message: "Shop image is required!" })
    }
    const existingShop = await Shop.findOne({ owner: req.userId })
    if (existingShop) {
      return res.status(400).json({ message: "Shop already exists for this owner" })
    }
    const shop = await Shop.create({
      name, city, state, address, image, owner: req.userId
    })
    const user = await User.findById(req.userId)
    if (user && user.role !== "owner") {
      user.role = "owner"
      await user.save()
    }
    await shop.populate("owner items")
    return res.status(201).json(shop)
  } catch (error) {
    return res.status(500).json({ message: `register shop error ${error}` })
  }
}

export const getAllShops = async (req, res) => {
  try {
    const shops = await Shop.find().populate('items')
    return res.status(200).json(shops)
  } catch (error) {
    return res.status(500).json({ message: `get all shops error ${error}` })
  }
}
