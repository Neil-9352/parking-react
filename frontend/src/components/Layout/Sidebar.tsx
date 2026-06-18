import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { to: '/dashboard', icon: '🏠', label: 'Dashboard' },
  { to: '/auto-entry', icon: '📸', label: 'Auto Entry' },
  { to: '/auto-delete', icon: '🗑️', label: 'Auto Remove' },
  { to: '/manual-entry', icon: '🚗', label: 'Manual Entry' },
  { to: '/slots', icon: '📋', label: 'View Slots' },
  { to: '/report', icon: '📊', label: 'Reports' },
  { to: '/settings', icon: '⚙️', label: 'Settings' },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <aside className="flex flex-col h-full w-full bg-slate-900 text-white">
      {/* Brand */}
      <div className="px-5 py-6 border-b border-slate-700">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">🅿️</span>
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Admin Panel</p>
            <p className="text-sm font-semibold text-white leading-tight truncate max-w-[140px]">
              {user?.lot_name || 'Parking Lot'}
            </p>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-2 truncate">👤 {user?.username}</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors duration-150 ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <span className="text-lg w-6 text-center">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-slate-700">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-red-600 hover:text-white rounded-lg transition-colors duration-150"
        >
          <span className="text-lg">🚪</span>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
