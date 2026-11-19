import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './features/authentication'
import { AuthGate, SessionProvider } from './features/authorization'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')
ReactDOM.createRoot(root).render(
  <BrowserRouter>
    <AuthProvider><AuthGate><SessionProvider><App /></SessionProvider></AuthGate></AuthProvider>
  </BrowserRouter>,
)
