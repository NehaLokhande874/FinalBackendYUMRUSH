import DeliveryAssignment from "../models/deliveryAssignment.model.js"
import Order from "../models/order.model.js"
import Shop from "../models/shop.model.js"
import User from "../models/user.model.js"
import Offer from "../models/offer.model.js"
import { sendDeliveryOtpMail } from "../utils/mail.js"
import RazorPay from "razorpay"
import dotenv from "dotenv"

dotenv.config()
let instance = new RazorPay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const emitOrderStatusUpdate = (io, payload) => {
    if (!io || !payload?.orderId) return
    io.to(`order-${payload.orderId}`).emit('order-status-update', payload)
    io.to(`order-${payload.orderId}`).emit('update-status', payload)
}

export const placeOrder = async (req, res) => {
    try {
        const { cartItems, paymentMethod, deliveryAddress, totalAmount, deliveryFee, orderNote, couponCode, discountAmount } = req.body

        if (!cartItems || cartItems.length === 0) {
            return res.status(400).json({ message: "cart is empty" })
        }
        if (!deliveryAddress?.text || !deliveryAddress?.latitude || !deliveryAddress?.longitude) {
            return res.status(400).json({ message: "send complete deliveryAddress" })
        }

        for (const item of cartItems) {
            if (!item.shop) {
                return res.status(400).json({ message: `Cart item "${item.name}" is missing a shop reference.` })
            }
            if (!item.id && !item._id) {
                return res.status(400).json({ message: `Cart item "${item.name}" is missing an item id.` })
            }
        }

        const groupItemsByShop = {}
        cartItems.forEach(item => {
            const shopId = item.shop
            if (!groupItemsByShop[shopId]) {
                groupItemsByShop[shopId] = []
            }
            groupItemsByShop[shopId].push(item)
        });

        const shopOrderResults = await Promise.all(
            Object.keys(groupItemsByShop).map(async (shopId) => {
                const shop = await Shop.findById(shopId).populate("owner")
                if (!shop) {
                    return { error: `Shop not found: ${shopId}` }
                }
                const items = groupItemsByShop[shopId]
                const subtotal = items.reduce((sum, i) => sum + Number(i.price) * Number(i.quantity), 0)
                return {
                    shop: shop._id,
                    owner: shop.owner._id,
                    subtotal,
                    shopOrderItems: items.map((i) => ({
                        item: i.id || i._id,
                        price: i.price,
                        quantity: i.quantity,
                        name: i.name
                    }))
                }
            })
        )

        const shopError = shopOrderResults.find(r => r?.error)
        if (shopError) {
            return res.status(400).json({ message: shopError.error })
        }

        const shopOrders = shopOrderResults

        if (couponCode) {
            await Offer.findOneAndUpdate({ code: couponCode.toUpperCase() }, { $inc: { usedCount: 1 } })
        }

        if (paymentMethod === "online") {
            const razorOrder = await instance.orders.create({
                amount: Math.round(totalAmount * 100),
                currency: 'INR',
                receipt: `receipt_${Date.now()}`
            })
            const newOrder = await Order.create({
                user: req.userId,
                paymentMethod,
                deliveryAddress,
                totalAmount,
                deliveryFee,
                orderNote,
                shopOrders,
                razorpayOrderId: razorOrder.id,
                payment: false,
                couponCode: couponCode || "",
                discountAmount: discountAmount || 0
            })
            return res.status(200).json({
                razorOrder,
                orderId: newOrder._id,
            })
        }

        const newOrder = await Order.create({
            user: req.userId,
            paymentMethod,
            deliveryAddress,
            totalAmount,
            deliveryFee,
            orderNote,
            shopOrders,
            couponCode: couponCode || "",
            discountAmount: discountAmount || 0
        })

        await newOrder.populate("shopOrders.shopOrderItems.item", "name image price")
        await newOrder.populate("shopOrders.shop", "name image city")
        await newOrder.populate("shopOrders.owner", "name socketId")
        await newOrder.populate("user", "name email mobile")
        const io = req.app.get('io')
        if (io) {
            newOrder.shopOrders.forEach(shopOrder => {
                const ownerSocketId = shopOrder.owner.socketId
                if (ownerSocketId) {
                    const ownerPayload = {
                        _id: newOrder._id,
                        paymentMethod: newOrder.paymentMethod,
                        user: newOrder.user,
                        shopOrders: shopOrder,
                        createdAt: newOrder.createdAt,
                        deliveryAddress: newOrder.deliveryAddress,
                        payment: newOrder.payment
                    }
                    io.to(ownerSocketId).emit('newOrder', ownerPayload)
                    io.to(ownerSocketId).emit('new-order', ownerPayload)
                }
            });
        }

        return res.status(201).json(newOrder)
    } catch (error) {
        console.error("placeOrder error:", error)
        return res.status(500).json({ message: `place order error: ${error.message}` })
    }
}

