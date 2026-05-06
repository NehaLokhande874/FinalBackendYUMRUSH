import express from "express"
import dotenv from "dotenv"
dotenv.config()
import connectDb from "./config/db.js"
import cookieParser from "cookie-parser"
import authRouter from "./routes/auth.routes.js"
import cors from "cors"
import userRouter from "./routes/user.routes.js"

import itemRouter from "./routes/item.routes.js"
import shopRouter from "./routes/shop.routes.js"
import orderRouter from "./routes/order.routes.js"
import profileRouter from "./routes/profile.routes.js"
import complaintRouter from "./routes/complaint.routes.js"
import adminRouter from "./routes/admin.routes.js"
import ratingRouter from "./routes/rating.routes.js"
import offerRouter from "./routes/offer.routes.js"

import http from "http"
import { Server } from "socket.io"
import { socketHandler } from "./socket.js"

const app = express()
const server = http.createServer(app)

// UPDATED: Added the specific Vercel Preview URL from your screenshot
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "https://final-frontend-yumrush.vercel.app",
  "https://final-frontend-yumrush-13oo02tnb-nehalokhande874s-projects.vercel.app",
  "https://final-frontend-yumrush-rle2kkjlc-nehalokhande874s-projects.vercel.app"
]

const isAllowedOrigin = (origin) => {
  // Allow requests with no origin (like mobile apps or curl requests)
  if (!origin) return true
  if (allowedOrigins.includes(origin)) return true

  // Allow Vite dev servers running on localhost with any port.
  return /^http:\/\/localhost:\d+$/.test(origin)
}

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) return callback(null, true)
      return callback(new Error("Not allowed by CORS"))
    },
    credentials: true,
    // UPDATED: Added common methods to ensure Socket.io stability
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
  }
})

app.set("io", io)

const PORT = process.env.PORT || 8000

// Apply CORS middleware to Express
app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) return callback(null, true)
    return callback(new Error("Not allowed by CORS"))
  },
  credentials: true
}))

app.use(express.json())
app.use(cookieParser())

// Routes
app.use("/api/auth", authRouter)
app.use("/api/user", userRouter)
app.use("/api/shop", shopRouter)
app.use("/api/item", itemRouter)
app.use("/api/order", orderRouter)
app.use("/api/complaint", complaintRouter)
app.use("/api/admin", adminRouter)
app.use("/api/rating", ratingRouter)
app.use("/api/offer", offerRouter)

socketHandler(io)

const startApp = async () => {
  server.listen(PORT, () => {
    console.log(`server started at ${PORT}`)
  })

  const dbConnected = await connectDb()
  if (!dbConnected) {
    console.warn("Warning: MongoDB not connected. API routes are available but DB requests may fail.")
  }
}

startApp().catch((err) => {
  console.error('Unexpected startup error:', err)
})