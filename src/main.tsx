import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initStore } from './lib/store'
import './styles/app.css'

// Find out whether a server is behind this page before rendering, so the app
// knows on its first paint whether it is shared or browser-only.
void initStore().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
