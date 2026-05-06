import User from "./models/user.model.js"
import Order from "./models/order.model.js"

function getDistanceInMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

export const socketHandler = (io) => {
  const orderChats = new Map()

  const ensureChatStore = (orderId) => {
    const key = String(orderId)
    if (!orderChats.has(key)) {
      orderChats.set(key, [])
    }
    return orderChats.get(key)
  }

  const emitDeliveryLocationToOrder = ({ orderId, deliveryBoyId, latitude, longitude, distanceInMeters = null }) => {
    const payload = {
      orderId: String(orderId),
      deliveryBoyId: String(deliveryBoyId),
      lat: Number(latitude),
      lng: Number(longitude),
      distanceInMeters
    }
    io.to(`order-${orderId}`).emit('delivery-location-update', payload)
    // Backward compatibility with older clients
    io.to(`order-${orderId}`).emit('deliveryLocationUpdate', payload)
    io.to(`order-${orderId}`).emit('updateDeliveryLocation', {
      deliveryBoyId: payload.deliveryBoyId,
      latitude: payload.lat,
      longitude: payload.lng
    })
  }

  io.on('connection', (socket) => {
    console.log(socket.id)
    socket.on('identity', async ({ userId }) => {
      try {
        const user = await User.findByIdAndUpdate(userId, {
          socketId: socket.id, isOnline: true
        }, { new: true })
      } catch (error) {
        console.log(error)
      }
    })

    socket.on('joinOrderRoom', ({ orderId }) => {
      if (orderId) {
        socket.join(`order-${orderId}`)
      }
    })

    // Native tracking interceptor
    socket.on('delivery-location-update', async ({ orderId, deliveryBoyId, latitude, longitude, lat, lng }) => {
        try {
            const nextLat = Number(latitude ?? lat)
            const nextLng = Number(longitude ?? lng)
            if (!orderId || !deliveryBoyId || Number.isNaN(nextLat) || Number.isNaN(nextLng)) {
              return
            }

            await User.findByIdAndUpdate(deliveryBoyId, {
                location: {
                    type: 'Point',
                    coordinates: [nextLng, nextLat]
                },
                isOnline: true,
                socketId: socket.id
            });

            const order = await Order.findById(orderId);
            if(order && order.deliveryAddress) {
                const { latitude: userLat, longitude: userLon } = order.deliveryAddress;
                
                const distanceInMeters = getDistanceInMeters(nextLat, nextLng, userLat, userLon);
                emitDeliveryLocationToOrder({
                  orderId,
                  deliveryBoyId,
                  latitude: nextLat,
                  longitude: nextLng,
                  distanceInMeters
                })

                if(distanceInMeters < 500) {
                    io.to(`order-${orderId}`).emit('order-nearby');
                }
            } else {
              emitDeliveryLocationToOrder({
                orderId,
                deliveryBoyId,
                latitude: nextLat,
                longitude: nextLng
              })
            }
        } catch (error) {
            console.log('delivery-location-update error', error);
        }
    })

    socket.on('order-status-update', ({ orderId, status, shopId, userId }) => {
        const payload = { orderId: String(orderId), status, shopId, userId }
        io.to(`order-${orderId}`).emit('order-status-update', payload)
        // Backward compatibility
        io.to(`order-${orderId}`).emit('update-status', payload)
    });

    socket.on('delivery-boy-assigned', ({ orderId, deliveryBoy }) => {
        io.to(`order-${orderId}`).emit('delivery-boy-assigned', { orderId: String(orderId), deliveryBoy })
    });

    socket.on('order-picked-up', ({ orderId }) => {
        io.to(`order-${orderId}`).emit('order-picked-up')
    });

    socket.on('order-delivered', ({ orderId }) => {
        io.to(`order-${orderId}`).emit('order-delivered')
    });

    socket.on('chat-message', async ({ orderId, senderId, senderName, senderRole, message, timestamp }) => {
      try {
        if (!orderId || !senderId || !message?.trim()) return
        const order = await Order.findById(orderId)
        if (!order) return

        // Chat only for active orders
        const hasActiveShopOrder = order.shopOrders.some((shopOrder) => !["delivered", "rejected"].includes(shopOrder.status))
        if (!hasActiveShopOrder) {
          socket.emit('chat-error', { orderId: String(orderId), message: 'Chat is available only for active orders.' })
          return
        }

        const payload = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          orderId: String(orderId),
          senderId: String(senderId),
          senderName: senderName || "User",
          senderRole: senderRole || "user",
          message: message.trim(),
          timestamp: timestamp || new Date().toISOString()
        }

        const messages = ensureChatStore(orderId)
        messages.push(payload)
        if (messages.length > 100) messages.shift()

        io.to(`order-${orderId}`).emit('chat-message', payload)
      } catch (error) {
        console.log('chat-message error', error)
      }
    })

    socket.on('get-chat-history', ({ orderId }) => {
      if (!orderId) return
      const history = ensureChatStore(orderId)
      socket.emit('chat-history', { orderId: String(orderId), messages: history })
    })

    // Fallback deprecated
    socket.on('updateLocation', async ({ userId, orderId, lat, lng }) => {
      try {
        const user = await User.findByIdAndUpdate(userId, {
          location: {
            type: 'Point',
            coordinates: [lng, lat]
          },
          isOnline: true,
          socketId: socket.id
        })

        if (user) {
          if (orderId) {
            emitDeliveryLocationToOrder({
              orderId,
              deliveryBoyId: userId,
              latitude: lat,
              longitude: lng
            })
          }
        }
      } catch (error) {
        console.log('updateDeliveryLocation error', error)
      }
    })

    socket.on('disconnect', async () => {
      try {
        await User.findOneAndUpdate({ socketId: socket.id }, {
          socketId: null,
          isOnline: false
        })
      } catch (error) {
        console.log(error)
      }
    })
  })
}