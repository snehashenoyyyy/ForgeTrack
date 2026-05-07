import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/auth/Login';
import Dashboard from './pages/mentor/Dashboard';
import StudentDashboard from './pages/student/StudentDashboard';
import MarkAttendance from './pages/mentor/MarkAttendance';
import History from './pages/mentor/History';
import Materials from './pages/mentor/Materials';
import AttendanceAppeals from './pages/student/AttendanceAppeals';
import ReviewAppeals from './pages/mentor/ReviewAppeals';
import BulkUpload from './pages/mentor/BulkUpload';
import Shell from './components/layout/Shell';

function RoleGuard({ children }) {
  const { user, loading, role } = useAuth();
  
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#07070B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid rgba(99,102,241,0.2)', borderTop: '3px solid #6366F1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ color: '#8A8A94', fontSize: 14, fontFamily: 'system-ui' }}>Loading ForgeTrack...</p>
      </div>
    </div>
  );

  if (!user) return <Navigate to="/login" replace />;
  
  return <Shell>{children}</Shell>;
}

function DashboardSwitcher() {
  const { role } = useAuth();
  return role === 'student' ? <StudentDashboard /> : <Dashboard />;
}

function AppealsSwitcher() {
  const { role } = useAuth();
  return role === 'student' ? <AttendanceAppeals /> : <ReviewAppeals />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          
          {/* Protected Routes */}
          <Route path="/dashboard" element={<RoleGuard><DashboardSwitcher /></RoleGuard>} />
          
          <Route path="/attendance" element={<RoleGuard><MarkAttendance /></RoleGuard>} />
          <Route path="/bulk-upload" element={<RoleGuard><BulkUpload /></RoleGuard>} />
          <Route path="/history" element={<RoleGuard><History /></RoleGuard>} />
          <Route path="/materials" element={<RoleGuard><Materials /></RoleGuard>} />
          <Route path="/appeals" element={<RoleGuard><AppealsSwitcher /></RoleGuard>} />
          
          {/* Default Redirect */}
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
