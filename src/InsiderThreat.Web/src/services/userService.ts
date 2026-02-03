import { api } from './api';
import type { User } from '../types';

export const userService = {
    // Get all users
    async getAllUsers(): Promise<User[]> {
        const response = await api.get<User[]>('/api/users');
        return response;
    },

    // Update user profile
    async updateUser(id: string, userData: Partial<User>): Promise<void> {
        await api.put(`/api/users/${id}`, userData);
    },

    // Get activity logs
    async getActivityLogs(userId: string): Promise<any[]> {
        const response = await api.get<any[]>(`/api/users/${userId}/logs`);
        return response;
    }
};