export const verifyPayment = async (req, res) => {
    try {
        const { razorpay_payment_id, orderId } = req.body
        const payment = await instance.payments.fetch(razorpay_payment_id)
        if (!payment || payment.status != "captured") {
            return res.status(400).json({ message: "payment not captured" })
        }
        const order = await Order.findById(orderId)
        if (!order) {
            return res.status(400).json({ message: "order not found" })
        }

        order.payment = true
        order.razorpayPaymentId = razorpay_payment_id
        await order.save()

        await order.populate("shopOrders.shopOrderItems.item", "name image price")
        await order.populate("shopOrders.shop", "name image city")
        await order.populate("shopOrders.owner", "name socketId")
        await order.populate("user", "name email mobile")

        const io = req.app.get('io')
        if (io) {
            order.shopOrders.forEach(shopOrder => {
                const ownerSocketId = shopOrder.owner.socketId
                if (ownerSocketId) {
                    const ownerPayload = {
                        _id: order._id,
                        paymentMethod: order.paymentMethod,
                        user: order.user,
                        shopOrders: shopOrder,
                        createdAt: order.createdAt,
                        deliveryAddress: order.deliveryAddress,
                        payment: order.payment
                    }
                    io.to(ownerSocketId).emit('newOrder', ownerPayload)
                    io.to(ownerSocketId).emit('new-order', ownerPayload)
                }
            });
        }

        return res.status(200).json(order)
    } catch (error) {
        return res.status(500).json({ message: `verify payment error ${error}` })
    }
}

export const getMyOrders = async (req, res) => {
    try {
        const user = await User.findById(req.userId)
        if (user.role == "user") {
            const orders = await Order.find({ user: req.userId })
                .sort({ createdAt: -1 })
                .populate("shopOrders.shop", "name image city")
                .populate("shopOrders.owner", "name email mobile")
                .populate("shopOrders.shopOrderItems.item", "name image price")
            return res.status(200).json(orders)
        } else if (user.role == "owner") {
            const orders = await Order.find({ "shopOrders.owner": req.userId })
                .sort({ createdAt: -1 })
                .populate("shopOrders.shop", "name image city")
                .populate("user")
                .populate("shopOrders.shopOrderItems.item", "name image price")
                .populate("shopOrders.assignedDeliveryBoy", "fullName mobile")

            const filteredOrders = orders.map((order => ({
                _id: order._id,
                paymentMethod: order.paymentMethod,
                user: order.user,
                shopOrders: order.shopOrders.find(o => String(o.owner) === String(req.userId)),
                createdAt: order.createdAt,
                deliveryAddress: order.deliveryAddress,
                payment: order.payment
            })))

            return res.status(200).json(filteredOrders)
        }
    } catch (error) {
        return res.status(500).json({ message: `get User order error ${error}` })
    }
}

