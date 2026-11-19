import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, select: false },
    googleId: { type: String, sparse: true, unique: true },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
    emailVerified: { type: Boolean, default: false },
  },
  { timestamps: true },
)

export default mongoose.model('User', userSchema)