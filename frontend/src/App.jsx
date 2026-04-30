import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/auth/Login';
import Dashboard from './pages/mentor/Dashboard';
import MarkAttendance from './pages/mentor/MarkAttendance';
import History from './pages/mentor/History';
import Materials from './pages/mentor/Materials';
import Shell from './components/layout/Shell';

function RoleGuard({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) return null; // Or a spinner
  if (!user) return <Navigate to="/login" replace />;
  
  return <Shell>{children}</Shell>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          
          {/* Protected Mentor Routes */}
          <Route path="/dashboard" element={<RoleGuard><Dashboard /></RoleGuard>} />
          <Route path="/attendance" element={<RoleGuard><MarkAttendance /></RoleGuard>} />
          <Route path="/history" element={<RoleGuard><History /></RoleGuard>} />
          <Route path="/materials" element={<RoleGuard><Materials /></RoleGuard>} />
          
          {/* Default Redirect */}
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
