import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './features/authentication'
import { AuthGate } from './features/authorization'
import { StoreProvider } from './data/store'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')
ReactDOM.createRoot(root).render(
  <BrowserRouter>
    <StoreProvider>
      <AuthProvider><AuthGate><App /></AuthGate></AuthProvider>
    </StoreProvider>
  </BrowserRouter>,
)
