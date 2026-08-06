import { NavLink } from 'react-router-dom'
import { Flame, MapPinned, MessageCircle, User } from 'lucide-react'

const tabs = [
  { to: '/', label: 'Feed', icon: Flame, end: true },
  { to: '/map', label: 'Nearby', icon: MapPinned, end: false },
  { to: '/messages', label: 'Inbox', icon: MessageCircle, end: false },
  { to: '/profile', label: 'You', icon: User, end: false },
] as const

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Main">
      {tabs.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `bottom-nav__item ${isActive ? 'is-active' : ''}`}
        >
          <Icon size={22} strokeWidth={1.8} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
