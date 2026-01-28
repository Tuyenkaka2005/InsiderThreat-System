import { useEffect, useState } from 'react';
import { Card, Spin, Alert, Typography, Space } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import axios from 'axios';
import './App.css';

const { Title, Text } = Typography;

interface HealthResponse {
  status: string;
  message: string;
  database: string;
  databaseMessage: string;
  timestamp: string;
}

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<HealthResponse>('http://localhost:5038/api/health');
      setHealth(response.data);
    } catch (err: any) {
      setError(err.message || 'Không thể kết nối với Server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <Card
        style={{
          width: 500,
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
          borderRadius: 12
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Title level={2} style={{ textAlign: 'center', margin: 0 }}>
            🔐 InsiderThreat System
          </Title>

          {loading && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin size="large" />
              <Text style={{ display: 'block', marginTop: 16 }}>
                Đang kiểm tra kết nối...
              </Text>
            </div>
          )}

          {!loading && error && (
            <Alert
              message="Lỗi kết nối"
              description={error}
              type="error"
              icon={<CloseCircleOutlined />}
              showIcon
            />
          )}

          {!loading && health && health.database === 'disconnected' && (
            <Alert
              message="Hệ thống không sẵn sàng"
              description={
                <Space direction="vertical">
                  <Text>Server: <strong>Đang hoạt động</strong></Text>
                  <Text type="danger">Database: <strong>Mất kết nối</strong></Text>
                  <Text type="secondary">{health.databaseMessage}</Text>
                  <Text type="secondary">{new Date(health.timestamp).toLocaleString('vi-VN')}</Text>
                </Space>
              }
              type="error"
              icon={<CloseCircleOutlined />}
              showIcon
            />
          )}

          {!loading && health && health.database === 'connected' && (
            <Alert
              message="Kết nối thành công!"
              description={
                <Space direction="vertical">
                  <Text>Server: <strong>Đang hoạt động</strong></Text>
                  <Text>Database: <strong style={{ color: '#52c41a' }}>Đã kết nối</strong></Text>
                  <Text type="secondary">{new Date(health.timestamp).toLocaleString('vi-VN')}</Text>
                </Space>
              }
              type="success"
              icon={<CheckCircleOutlined />}
              showIcon
            />
          )}

          <div style={{ textAlign: 'center' }}>
            <button
              onClick={checkHealth}
              style={{
                padding: '10px 30px',
                fontSize: 16,
                cursor: 'pointer',
                background: '#1890ff',
                color: 'white',
                border: 'none',
                borderRadius: 6
              }}
            >
              Kiểm tra lại
            </button>
          </div>
        </Space>
      </Card>
    </div>
  );
}

export default App;
