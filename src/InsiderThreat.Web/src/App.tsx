import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import StaffPage from './pages/StaffPage';
import UsbMonitorPage from './pages/UsbMonitorPage';
import DocumentsPage from './pages/DocumentsPage';
import FaceLoginPage from './pages/FaceLoginPage';
import './App.css';

// Component bảo vệ route - kiểm tra đăng nhập
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

// Redirect dựa trên role
function RoleBasedRedirect() {
  const userStr = localStorage.getItem('user');
  if (userStr) {
    const user = JSON.parse(userStr);
    if (user.role === 'Admin') {
      return <Navigate to="/dashboard" replace />;
    }
    return <Navigate to="/chat" replace />;
  }
  return <Navigate to="/login" replace />;
}

function App() {
  return (
    <ConfigProvider locale={viVN}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/face-login" element={<FaceLoginPage />} />
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <DashboardPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/chat"
            element={
              <PrivateRoute>
                <StaffPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/usb-monitor"
            element={
              <PrivateRoute>
                <UsbMonitorPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/documents"
            element={
              <PrivateRoute>
                <DocumentsPage />
              </PrivateRoute>
            }
          />
          <Route path="/" element={<RoleBasedRedirect />} />
          <Route path="*" element={<RoleBasedRedirect />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
