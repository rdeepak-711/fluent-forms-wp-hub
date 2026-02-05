import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { login } from './api/auth'

// Dev auto-login - remove when implementing proper auth
const devLogin = async () => {
  if (!localStorage.getItem('access_token')) {
    try {
      const tokens = await login({ username: 'admin@hub.local', password: 'admin@123' })
      localStorage.setItem('access_token', tokens.access_token)
      console.log('Dev auto-login successful')
      window.location.reload()
    } catch (e) {
      console.error('Dev auto-login failed:', e)
    }
  }
}
devLogin()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
