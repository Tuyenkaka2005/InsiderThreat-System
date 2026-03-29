import { Card, Avatar, Input, Button, message } from 'antd';
import { UserOutlined, PictureOutlined, VideoCameraOutlined, SmileOutlined, SendOutlined } from '@ant-design/icons';
import { useState } from 'react';
import api from '../../services/api';
import styles from './PostComposer.module.css';

interface PostComposerProps {
    onPostCreated?: (post: any) => void;
}

const PostComposer: React.FC<PostComposerProps> = ({ onPostCreated }) => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(false);

    const handlePost = async () => {
        if (!content.trim()) {
            message.warning('Please write something!');
            return;
        }

        try {
            setLoading(true);
            const newPost = await api.post<any>('/api/posts', {
                content: content.trim(),
                privacy: 'Public'
            });
            setContent('');
            message.success('Posted successfully!');
            if (onPostCreated) {
                onPostCreated(newPost);
            }
        } catch (error: any) {
            console.error('Error creating post:', error);
            message.error(error.response?.data?.message || 'Failed to create post');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className={styles.composer}>
            <div className={styles.input}>
                <Avatar size={40} icon={<UserOutlined />} />
                <Input.TextArea
                    className={styles.textarea}
                    placeholder={`What's on your mind, ${user.fullName || 'User'}?`}
                    variant="borderless"
                    autoSize={{ minRows: 1, maxRows: 6 }}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onPressEnter={(e) => {
                        if (e.shiftKey) return; // Allow new line with Shift+Enter
                        e.preventDefault();
                        handlePost();
                    }}
                />
            </div>

            <div className={styles.divider} />

            <div className={styles.actions}>
                <div className={styles.action}>
                    <PictureOutlined style={{ color: '#45bd62' }} />
                    <span>Photo/Video</span>
                </div>
                <div className={styles.action}>
                    <VideoCameraOutlined style={{ color: '#f3425f' }} />
                    <span>Live Video</span>
                </div>
                <div className={styles.action}>
                    <SmileOutlined style={{ color: '#f7b928' }} />
                    <span>Feeling</span>
                </div>
                <Button
                    type="primary"
                    icon={<SendOutlined />}
                    loading={loading}
                    onClick={handlePost}
                    style={{ marginLeft: 'auto' }}
                >
                    Post
                </Button>
            </div>
        </Card>
    );
};

export default PostComposer;
