import { api } from './api';
import type { Post, Comment, MediaFile } from '../types';

export const feedService = {
    getPosts: async (page = 1, limit = 10) => {
        return api.get<{ posts: Post[]; pagination: any }>(`/api/SocialFeed/posts?page=${page}&limit=${limit}`);
    },

    uploadFile: async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post<{ url: string; fileName: string; size: number; type: string }>('/api/Upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },

    getUserPosts: async (userId: string) => {
        return api.get<Post[]>(`/api/SocialFeed/users/${userId}/posts`);
    },

    updatePost: async (postId: string, content: string) => {
        return api.put<{ message: string }>(`/api/SocialFeed/posts/${postId}`, { content });
    },

    createPost: async (content: string, privacy = 'Public', mediaFiles: MediaFile[] = []) => {
        return api.post<Post>('/api/SocialFeed/posts', { content, privacy, mediaFiles });
    },

    likePost: async (postId: string) => {
        return api.post<{ liked: boolean; likeCount: number }>(`/api/SocialFeed/posts/${postId}/like`);
    },

    savePost: async (postId: string) => {
        return api.post<{ saved: boolean }>(`/api/SocialFeed/posts/${postId}/save`);
    },

    getComments: async (postId: string) => {
        return api.get<Comment[]>(`/api/SocialFeed/posts/${postId}/comments`);
    },

    addComment: async (postId: string, content: string, parentCommentId?: string) => {
        return api.post<Comment>(`/api/SocialFeed/posts/${postId}/comments`, { content, parentCommentId });
    },

    deletePost: async (postId: string) => {
        return api.delete(`/api/SocialFeed/posts/${postId}`);
    }
};
