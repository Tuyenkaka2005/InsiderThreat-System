import json
import os

def add_project_detail(file_path, project_detail):
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    data['project_detail'] = project_detail
    
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

vi_detail = {
    "tabs": {
        "dashboard": "Tổng quan",
        "mytasks": "Công việc của tôi",
        "timeline": "Lộ trình",
        "files": "Tài liệu"
    },
    "breadcrumbs": {
        "workspace": "Không gian làm việc",
        "projects": "Dự án"
    },
    "header": {
        "subtitle": "Quản lý và theo dõi tiến độ dự án",
        "sprint": "Giai đoạn: Digital Rebrand"
    },
    "stats": {
        "health": "Điểm sức khỏe",
        "total": "Tổng số Task",
        "progress": "Đang thực hiện",
        "completed": "Đã hoàn thành",
        "sub_health": "Sức khỏe dự án",
        "sub_total": "Task đã tạo",
        "sub_progress": "Đang hoạt động",
        "sub_completed": "Task xong"
    },
    "timeline": {
        "title": "Lộ trình dự án",
        "subtitle": "Kế hoạch chiến lược cho dự án",
        "daily": "Ngày",
        "weekly": "Tuần",
        "monthly": "Tháng"
    },
    "team": {
        "title": "Đội ngũ dự án",
        "invite": "Mời",
        "manage": "Quản lý truy cập"
    },
    "charts": {
        "distribution": "Phân bổ công việc",
        "done": "Đã xong",
        "in_progress": "Đang làm",
        "remaining": "Còn lại",
        "velocity": "Tốc độ trung bình",
        "mood": "Trạng thái nhóm",
        "optimal": "Tối ưu"
    },
    "focus": {
        "title": "Chế độ tập trung",
        "critical": "Đường găng (Critical Path)",
        "overdue": "Quá hạn",
        "milestones": "Chỉ mốc quan trọng"
    },
    "mytasks": {
        "narrative": "DIỄN GIẢI DỰ ÁN",
        "search": "Tìm kiếm công việc...",
        "board": "Bảng",
        "list": "Danh sách",
        "filters": "Bộ lọc",
        "add_new": "Thêm mới",
        "add_task": "Thêm công việc"
    },
    "files": {
        "resource_library": "THƯ VIỆN TÀI NGUYÊN",
        "project_assets": "Tài liệu dự án",
        "search": "Tìm tài liệu...",
        "upload": "Tải lên",
        "drop_zone": "Kéo thả tệp vào đây để tải lên",
        "storage_usage": "Dung lượng sử dụng",
        "used": "ĐÃ DÙNG",
        "total": "TỔNG CỘNG",
        "license": "GIẤY PHÉP KHÔNG GIỚI HẠN"
    }
}

en_detail = {
    "tabs": {
        "dashboard": "Dashboard",
        "mytasks": "My Tasks",
        "timeline": "Timeline",
        "files": "Files"
    },
    "breadcrumbs": {
        "workspace": "Workspace",
        "projects": "Projects"
    },
    "header": {
        "subtitle": "Manage and track project progress",
        "sprint": "Sprint: Digital Rebrand"
    },
    "stats": {
        "health": "Health Score",
        "total": "Total Tasks",
        "progress": "In Progress",
        "completed": "Completed",
        "sub_health": "Project health",
        "sub_total": "Tasks created",
        "sub_progress": "Active tasks",
        "sub_completed": "Done tasks"
    },
    "timeline": {
        "title": "Project Timeline",
        "subtitle": "Strategic timeline for the project rollout",
        "daily": "Daily",
        "weekly": "Weekly",
        "monthly": "Monthly"
    },
    "team": {
        "title": "Project Squad",
        "invite": "Invite",
        "manage": "Manage Access"
    },
    "charts": {
        "distribution": "Task Distribution",
        "done": "Done",
        "in_progress": "In Progress",
        "remaining": "Remaining",
        "velocity": "TOTAL VELOCITY",
        "mood": "TEAM MOOD",
        "optimal": "Optimal"
    },
    "focus": {
        "title": "Focus Mode",
        "critical": "Critical Path",
        "overdue": "Overdue Tasks",
        "milestones": "Milestones only"
    },
    "mytasks": {
        "narrative": "PROJECT NARRATIVE",
        "search": "Search tasks...",
        "board": "Board",
        "list": "List",
        "filters": "Filters",
        "add_new": "Add New",
        "add_task": "Add task"
    },
    "files": {
        "resource_library": "RESOURCE LIBRARY",
        "project_assets": "Project Assets",
        "search": "Search files...",
        "upload": "Upload",
        "drop_zone": "Drop files here to upload",
        "storage_usage": "Storage Usage",
        "used": "USED",
        "total": "TOTAL",
        "license": "UNLIMITED SEAT LICENSE"
    }
}

add_project_detail(r'c:\InsiderThreat-System\InsiderThreat-System\src\InsiderThreat.Web\src\i18n\locales\vi.json', vi_detail)
add_project_detail(r'c:\InsiderThreat-System\InsiderThreat-System\src\InsiderThreat.Web\src\i18n\locales\en.json', en_detail)
