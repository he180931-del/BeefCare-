import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, useLocation } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './features/authentication'
import { AuthGate } from './features/authorization'
import { StoreProvider } from './data/store'
import { FixtureSessionProvider } from './app/fixtureSession'
import { isDevelopmentReviewRoute, isPublicAccountRoute } from './app/reviewMode'
import ScreenReviewBar from './components/ScreenReviewBar'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')
function AppProviders() {
  const location = useLocation()
  const reviewRoute = isDevelopmentReviewRoute(location.pathname, import.meta.env.DEV)
  const publicRoute = isPublicAccountRoute(location.pathname)
  return reviewRoute || publicRoute ? (
    <FixtureSessionProvider>
      <App />
      <ScreenReviewBar />
    </FixtureSessionProvider>
  ) : (
    <StoreProvider>
      <FixtureSessionProvider>
        <AuthProvider><AuthGate><App /></AuthGate></AuthProvider>
        <ScreenReviewBar />
      </FixtureSessionProvider>
    </StoreProvider>
  )
}
ReactDOM.createRoot(root).render(
  <BrowserRouter>
    <AppProviders />
  </BrowserRouter>,
)
