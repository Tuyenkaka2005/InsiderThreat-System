// Type definitions matching Server models

export interface User {
    id?: string;
    username: string;
    role: string;
    fullName: string;
    email?: string;
    department?: string;
    position?: string;
    bio?: string;
    phoneNumber?: string;
    passwordHash?: string;
    publicKey?: string;
    avatarUrl?: string;
}

export interface LogEntry {
    id?: string;
    logType: string;
    severity: string;
    message: string;
    computerName: string;
    ipAddress: string;
    actionTaken: string;
    deviceId?: string | null;
    deviceName?: string | null;
    timestamp: string;
}

export interface Device {
    id?: string;
    deviceId: string;
    deviceName: string;
    description?: string;
    isAllowed: boolean;
    addedAt?: string;
}

export interface UsbAlert {
    deviceId: string;
    deviceName: string;
    computerName: string;
    ipAddress: string;
    timestamp: string;
    message: string;
}

export interface LoginRequest {
    username: string;
    password: string;
}

export interface LoginResponse {
    token: string;
    user: User;
}

export interface AttendanceLog {
    id: string;
    userId: string;
    userName: string;
    checkInTime: string;
    method: string;
}

export interface MediaFile {
    type: string;
    url: string;
    thumbnailUrl?: string;
    fileName?: string;
    fileSize?: number;
}

export interface Post {
    id: string;
    authorId: string;
    authorName: string;
    authorRole: string;
    authorAvatarUrl?: string;
    content: string;
    mediaFiles: MediaFile[];
    privacy: string;
    likedBy: string[];
    savedBy: string[];
    commentCount: number;
    shareCount: number;
    createdAt: string;
    updatedAt?: string;
}

export interface Comment {
    id: string;
    postId: string;
    authorId: string;
    authorName: string;
    authorAvatarUrl?: string;
    content: string;
    parentCommentId?: string;
    createdAt: string;
}
