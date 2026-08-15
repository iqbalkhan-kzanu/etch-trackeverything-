import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Landing from './components/Landing'
import Auth from './components/Auth'
import Tracker from './components/Tracker'

export default function App() {
  const [view, setView] = useState('landing')
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    checkSession()
  }, [])

  async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
      if (profile) {
        setUser({ id: session.user.id, name: profile.name, team: profile.team, email: session.user.email })
        setView('app')
      } else {
        setView('auth')
      }
    }
    setChecking(false)
  }

  function handleAuthenticated(u) {
    setUser(u)
    setView('app')
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setUser(null)
    setView('landing')
  }

  if (checking) return null

  if (view === 'landing') return <Landing onEnter={() => setView('auth')} />
  if (view === 'auth') return <Auth onAuthenticated={handleAuthenticated} onBack={() => setView('landing')} />
  return <Tracker user={user} onLogout={handleLogout} />
}  