import { useEffect, useState } from 'react';
import { useNotifications } from '../contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';
import type { Notification } from '../services/notificationService';

const ICONS: Record<string, string> = {
    Like: '❤️', Comment: '💬', Mention: '@', Report: '🚨',
    Global: '📢', Message: '✉️', NewPost: '📝',
};

const COLORS: Record<string, string> = {
    Like: 'border-l-rose-400', Comment: 'border-l-blue-400', Mention: 'border-l-purple-400',
    Global: 'border-l-amber-400', Message: 'border-l-green-400', NewPost: 'border-l-indigo-400',
    Report: 'border-l-red-500',
};

export default function NotificationToast() {
    const { toastQueue, dismissToast } = useNotifications();
    const navigate = useNavigate();

    return (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
            {toastQueue.map(notification => (
                <ToastItem
                    key={notification.id}
                    notification={notification}
                    onDismiss={() => dismissToast(notification.id)}
                    onNavigate={() => {
                        if (notification.link) navigate(notification.link);
                        dismissToast(notification.id);
                    }}
                />
            ))}
        </div>
    );
}

function ToastItem({ notification, onDismiss, onNavigate }: {
    notification: Notification;
    onDismiss: () => void;
    onNavigate: () => void;
}) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Slide in
        requestAnimationFrame(() => setVisible(true));

        // Auto dismiss after 5s
        const timer = setTimeout(() => {
            setVisible(false);
            setTimeout(onDismiss, 300); // wait for slide-out
        }, 5000);

        return () => clearTimeout(timer);
    }, []);

    const icon = ICONS[notification.type] || '🔔';
    const colorClass = COLORS[notification.type] || 'border-l-slate-400';

    return (
        <div
            className={`pointer-events-auto flex items-start gap-3 w-80 bg-white border border-slate-200 border-l-4 ${colorClass} 
                rounded-xl shadow-2xl px-4 py-3 cursor-pointer
                transition-all duration-300 ease-out
                ${visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}
            onClick={onNavigate}
        >
            {/* Icon */}
            <div className="flex-shrink-0 text-2xl leading-none mt-0.5">{icon}</div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                {notification.actorName && (
                    <p className="text-xs font-semibold text-slate-600 mb-0.5">{notification.actorName}</p>
                )}
                <p className="text-sm text-slate-800 leading-snug line-clamp-2">{notification.message}</p>
                <p className="text-xs text-slate-400 mt-1">Vừa xong</p>
            </div>

            {/* Close */}
            <button
                onClick={e => { e.stopPropagation(); setVisible(false); setTimeout(onDismiss, 300); }}
                className="flex-shrink-0 text-slate-300 hover:text-slate-500 transition-colors text-lg leading-none"
            >
                ×
            </button>
        </div>
    );
}