export const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, shopId } = req.params
        const { status } = req.body
        const order = await Order.findById(orderId)

        const shopOrder = order.shopOrders.find(o => o.shop == shopId)
        if (!shopOrder) {
            return res.status(400).json({ message: "shop order not found" })
        }
        shopOrder.status = status
        let deliveryBoysPayload = []

        if (status == "out of delivery" && !shopOrder.assignment) {
            const { longitude, latitude } = order.deliveryAddress
            const nearByDeliveryBoys = await User.find({
                role: "deliveryBoy",
                location: {
                    $near: {
                        $geometry: { type: "Point", coordinates: [Number(longitude), Number(latitude)] },
                        $maxDistance: 5000
                    }
                }
            })

            const nearByIds = nearByDeliveryBoys.map(b => b._id)
            const busyIds = await DeliveryAssignment.find({
                assignedTo: { $in: nearByIds },
                status: { $nin: ["brodcasted", "completed"] }
            }).distinct("assignedTo")

            const busyIdSet = new Set(busyIds.map(id => String(id)))
            const availableBoys = nearByDeliveryBoys.filter(b => !busyIdSet.has(String(b._id)))
            const candidates = availableBoys.map(b => b._id)
            if (candidates.length == 0) {
                await order.save()
                return res.json({
                    message: "order status updated but there is no available delivery boys"
                })
            }

            const deliveryAssignment = await DeliveryAssignment.create({
                order: order?._id,
                shop: shopOrder.shop,
                shopOrderId: shopOrder?._id,
                brodcastedTo: candidates,
                status: "brodcasted"
            })

            shopOrder.assignedDeliveryBoy = deliveryAssignment.assignedTo
            shopOrder.assignment = deliveryAssignment._id
            deliveryBoysPayload = availableBoys.map(b => ({
                id: b._id,
                fullName: b.fullName,
                longitude: b.location.coordinates?.[0],
                latitude: b.location.coordinates?.[1],
                mobile: b.mobile
            }))

            await deliveryAssignment.populate('order')
            await deliveryAssignment.populate('shop')
            const io = req.app.get('io')
            if (io) {
                availableBoys.forEach(boy => {
                    const boySocketId = boy.socketId
                    if (boySocketId) {
                        io.to(boySocketId).emit('newAssignment', {
                            sentTo: boy._id,
                            assignmentId: deliveryAssignment._id,
                            orderId: deliveryAssignment.order._id,
                            name: deliveryAssignment.shop.name,
                            deliveryAddress: deliveryAssignment.order.deliveryAddress,
                            items: deliveryAssignment.order.shopOrders.find(so => so._id.equals(deliveryAssignment.shopOrderId)).shopOrderItems || [],
                            subtotal: deliveryAssignment.order.shopOrders.find(so => so._id.equals(deliveryAssignment.shopOrderId))?.subtotal
                        })
                    }
                });
            }
        }

        await order.save()
        const updatedShopOrder = order.shopOrders.find(o => o.shop == shopId)
        await order.populate("shopOrders.shop", "name image city")
        await order.populate("shopOrders.assignedDeliveryBoy", "fullName email mobile")
        await order.populate("user", "socketId")

        const io = req.app.get('io')
        emitOrderStatusUpdate(io, {
            orderId: String(order._id),
            shopId: String(updatedShopOrder.shop._id),
            status: updatedShopOrder.status,
            userId: String(order.user._id)
        })

        return res.status(200).json({
            shopOrder: updatedShopOrder,
            assignedDeliveryBoy: updatedShopOrder?.assignedDeliveryBoy,
            availableBoys: deliveryBoysPayload,
            assignment: updatedShopOrder?.assignment?._id
        })
    } catch (error) {
        return res.status(500).json({ message: `order status error ${error}` })
    }
}

