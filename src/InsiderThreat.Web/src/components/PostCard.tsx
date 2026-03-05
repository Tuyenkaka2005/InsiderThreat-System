import { useState, useRef, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { feedService } from '../services/feedService';
import { API_BASE_URL } from '../services/api';
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

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHrs < 24) return `${diffHrs} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return date.toLocaleDateString('vi-VN');
};

const formatDateTime = (dateString: string) => {
    const d = new Date(dateString);
    const hh = d.getHours().toString().padStart(2, '0');
    const mm = d.getMinutes().toString().padStart(2, '0');
    const dd = d.getDate().toString().padStart(2, '0');
    const mo = (d.getMonth() + 1).toString().padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${hh}:${mm} · ${dd}/${mo}/${yyyy}`;
};

const getPrivacyIcon = (privacy?: string) => {
    switch (privacy) {
        case 'Public': return <span className="material-symbols-outlined text-[10px]">public</span>;
        case 'Private': return <span className="material-symbols-outlined text-[10px]">lock</span>;
        default: return <span className="material-symbols-outlined text-[10px]">group</span>;
    }
};

// SVG Reaction Icons (Facebook-style)
const ReactionSVGs: Record<string, React.ReactElement> = {
    like: (
        <svg viewBox="0 0 24 24" fill="#1877f2" width="22" height="22">
            <path d="M14.5 2.25c-.69 0-1.375.275-1.875.825L7.75 8.25H4.5c-1.1 0-2 .9-2 2v9c0 1.1.9 2 2 2h14.25c.9 0 1.675-.6 1.925-1.475l2-7.5c.325-1.2-.575-2.375-1.925-2.375H15.5V4.25c0-1.1-.9-2-2-2h-1zm-8 18H5v-9h1.5v9z" />
        </svg>
    ),
    love: (
        <svg viewBox="0 0 24 24" fill="#f63b4f" width="22" height="22">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
    ),
    haha: (
        <svg viewBox="0 0 24 24" fill="#f7b928" width="22" height="22">
            <circle cx="12" cy="12" r="10" />
            <path fill="#fff" d="M8.5 10.5c.6 0 1-.4 1-1s-.4-1-1-1-1 .4-1 1 .4 1 1 1zm7 0c.6 0 1-.4 1-1s-.4-1-1-1-1 .4-1 1 .4 1 1 1zm-3.5 6c2.3 0 4.3-1.5 5-3.5H7c.7 2 2.7 3.5 5 3.5z" />
        </svg>
    ),
    wow: (
        <svg viewBox="0 0 24 24" fill="#f7b928" width="22" height="22">
            <circle cx="12" cy="12" r="10" />
            <path fill="#fff" d="M8.5 10c.6 0 1-.4 1-1s-.4-1-1-1-1 .4-1 1 .4 1 1 1zm7 0c.6 0 1-.4 1-1s-.4-1-1-1-1 .4-1 1 .4 1 1 1zm-3.5 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
        </svg>
    ),
    sad: (
        <svg viewBox="0 0 24 24" fill="#f7b928" width="22" height="22">
            <circle cx="12" cy="12" r="10" />
            <path fill="#fff" d="M8.5 10c.6 0 1-.4 1-1s-.4-1-1-1-1 .4-1 1 .4 1 1 1zm7 0c.6 0 1-.4 1-1s-.4-1-1-1-1 .4-1 1 .4 1 1 1zm-3.5 7c2.3 0 4.3-1.5 5-3.5H7c.7 2 2.7 3.5 5 3.5z" transform="rotate(180 12 14)" />
        </svg>
    ),
    angry: (
        <svg viewBox="0 0 24 24" fill="#e66c24" width="22" height="22">
            <circle cx="12" cy="12" r="10" />
            <path fill="#fff" d="M7 9l2.5 1.5m5-1.5L12 10.5M9 16c.7-1 2-1.5 3-1.5s2.3.5 3 1.5H9z" />
        </svg>
    ),
};
const reactionLabelsVI: Record<string, string> = { like: 'Thích', love: 'Yêu thích', haha: 'Haha', wow: 'Wow', sad: 'Buồn', angry: 'Phẫn nộ' };

