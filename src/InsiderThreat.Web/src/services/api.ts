import axios from 'axios';

// API Base URL - Server chạy ở localhost:5038
const API_BASE_URL = 'http://127.0.0.1:5038';

// Tạo axios instance
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor: Tự động gắn JWT token vào mọi request
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Interceptor: Xử lý lỗi response
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Chỉ redirect nếu KHÔNG PHẢI đang ở trang login hoặc forgot-password
            const currentPath = window.location.pathname;
            const isAuthPage = currentPath === '/login' ||
                currentPath === '/face-login' ||
                currentPath === '/forgot-password';

            if (!isAuthPage) {
                // Unauthorized - xóa token và redirect về login
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

// Export API methods
export const api = {
    get: <T>(url: string) => apiClient.get<T>(url).then((res) => res.data),
    post: <T>(url: string, data?: any) => apiClient.post<T>(url, data).then((res) => res.data),
    put: <T>(url: string, data?: any) => apiClient.put<T>(url, data).then((res) => res.data),
    delete: <T>(url: string) => apiClient.delete<T>(url).then((res) => res.data),
};

export default api;
