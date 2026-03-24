import { useState, useEffect } from 'react';
import { userService } from '../../services/userService';
import { authService } from '../../services/auth';
import { API_BASE_URL } from '../../services/api';
import { useTranslation } from 'react-i18next';
import type { User } from '../../types';
import styles from './ChatSidebar.module.css';

interface ChatSidebarProps {
    onContactClick: (user: User) => void;
}

export default function ChatSidebar({ onContactClick }: ChatSidebarProps) {
    const currentUser = authService.getCurrentUser();
    const { t } = useTranslation();
    const [contacts, setContacts] = useState<User[]>([]);
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        const fetchContacts = async () => {
            try {
                const users = await userService.getAllUsers();
                setContacts(users.filter(u => u.username !== currentUser?.username));
            } catch (error) {
                console.error('Failed to fetch contacts', error);
            }
        };
        fetchContacts();
    }, [currentUser]);

    const getAvatarUrl = (user: User) => {
        if (!user.avatarUrl) return '';
        if (user.avatarUrl.startsWith('http')) return user.avatarUrl;
        return `${API_BASE_URL}${user.avatarUrl}`;
    };

    function getInitials(name: string) {
        return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
    }

    const COLORS = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#0891b2', '#d97706'];
    const getColor = (name: string) => {
        let h = 0; for (const c of name) h = (h + c.charCodeAt(0)) % COLORS.length;
        return COLORS[h];
    };

    const getRoleClass = (roleOrPosition?: string) => {
        if (!roleOrPosition) return styles.roleStaff;
        const r = roleOrPosition.toLowerCase();
        if (r.includes('admin')) return styles.roleAdmin;
        if (r.includes('quản lý') || r.includes('manager') || r.includes('trưởng phòng') || r.includes('phó phòng')) return styles.roleManager;
        if (r.includes('giám đốc') || r.includes('director')) return styles.roleDirector;
        return styles.roleStaff;
    };

    if (collapsed) {
        return (
            <aside className={styles.chatSidebarCollapsed}>
                <button
                    className={styles.collapseBtn}
                    onClick={() => setCollapsed(false)}
                    title={t('chat_sidebar.suggestions_tooltip', 'Gợi ý liên hệ')}
                >
                    <span className="material-symbols-outlined">people</span>
                </button>
            </aside>
        );
    }

    return (
        <aside className={styles.chatSidebar}>
            <div className={styles.sidebarHeader}>
                <span className={styles.sidebarTitle}>{t('chat_sidebar.suggestions_title', 'GỢI Ý LIÊN HỆ')}</span>
                <button className={styles.collapseBtn} onClick={() => setCollapsed(true)} title={t('chat_sidebar.collapse', 'Thu gọn')}>
                    <span className="material-symbols-outlined">chevron_right</span>
                </button>
            </div>
            <div className={styles.contactsList}>
                {contacts.map(contact => {
                    const url = getAvatarUrl(contact);
                    const name = contact.fullName || contact.username || 'User';
                    // Randomly simulate online/offline
                    const isOnline = contact.username ? (contact.username.charCodeAt(0) % 3 !== 0) : true;
                    return (
                        <div
                            key={contact.id || contact.username}
                            className={`${styles.contactItem} dark:hover:bg-darkCard group`}
                            onClick={() => onContactClick(contact)}
                        >
                            <div
                                className={styles.contactAvatar}
                                style={url
                                    ? { backgroundImage: `url(${url})`, backgroundColor: 'transparent' }
                                    : { background: getColor(name) }
                                }
                            >
                                {!url && <span className={styles.initials}>{getInitials(name)}</span>}
                                <div className={`${styles.statusDot} ${isOnline ? styles.online : styles.offline} dark:border-[#1e1e1e] group-hover:dark:border-[#2d2d2d]`} />
                            </div>
                            <div className={styles.contactInfo}>
                                <div className={styles.nameRow}>
                                    <div className={`${styles.contactName} dark:text-slate-200`}>{name}</div>
                                    {(contact.position || contact.role) && (
                                        <span className={`${styles.roleBadge} ${getRoleClass(contact.position || contact.role)}`}>
                                            {contact.position || contact.role}
                                        </span>
                                    )}
                                </div>
                                <div className={`${styles.statusLabel} ${isOnline ? styles.onlineLabel : styles.offlineLabel} dark:text-slate-400`}>
                                    {isOnline ? t('chat_sidebar.online', 'Đang online') : t('chat_sidebar.offline', 'Ngoại tuyến')}
                                </div>
                            </div>
                            <button className="material-symbols-outlined ml-auto text-slate-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity dark:text-slate-600 dark:hover:text-blue-400" title={t('chat_sidebar.add_friend', 'Kết bạn')}>
                                person_add
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Trending Topics (Mới Thêm Do Dark Mode Image) */}
            <div className="px-3 py-2 mt-2 border-t border-slate-100 dark:border-darkBorder">
                <div className="text-[10px] font-extrabold tracking-widest text-slate-400 dark:text-slate-500 uppercase mb-2">
                    {t('chat_sidebar.trending', 'Xu hướng')}
                </div>
                <div className="flex flex-col gap-2">
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-500 cursor-pointer transition-colors">
                        #MIDNIGHTCURATOR
                        <div className="text-xs font-normal text-slate-400 mt-0.5">2.4k {t('chat_sidebar.posts_count', 'bài viết')}</div>
                    </div>
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-500 cursor-pointer transition-colors">
                        #UIUXDESIGN
                        <div className="text-xs font-normal text-slate-400 mt-0.5">1.2k {t('chat_sidebar.posts_count', 'bài viết')}</div>
                    </div>
                </div>
            </div>

            {/* Feature Buttons (Mới Thêm) */}
            <div className="px-3 pb-4 pt-2 flex flex-col gap-2">
                <button className="flex items-center gap-2 w-full px-3 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-bold shadow-md shadow-orange-500/20 transition-all active:scale-[0.98]">
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>star</span>
                    {t('chat_sidebar.top_fans', 'Top Fans')}
                </button>
                <button className="flex items-center gap-2 w-full px-3 py-2.5 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white rounded-xl font-bold shadow-md shadow-pink-500/20 transition-all active:scale-[0.98]">
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>local_fire_department</span>
                    {t('chat_sidebar.hot_events', 'Hot Events')}
                </button>
            </div>
        </aside>
    );
}
