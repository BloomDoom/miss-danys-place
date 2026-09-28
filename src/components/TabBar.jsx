import { NavLink } from 'react-router-dom'

// Simple line icons (from the Lucide icon set), drawn inline so we
// don't need an icon library.
const icons = {
  today: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  payments: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2" /><path d="M6 12h.01M18 12h.01" /></>,
  students: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  groups: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
}

const tabs = [
  { to: '/', label: 'Today', icon: 'today' },
  { to: '/payments', label: 'Payments', icon: 'payments' },
  { to: '/students', label: 'Students', icon: 'students' },
  { to: '/groups', label: 'Groups', icon: 'groups' },
]

export default function TabBar() {
  return (
    <nav className="tab-bar">
      {tabs.map((tab) => (
        // "end" makes "/" only active on the Today screen itself.
        <NavLink key={tab.to} to={tab.to} end={tab.to === '/'} className="tab">
          <svg viewBox="0 0 24 24" aria-hidden="true">{icons[tab.icon]}</svg>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
