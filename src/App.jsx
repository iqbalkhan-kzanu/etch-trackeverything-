import { useEffect, useState } from 'react'
import Landing from './components/Landing'
import Login from './components/Login'
import Tracker from './components/Tracker'

export default function App() {
  const [view, setView] = useState('landing') // 'landing' | 'login' | 'app'
  const [user, setUser] = useState(null)

  useEffect(() => {
    const saved = localStorage.getItem('action_tracker_user')
    if (saved) {
      setUser(JSON.parse(saved))
      setView('app')
    }
  }, [])

  function handleLogin(userInfo) {
    localStorage.setItem('action_tracker_user', JSON.stringify(userInfo))
    setUser(userInfo)
    setView('app')
  }

  function handleLogout() {
    localStorage.removeItem('action_tracker_user')
    setUser(null)
    setView('landing')
  }

  if (view === 'landing') return <Landing onEnter={() => setView('login')} />
  if (view === 'login') return <Login onLogin={handleLogin} onBack={() => setView('landing')} />
  return <Tracker user={user} onLogout={handleLogout} />
}       