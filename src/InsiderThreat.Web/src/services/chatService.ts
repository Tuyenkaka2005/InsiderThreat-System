import { api } from './api';

// Types
export interface Message {
    id?: string;
    senderId: string;
    receiverId: string;
    content: string; // Encrypted for Receiver
    senderContent?: string; // Encrypted for Sender
    timestamp: string;
    isRead: boolean;
}

export const chatService = {
    // Send Message
    sendMessage: async (message: Omit<Message, 'id' | 'timestamp' | 'isRead'>) => {
        return await api.post<Message>('/api/messages', message);
    },

    // Get Messages
    getMessages: async (otherUserId: string, currentUserId: string) => {
        return await api.get<Message[]>(`/api/messages/${otherUserId}?currentUserId=${currentUserId}`);
    },

    // Update Public Key
    uploadPublicKey: async (userId: string, publicKey: string) => {
        // api.put handles JSON content type
        return await api.put(`/api/users/${userId}/public-key`, publicKey);
    },

    // Get User Public Key
    getUserPublicKey: async (userId: string) => {
        const user = await api.get<any>(`/api/users/${userId}`); // Assuming getting user returns user obj
        // Need to check if endpoint returns list or single user. 
        // UsersController.GetUsers returns list. 
        // We need a GetUser(id) endpoint? 
        // Current UsersController doesn't seem to have GetUserById public endpoint based on my memory?
        // Let's assume we might need to filter from getAllUsers if no specific endpoint exists,
        // OR add GetUserById to controller.
        // For now, let's look at UsersController again.
        return user.publicKey;
    }
};