export const getDeliveryBoyAssignment = async (req, res) => {
    try {
        const deliveryBoyId = req.userId
        const assignments = await DeliveryAssignment.find({
            brodcastedTo: deliveryBoyId,
            status: "brodcasted"
        })
            .populate("order")
            .populate("shop")

        const formated = assignments.map(a => ({
            assignmentId: a._id,
            orderId: a.order._id,
            name: a.shop.name,
            deliveryAddress: a.order.deliveryAddress,
            items: a.order.shopOrders.find(so => so._id.equals(a.shopOrderId)).shopOrderItems || [],
            subtotal: a.order.shopOrders.find(so => so._id.equals(a.shopOrderId))?.subtotal
        }))

        return res.status(200).json(formated)
    } catch (error) {
        return res.status(500).json({ message: `get Assignment error ${error}` })
    }
}

export const acceptOrder = async (req, res) => {
    try {
        const { assignmentId } = req.params
        const assignment = await DeliveryAssignment.findById(assignmentId)
        if (!assignment) {
            return res.status(400).json({ message: "assignment not found" })
        }
        if (assignment.status !== "brodcasted") {
            return res.status(400).json({ message: "assignment is expired" })
        }

        const alreadyAssigned = await DeliveryAssignment.findOne({
            assignedTo: req.userId,
            status: { $nin: ["brodcasted", "completed"] }
        })

        if (alreadyAssigned) {
            return res.status(400).json({ message: "You are already assigned to another order" })
        }

        assignment.assignedTo = req.userId
        assignment.status = 'assigned'
        assignment.acceptedAt = new Date()
        await assignment.save()

        const order = await Order.findById(assignment.order)
        if (!order) {
            return res.status(400).json({ message: "order not found" })
        }

        let shopOrder = order.shopOrders.id(assignment.shopOrderId)
        shopOrder.assignedDeliveryBoy = req.userId
        await order.save()

        const io = req.app.get("io")
        if (io) {
            await order.populate("user", "socketId")
            const deliveryBoy = await User.findById(req.userId).select("fullName mobile socketId")
            io.to(`order-${order._id}`).emit("delivery-boy-assigned", {
                orderId: String(order._id),
                deliveryBoy: {
                    _id: String(deliveryBoy?._id || req.userId),
                    fullName: deliveryBoy?.fullName || "Delivery Partner",
                    mobile: deliveryBoy?.mobile || ""
                }
            })

            const userSocketId = order?.user?.socketId
            if (userSocketId) {
                io.to(userSocketId).emit("delivery-boy-assigned", {
                    orderId: String(order._id),
                    deliveryBoy: {
                        _id: String(deliveryBoy?._id || req.userId),
                        fullName: deliveryBoy?.fullName || "Delivery Partner",
                        mobile: deliveryBoy?.mobile || ""
                    }
                })
            }
        }

        return res.status(200).json({ message: 'order accepted' })
    } catch (error) {
        return res.status(500).json({ message: `accept order error ${error}` })
    }
}

export const getCurrentOrder = async (req, res) => {
    try {
        const assignment = await DeliveryAssignment.findOne({
            assignedTo: req.userId,
            status: "assigned"
        })
            .populate("shop", "name location")
            .populate("assignedTo", "fullName email mobile location")
            .populate({
                path: "order",
                populate: [{ path: "user", select: "fullName email location mobile" }]
            })

        if (!assignment) {
            return res.status(400).json({ message: "assignment not found" })
        }
        if (!assignment.order) {
            return res.status(400).json({ message: "order not found" })
        }

        const shopOrder = assignment.order.shopOrders.find(
            so => String(so._id) == String(assignment.shopOrderId)
        )
        if (!shopOrder) {
            return res.status(400).json({ message: "shopOrder not found" })
        }

        let deliveryBoyLocation = { lat: null, lon: null }
        if (assignment.assignedTo?.location?.coordinates?.length == 2) {
            deliveryBoyLocation.lat = assignment.assignedTo.location.coordinates[1]
            deliveryBoyLocation.lon = assignment.assignedTo.location.coordinates[0]
        }

        let customerLocation = { lat: null, lon: null }
        if (assignment.order.deliveryAddress) {
            customerLocation.lat = assignment.order.deliveryAddress.latitude
            customerLocation.lon = assignment.order.deliveryAddress.longitude
        }

        let restaurantLocation = { lat: null, lon: null }
        if (assignment.shop?.location?.coordinates?.length == 2) {
            restaurantLocation.lat = assignment.shop.location.coordinates[1]
            restaurantLocation.lon = assignment.shop.location.coordinates[0]
        }

        return res.status(200).json({
            _id: assignment.order._id,
            user: assignment.order.user,
            shopOrder: {
                ...shopOrder.toObject(),
                shop: assignment.shop
            },
            deliveryAddress: assignment.order.deliveryAddress,
            deliveryBoyLocation,
            customerLocation,
            restaurantLocation
        })
    } catch (error) {
        return res.status(500).json({ message: `get current order error ${error}` })
    }
}

