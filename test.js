import mongoose from "mongoose";

mongoose.connect("mongodb+srv://yumrush:yumrush123@cluster0.o5kcx.mongodb.net/yumrush?retryWrites=true&w=majority")
  .then(async () => {
    const Order = mongoose.model('Order', new mongoose.Schema({}, {strict: false}));
    const orders = await Order.find({"shopOrders": {$exists: true}}).lean();
    console.log(JSON.stringify(orders.slice(-2), null, 2));
    process.exit(0);
  });
