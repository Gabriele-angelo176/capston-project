import 'dotenv/config'
import bcrypt from 'bcryptjs'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import { OAuth2Client } from 'google-auth-library'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import nodemailer from 'nodemailer'
import Order from './models/Order.js'
import Product from './models/Product.js'
import User from './models/User.js'
import { starterProducts } from './data/products.js'

const app = express()
const port = Number(process.env.PORT) || 4000
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/strive-blog'
const googleClientId = process.env.GOOGLE_CLIENT_ID
const googleClient = googleClientId ? new OAuth2Client(googleClientId) : null
const sessionCookie = 'offform-session'
const jwtSecret = process.env.JWT_SECRET || 'offform-local-development-only-change-before-deploy'
const gmailUser = process.env.GMAIL_USER
const notificationRecipient = process.env.NOTIFY_EMAIL
const mailer = gmailUser && process.env.GMAIL_APP_PASSWORD
  ? nodemailer.createTransport({ service: 'gmail', auth: { user: gmailUser, pass: process.env.GMAIL_APP_PASSWORD } })
  : null

app.use(cors())
app.use(express.json())
app.use(cookieParser())

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false })
app.use('/api/auth', authLimiter)

function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email, role: user.role }
}

function assignAdminRole(user) {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  if (adminEmail && user.email === adminEmail) user.role = 'admin'
  return user
}

