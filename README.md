# Offform

Capstone full stack per la gestione di un piccolo e-commerce. L'interfaccia React comunica con un'API REST Express, che salva catalogo, ordini e disponibilità in MongoDB tramite Mongoose.

## Avvio locale

Prerequisiti: Node.js e MongoDB in esecuzione in locale.

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

L'app si apre su `http://localhost:5173`; l'API è disponibile su `http://localhost:4000/api`. Se necessario, modifica `MONGO_URI` nel file `.env`. Il primo avvio inserisce otto prodotti di esempio quando il catalogo è vuoto.

### Accesso e notifiche

- Imposta `ADMIN_EMAIL` con l'indirizzo che deve poter accedere al pannello.
- Per Google OAuth crea un ID client OAuth di tipo applicazione web. Aggiungi `http://localhost:5173` tra le origini JavaScript autorizzate e copia lo stesso ID in `GOOGLE_CLIENT_ID` e `VITE_GOOGLE_CLIENT_ID`.
- Per le notifiche Gmail attiva la verifica in due passaggi sull'account mittente, crea una password per le app e imposta `GMAIL_USER`, `GMAIL_APP_PASSWORD` e `NOTIFY_EMAIL`.
- `JWT_SECRET` deve essere una stringa casuale lunga; in produzione è obbligatoria.

Il server invia notifiche Gmail per nuove registrazioni, accessi riusciti e nuovi ordini. Senza le relative variabili, registrazione e acquisti continuano a funzionare ma le email non vengono inviate.

## Funzionalità

- Catalogo filtrabile per categoria e ricercabile per nome.
- Carrello con quantità e totale, conservato nel browser.
- Registrazione e accesso con email/password o Google.
- Checkout dimostrativo: crea ordini nel database e aggiorna le scorte, senza addebiti reali.
- Pannello amministrativo con metriche, ordini recenti e modifica delle disponibilità.
- Stato della connessione MongoDB visibile nell'intestazione.

## API

- `GET /api/health`: stato dell'API e della connessione al database.
- `GET /api/products`: catalogo, con filtri facoltativi `category` e `search`.
- `POST /api/orders`: crea un ordine e riserva le disponibilità.
- `GET /api/admin/summary`: metriche e ordini recenti.
- `GET /api/admin/products`: inventario.
- `PATCH /api/admin/products/:id/stock`: aggiorna le scorte.

Le route amministrative richiedono una sessione e il ruolo assegnato all'indirizzo `ADMIN_EMAIL`; i tentativi di autenticazione sono limitati. Prima di esporre il progetto online, aggiungi verifica email e recupero password e integra un fornitore di pagamento reale.

## Controlli

```powershell
npm run lint
npm run build
```
