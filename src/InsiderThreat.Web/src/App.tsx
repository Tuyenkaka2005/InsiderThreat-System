import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme, App as AntdApp } from 'antd';
import viVN from 'antd/locale/vi_VN';
import enUS from 'antd/locale/en_US';
import { useTranslation } from 'react-i18next';
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
import GroupDetailPage from './pages/GroupDetailPage';
import InboxPage from './pages/InboxPage';
import LibraryPage from './pages/LibraryPage';
import SocialAttendancePage from './pages/SocialAttendancePage';
import MeetPage from './pages/MeetPage';
import MonitorLogsPage from './pages/MonitorLogsPage';
import SecurityApprovalsPage from './pages/SecurityApprovalsPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import { NotificationProvider } from './contexts/NotificationContext';
import NotificationToast from './components/NotificationToast';
import { ChatWidget } from './components/ChatWidget';
import { useTheme } from './context/ThemeContext';
import { loadFaceApiModels } from './services/faceApi';
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
  const { theme: currentTheme } = useTheme();
  const { i18n } = useTranslation();
  const isDarkMode = currentTheme === 'dark';

  useEffect(() => {
    // Tải trước AI ngầm
    loadFaceApiModels().catch(err => console.error('[App] Failed to pre-load Face models:', err));

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
    <ConfigProvider 
      locale={i18n.language === 'en' ? enUS : viVN}
      theme={{
        algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#2563eb', // Maintain primary color
        }
      }}
    >
      <AntdApp>
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
              <Route path="/groups/:id" element={<PrivateRoute><GroupDetailPage /></PrivateRoute>} />
              <Route path="/projects" element={<PrivateRoute><ProjectsPage /></PrivateRoute>} />
              <Route path="/projects/:id" element={<PrivateRoute><ProjectDetailPage /></PrivateRoute>} />
              <Route path="/inbox" element={<PrivateRoute><InboxPage /></PrivateRoute>} />
              <Route path="/library" element={<PrivateRoute><LibraryPage /></PrivateRoute>} />
              <Route path="/attendance" element={<PrivateRoute><SocialAttendancePage /></PrivateRoute>} />
              <Route path="/meet" element={<PrivateRoute><MeetPage /></PrivateRoute>} />
              <Route path="/monitor-logs" element={<PrivateRoute><MonitorLogsPage /></PrivateRoute>} />
              <Route path="/security-approvals" element={<PrivateRoute><SecurityApprovalsPage /></PrivateRoute>} />
              <Route path="/" element={<RoleBasedRedirect />} />
              <Route path="*" element={<RoleBasedRedirect />} />
            </Routes>
            {/* Global components */}
            <NotificationToast />
            {isLoggedIn && <ChatWidget />}
          </NotificationProvider>
        </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  );
}

export default App;
