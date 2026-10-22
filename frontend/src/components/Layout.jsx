import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Icon from './Icon.jsx'

const TABS = [
  { to: '/', icon: 'home', label: 'Home' },
  { to: '/weeks', icon: 'baby', label: 'Baby' },
  { to: '/health', icon: 'heart', label: 'Health' },
  { to: '/visits', icon: 'calendar', label: 'Visits' },
  { to: '/profile', icon: 'user', label: 'Me' },
]

export default function Layout() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="app">
      <main className="content">
        <Outlet />
      </main>
      <nav className="tabbar">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'} className="tab">
            <span className="tab-icon">
              <Icon name={t.icon} size={22} />
            </span>
            <span className="tab-label">{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
