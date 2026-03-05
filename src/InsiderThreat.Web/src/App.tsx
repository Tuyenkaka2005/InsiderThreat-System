import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UsbMonitorPage from './pages/UsbMonitorPage';
import DocumentsPage from './pages/DocumentsPage';
import FaceLoginPage from './pages/FaceLoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import FeedPage from './pages/FeedPage';
import ChatPage from './pages/ChatPage';
import ProfilePage from './pages/ProfilePage';
import StaffPage from './pages/StaffPage';
import GroupsPage from './pages/GroupsPage';
import LibraryPage from './pages/LibraryPage';
import { NotificationProvider } from './contexts/NotificationContext';
import NotificationToast from './components/NotificationToast';
import { ChatWidget } from './components/ChatWidget';
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
    return <Navigate to="/feed" replace />;
  }
  return <Navigate to="/login" replace />;
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('token'));

  useEffect(() => {
    const handleStorageChange = () => {
      setIsLoggedIn(!!localStorage.getItem('token'));
    };
    window.addEventListener('storage', handleStorageChange);
    // Tự động kiểm tra token mỗi giây để UI phản ứng nhanh khi login/logout
    const interval = setInterval(handleStorageChange, 1000);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  return (
    <ConfigProvider locale={viVN}>
      <BrowserRouter>
        <NotificationProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/face-login" element={<FaceLoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
            <Route path="/chat" element={<PrivateRoute><ChatPage /></PrivateRoute>} />
            <Route path="/usb-monitor" element={<PrivateRoute><UsbMonitorPage /></PrivateRoute>} />
            <Route path="/documents" element={<PrivateRoute><DocumentsPage /></PrivateRoute>} />
            <Route path="/profile/:userId" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
            <Route path="/feed" element={<PrivateRoute><FeedPage /></PrivateRoute>} />
            <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
            <Route path="/staff" element={<PrivateRoute><StaffPage /></PrivateRoute>} />
            <Route path="/groups" element={<PrivateRoute><GroupsPage /></PrivateRoute>} />
            <Route path="/library" element={<PrivateRoute><LibraryPage /></PrivateRoute>} />
            <Route path="/" element={<RoleBasedRedirect />} />
            <Route path="*" element={<RoleBasedRedirect />} />
          </Routes>
          {/* Global components */}
          <NotificationToast />
          {isLoggedIn && <ChatWidget />}
        </NotificationProvider>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
