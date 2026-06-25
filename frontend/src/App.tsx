import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppLayout } from './components/Layout/AppLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AutoEntry from './pages/AutoEntry';
import AutoDelete from './pages/AutoDelete';
import ManualEntry from './pages/ManualEntry';
import ViewSlots from './pages/ViewSlots';
import Report from './pages/Report';
import Settings from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected – AppLayout guards auth */}
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"    element={<Dashboard />} />
            <Route path="/auto-entry"   element={<AutoEntry />} />
            <Route path="/auto-delete"  element={<AutoDelete />} />
            <Route path="/manual-entry" element={<ManualEntry />} />
            <Route path="/slots"        element={<ViewSlots />} />
            <Route path="/report"       element={<Report />} />
            <Route path="/settings"     element={<Settings />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}