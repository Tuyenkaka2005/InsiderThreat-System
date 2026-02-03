import { useState, useRef, useEffect } from 'react';
import { feedService } from '../services/feedService';
import type { Post, Comment, User } from '../types';

interface PostCardProps {
    post: Post;
    currentUser: User | null;
    onPostUpdated: (updatedPost: Post) => void;
    onPostDeleted: (postId: string) => void;
}

const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.round(diffMs / 60000);
    const diffHrs = Math.round(diffMs / 3600000);
    const diffDays = Math.round(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
};

export default function PostCard({ post, currentUser, onPostUpdated, onPostDeleted }: PostCardProps) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(post.content);
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isLikeAnimating, setIsLikeAnimating] = useState(false);
    const [localPost, setLocalPost] = useState(post);

    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setLocalPost(post);
    }, [post]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getAvatarUrl = (userOrUrl?: any) => {
        if (!userOrUrl) return `https://i.pravatar.cc/150?u=user`;
        const url = typeof userOrUrl === 'string' ? userOrUrl : userOrUrl.authorAvatarUrl || userOrUrl.avatarUrl;
        if (!url) return `https://i.pravatar.cc/150?u=${localPost.authorName}`;
        if (url.startsWith('http')) return url;
        return `http://127.0.0.1:5038${url}`;
    };

    const handleLike = async () => {
        setIsLikeAnimating(true);
        setTimeout(() => setIsLikeAnimating(false), 500);
        try {
            const result = await feedService.likePost(localPost.id);
            const isLiked = result.liked;
            let newLikedBy = [...localPost.likedBy];
            if (isLiked && !newLikedBy.includes(currentUser?.id || '')) {
                newLikedBy.push(currentUser?.id || '');
            } else if (!isLiked) {
                newLikedBy = newLikedBy.filter(id => id !== currentUser?.id);
            }
            const updated = { ...localPost, likedBy: newLikedBy };
            setLocalPost(updated);
            onPostUpdated(updated); // Notify parent (encapsulation choice: sync or not? mostly yes)
        } catch (error) {
            console.error("Like failed", error);
        }
    };

    const handleSave = async () => {
        try {
            const result = await feedService.savePost(localPost.id);
            const isSaved = result.saved;
            let newSavedBy = localPost.savedBy ? [...localPost.savedBy] : [];
            if (isSaved && !newSavedBy.includes(currentUser?.id || '')) {
                newSavedBy.push(currentUser?.id || '');
            } else if (!isSaved) {
                newSavedBy = newSavedBy.filter(id => id !== currentUser?.id);
            }
            const updated = { ...localPost, savedBy: newSavedBy };
            setLocalPost(updated);
            onPostUpdated(updated);
        } catch (error) {
            console.error("Save failed", error);
        }
    };

    const handleDelete = async () => {
        if (window.confirm("Are you sure you want to delete this post?")) {
            try {
                await feedService.deletePost(localPost.id);
                onPostDeleted(localPost.id);
            } catch (error) {
                console.error("Delete failed", error);
                alert("Failed to delete post");
            }
        }
    };

    const handleEditSave = async () => {
        try {
            await feedService.updatePost(localPost.id, editContent);
            const updated = { ...localPost, content: editContent, updatedAt: new Date().toISOString() };
            setLocalPost(updated);
            onPostUpdated(updated);
            setIsEditing(false);
            setIsMenuOpen(false);
        } catch (error) {
            console.error("Update failed", error);
            alert("Failed to update post");
        }
    };

    const toggleComments = async () => {
        setShowComments(!showComments);
        if (!showComments && comments.length === 0) {
            try {
                const fetched = await feedService.getComments(localPost.id);
                setComments(fetched);
            } catch (e) {
                console.error(e);
            }
        }
    };

    const handleAddComment = async () => {
        if (!newComment.trim()) return;
        try {
            const added = await feedService.addComment(localPost.id, newComment);
            const updatedComments = [...comments, added];
            setComments(updatedComments);
            setNewComment('');

            const updatedPost = { ...localPost, commentCount: localPost.commentCount + 1 };
            setLocalPost(updatedPost);
            onPostUpdated(updatedPost);
        } catch (e) {
            console.error(e);
        }
    };

    const isLiked = localPost.likedBy?.includes(currentUser?.id || '');
    const isSaved = localPost.savedBy?.includes(currentUser?.id || '');
    const isOwner = currentUser?.id === localPost.authorId;

    return (
        <div className="post-card">
            <div className="post-header">
                <div className="post-user">
                    <div className="user-avatar" style={{ backgroundImage: `url(${getAvatarUrl(localPost)})` }}></div>
                    <div className="post-user-info">
                        <h4>{localPost.authorName}</h4>
                        <div className="post-meta">
                            <span>{localPost.authorRole}</span>
                            <span>•</span>
                            <span>{formatTimeAgo(localPost.createdAt)}</span>
                            {localPost.updatedAt && <span className="text-xs italic ml-1">(edited)</span>}
                        </div>
                    </div>
                </div>
                {isOwner && (
                    <div className="relative" ref={menuRef}>
                        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-[#9dabb9] hover:text-white p-1 rounded-full hover:bg-[#2a2e35]">
                            <span className="material-symbols-outlined">more_horiz</span>
                        </button>
                        {isMenuOpen && (
                            <div className="absolute right-0 top-8 bg-[#283039] border border-[#3b4754] rounded-lg shadow-lg z-10 w-32 py-1 flex flex-col">
                                <button onClick={() => { setIsEditing(true); setIsMenuOpen(false); }} className="text-left px-4 py-2 text-sm text-[#9dabb9] hover:text-white hover:bg-[#3b4754] flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm">edit</span> Edit
                                </button>
                                <button onClick={handleDelete} className="text-left px-4 py-2 text-sm text-red-500 hover:bg-[#3b4754] flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm">delete</span> Delete
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="post-content-text">
                {isEditing ? (
                    <div className="flex flex-col gap-2">
                        <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="bg-[#111418] border border-[#3b4754] rounded-lg p-2 text-white w-full outline-none focus:border-[#137fec]"
                            rows={3}
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => { setIsEditing(false); setEditContent(localPost.content); }} className="text-xs text-[#9dabb9] hover:text-white">Cancel</button>
                            <button onClick={handleEditSave} className="text-xs bg-[#137fec] text-white px-3 py-1 rounded hover:bg-[#137fec]/90">Save</button>
                        </div>
                    </div>
                ) : (
                    <p>{localPost.content}</p>
                )}
            </div>

            {localPost.mediaFiles && localPost.mediaFiles.length > 0 && (
                <div className="post-image" style={{ backgroundImage: `url(${getAvatarUrl(localPost.mediaFiles[0].url)})` }}></div>
            )}

            <div className="post-stats">
                <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-[#137fec]">thumb_up</span>
                    {localPost.likedBy?.length || 0} Likes
                </span>
                <span onClick={toggleComments} className="hover:underline cursor-pointer">{localPost.commentCount || 0} Comments</span>
            </div>

            <div className="post-actions-bar">
                <button
                    onClick={handleLike}
                    className={`post-action-btn ${isLiked ? 'text-[#137fec]' : ''} ${isLikeAnimating ? 'animate-pulse' : ''}`}
                >
                    <span className={`material-symbols-outlined ${isLiked ? 'fill-current' : ''}`}>thumb_up</span>
                    {isLiked ? 'Liked' : 'Like'}
                </button>
                <button onClick={toggleComments} className="post-action-btn">
                    <span className="material-symbols-outlined">mode_comment</span>
                    Comment
                </button>
                <button onClick={handleSave} className={`post-action-btn ${isSaved ? 'text-[#eab308]' : ''}`}>
                    <span className={`material-symbols-outlined ${isSaved ? 'fill-current' : ''}`}>bookmark</span>
                    {isSaved ? 'Saved' : 'Save'}
                </button>
                <button className="post-action-btn">
                    <span className="material-symbols-outlined">share</span>
                    Share
                </button>
            </div>

            {showComments && (
                <div className="post-comments-section p-4 bg-[#1e2126] border-t border-[#2a2e35]">
                    <div className="flex gap-2 mb-4">
                        <input
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                            placeholder="Write a comment..."
                            className="flex-1 bg-[#0f1115] border border-[#2a2e35] rounded-full px-4 py-2 text-sm text-white focus:outline-none focus:border-[#3b82f6]"
                        />
                        <button onClick={handleAddComment} disabled={!newComment.trim()} className="text-[#3b82f6] disabled:text-gray-500">
                            <span className="material-symbols-outlined">send</span>
                        </button>
                    </div>

                    <div className="flex flex-col gap-3">
                        {comments.map(comment => (
                            <div key={comment.id} className="comment flex gap-3">
                                <div className="user-avatar w-8 h-8 min-w-8" style={{ backgroundImage: `url(${getAvatarUrl(comment.authorAvatarUrl || '')})` }}></div>
                                <div className="flex-1">
                                    <div className="comment-content bg-[#2a2e35] rounded-2xl px-3 py-2 inline-block max-w-full">
                                        <div className="font-bold text-xs text-white mb-0.5">{comment.authorName}</div>
                                        <div className="text-sm text-[#e5e7eb]">{comment.content}</div>
                                    </div>
                                    <div className="text-[10px] text-[#9ca3af] mt-1 ml-2">{formatTimeAgo(comment.createdAt)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
