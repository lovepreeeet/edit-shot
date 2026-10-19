import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import Icon from './Icon.jsx'

export default function Layout() {
  // Pages can render header controls into this slot via a portal.
  const [headerSlot, setHeaderSlot] = useState(null)

  return (
    <div className="app">
      <header className="app-header">
        <NavLink to="/" className="brand">
          <Icon name="image" size={20} />
          <span>Snapboard</span>
        </NavLink>
        <div ref={setHeaderSlot} className="header-slot" />
        <nav className="nav">
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/about">Shortcuts</NavLink>
        </nav>
      </header>
      <main className="app-main">
        <Outlet context={{ headerSlot }} />
      </main>
    </div>
  )
}
