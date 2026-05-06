import Complaint from "../models/complaint.model.js";

export const createComplaint = async (req, res) => {
  try {
    const { subject, message, restaurantId, orderId } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ message: "Both subject and message are required" });
    }
    const complaint = await Complaint.create({
      userId: req.userId,
      subject,
      message,
      restaurantId,
      orderId
    });

    const io = req.app.get('io')
    if (io) {
      await complaint.populate("userId", "fullName email mobile")
      await complaint.populate("restaurantId", "shopName")
      await complaint.populate("orderId", "_id totalAmount createdAt")
      io.emit('newComplaint', complaint)
    }

    return res.status(201).json({ success: true, complaint, message: "Complaint submitted successfully" });
  } catch (error) {
    return res.status(500).json({ message: `create complaint error: ${error.message}` });
  }
};

export const getMyComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find({ userId: req.userId })
      .populate("restaurantId", "shopName")
      .populate("orderId", "_id totalAmount createdAt")
      .sort({ createdAt: -1 });
    return res.status(200).json(complaints);
  } catch (error) {
    return res.status(500).json({ message: `get my complaints error: ${error.message}` });
  }
};

export const getAllComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find()
      .populate("userId", "fullName email mobile")
      .populate("restaurantId", "shopName")
      .populate("orderId", "_id totalAmount createdAt")
      .sort({ createdAt: -1 });
    return res.status(200).json(complaints);
  } catch (error) {
    return res.status(500).json({ message: `get all complaints error: ${error.message}` });
  }
};

export const resolveComplaint = async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ Populate userId to get socketId for real-time notification
    const complaint = await Complaint.findByIdAndUpdate(
      id,
      { status: "resolved" },
      { new: true }
    ).populate("userId", "socketId fullName");

    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    // ✅ Notify user in real time that their complaint was resolved
    const io = req.app.get('io')
    if (io && complaint.userId?.socketId) {
      io.to(complaint.userId.socketId).emit('complaintResolved', {
        complaintId: String(complaint._id)
      })
    }

    return res.status(200).json({ success: true, complaint, message: "Complaint marked as resolved" });
  } catch (error) {
    return res.status(500).json({ message: `resolve complaint error: ${error.message}` });
  }
};