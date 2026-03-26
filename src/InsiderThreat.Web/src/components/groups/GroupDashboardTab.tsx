import { useTranslation } from 'react-i18next';
import './GroupDashboardTab.css';

export default function GroupDashboardTab() {
    const { t } = useTranslation();

    return (
        <div className="dashboardTab">
            {/* Quick Actions & Header */}
            <div className="dashboard-topBar">
                <div className="quickActions">
                    <button className="actionBtn">
                        <span className="material-symbols-outlined" style={{color: '#8b5cf6'}}>request_quote</span> 
                        {t('group_dash.send_invoice', 'Send an invoice')}
                    </button>
                    <button className="actionBtn">
                        <span className="material-symbols-outlined" style={{color: '#3b82f6'}}>description</span> 
                        {t('group_dash.draft_proposal', 'Draft a Proposal')}
                    </button>
                    <button className="actionBtn">
                        <span className="material-symbols-outlined" style={{color: '#f59e0b'}}>contract</span> 
                        {t('group_dash.create_contract', 'Create a contract')}
                    </button>
                    <button className="actionBtn">
                        <span className="material-symbols-outlined" style={{color: '#10b981'}}>note_add</span> 
                        {t('group_dash.add_form', 'Add a form')}
                    </button>
                </div>
                <div className="topBar-right">
                    <div className="memberPile">
                        <img src="https://i.pravatar.cc/150?u=12" alt="team" className="avatar-overlap" />
                        <img src="https://i.pravatar.cc/150?u=24" alt="team" className="avatar-overlap" />
                        <span className="avatar-more">+2</span>
                    </div>
                    <button className="inviteBtn">
                        <span className="material-symbols-outlined" style={{fontSize: 18}}>person_add</span> 
                        {t('group_dash.invite', 'Invite')}
                    </button>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="statCards-grid">
                <div className="statCard">
                    <p className="statLabel">{t('group_dash.total_projects', 'Total Projects')}</p>
                    <div className="statValueWrap">
                        <span className="statValue">12</span>
                        <span className="statSubvalue">{t('group_dash.active_projects', 'Active Projects')}</span>
                    </div>
                </div>
                <div className="statCard">
                    <p className="statLabel">{t('group_dash.total_task', 'Total Task')}</p>
                    <div className="statValueWrap">
                        <span className="statValue">108</span>
                        <span className="statSubvalue">{t('group_dash.tasks_created', 'Tasks Created')}</span>
                    </div>
                </div>
                <div className="statCard">
                    <p className="statLabel">{t('group_dash.in_progress', 'In Progress')}</p>
                    <div className="statValueWrap">
                        <span className="statValue">12</span>
                        <span className="statSubvalue">{t('group_dash.task_unit', 'Task')}</span>
                    </div>
                </div>
                <div className="statCard">
                    <p className="statLabel">{t('group_dash.completed', 'Completed')}</p>
                    <div className="statValueWrap">
                        <span className="statValue">76</span>
                        <span className="statSubvalue">{t('group_dash.task_unit', 'Task')}</span>
                    </div>
                </div>
            </div>

            <div className="dashboard-mainGrid">
                <div className="mainGrid-left">
                    <div className="panelCard">
                        <div className="panelHeader">
                            <h3>{t('group_dash.time_based_activity', 'Time-Based Activity Map')}</h3>
                            <div className="panelTabs">
                                <span>Daily</span>
                                <span>Weekly</span>
                                <span className="active">Monthly</span>
                                <span>Yearly</span>
                            </div>
                        </div>
                        <div className="activityMapPlaceholder">
                            {/* Gantt Chart Mockup */}
                            <div className="ganttRow">
                                <span className="ganttLabel">Dashboard Design</span>
                                <div className="ganttTrack">
                                    <div className="ganttBar" style={{width: '60%', background: '#e0e7ff', color: '#4f46e5'}}>
                                        Update Brand Logo Guidelines
                                    </div>
                                </div>
                            </div>
                            <div className="ganttRow">
                                <span className="ganttLabel">Mobile App</span>
                                <div className="ganttTrack">
                                    <div className="ganttBar" style={{width: '40%', marginLeft: '20%', background: '#ffedd5', color: '#ea580c'}}>
                                        Setup Wireframe
                                    </div>
                                </div>
                            </div>
                            <div className="ganttRow">
                                <span className="ganttLabel">Landing Page</span>
                                <div className="ganttTrack">
                                    <div className="ganttBar" style={{width: '30%', marginLeft: '50%', background: '#e0e7ff', color: '#4f46e5'}}>
                                        Update ABC Project
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="panelCard">
                        <div className="panelHeader">
                            <h3>{t('group_dash.today_projects', 'Today Projects')}</h3>
                            <button className="btnDark">+ {t('group_dash.new_project', 'New Project')}</button>
                        </div>
                        <div className="projectsGrid">
                            <div className="projectBlock">
                                <h4>Setup Wireframe</h4>
                                <p>Automate deployment process for Designer team</p>
                            </div>
                            <div className="projectBlock">
                                <h4>Update Brand Logo</h4>
                                <p>Minor revision on logo usage guide</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mainGrid-right">
                    <div className="panelCard">
                        <div className="panelHeader">
                            <h3>{t('group_dash.team', 'Team')}</h3>
                            <span className="material-symbols-outlined" style={{cursor: 'pointer', color: 'var(--color-text-muted)'}}>more_horiz</span>
                        </div>
                        <div className="teamList">
                            <div className="teamMember">
                                <img src="https://i.pravatar.cc/150?u=12" alt="Jerome" className="memberAvatar" />
                                <div><p className="memberName">Jerome Bell</p><p className="memberRole">Creative Director</p></div>
                            </div>
                            <div className="teamMember">
                                <img src="https://i.pravatar.cc/150?u=24" alt="Brooklyn" className="memberAvatar" />
                                <div><p className="memberName">Brooklyn Simmons</p><p className="memberRole">UI Designer</p></div>
                            </div>
                            <div className="teamMember">
                                <img src="https://i.pravatar.cc/150?u=36" alt="Cameron" className="memberAvatar" />
                                <div><p className="memberName">Cameron Williamson</p><p className="memberRole">Project Manager</p></div>
                            </div>
                            <div className="teamMember">
                                <img src="https://i.pravatar.cc/150?u=48" alt="Robert" className="memberAvatar" />
                                <div><p className="memberName">Robert Fox</p><p className="memberRole">Graphic Design</p></div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="panelCard" style={{marginTop: '20px'}}>
                        <div className="panelHeader">
                            <h3>{t('group_dash.upcoming_meeting', 'Upcoming Meeting')}</h3>
                        </div>
                        <div className="meetingBlock">
                            <h4>Dev Sync Meeting</h4>
                            <p>Monday, Feb 6, 2027 • 10:00 AM</p>
                        </div>
                        <div className="meetingBlock" style={{marginTop: '12px'}}>
                            <h4>ABC Project Meeting</h4>
                            <p>Tuesday, Feb 7, 2027 • 02:00 PM</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
