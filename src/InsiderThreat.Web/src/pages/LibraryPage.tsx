import { useState, useEffect } from 'react';
import { Button, Upload, message, Input, Modal, Select, Popconfirm, Avatar } from 'antd';
import {
    SearchOutlined
} from '@ant-design/icons';
import { api, API_BASE_URL } from '../services/api';
import BottomNavigation from '../components/BottomNavigation';
import LeftSidebar from '../components/LeftSidebar';
import './LibraryPage.css';

const { Dragger } = Upload;

interface SharedDocument {
    id: string;
    fileId: string;
    fileName: string;
    contentType: string;
    uploaderId: string;
    uploaderName: string;
    uploadDate: string;
    size: number;
    description?: string;
    minimumRole: string;
    allowedUserIds?: string[];
}

interface UserSummary {
    id: string;
    username: string;
    fullName: string;
    role: string;
    department: string;
}

const LibraryPage = () => {
    const [documents, setDocuments] = useState<SharedDocument[]>([]);
    const [allUsers, setAllUsers] = useState<UserSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [isUploadModalVisible, setIsUploadModalVisible] = useState(false);
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editingDocument, setEditingDocument] = useState<SharedDocument | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [uploadFileList, setUploadFileList] = useState<any[]>([]);

    // Form states
    const [description, setDescription] = useState('');
    const [minRole, setMinRole] = useState('Nhân viên');
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

    const user = JSON.parse(localStorage.getItem('user') || '{}');

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const fetchDocuments = async () => {
        setLoading(true);
        try {
            const data = await api.get<SharedDocument[]>('/api/DocumentLibrary');
            setDocuments(data);
        } catch (error) {
            console.error('Error fetching documents:', error);
            message.error('Không thể tải danh sách tài liệu');
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const users = await api.get<UserSummary[]>('/api/Users');
            setAllUsers(users.filter(u => u.username !== user.username));
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    useEffect(() => {
        fetchDocuments();
        fetchUsers();
    }, []);

    const handleDownload = (doc: SharedDocument) => {
        window.open(`${API_BASE_URL}/api/Upload/${doc.fileId}`, '_blank');
    };

    const handleDelete = async (id: string) => {
        try {
            await api.delete(`/api/DocumentLibrary/${id}`);
            message.success('Đã xóa tài liệu');
            fetchDocuments();
        } catch (error) {
            message.error('Không thể xóa tài liệu');
        }
    };

    const handleOpenEditModal = (doc: SharedDocument) => {
        setEditingDocument(doc);
        setMinRole(doc.minimumRole);
        setSelectedUserIds(doc.allowedUserIds || []);
        setIsEditModalVisible(true);
    };

    const handleUpdatePermissions = async () => {
        if (!editingDocument) return;

        setLoading(true);
        try {
            await api.put(`/api/DocumentLibrary/${editingDocument.id}/permissions`, {
                minimumRole: minRole,
                allowedUserIds: selectedUserIds
            });
            message.success('Đã cập nhật quyền truy cập');
            setIsEditModalVisible(false);
            fetchDocuments();
        } catch (error) {
            console.error('Error updating permissions:', error);
            message.error('Không thể cập nhật quyền truy cập');
        } finally {
            setLoading(false);
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getRoleBadgeStyle = (role: string) => {
        switch (role) {
            case 'Giám đốc': return { bg: '#fff7ed', color: '#c2410c' }; // Orange
            case 'Quản lý': return { bg: '#eff6ff', color: '#1d4ed8' }; // Blue
            case 'Nhân viên': return { bg: '#f0fdf4', color: '#15803d' }; // Green
            default: return { bg: '#f8fafc', color: '#64748b' };
        }
    };

    const getFileIconColor = (fileName: string) => {
        const ext = fileName.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'doc':
            case 'docx': return { icon: 'description', color: '#2563eb', bg: '#eff6ff' };
            case 'xls':
            case 'xlsx': return { icon: 'table_view', color: '#16a34a', bg: '#f0fdf4' };
            case 'pdf': return { icon: 'picture_as_pdf', color: '#ef4444', bg: '#fef2f2' };
            default: return { icon: 'draft', color: '#64748b', bg: '#f8fafc' };
        }
    };

    const uploadProps = {
        name: 'file',
        multiple: true,
        action: `${API_BASE_URL}/api/DocumentLibrary`,
        headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        data: {
            description,
            minimumRole: minRole,
            allowedUserIdsJson: JSON.stringify(selectedUserIds)
        },
        showFileList: false,
        onChange(info: any) {
            setUploadFileList(info.fileList);
            const { status } = info.file;
            if (status === 'done') {
                message.success(`${info.file.name} đã được tải lên thành công.`);
                fetchDocuments();
                setIsUploadModalVisible(false);
                setUploadFileList([]);
                setDescription('');
                setSelectedUserIds([]);
                setMinRole('Nhân viên');
            } else if (status === 'error') {
                const errorMsg = info.file.response?.message || info.file.response || "Lỗi không xác định";
                message.error(`${info.file.name} tải lên thất bại: ${errorMsg}`);
            }
        },
    };

    const filteredDocs = documents.filter(doc =>
        doc.fileName.toLowerCase().includes(searchText.toLowerCase()) ||
        doc.uploaderName.toLowerCase().includes(searchText.toLowerCase())
    );

    return (
        <div className="library-container">
            {!isMobile && <LeftSidebar />}

            <div className="library-main-wrapper">
                <header className="mobile-library-header">
                    <div className="library-icon-badge">
                        <span className="material-symbols-outlined">folder</span>
                    </div>
                    <div className="library-header-text">
                        <h1>Kho tài liệu</h1>
                        <p>Quản lý và chia sẻ tài liệu nội bộ</p>
                    </div>

                    {!isMobile && user.role === 'Admin' && (
                        <Button
                            type="primary"
                            size="large"
                            icon={<span className="material-symbols-outlined" style={{ fontSize: '20px', verticalAlign: 'middle', marginRight: '8px' }}>upload_file</span>}
                            onClick={() => setIsUploadModalVisible(true)}
                            className="desktop-upload-btn"
                        >
                            Thêm tài liệu
                        </Button>
                    )}

                    <Avatar size={40} src="https://i.pravatar.cc/150?u=admin" style={{ marginLeft: 'auto' }} />
                </header>

                <div className="mobile-search-wrapper">
                    <Input
                        placeholder="Tìm kiếm tài liệu hoặc người đăng..."
                        prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        className="mobile-search-input"
                        allowClear
                    />
                </div>

                <main className="mobile-document-list">
                    {loading && documents.length === 0 ? (
                        <div className="p-10 text-center">Đang tải tài liệu...</div>
                    ) : filteredDocs.length === 0 ? (
                        <div className="empty-library">
                            <span className="material-symbols-outlined">folder_off</span>
                            <p>Không thấy tài liệu nào</p>
                        </div>
                    ) : (
                        <div className="doc-grid">
                            {filteredDocs.map(doc => {
                                const iconData = getFileIconColor(doc.fileName);
                                const badgeStyle = getRoleBadgeStyle(doc.minimumRole);
                                return (
                                    <div key={doc.id} className="doc-card">
                                        <div className="doc-card-header">
                                            <div className="doc-icon-container" style={{ backgroundColor: iconData.bg, color: iconData.color }}>
                                                <span className="material-symbols-outlined">{iconData.icon}</span>
                                            </div>
                                            <span className="role-badge-compact" style={{ backgroundColor: badgeStyle.bg, color: badgeStyle.color }}>
                                                {doc.minimumRole}
                                            </span>
                                        </div>

                                        <div className="doc-info">
                                            <h3>{doc.fileName}</h3>
                                            <p className="doc-uploader">{doc.uploaderName}</p>
                                        </div>

                                        <div className="doc-metadata">
                                            <div className="meta-item">
                                                <span className="material-symbols-outlined">calendar_today</span>
                                                <span>{new Date(doc.uploadDate).toLocaleDateString()}</span>
                                            </div>
                                            <div className="meta-item">
                                                <span className="material-symbols-outlined">database</span>
                                                <span>{formatSize(doc.size)}</span>
                                            </div>
                                        </div>

                                        <div className="doc-actions">
                                            <button className="doc-action-btn" onClick={() => handleDownload(doc)}>
                                                <span className="material-symbols-outlined">download</span>
                                            </button>
                                            {user.role === 'Admin' && (
                                                <button className="doc-action-btn" onClick={() => handleOpenEditModal(doc)}>
                                                    <span className="material-symbols-outlined">edit</span>
                                                </button>
                                            )}
                                            <button className="doc-action-btn">
                                                <span className="material-symbols-outlined">folder</span>
                                            </button>
                                            {user.role === 'Admin' && (
                                                <Popconfirm
                                                    title="Xóa tài liệu"
                                                    description="Bạn có muốn xóa vĩnh viễn tệp này?"
                                                    onConfirm={() => handleDelete(doc.id)}
                                                    okText="Xóa"
                                                    cancelText="Hủy"
                                                    okButtonProps={{ danger: true }}
                                                >
                                                    <button className="doc-action-btn delete-btn">
                                                        <span className="material-symbols-outlined">delete</span>
                                                    </button>
                                                </Popconfirm>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </main>

                <div className="pagination-dots">
                    <div className="dot active"></div>
                    <div className="dot"></div>
                    <div className="dot"></div>
                </div>

                {isMobile && (
                    <button className="dark-mode-fab">
                        <span className="material-symbols-outlined">dark_mode</span>
                    </button>
                )}

                {user.role === 'Admin' && (
                    <button className="floating-upload-btn" onClick={() => setIsUploadModalVisible(true)}>
                        <span className="material-symbols-outlined">upload_file</span>
                    </button>
                )}

                <BottomNavigation />
            </div>

            <Modal
                title={null}
                open={isUploadModalVisible}
                onCancel={() => setIsUploadModalVisible(false)}
                footer={null}
                className="mobile-modal"
                width={isMobile ? "100%" : 600}
                style={isMobile ? { top: 0, margin: 0, maxWidth: '100vw' } : {}}
                getContainer={false} // Help with potential z-index/portal issues for selects
            >
                <div className="modal-header-mobile">
                    <button className="back-btn-mobile" onClick={() => setIsUploadModalVisible(false)}>
                        <span className="material-symbols-outlined">arrow_back_ios</span>
                    </button>
                    <h2>Tải tài liệu lên</h2>
                </div>

                <div className="modal-body-mobile">
                    <div className="upload-field">
                        <label className="field-label">Tên tài liệu</label>
                        <Input
                            placeholder="Nhập tên tài liệu..."
                            className="mobile-input"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                        />
                    </div>

                    <div className="upload-field">
                        <label className="field-label">Cấp bậc tối thiểu</label>
                        <Select
                            className="mobile-select"
                            value={minRole}
                            onChange={value => setMinRole(value)}
                            getPopupContainer={triggerNode => triggerNode.parentElement}
                            options={[
                                { value: 'Giám đốc', label: 'Giám đốc' },
                                { value: 'Quản lý', label: 'Quản lý trở lên' },
                                { value: 'Nhân viên', label: 'Tất cả nhân viên' },
                            ]}
                        />
                    </div>

                    <div className="upload-field">
                        <label className="field-label">Người được xem (Tùy chọn)</label>
                        <Select
                            mode="multiple"
                            className="mobile-select"
                            placeholder="Chọn người được phép xem..."
                            value={selectedUserIds}
                            onChange={ids => setSelectedUserIds(ids)}
                            getPopupContainer={triggerNode => triggerNode.parentElement}
                            options={allUsers.map(u => ({
                                value: u.id,
                                label: `${u.fullName} (${u.username})`
                            }))}
                            filterOption={(input, option) =>
                                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                            }
                        />
                    </div>

                    <div className="upload-field">
                        <label className="field-label">Tải tệp lên</label>
                        <Dragger {...uploadProps} className="dragger-mobile">
                            <div className="dragger-content-mobile">
                                <div className="upload-cloud-icon">
                                    <span className="material-symbols-outlined">cloud_upload</span>
                                </div>
                                <div className="dragger-text">
                                    <h4>Kéo và thả hoặc Chọn tệp</h4>
                                    <p>Hỗ trợ Word, Excel, PDF (Tối đa 25MB)</p>
                                </div>
                            </div>
                        </Dragger>

                        <div className="mobile-file-list">
                            {uploadFileList.map(file => (
                                <div key={file.uid} className="mobile-file-item">
                                    <div className="doc-icon-container" style={{ width: 32, height: 32, fontSize: 18, backgroundColor: '#eff6ff', color: '#2563eb' }}>
                                        <span className="material-symbols-outlined">description</span>
                                    </div>
                                    <div className="file-name-info">
                                        <span className="name">{file.name}</span>
                                        <span className="size">{formatSize(file.size || 0)}</span>
                                    </div>
                                    <button className="remove-file-btn">
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="modal-footer-mobile">
                    <Button type="primary" className="mobile-primary-btn" onClick={() => (document.querySelector('.dragger-mobile input') as HTMLInputElement)?.click()}>
                        Tải lên
                    </Button>
                    <Button className="mobile-secondary-btn" onClick={() => setIsUploadModalVisible(false)}>
                        Hủy
                    </Button>
                </div>
            </Modal>

            {/* Edit Permissions Modal */}
            <Modal
                title={null}
                open={isEditModalVisible}
                onCancel={() => setIsEditModalVisible(false)}
                footer={null}
                className="mobile-modal"
                width={isMobile ? "100%" : 600}
                style={isMobile ? { top: 0, margin: 0, maxWidth: '100vw' } : {}}
                getContainer={false}
            >
                <div className="modal-header-mobile">
                    <button className="back-btn-mobile" onClick={() => setIsEditModalVisible(false)}>
                        <span className="material-symbols-outlined">arrow_back_ios</span>
                    </button>
                    <h2>Sửa quyền xem</h2>
                </div>

                <div className="modal-body-mobile">
                    <div className="upload-field">
                        <label className="field-label">Tên tài liệu</label>
                        <Input
                            value={editingDocument?.fileName}
                            disabled
                            className="mobile-input"
                            style={{ opacity: 0.7 }}
                        />
                    </div>

                    <div className="upload-field">
                        <label className="field-label">Cấp bậc tối thiểu</label>
                        <Select
                            className="mobile-select"
                            value={minRole}
                            onChange={value => setMinRole(value)}
                            getPopupContainer={triggerNode => triggerNode.parentElement}
                            options={[
                                { value: 'Giám đốc', label: 'Giám đốc' },
                                { value: 'Quản lý', label: 'Quản lý trở lên' },
                                { value: 'Nhân viên', label: 'Tất cả nhân viên' },
                            ]}
                        />
                    </div>

                    <div className="upload-field">
                        <label className="field-label">Người được xem (Tùy chọn)</label>
                        <Select
                            mode="multiple"
                            className="mobile-select"
                            placeholder="Chọn người được phép xem..."
                            value={selectedUserIds}
                            onChange={ids => setSelectedUserIds(ids)}
                            getPopupContainer={triggerNode => triggerNode.parentElement}
                            options={allUsers.map(u => ({
                                value: u.id,
                                label: `${u.fullName} (${u.username})`
                            }))}
                            filterOption={(input, option) =>
                                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                            }
                        />
                    </div>
                </div>

                <div className="modal-footer-mobile">
                    <Button
                        type="primary"
                        className="mobile-primary-btn"
                        onClick={handleUpdatePermissions}
                        loading={loading}
                    >
                        Lưu thay đổi
                    </Button>
                    <Button className="mobile-secondary-btn" onClick={() => setIsEditModalVisible(false)}>
                        Hủy
                    </Button>
                </div>
            </Modal>
        </div>
    );
};

export default LibraryPage;
