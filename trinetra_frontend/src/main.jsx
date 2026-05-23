import ReactDOM from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import App from './App.jsx'
import './index.css'

// Loaded from trinetra_frontend/.env (VITE_GOOGLE_CLIENT_ID)
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

// NOTE: React.StrictMode is intentionally omitted here because it causes
// GoogleOAuthProvider to mount twice in dev mode, triggering the GSI
// "google.accounts.id.initialize() is called multiple times" warning.
ReactDOM.createRoot(document.getElementById('root')).render(
  <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
    <App />
  </GoogleOAuthProvider>
)

