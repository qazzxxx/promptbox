import React, { useState } from 'react';
import { Input, Button, message, Typography, Spin } from 'antd';
import { ArrowRightOutlined, LockOutlined, UserOutlined } from '@ant-design/icons';
import { authApi } from '../api';

const { Title, Text } = Typography;

const LockScreen = ({ onUnlock }) => {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    const handleLogin = async () => {
        if (!password) return;
        setLoading(true);
        try {
            await authApi.login(password);
            message.success('欢迎回来');
            onUnlock();
        } catch (e) {
            setError(true);
            message.error('由于密码错误，访问被拒绝');
            // Shake animation trigger or simply reset
            setTimeout(() => setError(false), 500);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            overflow: 'hidden'
        }}>
            {/* Abstract Background Blobs */}
            <div style={{
                position: 'absolute',
                top: '20%',
                left: '20%',
                width: '30vw',
                height: '30vw',
                background: 'radial-gradient(circle, rgba(79,70,229,0.3) 0%, rgba(0,0,0,0) 70%)',
                filter: 'blur(60px)',
                borderRadius: '50%',
                animation: 'float 10s infinite ease-in-out'
            }} />
            <div style={{
                position: 'absolute',
                bottom: '10%',
                right: '10%',
                width: '40vw',
                height: '40vw',
                background: 'radial-gradient(circle, rgba(236,72,153,0.2) 0%, rgba(0,0,0,0) 70%)',
                filter: 'blur(80px)',
                borderRadius: '50%',
                animation: 'float 15s infinite ease-in-out reverse'
            }} />

            {/* Glass Card */}
            <div style={{
                width: 380,
                padding: '48px 32px',
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(20px)',
                borderRadius: 24,
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                transform: error ? 'translateX(-10px)' : 'none',
                transition: 'transform 0.1s'
            }}>
                <div style={{
                    width: 80,
                    height: 80,
                    background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
                    borderRadius: 24,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginBottom: 24,
                    boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.3)'
                }}>
                    <LockOutlined style={{ fontSize: 36, color: 'white' }} />
                </div>

                <Title level={3} style={{ color: '#fff', marginBottom: 8, fontWeight: 600 }}>System Locked</Title>
                <Text style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 32 }}>请输入系统密码以继续访问</Text>

                <div style={{ width: '100%' }}>
                    <Input.Password
                        placeholder="Password"
                        size="large"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        onPressEnter={handleLogin}
                        prefix={<UserOutlined style={{ color: 'rgba(255,255,255,0.4)' }} />}
                        style={{
                            background: 'rgba(0,0,0,0.2)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: 'white',
                            height: 50,
                            borderRadius: 12,
                            marginBottom: 24
                        }}
                        disabled={loading}
                    />

                    <Button
                        type="primary"
                        block
                        size="large"
                        onClick={handleLogin}
                        loading={loading}
                        style={{
                            height: 50,
                            borderRadius: 12,
                            background: 'linear-gradient(90deg, #4f46e5 0%, #6366f1 100%)',
                            border: 'none',
                            fontSize: 16,
                            fontWeight: 600,
                            boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.4)'
                        }}
                    >
                        {loading ? 'Verifying...' : 'Unlock System'}
                    </Button>
                </div>
            </div>

            {/* CSS Animation for floating */}
            <style>{`
        @keyframes float {
          0% { transform: translate(0, 0); }
          50% { transform: translate(20px, -20px); }
          100% { transform: translate(0, 0); }
        }
        .ant-input-password input {
            background: transparent !important;
            color: white !important;
        }
        .ant-input-password-icon {
            color: rgba(255,255,255,0.5) !important;
        }
      `}</style>
        </div>
    );
};

export default LockScreen;