export const getOrderById = async (req, res) => {
    try {
        const { orderId } = req.params
        const order = await Order.findById(orderId)
            .populate("user")
            .populate({ path: "shopOrders.shop", model: "Shop" })
            .populate({ path: "shopOrders.assignedDeliveryBoy", model: "User" })
            .populate({ path: "shopOrders.shopOrderItems.item", model: "Item" })
            .lean()

        if (!order) {
            return res.status(400).json({ message: "order not found" })
        }
        return res.status(200).json(order)
    } catch (error) {
        return res.status(500).json({ message: `get by id order error ${error}` })
    }
}

export const sendDeliveryOtp = async (req, res) => {
    try {
        const { orderId, shopOrderId } = req.body

        if (!orderId || !shopOrderId) {
            return res.status(400).json({ message: "orderId and shopOrderId are required" })
        }

        const order = await Order.findById(orderId).populate("user", "fullName email mobile")
        if (!order) {
            return res.status(400).json({ message: "Order not found" })
        }

        const shopOrder = order.shopOrders.id(shopOrderId)
        if (!shopOrder) {
            return res.status(400).json({ message: "Shop order not found" })
        }

        if (!order.user?.email) {
            return res.status(400).json({ message: "Customer email not found" })
        }

        const otp = Math.floor(1000 + Math.random() * 9000).toString()
        shopOrder.deliveryOtp = otp
        shopOrder.otpExpires = Date.now() + 5 * 60 * 1000
        await order.save()

        try {
            await sendDeliveryOtpMail(order.user, otp)
        } catch (mailError) {
            console.error("Failed to send OTP email:", mailError);
            return res.status(500).json({ message: "OTP generated but failed to send email. Please check the backend EMAIL and PASS environment variables on Render." })
        }

        return res.status(200).json({
            message: `OTP sent successfully to ${order.user.fullName}`
        })
    } catch (error) {
        console.error("sendDeliveryOtp error:", error)
        return res.status(500).json({ message: `delivery otp error: ${error.message}` })
    }
}

export const verifyDeliveryOtp = async (req, res) => {
    try {
        const { orderId, shopOrderId, otp } = req.body

        if (!orderId || !shopOrderId || !otp) {
            return res.status(400).json({ message: "orderId, shopOrderId and otp are required" })
        }

        const order = await Order.findById(orderId).populate("user", "fullName email mobile")
        if (!order) {
            return res.status(400).json({ message: "Order not found" })
        }

        const shopOrder = order.shopOrders.id(shopOrderId)
        if (!shopOrder) {
            return res.status(400).json({ message: "Shop order not found" })
        }

        if (!shopOrder.deliveryOtp) {
            return res.status(400).json({ message: "OTP not generated. Please click Mark As Delivered first." })
        }

        if (shopOrder.otpExpires < Date.now()) {
            return res.status(400).json({ message: "OTP expired. Please request a new one." })
        }

        if (shopOrder.deliveryOtp !== otp.toString()) {
            return res.status(400).json({ message: "Invalid OTP" })
        }

        shopOrder.status = "delivered"
        shopOrder.deliveredAt = Date.now()
        shopOrder.deliveryOtp = undefined
        shopOrder.otpExpires = undefined
        await order.save()

        await DeliveryAssignment.deleteOne({
            shopOrderId: shopOrder._id,
            order: order._id,
            assignedTo: shopOrder.assignedDeliveryBoy
        })

        const io = req.app.get("io")
        emitOrderStatusUpdate(io, {
            orderId: String(order._id),
            shopId: String(shopOrder.shop),
            status: shopOrder.status,
            userId: String(order.user._id)
        })

        if (io && shopOrder.assignedDeliveryBoy) {
            const deliveryBoy = await User.findById(shopOrder.assignedDeliveryBoy).select("socketId")
            const earningAmount = Number(order.deliveryFee) || 40
            if (deliveryBoy?.socketId) {
                io.to(deliveryBoy.socketId).emit("earnings-update", {
                    orderId: String(order._id),
                    amount: earningAmount
                })
            }
        }

        return res.status(200).json({ message: "Order Delivered Successfully!" })
    } catch (error) {
        console.error("verifyDeliveryOtp error:", error)
        return res.status(500).json({ message: `verify delivery otp error: ${error.message}` })
    }
}

