import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './app/App.jsx'
import { MockModeProvider } from './shared/store/mockModeContext.jsx'
import { UserProvider } from './shared/store/userContext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <UserProvider>
      <MockModeProvider>
        <App />
      </MockModeProvider>
    </UserProvider>
  </React.StrictMode>
)
