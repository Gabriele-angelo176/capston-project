import mongoose from 'mongoose'

const orderSchema = new mongoose.Schema(
  {
    customer: {
      name: { type: String, required: true },
      email: { type: String, required: true },
    },
    items: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        name: { type: String, required: true },
        price: { type: Number, required: true },
        quantity: { type: Number, required: true, min: 1 },
        image: { type: String, required: true },
      },
    ],
    total: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['paid', 'refunded'], default: 'paid' },
  },
  { timestamps: true },
)

export default mongoose.model('Order', orderSchema)