export default function PostCard({ post, currentUser, onPostUpdated, onPostDeleted }: PostCardProps) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(post.content);
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isLikeAnimating, setIsLikeAnimating] = useState(false);
    const [localPost, setLocalPost] = useState(post);

    // Reaction Users Modal
    const [showReactionsModal, setShowReactionsModal] = useState(false);
    const [reactionUsers, setReactionUsers] = useState<{ id: string; name: string; avatar: string; department?: string; reactionType: string }[]>([]);
    const [reactionFilter, setReactionFilter] = useState<string>('all');

    // Comment image
    const commentFileRef = useRef<HTMLInputElement>(null);
    const commentInputRef = useRef<HTMLInputElement>(null);
    const [commentFile, setCommentFile] = useState<File | null>(null);
    const [commentPreviewUrl, setCommentPreviewUrl] = useState<string | null>(null);
    const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);
    const [replyToAuthorName, setReplyToAuthorName] = useState<string>('');

    // Comment reactions: { [commentId]: { [type]: count } }
    const [commentReactions, setCommentReactions] = useState<Record<string, Record<string, number>>>({});
    const [myCommentReactions, setMyCommentReactions] = useState<Record<string, string>>({}); // commentId -> reactionType

    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setLocalPost(post);
    }, [post]);

    // Report Modal State
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportReason, setReportReason] = useState('');

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
        return `${API_BASE_URL}${url}`;
    };

    // Determine my current reaction
    const myReaction = useMemo(() => {
        // Check new reactions dict
        if (localPost.reactions) {
            const found = Object.keys(localPost.reactions).find(key => localPost.reactions![key].includes(currentUser?.id || ''));
            if (found) return found;
        }
        // Fallback to legacy likedBy
        if (localPost.likedBy?.includes(currentUser?.id || '')) return 'like';
        return null;
    }, [localPost, currentUser]);

    const handleLike = async () => {
        if (isLikeAnimating) return;
        setIsLikeAnimating(true);

        // If has reaction -> remove (toggle off). If no reaction -> add 'like'
        const typeToSet = myReaction ? '' : 'like';

        try {
            const res = await feedService.reactToPost(localPost.id, typeToSet);
            if (res.success) {
                const updatedReactions = res.reactions;

                // We also need to ensure legacy likedBy is cleared locally if we are moving away
                let updatedLikedBy = localPost.likedBy || [];
                if (currentUser?.id) {
                    updatedLikedBy = updatedLikedBy.filter(id => id !== currentUser.id);
                }

                const updatedPost = {
                    ...localPost,
                    reactions: updatedReactions,
                    likedBy: updatedLikedBy
                };

                setLocalPost(updatedPost);
                onPostUpdated(updatedPost);
            }
        } catch (error) {
            console.error("Failed to react", error);
        } finally {
            setTimeout(() => setIsLikeAnimating(false), 500);
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

    const handleReport = () => {
        setIsMenuOpen(false);
        setShowReportModal(true);
    };

    const submitReport = async () => {
        if (!reportReason.trim()) return;

        try {
            await feedService.reportPost(localPost.id, reportReason);
            setShowReportModal(false);
            setReportReason('');
            // Show success feedback
            alert("Report submitted. Thank you for keeping our community safe.");
        } catch (error) {
            console.error("Report failed", error);
            alert("Failed to submit report. Please try again.");
        }
    };

    const handleHide = async () => {
        if (window.confirm("Hide this post (Admin)?")) {
            try {
                await feedService.hidePost(localPost.id);
                // Treat as deleted for UI purposes (remove from feed)
                onPostDeleted(localPost.id);
            } catch (error) {
                console.error("Hide failed", error);
            }
        }
    };

    const toggleComments = async () => {
        setShowComments(!showComments);
        if (!showComments && comments.length === 0) {
            try {
                const fetched = await feedService.getComments(localPost.id);
                setComments(fetched);
                // Init reaction state from server data
                const rMap: Record<string, Record<string, number>> = {};
                const myMap: Record<string, string> = {};
                fetched.forEach(c => {
                    if (c.reactions) {
                        rMap[c.id] = Object.fromEntries(
                            Object.entries(c.reactions).map(([t, ids]) => [t, ids.length])
                        );
                        const found = Object.entries(c.reactions).find(([, ids]) => ids.includes(currentUser?.id || ''));
                        if (found) myMap[c.id] = found[0];
                    }
                });
                setCommentReactions(rMap);
                setMyCommentReactions(myMap);
            } catch (e) {
                console.error(e);
            }
        }
    };

    const handleAddComment = async () => {
        if (!newComment.trim() && !commentFile) return;
        try {
            let content = newComment;
            if (commentFile) {
                try {
                    const uploadResult = await feedService.uploadFile(commentFile);
                    content = newComment ? `${newComment}\n![img](${uploadResult.url})` : `![img](${uploadResult.url})`;
                } catch { /* ignore upload error, send text only */ }
            }
            const added = await feedService.addComment(localPost.id, content, replyToCommentId || undefined);
            const updatedComments = [...comments, added];
            setComments(updatedComments);
            setNewComment('');
            setCommentFile(null);
            setCommentPreviewUrl(null);
            setReplyToCommentId(null);
            setReplyToAuthorName('');

            const updatedPost = { ...localPost, commentCount: localPost.commentCount + 1 };
            setLocalPost(updatedPost);
            onPostUpdated(updatedPost);
        } catch (e) {
            console.error(e);
        }
    };

    const handleCommentReact = async (commentId: string, type: string) => {
        const currentType = myCommentReactions[commentId];
        const newType = currentType === type ? '' : type;
        // Optimistic update
        setMyCommentReactions(prev => ({ ...prev, [commentId]: newType }));
        setCommentReactions(prev => {
            const curr = { ...(prev[commentId] || {}) };
            if (currentType) curr[currentType] = Math.max(0, (curr[currentType] || 1) - 1);
            if (newType) curr[newType] = (curr[newType] || 0) + 1;
            return { ...prev, [commentId]: curr };
        });
        try {
            const res = await feedService.reactToComment(commentId, newType);
            if (res.success) {
                const serverCount = Object.fromEntries(
                    Object.entries(res.reactions).map(([t, ids]) => [t, (ids as string[]).length])
                );
                setCommentReactions(prev => ({ ...prev, [commentId]: serverCount }));
                const myR = Object.entries(res.reactions).find(([, ids]) => (ids as string[]).includes(currentUser?.id || ''));
                setMyCommentReactions(prev => ({ ...prev, [commentId]: myR?.[0] || '' }));
            }
        } catch (e) {
            console.error('Comment react failed', e);
        }
    };


    const handleReply = (comment: Comment) => {
        setReplyToCommentId(comment.parentCommentId ? comment.parentCommentId : comment.id);
        setReplyToAuthorName(comment.authorName);
        const text = `@${comment.authorName} `;
        setNewComment(text);
        setTimeout(() => {
            const input = commentInputRef.current;
            if (input) {
                input.focus();
                input.setSelectionRange(text.length, text.length);
            }
        }, 50);
    };

    const handleCommentFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setCommentFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setCommentPreviewUrl(reader.result as string);
        reader.readAsDataURL(file);
    };

    const fetchReactionUsers = async () => {
        // Build list from reactions dict using authorId stored in post
        const entries: { id: string; name: string; avatar: string; department?: string; reactionType: string }[] = [];
        const reactions = localPost.reactions || {};
        // We can map locally since we only have IDs — show what we have
        for (const [type, ids] of Object.entries(reactions)) {
            for (const id of ids) {
                entries.push({ id, name: id, avatar: `https://i.pravatar.cc/40?u=${id}`, reactionType: type });
            }
        }
        // Try to fetch actual user info
        try {
            const resp = await fetch(`${API_BASE_URL}/api/users`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
            const users: any[] = await resp.json();
            const mapped = entries.map(e => {
                const u = users.find((u: any) => u.id === e.id || u._id === e.id);
                return u ? { ...e, name: u.fullName || u.username, avatar: u.avatarUrl ? `${API_BASE_URL}${u.avatarUrl}` : e.avatar, department: u.department } : e;
            });
            setReactionUsers(mapped);
        } catch {
            setReactionUsers(entries);
        }
        setShowReactionsModal(true);
        setReactionFilter('all');
    };

    const isSaved = localPost.savedBy?.includes(currentUser?.id || '');
    const isOwner = currentUser?.id === localPost.authorId;

    const reactionIcons: Record<string, string> = { 'like': '👍', 'love': '❤️', 'haha': '😂', 'wow': '😮', 'sad': '😢', 'angry': '😡' };
    const reactionColors: Record<string, string> = { 'like': 'text-[#137fec]', 'love': 'text-[#f63b4f]', 'haha': 'text-[#f7b928]', 'wow': 'text-[#f7b928]', 'sad': 'text-[#f7b928]', 'angry': 'text-[#e66c24]' };
    const reactionLabels: Record<string, string> = { 'like': 'Like', 'love': 'Love', 'haha': 'Haha', 'wow': 'Wow', 'sad': 'Sad', 'angry': 'Angry' };

    const CurrentReactionIcon = myReaction ? reactionIcons[myReaction] : 'thumb_up';
    const CurrentReactionLabel = myReaction ? (reactionLabels[myReaction] || 'Liked') : 'Like';
    // If not specific reaction but standard like (from myReaction logic being 'like'), it falls into generic blue.
    // However, for consistency, if myReaction is set, use the specialized color.
    const CurrentReactionColor = myReaction ? (reactionColors[myReaction] || 'text-[#137fec]') : 'text-slate-500 hover:text-slate-800';

    // Icon Logic for Button:
    // If has reaction -> show that emoji. If no reaction -> show generic thumb_up icon (material symbol).
    // Note: Standard 'Like' reaction also maps to 👍 emoji in my dictionary. 
    // Standard UI usually shows "Thumb Up" SVG for "Like" state, but emoji for others.
    // For simplicity, let's use Emoji for all ACTIVE states, and Material Icon for INACTIVE.

    return (
        <div className="bg-white border border-[var(--color-border)] rounded-2xl p-4 mb-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-blue-100 transition-all duration-300">
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden">
                        <img src={getAvatarUrl(localPost.authorAvatarUrl)} alt={localPost.authorName} className="w-full h-full object-cover" />
                    </div>
                    <div>
                        <Link to={`/profile/${localPost.authorId}`} className="font-semibold text-slate-900 hover:underline">
                            {localPost.authorName}
                        </Link>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-slate-500" title={formatDateTime(localPost.createdAt)}>
                                {formatTimeAgo(localPost.createdAt)}
                            </span>
                            <span className="text-[10px] text-slate-300">·</span>
                            <span className="text-[10px] text-slate-400">{formatDateTime(localPost.createdAt).split('·')[0].trim()}</span>

                            {/* Category Badge */}
                            {localPost.category && localPost.category !== 'General' && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${localPost.category === 'Security' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                    localPost.category === 'Announcement' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                        'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                    }`}>
                                    {localPost.category}
                                </span>
                            )}

                            {/* Visibility Badge */}
                            <span className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                {getPrivacyIcon(localPost.privacy)}
                                {localPost.allowedDepartments && localPost.allowedDepartments.length > 0
                                    ? `${localPost.allowedDepartments.join(', ')} Dept`
                                    : localPost.allowedRoles && localPost.allowedRoles.length > 0
                                        ? `${localPost.allowedRoles.join(', ')} Only`
                                        : 'Everyone'}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="relative" ref={menuRef}>
                    <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-slate-400 hover:text-slate-700 p-1 rounded-full hover:bg-slate-100">
                        <span className="material-symbols-outlined">more_horiz</span>
                    </button>
                    {isMenuOpen && (
                        <div className="absolute right-0 top-8 bg-white border border-[var(--color-border)] rounded-lg shadow-lg z-10 w-32 py-1 flex flex-col">
                            {currentUser?.role === 'Admin' && (
                                <>
                                    <button onClick={async () => {
                                        await feedService.pinPost(localPost.id);
                                        const updated = { ...localPost, isPinned: !localPost.isPinned };
                                        setLocalPost(updated);
                                        onPostUpdated(updated);
                                        setIsMenuOpen(false);
                                    }} className="text-left px-4 py-2 text-sm text-slate-500 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">push_pin</span> {localPost.isPinned ? 'Unpin' : 'Pin'}
                                    </button>
                                    <button onClick={handleHide} className="text-left px-4 py-2 text-sm text-slate-500 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">visibility_off</span> Hide
                                    </button>
                                </>
                            )}
                            {isOwner && (
                                <>
                                    <button onClick={() => { setIsEditing(true); setIsMenuOpen(false); }} className="text-left px-4 py-2 text-sm text-slate-500 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">edit</span> Edit
                                    </button>
                                    <button onClick={handleDelete} className="text-left px-4 py-2 text-sm text-red-500 hover:bg-[#3b4754] flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">delete</span> Delete
                                    </button>
                                </>
                            )}
                            {/* Every post can be reported (except maybe own?) */}
                            <button onClick={handleReport} className="text-left px-4 py-2 text-sm text-slate-500 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">flag</span> Report
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="post-content-text">
                {localPost.isUrgent && (
                    <div className="flex items-center gap-2 text-sm bg-red-600 text-white px-4 py-3 rounded-lg mb-3 font-bold animate-pulse border-2 border-red-400">
                        <span className="material-symbols-outlined fill-current animate-bounce">emergency</span>
                        <div className="flex-1">
                            <div className="font-extrabold uppercase tracking-wide">URGENT / EMERGENCY</div>
                            {localPost.urgentReason && <div className="text-xs font-normal mt-0.5 opacity-90">{localPost.urgentReason}</div>}
                        </div>
                        <span className="material-symbols-outlined fill-current">warning</span>
                    </div>
                )}
                {localPost.isPinned && (
                    <div className="flex items-center gap-2 text-xs text-[#137fec] mb-2 font-semibold">
                        <span className="material-symbols-outlined text-sm fill-current">push_pin</span> Pinned Post
                    </div>
                )}
                {isEditing ? (
                    <div className="flex flex-col gap-2">
                        <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="bg-slate-50 border border-[var(--color-border)] rounded-lg p-2 text-slate-900 w-full outline-none focus:border-[var(--color-primary)]"
                            rows={3}
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => { setIsEditing(false); setEditContent(localPost.content); }} className="text-xs text-slate-500 hover:text-slate-900">Cancel</button>
                            <button onClick={handleEditSave} className="text-xs bg-[#137fec] text-white px-3 py-1 rounded hover:bg-[#137fec]/90">Save</button>
                        </div>
                    </div>
                ) : (
                    <p>{localPost.content}</p>
                )}

                {/* Link Preview */}
                {localPost.linkInfo && (
                    <a href={localPost.linkInfo.url} target="_blank" rel="noreferrer" className="block mt-2 mb-2 bg-slate-50 rounded-lg overflow-hidden hover:bg-slate-100 transition-colors border border-slate-200 group">
                        {localPost.linkInfo.imageUrl && (
                            <img src={localPost.linkInfo.imageUrl} alt="" className="w-full h-48 object-cover" />
                        )}
                        <div className="p-3">
                            <div className="text-sm font-bold text-slate-800 group-hover:text-blue-600 mb-1 line-clamp-2">{localPost.linkInfo.title}</div>
                            {localPost.linkInfo.description && <div className="text-xs text-slate-500 line-clamp-2 mb-1">{localPost.linkInfo.description}</div>}
                            <div className="text-xs text-slate-400 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[10px]">link</span>
                                {new URL(localPost.linkInfo.url).hostname}
                            </div>
                        </div>
                    </a>
                )}
            </div>

            {localPost.mediaFiles && localPost.mediaFiles.length > 0 && (
                <div className="mt-3">
                    {localPost.mediaFiles.map((media, idx) => {
                        const fileUrl = getAvatarUrl(media.url);
                        if (media.type === 'video' || (localPost.type === 'Video' && idx === 0)) {
                            return (
                                <video key={idx} src={fileUrl} controls className="w-full rounded-lg max-h-[400px] bg-black" />
                            );
                        } else if (media.type === 'image' || (localPost.type === 'Image' && idx === 0) || !media.type) {
                            return (
                                <div key={idx} className="w-full bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center" style={{ maxHeight: '500px' }}>
                                    <img
                                        src={fileUrl}
                                        alt="post media"
                                        className="w-full h-auto object-contain max-h-[500px]"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                </div>
                            );
                        } else {
                            // File
                            return (
                                <a key={idx} href={fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200">
                                    <div className="bg-blue-500/20 p-2 rounded-lg">
                                        <span className="material-symbols-outlined text-blue-500">description</span>
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <div className="text-sm font-medium text-slate-800 truncate">{media.fileName || 'Attached File'}</div>
                                        <div className="text-xs text-slate-500">{media.fileSize ? `${(media.fileSize / 1024).toFixed(1)} KB` : 'Download'}</div>
                                    </div>
                                    <span className="material-symbols-outlined text-slate-400">download</span>
                                </a>
                            );
                        }
                    })}
                </div>
            )}

            <div className="post-stats">
                <div className="flex items-center gap-1">
                    {(() => {
                        const types = ['like', 'love', 'haha', 'wow', 'sad', 'angry'];
                        const activeKeyStats = types
                            .map(t => ({ type: t, count: localPost.reactions?.[t]?.length || 0 }))
                            .filter(x => x.count > 0)
                            .sort((a, b) => b.count - a.count);
                        const totalCount = Object.values(localPost.reactions || {}).flat().length;

                        if (activeKeyStats.length > 0) {
                            return (
                                <button className="flex items-center gap-1 hover:underline" onClick={fetchReactionUsers}>
                                    <div className="flex -space-x-1">
                                        {activeKeyStats.slice(0, 3).map(stat => (
                                            <span key={stat.type} className="w-5 h-5 flex items-center justify-center bg-white rounded-full border border-slate-100 z-10">
                                                {ReactionSVGs[stat.type]}
                                            </span>
                                        ))}
                                    </div>
                                    <span className="text-slate-500 text-sm ml-1 hover:text-slate-800">{totalCount}</span>
                                </button>
                            );
                        }
                        if (localPost.likedBy && localPost.likedBy.length > 0) {
                            return (
                                <button className="flex items-center gap-1 hover:underline" onClick={fetchReactionUsers}>
                                    <span className="w-5 h-5">{ReactionSVGs.like}</span>
                                    <span className="text-slate-500 text-sm">{localPost.likedBy.length}</span>
                                </button>
                            );
                        }
                        return null;
                    })()}
                </div>
                <span onClick={toggleComments} className="hover:underline cursor-pointer text-sm text-slate-500">{localPost.commentCount || 0} bình luận</span>
            </div>

            <div className="post-actions-bar mt-4 pt-2 border-t border-slate-50 relative">
                <div className="group relative">
                    <button
                        onClick={handleLike}
                        className={`post-action-btn ${CurrentReactionColor} ${isLikeAnimating ? 'scale-110' : ''} transition-transform`}
                    >
                        {myReaction
                            ? <span className="w-5 h-5 flex items-center">{ReactionSVGs[myReaction]}</span>
                            : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="20" height="20"><path d="M14.5 2.25c-.69 0-1.375.275-1.875.825L7.75 8.25H4.5c-1.1 0-2 .9-2 2v9c0 1.1.9 2 2 2h14.25c.9 0 1.675-.6 1.925-1.475l2-7.5c.325-1.2-.575-2.375-1.925-2.375H15.5V4.25c0-1.1-.9-2-2-2h-1z" /></svg>
                        }
                        <span className="ml-1">{myReaction ? (reactionLabelsVI[myReaction] || 'Thích') : 'Thích'}</span>
                    </button>
                    {/* Reaction Popup — SVG icons */}
                    <div className="absolute bottom-full left-0 pb-2 hidden group-hover:flex z-20">
                        <div className="flex bg-white rounded-full px-2 py-1.5 shadow-xl border border-slate-100 gap-2">
                            {(['like', 'love', 'haha', 'wow', 'sad', 'angry'] as const).map(type => (
                                <button
                                    key={type}
                                    title={reactionLabelsVI[type]}
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        const res = await feedService.reactToPost(localPost.id, type);
                                        if (res.success) {
                                            let updatedLikedBy = (localPost.likedBy || []).filter(id => id !== currentUser?.id);
                                            setLocalPost({ ...localPost, reactions: res.reactions, likedBy: updatedLikedBy });
                                            onPostUpdated({ ...localPost, reactions: res.reactions, likedBy: updatedLikedBy });
                                        }
                                    }}
                                    className="hover:scale-125 transition-all duration-150 w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-50"
                                >
                                    {ReactionSVGs[type]}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
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

            {showComments && (() => {
                const rootComments = comments.filter(c => !c.parentCommentId);
                const getReplies = (cid: string) => comments.filter(c => c.parentCommentId === cid);

                const renderComment = (comment: Comment, isReply = false) => {
                    const myRType = myCommentReactions[comment.id];
                    const reactions = commentReactions[comment.id] || {};
                    const totalReactions = Object.values(reactions).reduce((a, b) => a + b, 0);
                    const topReactionTypes = Object.entries(reactions).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([t]) => t);
                    const replies = getReplies(comment.id);

                    return (
                        <div key={comment.id} className={`flex gap-2 ${isReply ? '' : ''}`}>
                            <div className={`rounded-full bg-slate-200 overflow-hidden flex-shrink-0 ${isReply ? 'w-7 h-7' : 'w-8 h-8'}`}>
                                <img src={getAvatarUrl(comment.authorAvatarUrl || '')} alt="" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                                {/* Comment bubble */}
                                <div className="relative inline-block max-w-full">
                                    <div className="bg-white rounded-2xl px-3 py-2 border border-slate-100 shadow-sm">
                                        <Link to={`/profile/${comment.authorId || ''}`} className="font-semibold text-xs text-slate-800 hover:underline block mb-0.5">{comment.authorName}</Link>
                                        {comment.content.includes('![img](') ? (
                                            <>
                                                <p className="text-sm text-slate-700 whitespace-pre-line">{comment.content.replace(/\n?!\[img\]\([^)]+\)/g, '').trim()}</p>
                                                {(() => {
                                                    const match = comment.content.match(/!\[img\]\(([^)]+)\)/);
                                                    return match ? <img src={`${API_BASE_URL}${match[1]}`} alt="" className="mt-1 rounded-xl max-h-40 object-cover" /> : null;
                                                })()}
                                            </>
                                        ) : (
                                            <p className="text-sm text-slate-700 whitespace-pre-line">{comment.content}</p>
                                        )}
                                    </div>
                                    {/* Reaction count badge on bubble */}
                                    {totalReactions > 0 && (
                                        <div className="absolute -bottom-2.5 right-2 flex items-center gap-0.5 bg-white border border-slate-100 rounded-full px-1.5 py-0.5 shadow-sm">
                                            {topReactionTypes.map(t => <span key={t} className="w-3.5 h-3.5">{ReactionSVGs[t]}</span>)}
                                            <span className="text-[10px] text-slate-500 ml-0.5">{totalReactions}</span>
                                        </div>
                                    )}
                                </div>
                                {/* Actions */}
                                <div className="flex items-center gap-3 mt-2 ml-2">
                                    <span className="text-[11px] text-slate-400">{formatTimeAgo(comment.createdAt)}</span>
                                    {/* Like with mini popup */}
                                    <div className="group relative">
                                        {(() => {
                                            const rColors: Record<string, string> = { like: 'text-[#137fec]', love: 'text-[#f63b4f]', haha: 'text-[#f7b928]', wow: 'text-[#f7b928]', sad: 'text-[#f7b928]', angry: 'text-[#e66c24]' };
                                            return (
                                                <button
                                                    className={`flex items-center gap-1 text-[11px] font-semibold transition-colors ${myRType ? (rColors[myRType] || 'text-blue-600') : 'text-slate-500 hover:text-blue-600'}`}
                                                    onClick={() => handleCommentReact(comment.id, myRType ? '' : 'like')}
                                                >
                                                    {myRType
                                                        ? <span className="w-4 h-4 flex items-center">{ReactionSVGs[myRType]}</span>
                                                        : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M14.5 2.25c-.69 0-1.375.275-1.875.825L7.75 8.25H4.5c-1.1 0-2 .9-2 2v9c0 1.1.9 2 2 2h14.25c.9 0 1.675-.6 1.925-1.475l2-7.5c.325-1.2-.575-2.375-1.925-2.375H15.5V4.25c0-1.1-.9-2-2-2h-1z" /></svg>
                                                    }
                                                    {myRType ? (reactionLabelsVI[myRType] || 'Thích') : 'Thích'}
                                                </button>
                                            );
                                        })()}
                                        {/* Mini reaction popup */}
                                        <div className="absolute bottom-full left-0 pb-1 hidden group-hover:flex z-20">
                                            <div className="flex bg-white rounded-full px-1.5 py-1 shadow-xl border border-slate-100 gap-1">
                                                {(['like', 'love', 'haha', 'wow', 'sad', 'angry'] as const).map(type => (
                                                    <button key={type} title={reactionLabelsVI[type]}
                                                        onClick={() => handleCommentReact(comment.id, type)}
                                                        className="hover:scale-125 transition-all duration-150 w-7 h-7 flex items-center justify-center">
                                                        <span className="w-5 h-5">{ReactionSVGs[type]}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        className="text-[11px] text-slate-500 hover:text-blue-600 font-semibold transition-colors"
                                        onClick={() => handleReply(comment)}
                                    >
                                        Phản hồi
                                    </button>
                                    <span className="text-[11px] text-slate-400">{formatDateTime(comment.createdAt).split('·')[0].trim()}</span>
                                </div>

                                {/* Nested replies */}
                                {replies.length > 0 && (
                                    <div className="mt-3 flex flex-col gap-3 pl-2 border-l-2 border-slate-100">
                                        {replies.map(r => renderComment(r, true))}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                };

                return (
                    <div className="post-comments-section p-4 bg-slate-50 border-t border-slate-200">
                        {/* Comment Input */}
                        <div className="flex flex-col gap-2 mb-4">
                            {/* Reply indicator */}
                            {replyToCommentId && (
                                <div className="flex items-center gap-2 bg-blue-50 text-blue-600 text-xs px-3 py-1.5 rounded-lg">
                                    <span className="material-symbols-outlined text-sm">reply</span>
                                    <span>Đang phản hồi <strong>{replyToAuthorName}</strong></span>
                                    <button onClick={() => { setReplyToCommentId(null); setReplyToAuthorName(''); setNewComment(''); }} className="ml-auto text-blue-400 hover:text-blue-600">×</button>
                                </div>
                            )}
                            {/* Image preview */}
                            {commentPreviewUrl && (
                                <div className="flex gap-2 p-2 bg-white rounded-xl border border-dashed border-slate-200">
                                    <div className="relative w-16 h-16 rounded-lg overflow-hidden group flex-shrink-0">
                                        <img src={commentPreviewUrl} alt="preview" className="w-full h-full object-cover" />
                                        <button onClick={() => { setCommentFile(null); setCommentPreviewUrl(null); }}
                                            className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                                            ×
                                        </button>
                                    </div>
                                </div>
                            )}
                            <div className="flex gap-2">
                                <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden flex-shrink-0">
                                    <img src={getAvatarUrl(currentUser)} alt="" className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1 flex items-center bg-white border border-slate-200 rounded-full px-3 gap-2 focus-within:border-blue-300 transition-colors">
                                    <input
                                        ref={commentInputRef}
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAddComment()}
                                        placeholder={replyToCommentId ? `Phản hồi ${replyToAuthorName}...` : 'Viết bình luận...'}
                                        className="flex-1 bg-transparent py-2 text-sm text-slate-900 focus:outline-none placeholder:text-slate-400"
                                    />
                                    <input type="file" ref={commentFileRef} onChange={handleCommentFileSelect} accept="image/*" style={{ display: 'none' }} />
                                    <button onClick={() => commentFileRef.current?.click()} className="text-slate-400 hover:text-green-500 transition-colors p-1">
                                        <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" /></svg>
                                    </button>
                                </div>
                                <button onClick={handleAddComment} disabled={!newComment.trim() && !commentFile} className="text-blue-500 disabled:text-gray-300 transition-colors">
                                    <span className="material-symbols-outlined">send</span>
                                </button>
                            </div>
                        </div>

                        {/* Threaded Comments */}
                        <div className="flex flex-col gap-4">
                            {rootComments.map(c => renderComment(c, false))}
                        </div>
                    </div>
                );
            })()}


            {/* Reaction Users Modal */}
            {showReactionsModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" onClick={() => setShowReactionsModal(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                            <h3 className="font-bold text-slate-900">Cảm xúc</h3>
                            <button onClick={() => setShowReactionsModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-lg">×</button>
                        </div>
                        {/* Reaction filter tabs */}
                        <div className="flex gap-1 px-4 pt-3 pb-2 overflow-x-auto">
                            {['all', 'like', 'love', 'haha', 'wow', 'sad', 'angry'].map(f => {
                                const count = f === 'all' ? reactionUsers.length : reactionUsers.filter(u => u.reactionType === f).length;
                                if (count === 0 && f !== 'all') return null;
                                return (
                                    <button key={f} onClick={() => setReactionFilter(f)}
                                        className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${reactionFilter === f ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'text-slate-500 hover:bg-slate-50'
                                            }`}>
                                        {f !== 'all' && <span className="w-4 h-4">{ReactionSVGs[f]}</span>}
                                        {f === 'all' ? `Tất cả ${count}` : count}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="max-h-80 overflow-y-auto px-4 pb-4">
                            {reactionUsers.filter(u => reactionFilter === 'all' || u.reactionType === reactionFilter).map((u, i) => (
                                <div key={i} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
                                    <div className="relative">
                                        <img src={u.avatar} alt={u.name} className="w-10 h-10 rounded-full object-cover" />
                                        <span className="absolute -bottom-1 -right-1 w-5 h-5">{ReactionSVGs[u.reactionType]}</span>
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-semibold text-slate-900 text-sm">{u.name}</div>
                                        {u.department && <div className="text-xs text-slate-500">{u.department}</div>}
                                    </div>
                                    <Link to={`/profile/${u.id}`} onClick={() => setShowReactionsModal(false)}
                                        className="text-xs text-blue-600 hover:text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors font-medium">
                                        Hồ sơ
                                    </Link>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Report Modal */}
            {showReportModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]" onClick={() => setShowReportModal(false)}>
                    <div className="bg-[var(--color-dark-surface)] border-2 border-red-500 rounded-xl p-6 max-w-md mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-4">
                            <span className="material-symbols-outlined text-red-500 text-3xl">flag</span>
                            <h3 className="text-xl font-bold text-white">Report Post</h3>
                        </div>
                        <p className="text-[var(--color-text-muted)] mb-4 text-sm">Please describe why you're reporting this content:</p>
                        <textarea
                            value={reportReason}
                            onChange={(e) => setReportReason(e.target.value)}
                            placeholder="E.g., Spam, inappropriate content, harassment..."
                            className="w-full bg-[var(--color-dark-bg)] text-white border border-[var(--color-border)] rounded-lg p-3 mb-4 focus:outline-none focus:border-[var(--color-primary)] resize-none"
                            rows={4}
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowReportModal(false);
                                    setReportReason('');
                                }}
                                className="flex-1 px-4 py-2 bg-[var(--color-dark-bg)] text-white rounded-lg hover:bg-[var(--color-dark-surface-lighter)] transition-colors border border-[var(--color-border)]"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitReport}
                                disabled={!reportReason.trim()}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Submit Report
                            </button>
                        </div>
                    </div>
                </div>
            )
            }
        </div >
    );
}
