import { useState, useRef, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
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

const getPrivacyIcon = (privacy?: string) => {
    switch (privacy) {
        case 'Public': return <span className="material-symbols-outlined text-[10px]">public</span>;
        case 'Private': return <span className="material-symbols-outlined text-[10px]">lock</span>;
        default: return <span className="material-symbols-outlined text-[10px]">group</span>;
    }
};

const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
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
        return `http://127.0.0.1:5038${url}`;
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

    const isSaved = localPost.savedBy?.includes(currentUser?.id || '');
    const isOwner = currentUser?.id === localPost.authorId;

    const reactionIcons: Record<string, string> = { 'like': '👍', 'love': '❤️', 'haha': '😂', 'wow': '😮', 'sad': '😢', 'angry': '😡' };
    const reactionColors: Record<string, string> = { 'like': 'text-[#137fec]', 'love': 'text-[#f63b4f]', 'haha': 'text-[#f7b928]', 'wow': 'text-[#f7b928]', 'sad': 'text-[#f7b928]', 'angry': 'text-[#e66c24]' };
    const reactionLabels: Record<string, string> = { 'like': 'Like', 'love': 'Love', 'haha': 'Haha', 'wow': 'Wow', 'sad': 'Sad', 'angry': 'Angry' };

    const CurrentReactionIcon = myReaction ? reactionIcons[myReaction] : 'thumb_up';
    const CurrentReactionLabel = myReaction ? (reactionLabels[myReaction] || 'Liked') : 'Like';
    // If not specific reaction but standard like (from myReaction logic being 'like'), it falls into generic blue.
    // However, for consistency, if myReaction is set, use the specialized color.
    const CurrentReactionColor = myReaction ? (reactionColors[myReaction] || 'text-[#137fec]') : 'text-[#9dabb9] hover:text-white';

    // Icon Logic for Button:
    // If has reaction -> show that emoji. If no reaction -> show generic thumb_up icon (material symbol).
    // Note: Standard 'Like' reaction also maps to 👍 emoji in my dictionary. 
    // Standard UI usually shows "Thumb Up" SVG for "Like" state, but emoji for others.
    // For simplicity, let's use Emoji for all ACTIVE states, and Material Icon for INACTIVE.

    return (
        <div className="bg-[#1e2126] border border-[#2a2e35] rounded-xl p-4 mb-4 shadow-sm hover:border-[#3b4754] transition-colors">
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#2a2e35] overflow-hidden">
                        <img src={getAvatarUrl(localPost.authorAvatarUrl)} alt={localPost.authorName} className="w-full h-full object-cover" />
                    </div>
                    <div>
                        <Link to={`/profile/${localPost.authorId}`} className="font-semibold text-white hover:underline">
                            {localPost.authorName}
                        </Link>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] bg-[#2a2e35] px-1.5 py-0.5 rounded text-gray-400 border border-[#3b4754]">
                                {formatDate(localPost.createdAt)}
                            </span>

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
                            <span className="flex items-center gap-1 text-[10px] text-[#9dabb9] bg-[#2a2e35] px-1.5 py-0.5 rounded border border-[#3b4754]">
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
                    <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-[#9dabb9] hover:text-white p-1 rounded-full hover:bg-[#2a2e35]">
                        <span className="material-symbols-outlined">more_horiz</span>
                    </button>
                    {isMenuOpen && (
                        <div className="absolute right-0 top-8 bg-[#283039] border border-[#3b4754] rounded-lg shadow-lg z-10 w-32 py-1 flex flex-col">
                            {currentUser?.role === 'Admin' && (
                                <>
                                    <button onClick={async () => {
                                        await feedService.pinPost(localPost.id);
                                        const updated = { ...localPost, isPinned: !localPost.isPinned };
                                        setLocalPost(updated);
                                        onPostUpdated(updated);
                                        setIsMenuOpen(false);
                                    }} className="text-left px-4 py-2 text-sm text-[#9dabb9] hover:text-white hover:bg-[#3b4754] flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">push_pin</span> {localPost.isPinned ? 'Unpin' : 'Pin'}
                                    </button>
                                    <button onClick={handleHide} className="text-left px-4 py-2 text-sm text-[#9dabb9] hover:text-white hover:bg-[#3b4754] flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">visibility_off</span> Hide
                                    </button>
                                </>
                            )}
                            {isOwner && (
                                <>
                                    <button onClick={() => { setIsEditing(true); setIsMenuOpen(false); }} className="text-left px-4 py-2 text-sm text-[#9dabb9] hover:text-white hover:bg-[#3b4754] flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">edit</span> Edit
                                    </button>
                                    <button onClick={handleDelete} className="text-left px-4 py-2 text-sm text-red-500 hover:bg-[#3b4754] flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">delete</span> Delete
                                    </button>
                                </>
                            )}
                            {/* Every post can be reported (except maybe own?) */}
                            <button onClick={handleReport} className="text-left px-4 py-2 text-sm text-[#9dabb9] hover:text-white hover:bg-[#3b4754] flex items-center gap-2">
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

                {/* Link Preview */}
                {localPost.linkInfo && (
                    <a href={localPost.linkInfo.url} target="_blank" rel="noreferrer" className="block mt-2 mb-2 bg-[#2a2e35] rounded-lg overflow-hidden hover:bg-[#3b4754] transition-colors border border-[#3b4754] group">
                        {localPost.linkInfo.imageUrl && (
                            <img src={localPost.linkInfo.imageUrl} alt="" className="w-full h-48 object-cover" />
                        )}
                        <div className="p-3">
                            <div className="text-sm font-bold text-gray-200 group-hover:text-blue-400 mb-1 line-clamp-2">{localPost.linkInfo.title}</div>
                            {localPost.linkInfo.description && <div className="text-xs text-gray-400 line-clamp-2 mb-1">{localPost.linkInfo.description}</div>}
                            <div className="text-xs text-gray-500 flex items-center gap-1">
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
                                <div key={idx} className="post-image" style={{ backgroundImage: `url(${fileUrl})` }}></div>
                            );
                        } else {
                            // File
                            return (
                                <a key={idx} href={fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-[#2a2e35] rounded-lg hover:bg-[#3b4754] transition-colors border border-[#3b4754]">
                                    <div className="bg-blue-500/20 p-2 rounded-lg">
                                        <span className="material-symbols-outlined text-blue-500">description</span>
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <div className="text-sm font-medium text-white truncate">{media.fileName || 'Attached File'}</div>
                                        <div className="text-xs text-[#9dabb9]">{media.fileSize ? `${(media.fileSize / 1024).toFixed(1)} KB` : 'Download'}</div>
                                    </div>
                                    <span className="material-symbols-outlined text-[#9dabb9]">download</span>
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
                        const icons: Record<string, string> = { 'like': '👍', 'love': '❤️', 'haha': '😂', 'wow': '😮', 'sad': '😢', 'angry': '😡' };

                        const activeKeyStats = types
                            .map(t => ({ type: t, count: localPost.reactions?.[t]?.length || 0 }))
                            .filter(x => x.count > 0)
                            .sort((a, b) => b.count - a.count);

                        if (activeKeyStats.length > 0) {
                            return (
                                <div className="flex items-center gap-1">
                                    <div className="flex -space-x-2">
                                        {activeKeyStats.slice(0, 3).map(stat => (
                                            <span key={stat.type} className="w-5 h-5 flex items-center justify-center bg-[#1e2126] rounded-full border border-[#2a2e35] text-xs z-10" title={stat.type}>
                                                {icons[stat.type]}
                                            </span>
                                        ))}
                                    </div>
                                    <span className="text-[#9dabb9] text-sm hover:underline cursor-pointer ml-1">
                                        {Object.values(localPost.reactions || {}).flat().length}
                                    </span>
                                </div>
                            );
                        }

                        // Fallback for legacy data if no dictionary reactions but has likedBy
                        if (localPost.likedBy && localPost.likedBy.length > 0) {
                            return (
                                <span className="flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm text-[#137fec]">thumb_up</span>
                                    {localPost.likedBy.length} Likes
                                </span>
                            );
                        }
                        return null;
                    })()}
                </div>
                <span onClick={toggleComments} className="hover:underline cursor-pointer">{localPost.commentCount || 0} Comments</span>
            </div>

            <div className="post-actions-bar relative">
                <div className="group relative">
                    <button
                        onClick={handleLike}
                        className={`post-action-btn ${CurrentReactionColor} ${isLikeAnimating ? 'animate-pulse' : ''}`}
                    >
                        {myReaction ? (
                            <span className="text-lg leading-none mr-1">{CurrentReactionIcon}</span>
                        ) : (
                            <span className="material-symbols-outlined">thumb_up</span>
                        )}
                        {CurrentReactionLabel}
                    </button>
                    {/* Reaction Popup */}
                    <div className="absolute bottom-full left-0 pb-2 hidden group-hover:block z-20 w-max">
                        <div className="flex bg-[#2a2e35] rounded-full p-1 shadow-lg border border-[#3b4754] gap-1 animate-in fade-in zoom-in duration-200 origin-bottom-left">
                            {['👍', '❤️', '😂', '😮', '😢', '😡'].map(emoji => (
                                <button
                                    key={emoji}
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        const typeMap: Record<string, string> = { '👍': 'like', '❤️': 'love', '😂': 'haha', '😮': 'wow', '😢': 'sad', '😡': 'angry' };
                                        const type = typeMap[emoji];

                                        const res = await feedService.reactToPost(localPost.id, type);
                                        if (res.success) {
                                            const updatedReactions = res.reactions;

                                            // Clear legacy local
                                            let updatedLikedBy = localPost.likedBy || [];
                                            if (currentUser?.id) {
                                                updatedLikedBy = updatedLikedBy.filter(id => id !== currentUser.id);
                                            }

                                            const updated = { ...localPost, reactions: updatedReactions, likedBy: updatedLikedBy };
                                            setLocalPost(updated);
                                            onPostUpdated(updated);
                                        }
                                    }}
                                    className="hover:scale-125 transition-transform p-1 text-lg"
                                >
                                    {emoji}
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
