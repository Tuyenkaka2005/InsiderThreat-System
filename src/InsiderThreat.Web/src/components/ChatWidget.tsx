import React, { useState, useEffect, useRef } from 'react';
import { Button, Input, List, Avatar, Card, Tooltip } from 'antd';
import { MessageOutlined, CloseOutlined, SendOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons';
import styles from './ChatWidget.module.css';
import { authService } from '../services/auth';

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'bot';
    timestamp: Date;
}

export const ChatWidget: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', text: 'Xin chào! Tôi là trợ lý ảo AI. Tôi có thể giúp gì cho bạn?', sender: 'bot', timestamp: new Date() }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const user = authService.getCurrentUser();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [messages, isOpen]);

    const handleSend = async () => {
        if (!inputValue.trim()) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            text: inputValue,
            sender: 'user',
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setLoading(true);

        try {
            // Logic gọi Bot API có thể được thêm ở đây
            // Tạm thời mô phỏng phản hồi từ bot
            setTimeout(() => {
                const botMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    text: `Cảm ơn ${user?.fullName || 'bạn'}! Tôi đã nhận được tin nhắn: "${userMsg.text}". Chức năng này đang được phát triển thêm.`,
                    sender: 'bot',
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, botMsg]);
                setLoading(false);
            }, 1000);
        } catch (error) {
            console.error('Error sending message to bot:', error);
            setLoading(false);
        }
    };

    return (
        <div className={styles.widgetContainer}>
            {/* Floating Button */}
            {!isOpen && (
                <Tooltip title="Chat với AI" placement="left">
                    <Button
                        type="primary"
                        shape="circle"
                        size="large"
                        icon={<MessageOutlined style={{ fontSize: '24px' }} />}
                        className={styles.floatingButton}
                        onClick={() => setIsOpen(true)}
                    />
                </Tooltip>
            )}

            {/* Chat Window */}
            {isOpen && (
                <Card
                    className={styles.chatWindow}
                    title={
                        <div className={styles.header}>
                            <div className={styles.headerTitle}>
                                <RobotOutlined className={styles.headerIcon} />
                                <span>Trợ lý AI</span>
                            </div>
                            <Button
                                type="text"
                                icon={<CloseOutlined />}
                                onClick={() => setIsOpen(false)}
                                className={styles.closeButton}
                            />
                        </div>
                    }
                >
                    <div className={styles.messageList}>
                        {messages.map((item) => (
                            <div
                                key={item.id}
                                className={`${styles.messageItem} ${item.sender === 'user' ? styles.userMessage : styles.botMessage}`}
                            >
                                <div className={styles.messageContent}>
                                    <Avatar
                                        icon={item.sender === 'bot' ? <RobotOutlined /> : <UserOutlined />}
                                        className={styles.avatar}
                                        size="small"
                                    />
                                    <div className={styles.bubble}>
                                        {item.text}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className={styles.botThinking}>
                                <span>Bot đang trả lời...</span>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className={styles.inputArea}>
                        <Input
                            placeholder="Nhập tin nhắn..."
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onPressEnter={handleSend}
                            suffix={
                                <Button
                                    type="primary"
                                    icon={<SendOutlined />}
                                    onClick={handleSend}
                                    disabled={!inputValue.trim()}
                                    shape="circle"
                                    size="small"
                                />
                            }
                        />
                    </div>
                </Card>
            )}
        </div>
    );
};
