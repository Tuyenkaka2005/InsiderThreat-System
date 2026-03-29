import { Avatar, Badge } from 'antd';
import { UserOutlined, MoreOutlined, SearchOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import api from '../../services/api';
import styles from './RightSidebar.module.css';

interface User {
    id: string;
    username: string;
    fullName: string;
    role: string;
    department: string;
}

const RightSidebar = () => {
    const [contacts, setContacts] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    const userStr = localStorage.getItem('user');
    const currentUser = userStr ? JSON.parse(userStr) : {};
    const currentUserId = currentUser._id || currentUser.id || '';

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const users = await api.get<User[]>('/api/users');
            // Filter out current user and limit to 10 contacts
            const filteredUsers = users
                .filter((u: User) => u.id !== currentUserId)
                .slice(0, 10);
            setContacts(filteredUsers);
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.sidebar}>
            <div className={styles.header}>
                <h3 className={styles.title}>Contacts</h3>
                <div className={styles.actions}>
                    <div className={styles.iconBtn}>
                        <SearchOutlined />
                    </div>
                    <div className={styles.iconBtn}>
                        <MoreOutlined />
                    </div>
                </div>
            </div>

            <div className={styles.contactList}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                        Loading...
                    </div>
                ) : contacts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                        No contacts found
                    </div>
                ) : (
                    contacts.map((contact) => (
                        <div key={contact.id} className={styles.contact}>
                            <Badge dot status="default" offset={[-5, 32]}>
                                <Avatar size={36} icon={<UserOutlined />} />
                            </Badge>
                            <div className={styles.contactInfo}>
                                <span className={styles.name}>{contact.fullName}</span>
                                {contact.department && (
                                    <span className={styles.department}>{contact.department}</span>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default RightSidebar;
