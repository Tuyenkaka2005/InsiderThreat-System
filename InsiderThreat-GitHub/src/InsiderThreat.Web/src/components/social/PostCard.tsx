import { Card, Avatar, Dropdown, message as antdMessage } from 'antd';
import type { MenuProps } from 'antd';
import {
    UserOutlined,
    MoreOutlined,
    LikeOutlined,
    LikeFilled,
    CommentOutlined,
    ShareAltOutlined,
    GlobalOutlined
} from '@ant-design/icons';
import { useState } from 'react';
import api from '../../services/api';
import styles from './PostCard.module.css';

interface Post {
    id: string;
    authorId: string;
    authorName: string;
    authorRole: string;
    content: string;
    privacy: string;
    likedBy: string[];
    commentCount: number;
    shareCount: number;
    createdAt: string;
}

interface PostCardProps {
    post: Post;
    onPostDeleted?: (postId: string) => void;
    onPostUpdated?: (postId: string, post: Post) => void;
}

const PostCard: React.FC<PostCardProps> = ({ post, onPostDeleted, onPostUpdated }) => {
    const userStr = localStorage.getItem('user');
    const currentUser = userStr ? JSON.parse(userStr) : {};
    const userId = currentUser._id || currentUser.id || '';

    const [liked, setLiked] = useState(post.likedBy?.includes(userId) || false);
    const [likeCount, setLikeCount] = useState(post.likedBy?.length || 0);
    const [loading, setLoading] = useState(false);

    const handleLike = async () => {
        try {
            setLoading(true);
            const result = await api.post<{ liked: boolean; likeCount: number }>(`/api/posts/${post.id}/like`, {});
            setLiked(result.liked);
            setLikeCount(result.likeCount);
        } catch (error: any) {
            console.error('Error liking post:', error);
            antdMessage.error('Failed to like post');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        try {
            await api.delete<void>(`/api/posts/${post.id}`);
            if (onPostDeleted) {
                onPostDeleted(post.id);
            }
        } catch (error: any) {
            console.error('Error deleting post:', error);
            antdMessage.error(error.response?.data?.message || 'Failed to delete post');
        }
    };

    const menuItems: MenuProps['items'] = [
        { key: '1', label: 'Save post' },
        ...(post.authorId === userId || currentUser.role === 'Admin'
            ? [
                { key: '2', label: 'Edit post' },
                { key: '3', label: 'Delete post', onClick: handleDelete, danger: true },
            ]
            : []),
        { key: '4', label: 'Report post' },
    ];

    const getTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    };

    return (
        <Card className={styles.card}>
            {/* Post Header */}
            <div className={styles.header}>
                <div className={styles.userInfo}>
                    <Avatar size={40} icon={<UserOutlined />} />
                    <div className={styles.info}>
                        <div className={styles.name}>{post.authorName}</div>
                        <div className={styles.meta}>
                            <span>{getTimeAgo(post.createdAt)}</span>
                            <span className={styles.dot}>·</span>
                            <GlobalOutlined style={{ fontSize: 12 }} />
                        </div>
                    </div>
                </div>
                <Dropdown menu={{ items: menuItems }} placement="bottomRight" trigger={['click']}>
                    <div className={styles.moreBtn}>
                        <MoreOutlined />
                    </div>
                </Dropdown>
            </div>

            {/* Post Content */}
            <div className={styles.content}>
                {post.content}
            </div>

            {/* Post Stats */}
            <div className={styles.stats}>
                <div className={styles.likes}>
                    {likeCount > 0 && (
                        <>
                            <span className={styles.likeIcon}>👍</span>
                            <span>{likeCount}</span>
                        </>
                    )}
                </div>
                <div className={styles.interactions}>
                    {post.commentCount > 0 && <span>{post.commentCount} comments</span>}
                    {post.shareCount > 0 && <span>{post.shareCount} shares</span>}
                </div>
            </div>

            <div className={styles.divider} />

            {/* Post Actions */}
            <div className={styles.actions}>
                <div
                    className={`${styles.action} ${liked ? styles.liked : ''}`}
                    onClick={handleLike}
                    style={{ pointerEvents: loading ? 'none' : 'auto' }}
                >
                    {liked ? <LikeFilled style={{ color: 'var(--primary-blue)' }} /> : <LikeOutlined />}
                    <span>Like</span>
                </div>
                <div className={styles.action}>
                    <CommentOutlined />
                    <span>Comment</span>
                </div>
                <div className={styles.action}>
                    <ShareAltOutlined />
                    <span>Share</span>
                </div>
            </div>
        </Card>
    );
};

export default PostCard;
