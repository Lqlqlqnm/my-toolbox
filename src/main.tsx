import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { ModalProvider } from './components/Modal'
import App from './App'
import './index.css'

// PWA auto-update: detect new SW and reload
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(reg => {
    // Check for updates every 60 seconds
    setInterval(() => reg.update(), 60 * 1000)

    reg.addEventListener('updatefound', () => {
      const newSW = reg.installing
      if (!newSW) return
      newSW.addEventListener('statechange', () => {
        // New SW activated (skipWaiting already configured), reload to get new content
        if (newSW.state === 'activated' && navigator.serviceWorker.controller) {
          window.location.reload()
        }
      })
    })
  })

  // Also handle controller change (when skipWaiting fires)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload()
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <ModalProvider>
        <App />
      </ModalProvider>
    </HashRouter>
  </React.StrictMode>,
)
