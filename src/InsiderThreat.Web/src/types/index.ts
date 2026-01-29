// Type definitions matching Server models

export interface User {
    id?: string;
    username: string;
    role: string;
    fullName: string;
    email?: string;
    department?: string;
    passwordHash?: string;
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
