import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const cards = [
  { to: '/auto-entry', icon: '📸', label: 'Auto Entry', desc: 'Camera-based vehicle entry with ANPR', color: 'bg-blue-600' },
  { to: '/auto-delete', icon: '🗑️', label: 'Auto Remove', desc: 'Camera-based vehicle removal & receipt', color: 'bg-red-600' },
  { to: '/manual-entry', icon: '🚗', label: 'Manual Entry', desc: 'Add vehicle by registration number', color: 'bg-violet-600' },
  { to: '/slots', icon: '📋', label: 'View Slots', desc: 'Overview of all parking slots', color: 'bg-teal-600' },
  { to: '/report', icon: '📊', label: 'Reports', desc: 'Parking history and fee structure', color: 'bg-amber-600' },
  { to: '/settings', icon: '⚙️', label: 'Settings', desc: 'Manage lot details, slots and fees', color: 'bg-slate-600' },
];

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user?.username}!</h1>
        <p className="text-gray-500 text-sm mt-1">
          Managing: <span className="font-medium text-blue-600">{user?.lot_name}</span>
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {cards.map(card => (
          <Link
            key={card.to}
            to={card.to}
            className="group bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all duration-200 overflow-hidden"
          >
            <div className={`h-2 ${card.color}`}></div>
            <div className="p-6">
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${card.color} text-white text-2xl mb-4 group-hover:scale-110 transition-transform duration-200`}>
                {card.icon}
              </div>
              <h3 className="font-semibold text-gray-900 text-lg mb-1">{card.label}</h3>
              <p className="text-gray-500 text-sm">{card.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
