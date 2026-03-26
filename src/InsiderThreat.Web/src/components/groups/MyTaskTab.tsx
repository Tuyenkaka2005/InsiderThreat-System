import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import CreateTaskModal from './CreateTaskModal';
import './MyTaskTab.css';

export default function MyTaskTab() {
    const { t } = useTranslation();
    const [viewMode, setViewMode] = useState<'kanban' | 'timeline' | 'spreadsheet'>('kanban');
    const [showCreateTask, setShowCreateTask] = useState(false);

    return (
        <div className="myTaskTab">
            {/* Header Area */}
            <div className="myTask-topBar">
                <div className="topBar-left">
                    <h2>My Task</h2>
                </div>
                <div className="topBar-right">
                    <div className="searchTask">
                        <span className="material-symbols-outlined">search</span>
                        <input type="text" placeholder={t('mytask.search_task', 'Search task...')} />
                    </div>
                    <button className="iconBtn" title="Share"><span className="material-symbols-outlined">share</span></button>
                    <button className="iconBtn" title="Notifications"><span className="material-symbols-outlined">notifications</span></button>
                    <div className="divider"></div>
                    <span className="lastSync">3 min ago</span>
                    <div className="memberPile">
                        <img src="https://i.pravatar.cc/150?u=12" alt="Avatar" className="avatar-overlap" />
                        <img src="https://i.pravatar.cc/150?u=24" alt="Avatar" className="avatar-overlap" />
                        <span className="avatar-more">+2</span>
                    </div>
                    <button className="inviteBtn"><span className="material-symbols-outlined" style={{fontSize: 18}}>person_add</span> Invite</button>
                    <button className="btnCreateTask" style={{ background: 'var(--color-text-main)', color: 'var(--color-background)', border: 'none', padding: '6px 16px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => setShowCreateTask(true)}>
                        <span className="material-symbols-outlined" style={{fontSize: 18}}>add</span> New Task
                    </button>
                    <button className="iconBtn"><span className="material-symbols-outlined">more_horiz</span></button>
                </div>
            </div>

            {/* Task Calendar Panel */}
            <div className="panelCard taskCalendar">
                <div className="panelHeader">
                    <h3>Task Calendar</h3>
                    <button className="iconBtn"><span className="material-symbols-outlined">more_horiz</span></button>
                </div>
                <div className="calendarGridWrapper">
                    <div className="calendarHeader">
                        <span>11 Feb</span><span>12 Feb</span><span>13 Feb</span><span>14 Feb</span>
                        <span>15 Feb</span><span>16 Feb</span><span>17 Feb</span><span>18 Feb</span>
                    </div>
                    <div className="calendarBody">
                        <div className="timeBar" style={{ left: '10%', width: '15%', top: '24px' }}>11 Feb: Submit Final Screens</div>
                        <div className="timeBar" style={{ left: '10%', width: '15%', top: '64px' }}>11 Feb: Client Feedback</div>
                        <div className="timeBar dark" style={{ left: '18%', width: '18%', top: '104px', color:'white' }}>12 Feb: Client Feedback Meeting</div>
                        <div className="timeBar" style={{ left: '40%', width: '15%', top: '64px' }}>14 Feb: Prototype Testing</div>
                        <div className="timeBar" style={{ left: '60%', width: '15%', top: '144px' }}>15 Feb: Finalize UI Screens</div>
                        <div className="timeBar" style={{ left: '80%', width: '15%', top: '64px' }}>17 Feb: Update Style</div>
                        
                        <div className="currentTimeLine" style={{ left: '22%' }}>
                            <div className="timeNode"></div>
                            <div style={{position: 'absolute', top: -20, left: -4, fontSize: 10, fontWeight: 700}}>T</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* All Task / Kanban Panel */}
            <div className="panelCard allTaskPanel">
                <div className="panelHeader" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                    <h3>All Task</h3>
                    <div className="taskViewOptions">
                        <div className="viewToggles">
                            <button className={viewMode === 'spreadsheet' ? 'active' : ''} onClick={() => setViewMode('spreadsheet')}>
                                <span className="material-symbols-outlined">grid_on</span> Spreadsheet
                            </button>
                            <button className={viewMode === 'timeline' ? 'active' : ''} onClick={() => setViewMode('timeline')}>
                                <span className="material-symbols-outlined">timeline</span> Timeline
                            </button>
                            <button className={viewMode === 'kanban' ? 'active' : ''} onClick={() => setViewMode('kanban')}>
                                <span className="material-symbols-outlined">view_kanban</span> Kanban
                            </button>
                        </div>
                        <button className="iconBtn"><span className="material-symbols-outlined">filter_list</span></button>
                    </div>
                </div>

                {viewMode === 'kanban' && (
                    <div className="kanbanBoard">
                        {/* To-do Column */}
                        <div className="kanbanColumn">
                            <div className="colHeader">
                                <div className="colTitle"><span className="material-symbols-outlined" style={{color: '#64748b'}}>radio_button_unchecked</span> To-do <span className="colCount">4</span></div>
                                <button className="iconBtn"><span className="material-symbols-outlined">more_horiz</span></button>
                            </div>
                            <div className="kanbanCards">
                                <div className="kCard">
                                    <div className="kCardTop">
                                        <span className="kCardTag">ABC Dashboard</span>
                                        <button className="iconBtn"><span className="material-symbols-outlined">more_horiz</span></button>
                                    </div>
                                    <div className="kCardDate"><span className="material-symbols-outlined" style={{color: '#ef4444', fontSize: 16}}>signal_cellular_alt</span> Feb 12, 2027</div>
                                    <h4 className="kCardTitle">Create Wireframe</h4>
                                    <div className="kCardProgress">
                                        <div className="pText">Progress: 0%</div>
                                        <div className="pBar"><div className="pFill" style={{width: '0%'}}></div></div>
                                    </div>
                                    <div className="kCardFooter">
                                        <div className="kCardMembers">
                                            <img src="https://i.pravatar.cc/150?u=12" alt="User" />
                                            <img src="https://i.pravatar.cc/150?u=24" alt="User" />
                                        </div>
                                        <div className="kCardMeta">
                                            <span><span className="material-symbols-outlined">chat_bubble_outline</span> 3</span>
                                            <span><span className="material-symbols-outlined">attach_file</span> 2</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {/* In Progress Column */}
                        <div className="kanbanColumn">
                            <div className="colHeader">
                                <div className="colTitle">
                                    <span className="material-symbols-outlined" style={{color: '#3b82f6'}}>motion_photos_on</span> 
                                    <span style={{color: '#3b82f6', background: '#eff6ff', padding: '2px 8px', borderRadius: 12}}>In Progress</span> 
                                    <span className="colCount">5</span>
                                </div>
                                <button className="iconBtn"><span className="material-symbols-outlined">more_horiz</span></button>
                            </div>
                            <div className="kanbanCards">
                                <div className="kCard">
                                    <div className="kCardTop">
                                        <span className="kCardTag">Sinen Dashboard</span>
                                        <button className="iconBtn"><span className="material-symbols-outlined">more_horiz</span></button>
                                    </div>
                                    <div className="kCardDate"><span className="material-symbols-outlined" style={{color: '#3b82f6', fontSize: 16}}>signal_cellular_alt</span> Feb 12, 2027</div>
                                    <h4 className="kCardTitle">UI Testing</h4>
                                    <div className="kCardProgress">
                                        <div className="pText">Progress: 25%</div>
                                        <div className="pBar"><div className="pFill" style={{width: '25%', background: '#3b82f6'}}></div></div>
                                    </div>
                                    <div className="kCardFooter">
                                        <div className="kCardMembers">
                                            <img src="https://i.pravatar.cc/150?u=36" alt="User" />
                                            <img src="https://i.pravatar.cc/150?u=48" alt="User" />
                                        </div>
                                        <div className="kCardMeta">
                                            <span><span className="material-symbols-outlined">chat_bubble_outline</span> 14</span>
                                            <span><span className="material-symbols-outlined">link</span> 4</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* In Review Column */}
                        <div className="kanbanColumn">
                            <div className="colHeader">
                                <div className="colTitle">
                                    <span className="material-symbols-outlined" style={{color: '#eab308'}}>remove_red_eye</span> 
                                    <span style={{color: '#eab308', background: '#fefce8', padding: '2px 8px', borderRadius: 12}}>In Review</span> 
                                    <span className="colCount">3</span>
                                </div>
                                <button className="iconBtn"><span className="material-symbols-outlined">more_horiz</span></button>
                            </div>
                            <div className="kanbanCards">
                                <div className="kCard">
                                    <div className="kCardTop">
                                        <span className="kCardTag">Twingkle Website</span>
                                        <button className="iconBtn"><span className="material-symbols-outlined">more_horiz</span></button>
                                    </div>
                                    <div className="kCardDate"><span className="material-symbols-outlined" style={{color: '#3b82f6', fontSize: 16}}>signal_cellular_alt</span> Feb 12, 2027</div>
                                    <h4 className="kCardTitle">Update Style</h4>
                                    <div className="kCardProgress">
                                        <div className="pText">Progress: 55%</div>
                                        <div className="pBar"><div className="pFill" style={{width: '55%', background: '#10b981'}}></div></div>
                                    </div>
                                    <div className="kCardFooter">
                                        <div className="kCardMembers">
                                            <img src="https://i.pravatar.cc/150?u=12" alt="User" />
                                            <img src="https://i.pravatar.cc/150?u=24" alt="User" />
                                        </div>
                                        <div className="kCardMeta">
                                            <span><span className="material-symbols-outlined">chat_bubble_outline</span> 7</span>
                                            <span><span className="material-symbols-outlined">link</span> 1</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Completed Column */}
                        <div className="kanbanColumn">
                            <div className="colHeader">
                                <div className="colTitle">
                                    <span className="material-symbols-outlined" style={{color: '#10b981'}}>check_circle</span> 
                                    <span style={{color: '#10b981', background: '#f0fdf4', padding: '2px 8px', borderRadius: 12}}>Completed</span> 
                                    <span className="colCount">4</span>
                                </div>
                                <button className="iconBtn"><span className="material-symbols-outlined">more_horiz</span></button>
                            </div>
                            <div className="kanbanCards">
                                <div className="kCard">
                                    <div className="kCardTop">
                                        <span className="kCardTag">ABC Dashboard</span>
                                        <button className="iconBtn"><span className="material-symbols-outlined">more_horiz</span></button>
                                    </div>
                                    <div className="kCardDate"><span className="material-symbols-outlined" style={{color: '#ef4444', fontSize: 16}}>signal_cellular_alt</span> Feb 12, 2027</div>
                                    <h4 className="kCardTitle">Create Wireframe</h4>
                                    <div className="kCardProgress">
                                        <div className="pText">Progress: 100%</div>
                                        <div className="pBar"><div className="pFill" style={{width: '100%', background: '#10b981'}}></div></div>
                                    </div>
                                    <div className="kCardFooter">
                                        <div className="kCardMembers">
                                            <img src="https://i.pravatar.cc/150?u=12" alt="User" />
                                            <img src="https://i.pravatar.cc/150?u=24" alt="User" />
                                        </div>
                                        <div className="kCardMeta">
                                            <span><span className="material-symbols-outlined">chat_bubble_outline</span> 3</span>
                                            <span><span className="material-symbols-outlined">attach_file</span> 2</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {showCreateTask && (
                <CreateTaskModal 
                    onClose={() => setShowCreateTask(false)} 
                    onSubmit={() => setShowCreateTask(false)} 
                />
            )}
        </div>
    );
}