function setSession(response, user) {
  const token = jwt.sign({ sub: user._id.toString() }, jwtSecret, { expiresIn: '7d' })
  response.cookie(sessionCookie, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
}

async function requireAuth(request, response, next) {
  try {
    const token = request.cookies[sessionCookie]
    if (!token) return response.status(401).json({ message: 'Accedi per continuare.' })
    const payload = jwt.verify(token, jwtSecret)
    const user = await User.findById(payload.sub)
    if (!user) return response.status(401).json({ message: 'Sessione non valida.' })
    request.user = user
    next()
  } catch {
    response.status(401).json({ message: 'Sessione scaduta. Accedi di nuovo.' })
  }
}

function requireAdmin(request, response, next) {
  if (request.user.role !== 'admin') return response.status(403).json({ message: "Accesso riservato all'amministratore." })
  next()
}

async function notifyGmail(subject, lines) {
  if (!mailer || !notificationRecipient) {
    console.warn('Gmail notification skipped: configure GMAIL_USER, GMAIL_APP_PASSWORD and NOTIFY_EMAIL in .env')
    return
  }

  try {
    await mailer.sendMail({
      from: `Offform <${gmailUser}>`,
      to: notificationRecipient,
      subject,
      text: lines.join('\n'),
    })
  } catch (error) {
    console.error('Gmail notification failed:', error.message)
  }
}

app.get('/api/health', (_request, response) => {
  response.json({
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    googleConfigured: Boolean(googleClient),
    gmailConfigured: Boolean(mailer && notificationRecipient),
  })
})

app.get('/api/auth/me', async (request, response) => {
  const token = request.cookies[sessionCookie]
  if (!token) return response.json({ user: null })

  try {
    const payload = jwt.verify(token, jwtSecret)
    const user = await User.findById(payload.sub)
    response.json({ user: user ? publicUser(user) : null })
  } catch {
    response.clearCookie(sessionCookie, { httpOnly: true, sameSite: 'lax', path: '/' })
    response.json({ user: null })
  }
})

app.post('/api/auth/register', async (request, response, next) => {
  try {
    const name = String(request.body.name || '').trim()
    const email = String(request.body.email || '').trim().toLowerCase()
    const password = String(request.body.password || '')

    if (name.length < 2 || name.length > 100 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
      return response.status(400).json({ message: 'Inserisci nome, email valida e password di almeno 8 caratteri.' })
    }
    if (await User.exists({ email })) return response.status(409).json({ message: 'Esiste già un account con questa email.' })

    const user = assignAdminRole(await User.create({
      name,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      emailVerified: false,
    }))
    await user.save()
    setSession(response, user)
    await notifyGmail('Nuova registrazione Offform', [
      'È stato creato un nuovo account.',
      `Nome: ${user.name}`,
      `Email: ${user.email}`,
      `Data: ${new Date().toLocaleString('it-IT')}`,
    ])
    response.status(201).json({ user: publicUser(user) })
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/login', async (request, response, next) => {
  try {
    const email = String(request.body.email || '').trim().toLowerCase()
    const password = String(request.body.password || '')
    const user = await User.findOne({ email }).select('+passwordHash')

    if (!user?.passwordHash || !await bcrypt.compare(password, user.passwordHash)) {
      return response.status(401).json({ message: 'Email o password non corrette.' })
    }

    assignAdminRole(user)
    await user.save()
    setSession(response, user)
    await notifyGmail('Nuovo accesso Offform', [
      'Un account ha effettuato l’accesso.',
      `Nome: ${user.name}`,
      `Email: ${user.email}`,
      `Data: ${new Date().toLocaleString('it-IT')}`,
    ])
    response.json({ user: publicUser(user) })
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/google', async (request, response, next) => {
  try {
    if (!googleClient) return response.status(503).json({ message: 'Accesso Google non configurato.' })
    const credential = String(request.body.credential || '')
    if (!credential) return response.status(400).json({ message: 'Credenziale Google mancante.' })

    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: googleClientId })
    const profile = ticket.getPayload()
    if (!profile?.email || !profile.email_verified || !profile.sub) {
      return response.status(401).json({ message: 'Non è stato possibile verificare l’account Google.' })
    }

    const email = profile.email.toLowerCase()
    let user = await User.findOne({ $or: [{ googleId: profile.sub }, { email }] })
    if (!user) {
      user = new User({ name: profile.name || email.split('@')[0], email, googleId: profile.sub, emailVerified: true })
    } else if (!user.googleId) {
      user.googleId = profile.sub
      user.emailVerified = true
    }

    assignAdminRole(user)
    await user.save()
    setSession(response, user)
    await notifyGmail('Nuovo accesso Google Offform', [
      'Un account ha effettuato l’accesso con Google.',
      `Nome: ${user.name}`,
      `Email: ${user.email}`,
      `Data: ${new Date().toLocaleString('it-IT')}`,
    ])
    response.json({ user: publicUser(user) })
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/logout', (_request, response) => {
  response.clearCookie(sessionCookie, { httpOnly: true, sameSite: 'lax', path: '/' })
  response.status(204).end()
})

app.get('/api/products', async (request, response, next) => {
  try {
    const { category, search } = request.query
    const filter = {}

    if (category && category !== 'Tutti') filter.category = category
    if (search) filter.name = { $regex: String(search), $options: 'i' }

    const products = await Product.find(filter).sort({ featured: -1, createdAt: -1 })
    response.json(products)
  } catch (error) {
    next(error)
  }
})

app.post('/api/orders', async (request, response, next) => {
  const reservedItems = []

  try {
    const name = String(request.body.customer?.name || '').trim()
    const email = String(request.body.customer?.email || '').trim().toLowerCase()
    const requestedItems = request.body.items

    if (!name || !/^\S+@\S+\.\S+$/.test(email) || !Array.isArray(requestedItems) || requestedItems.length === 0) {
      return response.status(400).json({ message: 'Inserisci nome, email valida e almeno un articolo.' })
    }

    const quantities = new Map()
    for (const item of requestedItems) {
      const quantity = Number(item.quantity)
      if (!mongoose.isValidObjectId(item.productId) || !Number.isInteger(quantity) || quantity < 1) {
        return response.status(400).json({ message: 'Articoli o quantità non validi.' })
      }
      quantities.set(item.productId, (quantities.get(item.productId) || 0) + quantity)
    }

    const orderItems = []
    for (const [productId, quantity] of quantities) {
      const product = await Product.findOneAndUpdate(
        { _id: productId, stock: { $gte: quantity } },
        { $inc: { stock: -quantity } },
        { new: true },
      )

      if (!product) {
        const error = new Error('Disponibilità non sufficiente per uno degli articoli.')
        error.status = 409
        throw error
      }

      reservedItems.push({ productId, quantity })
      orderItems.push({ productId, name: product.name, price: product.price, quantity, image: product.image })
    }

    const order = await Order.create({
      customer: { name, email },
      items: orderItems,
      total: orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    })

    await notifyGmail('Nuovo ordine Offform', [
      `Ordine: ${order._id}`,
      `Cliente: ${name}`,
      `Email: ${email}`,
      `Articoli: ${orderItems.reduce((sum, item) => sum + item.quantity, 0)}`,
      `Totale: ${new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(order.total)}`,
      `Data: ${new Date().toLocaleString('it-IT')}`,
    ])
    response.status(201).json(order)
  } catch (error) {
    if (reservedItems.length) {
      await Promise.all(reservedItems.map(({ productId, quantity }) =>
        Product.updateOne({ _id: productId }, { $inc: { stock: quantity } }),
      ))
    }
    next(error)
  }
})

app.use('/api/admin', requireAuth, requireAdmin)

app.get('/api/admin/summary', async (_request, response, next) => {
  try {
    const [products, orders, revenue, latestOrders] = await Promise.all([
      Product.countDocuments(),
      Order.countDocuments(),
      Order.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
      Order.find().sort({ createdAt: -1 }).limit(5),
    ])

    response.json({ products, orders, revenue: revenue[0]?.total || 0, latestOrders })
  } catch (error) {
    next(error)
  }
})

app.get('/api/admin/products', async (_request, response, next) => {
  try {
    response.json(await Product.find().sort({ stock: 1, name: 1 }))
  } catch (error) {
    next(error)
  }
})

app.patch('/api/admin/products/:id/stock', async (request, response, next) => {
  try {
    const stock = Number(request.body.stock)
    if (!Number.isInteger(stock) || stock < 0) {
      return response.status(400).json({ message: 'La disponibilità deve essere un intero positivo.' })
    }

    const product = await Product.findByIdAndUpdate(request.params.id, { stock }, { new: true, runValidators: true })
    if (!product) return response.status(404).json({ message: 'Prodotto non trovato.' })
    response.json(product)
  } catch (error) {
    next(error)
  }
})

app.use((error, _request, response, next) => {
  console.error(error)
  if (response.headersSent) return next(error)
  response.status(error.status || 500).json({ message: error.status ? error.message : 'Errore del server.' })
})

async function start() {
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be configured in production.')
  }
  await mongoose.connect(mongoUri)
  if (await Product.countDocuments() === 0) await Product.insertMany(starterProducts)
  app.listen(port, () => console.log(`Strive API listening at http://127.0.0.1:${port}`))
}

start().catch((error) => {
  console.error('Could not start the API:', error.message)
  process.exit(1)
})