export const getTodayDeliveries = async (req, res) => {
    try {
        const deliveryBoyId = req.userId
        const startsOfDay = new Date()
        startsOfDay.setHours(0, 0, 0, 0)

        const orders = await Order.find({
            "shopOrders.assignedDeliveryBoy": deliveryBoyId,
            "shopOrders.status": "delivered",
            "shopOrders.deliveredAt": { $gte: startsOfDay }
        }).lean()

        let todaysDeliveries = []
        orders.forEach(order => {
            order.shopOrders.forEach(shopOrder => {
                if (shopOrder.assignedDeliveryBoy == deliveryBoyId &&
                    shopOrder.status == "delivered" &&
                    shopOrder.deliveredAt &&
                    shopOrder.deliveredAt >= startsOfDay
                ) {
                    todaysDeliveries.push(shopOrder)
                }
            })
        })

        let stats = {}
        todaysDeliveries.forEach(shopOrder => {
            const hour = new Date(shopOrder.deliveredAt).getHours()
            stats[hour] = (stats[hour] || 0) + 1
        })

        let formattedStats = Object.keys(stats).map(hour => ({
            hour: parseInt(hour),
            count: stats[hour]
        }))

        formattedStats.sort((a, b) => a.hour - b.hour)

        return res.status(200).json(formattedStats)
    } catch (error) {
        return res.status(500).json({ message: `get today deliveries error ${error}` })
    }
}

export const updateStatusByDeliveryBoy = async (req, res) => {
    try {
        const { orderId, shopOrderId, status } = req.body
        const order = await Order.findById(orderId).populate("user")
        const shopOrder = order?.shopOrders.id(shopOrderId)

        if (!order || !shopOrder) {
            return res.status(400).json({ message: "enter valid order/shopOrderid" })
        }

        shopOrder.status = status
        if (status === "delivered") {
            shopOrder.deliveredAt = Date.now()
            await DeliveryAssignment.deleteOne({
                shopOrderId: shopOrder._id,
                order: order._id,
                assignedTo: shopOrder.assignedDeliveryBoy
            })
        }

        await order.save()
        const io = req.app.get("io")
        emitOrderStatusUpdate(io, {
            orderId: String(order._id),
            shopId: String(shopOrder.shop),
            status: shopOrder.status,
            userId: String(order.user._id)
        })

        if (status === "delivered" && io && shopOrder.assignedDeliveryBoy) {
            const deliveryBoy = await User.findById(shopOrder.assignedDeliveryBoy).select("socketId")
            const earningAmount = Number(order.deliveryFee) || 40
            if (deliveryBoy?.socketId) {
                io.to(deliveryBoy.socketId).emit("earnings-update", {
                    orderId: String(order._id),
                    amount: earningAmount
                })
            }
        }

        return res.status(200).json({ message: `Order marked as ${status}`, shopOrder })
    } catch (error) {
        return res.status(500).json({ message: `update status by delivery boy error: ${error}` })
    }
}
