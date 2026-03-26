import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './CreateTaskModal.css';

interface CreateTaskModalProps {
    onClose: () => void;
    onSubmit: (taskData: any) => void;
}

export default function CreateTaskModal({ onClose, onSubmit }: CreateTaskModalProps) {
    const { t } = useTranslation();
    const [title, setTitle] = useState('');
    const [status, setStatus] = useState('On Progress');
    const [dueDate, setDueDate] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState('Urgent');

    return (
        <div className="taskModal-overlay" onClick={onClose}>
            <div className="taskModal-content" onClick={e => e.stopPropagation()}>
                <div className="taskModal-header">
                    <h2>Create Task</h2>
                    <button className="iconBtn" onClick={onClose}>
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                
                <div className="taskModal-body">
                    {/* Title input (Hidden in image but needed usually, maybe skip for now if matching perfectly) */}
                    
                    <div className="taskForm-row">
                        <label><span className="material-symbols-outlined">check_circle</span> Status</label>
                        <div className="taskForm-value">
                            <div className="statusSelect">
                                <span className="material-symbols-outlined" style={{color: '#64748b', fontSize: 18}}>radio_button_unchecked</span>
                                <select value={status} onChange={e => setStatus(e.target.value)}>
                                    <option value="To-do">To-do</option>
                                    <option value="On Progress">On Progress</option>
                                    <option value="In Review">In Review</option>
                                    <option value="Completed">Completed</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="taskForm-row">
                        <label><span className="material-symbols-outlined">calendar_today</span> Due date</label>
                        <div className="taskForm-value">
                            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                        </div>
                    </div>

                    <div className="taskForm-row">
                        <label><span className="material-symbols-outlined">person</span> Assignee</label>
                        <div className="taskForm-value assignees">
                            <span className="assigneeTag bg-blue">Kiara Laras ✕</span>
                            <span className="assigneeTag bg-green">Joe Tesla ✕</span>
                            <span className="assigneeTag bg-yellow">Tania ✕</span>
                            <button className="addAssigneeBtn">+</button>
                        </div>
                    </div>

                    <div className="taskForm-row">
                        <label><span className="material-symbols-outlined">sell</span> Tags</label>
                        <div className="taskForm-value">
                            <select className="tagsDropdown">
                                <option>Dashboard</option>
                                <option>UI/UX</option>
                                <option>Backend</option>
                            </select>
                        </div>
                    </div>

                    <div className="taskForm-row">
                        <label><span className="material-symbols-outlined">local_fire_department</span> Priority</label>
                        <div className="taskForm-value">
                            <span className="priorityTag urgent">Urgent</span>
                        </div>
                    </div>

                    <div className="taskForm-row descriptionRow">
                        <label><span className="material-symbols-outlined">notes</span> Description</label>
                        <div className="taskForm-value">
                            <textarea 
                                placeholder="Add description..." 
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                            />
                            <button className="addSectionBtn">+ Add Section</button>
                        </div>
                    </div>

                    <div className="taskModal-comment">
                        <img src="https://i.pravatar.cc/150?u=a1" alt="Me" />
                        <input type="text" placeholder="Add a comment" />
                    </div>
                </div>

                <div className="taskModal-footer">
                    <div className="footer-collaborators">
                        <span>Collaborators</span>
                        <div className="collabPile">
                            <img src="https://i.pravatar.cc/150?u=12" alt="c1" />
                            <img src="https://i.pravatar.cc/150?u=24" alt="c2" />
                            <img src="https://i.pravatar.cc/150?u=36" alt="c3" />
                            <button className="addCollabBtn">+</button>
                        </div>
                    </div>
                    <div className="footer-actions">
                        <button className="btnCancel" onClick={onClose}>Cancel</button>
                        <button className="btnSave" onClick={() => onSubmit({})}>Save</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
