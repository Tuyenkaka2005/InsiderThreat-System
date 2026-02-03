import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';
import { userService } from '../services/userService';
import { api } from '../services/api';
import type { User } from '../types';

export default function ProfilePage() {
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [formData, setFormData] = useState({
        fullName: '',
        department: '',
        email: ''
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const currentUser = authService.getCurrentUser();
        if (currentUser) {
            setUser(currentUser);
            setFormData({
                fullName: currentUser.fullName || '',
                department: currentUser.department || '',
                email: currentUser.email || ''
            });
        } else {
            // navigate('/login');
        }
    }, [navigate]);

    const handleEditClick = () => {
        if (user) {
            setFormData({
                fullName: user.fullName || '',
                department: user.department || '',
                email: user.email || ''
            });
            setIsEditing(true);
        }
    };

    const handleSaveProfile = async () => {
        if (!user || !user.id) return;

        try {
            await userService.updateUser(user.id, {
                fullName: formData.fullName,
                department: formData.department,
                email: formData.email
            });

            // Update local state
            const updatedUser = { ...user, ...formData };
            setUser(updatedUser);
            // Update auth service storage if necessary or just rely on state until refresh
            localStorage.setItem('user', JSON.stringify(updatedUser));

            setIsEditing(false);
        } catch (error) {
            console.error('Failed to update profile:', error);
            alert('Failed to update profile');
        }
    };

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !user || !user.id) return;

        setIsUploading(true);
        const uploadFormData = new FormData();
        uploadFormData.append('file', file);

        try {
            // Upload file
            const response = await api.post<{ url: string }>('/api/upload', uploadFormData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            // ASP.NET Core default JSON serialization is camelCase
            const avatarUrl = response.url; // url not Url

            // Update user profile with new avatar URL
            // Assuming backend returns relative path like /uploads/filename.jpg, we might need full URL if backend doesn't handle static files at root properly, but usually it does.
            // Let's assume the returned Url is what we save.

            // Construct full URL if needed, but let's save what server gives.
            // The server returns /uploads/filename
            // Currently server runs on port 5038.
            // The Url returned is relative. E.g. /uploads/guid.jpg
            // We should store this relative path or full path. Storing relative is better?
            // User.cs expects AvatarUrl.

            // NOTE: The current API base URL is http://127.0.0.1:5038
            // If we save relative path, we need to prepend API_BASE_URL when displaying.
            // Or we can save full URL.
            // Let's save the relative path as returned by UploadController,
            // and when displaying, check if it starts with http. If not, prepend API_BASE_URL.

            // Actually, let's just save the full URL to make it easier for now,
            // or modify the display logic.
            // Let's modify display logic to handle relative URLs.

            await userService.updateUser(user.id, {
                avatarUrl: avatarUrl
            });

            const updatedUser = { ...user, avatarUrl: avatarUrl };
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));

        } catch (error) {
            console.error('Failed to upload avatar:', error);
            alert('Failed to upload avatar');
        } finally {
            setIsUploading(false);
        }
    };

    // Fallback if user is loading or not found
    if (!user) return <div className="min-h-screen bg-[#111418] text-white flex items-center justify-center">Loading...</div>;

    // Helper to get display Avatar URL
    const getDisplayAvatarUrl = (url?: string) => {
        if (!url) return `https://i.pravatar.cc/150?u=${user.username}`;
        if (url.startsWith('http')) return url;
        return `http://127.0.0.1:5038${url}`; // Prepend API URL for relative paths
    };

    const avatarUrl = getDisplayAvatarUrl(user.avatarUrl);

    return (
        <div className="flex min-h-screen w-full flex-col bg-[#f6f7f8] dark:bg-[#111418] text-slate-900 dark:text-white font-[Inter]">
            {/* Top Navigation Bar */}
            <header className="sticky top-0 z-50 flex items-center justify-between whitespace-nowrap border-b border-solid border-b-[#283039] bg-[#111418]/95 backdrop-blur-md px-4 py-3 lg:px-10">
                <div className="flex items-center gap-4 lg:gap-8">
                    <div className="flex items-center gap-4 text-white cursor-pointer" onClick={() => navigate('/feed')}>
                        <div className="size-8 text-[#137fec]">
                            <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                                <path d="M13.8261 17.4264C16.7203 18.1174 20.2244 18.5217 24 18.5217C27.7756 18.5217 31.2797 18.1174 34.1739 17.4264C36.9144 16.7722 39.9967 15.2331 41.3563 14.1648L24.8486 40.6391C24.4571 41.267 23.5429 41.267 23.1514 40.6391L6.64374 14.1648C8.00331 15.2331 11.0856 16.7722 13.8261 17.4264Z" fill="currentColor"></path>
                                <path clipRule="evenodd" d="M39.998 12.236C39.9944 12.2537 39.9875 12.2845 39.9748 12.3294C39.9436 12.4399 39.8949 12.5741 39.8346 12.7175C39.8168 12.7597 39.7989 12.8007 39.7813 12.8398C38.5103 13.7113 35.9788 14.9393 33.7095 15.4811C30.9875 16.131 27.6413 16.5217 24 16.5217C20.3587 16.5217 17.0125 16.131 14.2905 15.4811C12.0012 14.9346 9.44505 13.6897 8.18538 12.8168C8.17384 12.7925 8.16216 12.767 8.15052 12.7408C8.09919 12.6249 8.05721 12.5114 8.02977 12.411C8.00356 12.3152 8.00039 12.2667 8.00004 12.2612C8.00004 12.261 8 12.2607 8.00004 12.2612C8.00004 12.2359 8.0104 11.9233 8.68485 11.3686C9.34546 10.8254 10.4222 10.2469 11.9291 9.72276C14.9242 8.68098 19.1919 8 24 8C28.8081 8 33.0758 8.68098 36.0709 9.72276C37.5778 10.2469 38.6545 10.8254 39.3151 11.3686C39.9006 11.8501 39.9857 12.1489 39.998 12.236ZM4.95178 15.2312L21.4543 41.6973C22.6288 43.5809 25.3712 43.5809 26.5457 41.6973L43.0534 15.223C43.0709 15.1948 43.0878 15.1662 43.104 15.1371L41.3563 14.1648C43.104 15.1371 43.1038 15.1374 43.104 15.1371L43.1051 15.135L43.1065 15.1325L43.1101 15.1261L43.1199 15.1082C43.1276 15.094 43.1377 15.0754 43.1497 15.0527C43.1738 15.0075 43.2062 14.9455 43.244 14.8701C43.319 14.7208 43.4196 14.511 43.5217 14.2683C43.6901 13.8679 44 13.0689 44 12.2609C44 10.5573 43.003 9.22254 41.8558 8.2791C40.6947 7.32427 39.1354 6.55361 37.385 5.94477C33.8654 4.72057 29.133 4 24 4C18.867 4 14.1346 4.72057 10.615 5.94478C8.86463 6.55361 7.30529 7.32428 6.14419 8.27911C4.99695 9.22255 3.99999 10.5573 3.99999 12.2609C3.99999 13.1275 4.29264 13.9078 4.49321 14.3607C4.60375 14.6102 4.71348 14.8196 4.79687 14.9689C4.83898 15.0444 4.87547 15.1065 4.9035 15.1529C4.91754 15.1762 4.92954 15.1957 4.93916 15.2111L4.94662 15.223L4.95178 15.2312ZM35.9868 18.996L24 38.22L12.0131 18.996C12.4661 19.1391 12.9179 19.2658 13.3617 19.3718C16.4281 20.1039 20.0901 20.5217 24 20.5217C27.9099 20.5217 31.5719 20.1039 34.6383 19.3718C35.082 19.2658 35.5339 19.1391 35.9868 18.996Z" fill="currentColor" fillRule="evenodd"></path>
                            </svg>
                        </div>
                        <h2 className="text-white text-lg font-bold leading-tight tracking-[-0.015em] hidden sm:block">SocialNet</h2>
                    </div>

                    {/* Search Bar */}
                    <label className="flex flex-col min-w-40 !h-10 max-w-64 lg:w-96">
                        <div className="flex w-full flex-1 items-stretch rounded-xl h-full">
                            <div className="text-[#9dabb9] flex border-none bg-[#283039] items-center justify-center pl-4 rounded-l-xl border-r-0">
                                <span className="material-symbols-outlined">search</span>
                            </div>
                            <input className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-white focus:outline-0 focus:ring-0 border-none bg-[#283039] focus:border-none h-full placeholder:text-[#9dabb9] px-4 rounded-l-none border-l-0 pl-2 text-base font-normal leading-normal" placeholder="Search..." />
                        </div>
                    </label>
                </div>

                <div className="flex items-center justify-end gap-4 lg:gap-8">
                    <button className="flex items-center justify-center text-[#9dabb9] hover:text-white transition-colors relative">
                        <span className="material-symbols-outlined">chat_bubble</span>
                        <span className="absolute top-0 right-0 size-2 bg-red-500 rounded-full border border-[#111418]"></span>
                    </button>
                    <button className="flex items-center justify-center text-[#9dabb9] hover:text-white transition-colors">
                        <span className="material-symbols-outlined">notifications</span>
                    </button>
                    <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 ring-2 ring-[#283039] cursor-pointer" style={{ backgroundImage: `url(${avatarUrl})` }}></div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex flex-1 justify-center py-5 px-4 lg:px-8 xl:px-40">
                <div className="flex flex-col max-w-[1200px] flex-1 w-full gap-5">
                    {/* Profile Hero Section */}
                    <div className="flex flex-col w-full bg-[#283039]/30 rounded-xl overflow-hidden shadow-sm">
                        {/* Cover Image */}
                        <div className="w-full bg-center bg-no-repeat bg-cover h-48 md:h-64 lg:h-80 relative" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDkjvK405c9kygPu-McjoGoNz93gEiXxBm6Lwatwqv_9EhU5ra1ZB5Yo50KJJBiSHrD5ltyTlcxpclF3mGnLIIBXsucZdKeHtyR5n_DnMnNyJIX9diIziIYPhFxs7-3iEjhrlwNGCuS0lq0vR-6CNsWhU8nkk3NHbrQL0Z6pgQ7gRq_XJwV83t0NspdQzSdNfCwGiV2RkHDGFzxCaLkKC7cpIdzW7mndxjgARC0TJqxx-4fJKQ270zAz3mpPWYbXm87T2lnU-9oH1uR")' }}>
                            <div className="absolute inset-0 bg-gradient-to-t from-[#111418]/80 to-transparent"></div>
                        </div>

                        {/* Profile Info & Actions */}
                        <div className="px-4 pb-4 md:px-8">
                            <div className="flex flex-col md:flex-row gap-4 items-start md:items-end -mt-16 relative z-10">
                                {/* Avatar */}
                                <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
                                    <div className="bg-center bg-no-repeat bg-cover rounded-full size-32 md:size-40 ring-4 ring-[#111418] bg-[#111418]" style={{ backgroundImage: `url(${avatarUrl})` }}></div>
                                    <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="material-symbols-outlined text-white text-3xl">photo_camera</span>
                                    </div>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                    />
                                    {isUploading && (
                                        <div className="absolute inset-0 rounded-full bg-black/70 flex items-center justify-center">
                                            <div className="size-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                    )}
                                </div>

                                {/* Name & Title */}
                                <div className="flex flex-col flex-1 mb-2">
                                    <div className="flex items-center gap-2">
                                        <h1 className="text-white text-2xl md:text-3xl font-bold leading-tight">{user.fullName || user.username}</h1>
                                        <span className="material-symbols-outlined text-[#137fec] text-[20px] md:text-[24px]" title="Verified Account">verified</span>
                                    </div>
                                    <p className="text-[#9dabb9] text-base md:text-lg font-normal">{user.department || 'Insider Threat System User'}</p>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-3 mt-4 md:mt-0 mb-2 w-full md:w-auto">
                                    <button
                                        onClick={handleEditClick}
                                        className="flex-1 md:flex-auto min-w-[100px] cursor-pointer items-center justify-center rounded-xl h-10 px-6 bg-[#137fec] hover:bg-[#137fec]/90 transition-colors text-white text-sm font-bold tracking-[0.015em] shadow-lg shadow-[#137fec]/20"
                                    >
                                        Edit Profile
                                    </button>
                                    <button className="flex-1 md:flex-auto min-w-[100px] cursor-pointer items-center justify-center rounded-xl h-10 px-6 bg-[#283039] hover:bg-[#3b4754] transition-colors text-white text-sm font-bold tracking-[0.015em] border border-[#3b4754]">
                                        Settings
                                    </button>
                                    <button className="cursor-pointer items-center justify-center rounded-xl h-10 px-3 bg-[#283039] hover:bg-[#3b4754] transition-colors text-white border border-[#3b4754]">
                                        <span className="material-symbols-outlined text-[20px]">more_horiz</span>
                                    </button>
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="h-px bg-[#3b4754] w-full my-6"></div>

                            {/* Stats Bar */}
                            <div className="flex items-center gap-8 md:gap-12 px-2 overflow-x-auto no-scrollbar">
                                <div className="flex flex-col items-center cursor-pointer group">
                                    <span className="text-white text-lg font-bold group-hover:text-[#137fec] transition-colors">12</span>
                                    <span className="text-[#9dabb9] text-sm">Friends</span>
                                </div>
                                <div className="flex flex-col items-center cursor-pointer group">
                                    <span className="text-white text-lg font-bold group-hover:text-[#137fec] transition-colors">5</span>
                                    <span className="text-[#9dabb9] text-sm">Posts</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3-Column Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* Left Sidebar (Identity) */}
                        <aside className="lg:col-span-3 lg:sticky lg:top-24 flex flex-col gap-6 order-2 lg:order-1">
                            {/* Intro Card */}
                            <div className="bg-[#283039] rounded-xl p-5 border border-[#3b4754]/50 shadow-sm">
                                <h3 className="text-white text-lg font-bold mb-4">About Me</h3>
                                <p className="text-[#9dabb9] text-sm leading-relaxed mb-6">
                                    System user with access to secure documents and monitoring tools.
                                </p>
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center gap-3 text-[#9dabb9]">
                                        <span className="material-symbols-outlined text-[20px]">badge</span>
                                        <span className="text-sm">Role: <strong className="text-white font-medium">{user.role}</strong></span>
                                    </div>
                                    <div className="flex items-center gap-3 text-[#9dabb9]">
                                        <span className="material-symbols-outlined text-[20px]">mail</span>
                                        <span className="text-sm">Email: {user.email || 'N/A'}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-[#9dabb9]">
                                        <span className="material-symbols-outlined text-[20px]">location_on</span>
                                        <span className="text-sm">Vietnam</span>
                                    </div>
                                </div>
                            </div>
                        </aside>

                        {/* Center Column (Feed) */}
                        <section className="lg:col-span-6 flex flex-col gap-6 order-1 lg:order-2">
                            {/* Create Post Widget */}
                            <div className="bg-[#283039] rounded-xl p-4 border border-[#3b4754]/50 shadow-sm">
                                <div className="flex gap-4 mb-4">
                                    <div className="bg-center bg-no-repeat bg-cover rounded-full size-10 shrink-0" style={{ backgroundImage: `url(${avatarUrl})` }}></div>
                                    <input className="w-full bg-[#111418] border-none rounded-xl px-4 py-2 text-white placeholder:text-[#9dabb9] focus:ring-1 focus:ring-[#137fec] focus:outline-none" placeholder={`What's on your mind, ${user.fullName?.split(' ')[0]}?`} />
                                </div>
                                <div className="flex items-center justify-between pt-2 border-t border-[#3b4754]">
                                    <div className="flex gap-2">
                                        <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#3b4754]/50 text-[#9dabb9] hover:text-white transition-colors">
                                            <span className="material-symbols-outlined text-[20px] text-green-500">image</span>
                                            <span className="text-sm font-medium">Photo</span>
                                        </button>
                                        <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#3b4754]/50 text-[#9dabb9] hover:text-white transition-colors">
                                            <span className="material-symbols-outlined text-[20px] text-blue-500">videocam</span>
                                            <span className="text-sm font-medium">Video</span>
                                        </button>
                                    </div>
                                    <button className="bg-[#137fec] hover:bg-[#137fec]/90 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors">
                                        Post
                                    </button>
                                </div>
                            </div>

                            {/* Post 1 (Text Only) */}
                            <article className="bg-[#283039] rounded-xl border border-[#3b4754]/50 shadow-sm">
                                <div className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-center bg-no-repeat bg-cover rounded-full size-10 cursor-pointer" style={{ backgroundImage: `url(${avatarUrl})` }}></div>
                                        <div>
                                            <h4 className="text-white font-bold text-sm cursor-pointer hover:underline">{user.fullName || user.username}</h4>
                                            <p className="text-[#9dabb9] text-xs">Just now • Public</p>
                                        </div>
                                    </div>
                                    <button className="text-[#9dabb9] hover:text-white">
                                        <span className="material-symbols-outlined">more_horiz</span>
                                    </button>
                                </div>
                                <div className="px-4 pb-4">
                                    <p className="text-white text-base leading-relaxed">
                                        Setting up my profile on the new Insider Threat System! 🚀
                                    </p>
                                </div>
                                <div className="p-4 border-t border-[#3b4754]">
                                    <div className="flex items-center justify-between gap-2">
                                        <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-[#3b4754]/50 text-[#9dabb9] hover:text-white transition-colors group">
                                            <span className="material-symbols-outlined text-[20px] group-hover:text-pink-500 transition-colors">favorite</span>
                                            <span className="text-sm font-medium">Like</span>
                                        </button>
                                        <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-[#3b4754]/50 text-[#9dabb9] hover:text-white transition-colors">
                                            <span className="material-symbols-outlined text-[20px]">comment</span>
                                            <span className="text-sm font-medium">Comment</span>
                                        </button>
                                        <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-[#3b4754]/50 text-[#9dabb9] hover:text-white transition-colors">
                                            <span className="material-symbols-outlined text-[20px]">share</span>
                                            <span className="text-sm font-medium">Share</span>
                                        </button>
                                    </div>
                                </div>
                            </article>
                        </section>

                        {/* Right Sidebar (Social Proof) */}
                        <aside className="lg:col-span-3 lg:sticky lg:top-24 flex flex-col gap-6 order-3">
                            {/* Friends Widget */}
                            <div className="bg-[#283039] rounded-xl p-5 border border-[#3b4754]/50 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex flex-col">
                                        <h3 className="text-white text-lg font-bold">Friends</h3>
                                    </div>
                                    <a className="text-[#137fec] text-sm font-medium hover:underline" href="#">See all</a>
                                </div>
                                <div className="text-[#9dabb9] text-sm text-center py-4">
                                    No friends to show yet.
                                </div>
                            </div>
                        </aside>
                    </div>
                </div>
            </main>

            {/* Edit Profile Modal */}
            {isEditing && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-[#283039] rounded-xl w-full max-w-lg shadow-2xl overflow-hidden border border-[#3b4754]">
                        <div className="flex items-center justify-between p-4 border-b border-[#3b4754]">
                            <h3 className="text-white text-xl font-bold">Edit Profile</h3>
                            <button onClick={() => setIsEditing(false)} className="text-[#9dabb9] hover:text-white">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="p-6 flex flex-col gap-4">
                            <div>
                                <label className="block text-[#9dabb9] text-sm mb-1">Full Name</label>
                                <input
                                    className="w-full bg-[#111418] border border-[#3b4754] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#137fec]"
                                    value={formData.fullName}
                                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                    placeholder="Enter full name"
                                />
                            </div>
                            <div>
                                <label className="block text-[#9dabb9] text-sm mb-1">Email</label>
                                <input
                                    className="w-full bg-[#111418] border border-[#3b4754] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#137fec]"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="Enter email address"
                                />
                            </div>
                            <div>
                                <label className="block text-[#9dabb9] text-sm mb-1">Department</label>
                                <input
                                    className="w-full bg-[#111418] border border-[#3b4754] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#137fec]"
                                    value={formData.department}
                                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                    placeholder="Enter department"
                                />
                            </div>
                        </div>
                        <div className="p-4 border-t border-[#3b4754] flex justify-end gap-3 bg-[#111418]/50">
                            <button
                                onClick={() => setIsEditing(false)}
                                className="px-4 py-2 rounded-lg text-[#9dabb9] hover:text-white font-medium hover:bg-[#3b4754] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveProfile}
                                className="px-6 py-2 rounded-lg bg-[#137fec] hover:bg-[#137fec]/90 text-white font-bold shadow-lg shadow-[#137fec]/20 transition-colors"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
