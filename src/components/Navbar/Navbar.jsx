export default function Navbar() {
    return (
        <>
            <a className="wordmark" href="#home" onClick={() => setView('shop')} aria-label="Offform, home"><span className="wordmark-symbol">o</span>ffform<span className="wordmark-period">.</span></a>
            <nav className="main-nav" aria-label="Navigazione principale">
                <button className={view === 'shop' ? 'nav-link active' : 'nav-link'} type="button" onClick={() => setView('shop')}><Store size={15} /> Negozio</button>
                {authUser?.role === 'admin' && <button className={view === 'admin' ? 'nav-link active' : 'nav-link'} type="button" onClick={() => setView('admin')}><LayoutDashboard size={15} /> Pannello</button>}
            </nav>
            <div className="header-actions">
                <span className={`connection-status ${database}`}><i />{database === 'connected' ? 'Connesso' : database === 'offline' ? 'Non attivo' : 'Verifica...'}</span>
                {authUser ? <><button className="account-trigger" type="button" title={authUser.email}><CircleUserRound size={17} /><span>{authUser.name.split(' ')[0]}</span></button><button className="logout-trigger" type="button" onClick={logout} aria-label="Esci dall'account" title="Esci"><LogOut size={17} /></button></> : <button className="login-trigger" type="button" onClick={() => { setAuthError(''); setAuthMode('login'); setAuthOpen(true) }}><CircleUserRound size={17} /><span>Accedi</span></button>}
                <button className="cart-trigger" type="button" onClick={() => { setCartOpen(true); setCheckoutMode(false) }} aria-label={`Apri carrello, ${cartCount} articoli`}><ShoppingBag size={18} strokeWidth={1.8} /><span>Carrello</span><b>{cartCount}</b></button>
            </div>
        </>
    )
}