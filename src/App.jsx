import { useEffect, useRef, useState } from 'react'
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Check,
  CircleUserRound,
  LayoutDashboard,
  LogIn,
  LogOut,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingBag,
  Store,
  X,
} from 'lucide-react'
import './App.css'

const money = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })
const categories = ['Tutti', 'Audio', 'Casa', 'Luce', 'Cartoleria', 'Accessori']

function readCart() {
  try {
    return JSON.parse(localStorage.getItem('offform-cart') || '[]')
  } catch {
    return []
  }
}

function ProductCard({ product, onAdd }) {
  return (
    <article className="product-card">
      <div className="product-image-wrap">
        <img className="product-image" src={product.image} alt={product.name} loading="lazy" />
        {product.featured && <span className="product-tag">Scelto per te</span>}
        <button className="add-button" type="button" onClick={() => onAdd(product)} aria-label={`Aggiungi ${product.name} al carrello`} title="Aggiungi al carrello" disabled={product.stock < 1}>
          <Plus size={19} strokeWidth={1.8} />
        </button>
      </div>
      <div className="product-meta"><div><span className="product-category">{product.category}</span><h3>{product.name}</h3></div><strong>{money.format(product.price)}</strong></div>
      <p className="product-description">{product.description}</p>
    </article>
  )
}
/*ACESSO A GOOGLE E EMAIL*/
function AuthDialog({ mode, setMode, onClose, onSubmit, error, busy, googleButtonRef, googleConfigured }) {
  const isRegister = mode === 'register'

  return (
    <div className="auth-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <div className="auth-heading">
          <div><p className="eyebrow">Offform / Il tuo profilo</p><h2 id="auth-title">{isRegister ? 'Crea il tuo account' : 'Bentornato'}<span>.</span></h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Chiudi accesso"><X size={20} /></button>
        </div>
        <div className="auth-switch" role="tablist" aria-label="Tipo di accesso">
          <button type="button" role="tab" aria-selected={!isRegister} className={!isRegister ? 'selected' : ''} onClick={() => setMode('login')}>Accedi</button>
          <button type="button" role="tab" aria-selected={isRegister} className={isRegister ? 'selected' : ''} onClick={() => setMode('register')}>Registrati</button>
        </div>
        <form className="auth-form" onSubmit={onSubmit}>
          {isRegister && <label>Nome<input required minLength="2" maxLength="100" autoComplete="name" name="name" placeholder="Il tuo nome" /></label>}
          <label>Email<input required type="email" autoComplete="email" name="email" placeholder="nome@email.com" /></label>
          <label>Password<input required type="password" minLength="8" autoComplete={isRegister ? 'new-password' : 'current-password'} name="password" placeholder={isRegister ? 'Almeno 8 caratteri' : 'La tua password'} /></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="checkout-button" type="submit" disabled={busy}>{busy ? 'Attendi...' : isRegister ? 'Crea account' : 'Accedi'} <LogIn size={17} /></button>
        </form>
        <div className="auth-divider"><span>oppure</span></div>
        {googleConfigured ? <div className="google-button-wrap" ref={googleButtonRef} /> : <p className="auth-config-note">Per attivare Google, configura l'ID client nel file `.env`.</p>}
        <p className="auth-privacy">La password viene salvata in forma protetta.</p>
      </section>
    </div>
  )
}

function App() {
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState(readCart)
  const [view, setView] = useState('shop')
  const [activeCategory, setActiveCategory] = useState('Tutti')
  const [search, setSearch] = useState('')
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutMode, setCheckoutMode] = useState(false)
  const [customer, setCustomer] = useState({ name: '', email: '' })
  const [loading, setLoading] = useState(true)
  const [database, setDatabase] = useState('checking')
  const [notice, setNotice] = useState('')
  const [summary, setSummary] = useState(null)
  const [adminProducts, setAdminProducts] = useState([])
  const [adminLoading, setAdminLoading] = useState(false)
  const [authUser, setAuthUser] = useState(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const googleButtonRef = useRef(null)
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

  async function loadProducts() {
    try {
      const response = await fetch('/api/products')
      if (!response.ok) throw new Error('Catalogo non disponibile')
      setProducts(await response.json())
    } catch {
      setNotice('Avvia il server locale per caricare il catalogo.')
    } finally {
      setLoading(false)
    }
  }

  async function loadAdmin() {
    try {
      const [summaryResponse, productsResponse] = await Promise.all([fetch('/api/admin/summary'), fetch('/api/admin/products')])
      if (!summaryResponse.ok || !productsResponse.ok) throw new Error('Dashboard non disponibile')
      setSummary(await summaryResponse.json())
      setAdminProducts(await productsResponse.json())
    } catch {
      setNotice('Impossibile caricare i dati amministrativi.')
    } finally {
      setAdminLoading(false)
    }
  }

  useEffect(() => {
    fetch('/api/products')
      .then((response) => {
        if (!response.ok) throw new Error('Catalogo non disponibile')
        return response.json()
      })
      .then(setProducts)
      .catch(() => setNotice('Avvia il server locale per caricare il catalogo.'))
      .finally(() => setLoading(false))
    fetch('/api/health').then((response) => response.json()).then((data) => setDatabase(data.database)).catch(() => setDatabase('offline'))
    fetch('/api/auth/me').then((response) => response.json()).then((result) => setAuthUser(result.user)).catch(() => setAuthUser(null))
  }, [])

  useEffect(() => {
    if (!authOpen || !googleClientId) return undefined

    const renderGoogleButton = () => {
      if (!window.google?.accounts?.id || !googleButtonRef.current) return
      googleButtonRef.current.replaceChildren()
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async ({ credential }) => {
          setAuthBusy(true)
          setAuthError('')
          try {
            const response = await fetch('/api/auth/google', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ credential }),
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result.message || 'Accesso Google non riuscito.')
            setAuthUser(result.user)
            setAuthOpen(false)
            setNotice(`Benvenuto, ${result.user.name}`)
          } catch (error) {
            setAuthError(error.message)
          } finally {
            setAuthBusy(false)
          }
        },
      })
      window.google.accounts.id.renderButton(googleButtonRef.current, { theme: 'outline', size: 'large', shape: 'rectangular', text: 'continue_with', width: Math.min(340, window.innerWidth - 80), locale: 'it' })
    }

    const script = document.getElementById('google-identity-script')
    script?.addEventListener('load', renderGoogleButton)
    renderGoogleButton()
    return () => script?.removeEventListener('load', renderGoogleButton)
  }, [authOpen, googleClientId])

  useEffect(() => { localStorage.setItem('offform-cart', JSON.stringify(cart)) }, [cart])
  useEffect(() => {
    if (view !== 'admin') return
    Promise.all([fetch('/api/admin/summary'), fetch('/api/admin/products')])
      .then(async ([summaryResponse, productsResponse]) => {
        if (!summaryResponse.ok || !productsResponse.ok) throw new Error('Dashboard non disponibile')
        const [summaryData, productsData] = await Promise.all([summaryResponse.json(), productsResponse.json()])
        setSummary(summaryData)
        setAdminProducts(productsData)
      })
      .catch(() => setNotice('Impossibile caricare i dati amministrativi.'))
      .finally(() => setAdminLoading(false))
  }, [view])
  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(''), 3400)
    return () => window.clearTimeout(timer)
  }, [notice])

  const visibleProducts = products.filter((product) => {
    const matchesCategory = activeCategory === 'Tutti' || product.category === activeCategory
    const matchesSearch = product.name.toLowerCase().includes(search.trim().toLowerCase())
    return matchesCategory && matchesSearch
  })
  const cartCount = cart.reduce((count, item) => count + item.quantity, 0)
  const cartTotal = cart.reduce((total, item) => total + item.price * item.quantity, 0)

  function addToCart(product) {
    const existing = cart.find((item) => item._id === product._id)
    if (existing?.quantity >= product.stock) {
      setNotice('Hai aggiunto tutti i pezzi disponibili.')
      return
    }
    setCart((current) => {
      const match = current.find((item) => item._id === product._id)
      if (match) return current.map((item) => item._id === product._id ? { ...item, quantity: item.quantity + 1 } : item)
      return [...current, { ...product, quantity: 1 }]
    })
    setNotice(`${product.name} aggiunto al carrello`)
  }

  function updateQuantity(productId, amount) {
    setCart((current) => current.map((item) => item._id === productId ? { ...item, quantity: item.quantity + amount } : item).filter((item) => item.quantity > 0))
  }

  async function submitOrder(event) {
    event.preventDefault()
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer, items: cart.map((item) => ({ productId: item._id, quantity: item.quantity })) }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Ordine non completato.')
      setCart([])
      setCartOpen(false)
      setCheckoutMode(false)
      setCustomer({ name: '', email: '' })
      setNotice(`Ordine confermato · ${result._id.slice(-6).toUpperCase()}`)
      loadProducts()
      if (view === 'admin') loadAdmin()
    } catch (error) {
      setNotice(error.message)
    }
  }

  async function updateStock(productId, value) {
    const stock = Number(value)
    if (!Number.isInteger(stock) || stock < 0) return
    try {
      const response = await fetch(`/api/admin/products/${productId}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock }),
      })
      const updated = await response.json()
      if (!response.ok) throw new Error(updated.message)
      setAdminProducts((current) => current.map((product) => product._id === productId ? updated : product))
      setProducts((current) => current.map((product) => product._id === productId ? updated : product))
      setNotice('Disponibilità aggiornata')
    } catch (error) {
      setNotice(error.message || 'Impossibile aggiornare la disponibilità.')
    }
  }

  async function submitAuth(event) {
    event.preventDefault()
    setAuthBusy(true)
    setAuthError('')
    const formData = new FormData(event.currentTarget)
    try {
      const response = await fetch(`/api/auth/${authMode === 'register' ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(formData)),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Accesso non riuscito.')
      setAuthUser(result.user)
      setAuthOpen(false)
      setNotice(authMode === 'register' ? 'Account creato con successo' : `Bentornato, ${result.user.name}`)
    } catch (error) {
      setAuthError(error.message)
    } finally {
      setAuthBusy(false)
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    setAuthUser(null)
    setView('shop')
    setNotice('Hai effettuato la disconnessione')
  }

  return (
    <div className="app-shell">
      <header className="site-header">
       
      </header>

      {view === 'shop' ? (
        <main id="home">
          <section className="shop-hero">
            <div className="hero-copy">
              <p className="eyebrow"><span>Oggetti scelti, vita quotidiana</span><span>01 / 04</span></p>
              <h1>Belle cose<br />per <em>ogni giorno.</em></h1>
              <div className="hero-bottom"><p>Una collezione di oggetti utili, belli da usare e fatti per restare.</p><a className="round-link" href="#catalogo" aria-label="Vai al catalogo"><ArrowDownRight size={21} /></a></div>
            </div>
            <div className="hero-image" role="img" aria-label="Una selezione di oggetti di design per la casa"><div className="hero-image-caption"><span>Oggetti scelti con cura</span><span>Dal 2024</span></div></div>
            <div className="hero-index"><span>SELEZIONE N. 04</span><span>48°08' N / 11°34' E</span></div>
          </section>

          <section className="catalog-section" id="catalogo">
            <div className="section-heading"><div><p className="eyebrow">Pezzi per i tuoi rituali</p><h2>La selezione <span>del momento.</span></h2></div>
              <label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cerca un oggetto" aria-label="Cerca prodotti" />{search && <button type="button" onClick={() => setSearch('')} aria-label="Cancella ricerca"><X size={15} /></button>}</label>
            </div>
            <div className="catalog-toolbar"><div className="category-list" aria-label="Filtra per categoria">{categories.map((category) => <button key={category} type="button" className={activeCategory === category ? 'category-button selected' : 'category-button'} onClick={() => setActiveCategory(category)}>{category}</button>)}</div><span className="product-count">{loading ? 'Caricamento...' : `${visibleProducts.length} oggetti`}</span></div>
            {loading ? <div className="catalog-message">Il catalogo si sta preparando<span className="loading-line" /></div> : visibleProducts.length ? <div className="product-grid">{visibleProducts.map((product) => <ProductCard key={product._id} product={product} onAdd={addToCart} />)}</div> : <div className="catalog-message">Nessun oggetto trovato. Prova a cambiare ricerca.</div>}
          </section>
          <section className="shop-note"><span className="note-mark">✳</span><p>Pensati per l'uso.<br /><em>Fatti per durare.</em></p><span className="note-side">Consegna gratuita<br />sopra i 100 €</span></section>
        </main>
      ) : (
        <main className="admin-page">
          <div className="admin-topline"><p className="eyebrow">Offform / Area gestione</p><span className="admin-demo">Modalità demo</span></div>
          <div className="admin-title-row"><div><h1>Riepilogo<span>.</span></h1><p>Una panoramica aggiornata del tuo spazio.</p></div><button className="refresh-button" type="button" onClick={loadAdmin}><ArrowUpRight size={16} /> Aggiorna dati</button></div>
          <div className="metric-grid">
            <article className="metric-card metric-dark"><span>Fatturato registrato</span><strong>{money.format(summary?.revenue || 0)}</strong><small><ArrowUpRight size={13} /> Ordini completati</small></article>
            <article className="metric-card"><span>Ordini totali</span><strong>{summary?.orders ?? '—'}</strong><small><Package size={13} /> Acquisti simulati</small></article>
            <article className="metric-card"><span>Prodotti a catalogo</span><strong>{summary?.products ?? '—'}</strong><small><Check size={13} /> Disponibili online</small></article>
            <article className="metric-card metric-accent"><span>Scorte in esaurimento</span><strong>{adminProducts.filter((product) => product.stock < 10).length}</strong><small><ArrowDownRight size={13} /> Meno di 10 pezzi</small></article>
          </div>
          <section className="inventory-section"><div className="admin-section-heading"><div><p className="eyebrow">Risorse / 01</p><h2>Inventario</h2></div><span>{adminLoading ? 'Aggiornamento...' : `${adminProducts.length} referenze`}</span></div>
            <div className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th>Prodotto</th><th>Categoria</th><th>Prezzo</th><th>Disponibilità</th></tr></thead><tbody>{adminProducts.map((product) => <tr key={product._id}><td><div className="inventory-product"><img src={product.image} alt="" /><span>{product.name}</span></div></td><td>{product.category}</td><td>{money.format(product.price)}</td><td><div className="stock-control"><input aria-label={`Scorte ${product.name}`} type="number" min="0" defaultValue={product.stock} onBlur={(event) => updateStock(product._id, event.target.value)} /><span className={product.stock < 10 ? 'stock-low' : 'stock-ok'}>{product.stock < 10 ? 'Riordino' : 'Disponibile'}</span></div></td></tr>)}</tbody></table>{!adminLoading && adminProducts.length === 0 && <p className="empty-admin">Nessun prodotto da mostrare.</p>}</div>
          </section>
          <section className="orders-section"><div className="admin-section-heading"><div><p className="eyebrow">Attività / 02</p><h2>Ordini recenti</h2></div><span>Ultime 5 transazioni</span></div>{summary?.latestOrders?.length ? <div className="orders-list">{summary.latestOrders.map((order) => <article className="order-row" key={order._id}><span className="order-id">#{order._id.slice(-6).toUpperCase()}</span><span>{order.customer.name}</span><span>{new Date(order.createdAt).toLocaleDateString('it-IT')}</span><strong>{money.format(order.total)}</strong><span className="order-status">Confermato</span></article>)}</div> : <p className="empty-admin">Gli ordini appariranno qui dopo il primo acquisto.</p>}</section>
        </main>
      )}

      <footer className="site-footer"><a className="wordmark footer-brand" href="#home"><span className="wordmark-symbol">o</span>ffform<span className="wordmark-period">.</span></a><span>Piccole cose, fatte con cura.</span><span>© 2026 OFFFORM STUDIO</span></footer>

      {cartOpen && <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) { setCartOpen(false); setCheckoutMode(false) } }}><aside className="cart-drawer" aria-label="Carrello">
        <div className="drawer-heading"><div><p className="eyebrow">La tua selezione</p><h2>{checkoutMode ? 'Pagamento' : 'Il tuo carrello'}<span>.</span></h2></div><button className="icon-button" type="button" onClick={() => { setCartOpen(false); setCheckoutMode(false) }} aria-label="Chiudi carrello"><X size={20} /></button></div>
        {!checkoutMode ? <><div className="cart-items">{cart.length ? cart.map((item) => <article className="cart-item" key={item._id}><img src={item.image} alt="" /><div className="cart-item-info"><span>{item.category}</span><h3>{item.name}</h3><strong>{money.format(item.price)}</strong><div className="quantity-control"><button type="button" onClick={() => updateQuantity(item._id, -1)} aria-label={`Riduci quantità ${item.name}`}><Minus size={13} /></button><span>{item.quantity}</span><button type="button" onClick={() => updateQuantity(item._id, 1)} aria-label={`Aumenta quantità ${item.name}`}><Plus size={13} /></button></div></div></article>) : <div className="empty-cart"><ShoppingBag size={30} strokeWidth={1.3} /><p>Il tuo carrello è ancora vuoto.</p><button type="button" onClick={() => setCartOpen(false)}>Scopri la selezione <ArrowUpRight size={15} /></button></div>}</div>{cart.length > 0 && <div className="cart-footer"><div className="cart-total"><span>Subtotale</span><strong>{money.format(cartTotal)}</strong></div><p>Spedizione gratuita sopra i 100 €</p><button className="checkout-button" type="button" onClick={() => setCheckoutMode(true)}>Procedi al pagamento <ArrowUpRight size={17} /></button><span className="secure-note">Pagamento demo · nessun addebito reale</span></div>}</> : <form className="checkout-form" onSubmit={submitOrder}><button className="back-link" type="button" onClick={() => setCheckoutMode(false)}><ArrowLeft size={15} /> Torna al carrello</button><p className="checkout-intro">Quasi tuo. Inserisci i tuoi dati per confermare l'ordine demo.</p><label>Nome e cognome<input required autoComplete="name" value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} placeholder="Il tuo nome" /></label><label>Email<input required type="email" autoComplete="email" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} placeholder="nome@email.com" /></label><div className="checkout-total"><span>Totale ordine</span><strong>{money.format(cartTotal)}</strong></div><button className="checkout-button" type="submit">Conferma ordine <Check size={17} /></button><span className="secure-note">Transazione simulata per il progetto finale</span></form>}
      </aside></div>}

      {authOpen && <AuthDialog mode={authMode} setMode={(mode) => { setAuthError(''); setAuthMode(mode) }} onClose={() => setAuthOpen(false)} onSubmit={submitAuth} error={authError} busy={authBusy} googleButtonRef={googleButtonRef} googleConfigured={Boolean(googleClientId)} />}

      {notice && <div className="toast" role="status"><Check size={16} />{notice}<button type="button" onClick={() => setNotice('')} aria-label="Chiudi notifica"><X size={14} /></button></div>}
    </div>
  )
}

export default App
