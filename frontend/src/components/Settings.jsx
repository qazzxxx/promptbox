import React, { useState, useEffect } from 'react';
import { Typography, Form, Input, Select, Button, message, Divider, Layout, Menu, Space, Avatar, Tag, theme } from 'antd';
import {
  SaveOutlined,
  RobotOutlined,
  GlobalOutlined,
  UserOutlined,
  SafetyCertificateOutlined,
  BgColorsOutlined,
  CheckCircleFilled,
  ApiOutlined,
  SettingOutlined,
  RightOutlined
} from '@ant-design/icons';
import { settingsApi } from '../api';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { Sider, Content } = Layout;

const Settings = ({ isDarkMode }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [activeKey, setActiveKey] = useState('model');
  const { token } = theme.useToken();

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await settingsApi.get();
      form.setFieldsValue(data);
    } catch (e) {
      // Quietly fail
    }
  };

  const handleSave = async (values) => {
    setLoading(true);
    try {
      await settingsApi.update(values);
      message.success({ content: '设置已保存', key: 'save_settings' });
    } catch (e) {
      message.error({ content: '保存失败，请稍后重试', key: 'save_settings' });
    } finally {
      setLoading(false);
    }
  };

  // Glassmorphism styles
  const glassStyle = {
    background: isDarkMode ? 'rgba(30, 41, 59, 0.6)' : 'rgba(255, 255, 255, 0.6)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRight: '1px solid var(--border-color)',
    transition: 'all 0.3s ease'
  };

  const contentGlassStyle = {
    background: isDarkMode ? 'rgba(30, 41, 59, 0.4)' : 'rgba(255, 255, 255, 0.4)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRadius: '0 16px 16px 0', // Rounded corners on the right
  };

  const menuItems = [
    {
      key: 'model',
      icon: <ApiOutlined />,
      label: '模型服务',
      title: '配置 AI 服务提供商与参数'
    },
    {
      key: 'behavior',
      icon: <RobotOutlined />,
      label: 'AI 偏好',
      title: '自定义 AI 的行为与指令'
    },
    {
      key: 'general',
      icon: <SafetyCertificateOutlined />,
      label: '常规设置',
      title: '通用应用设置'
    }
  ];

  const activeItem = menuItems.find(item => item.key === activeKey);

  return (
    <div style={{
      width: '100%',
      height: 'calc(100vh - 100px)', // Fit within parent constraint minus padding
      display: 'flex',
      flexDirection: 'column',
      animation: 'fadeIn 0.5s ease'
    }}>

      {/* Page Title - Minimal */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'var(--primary-color)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
        }}>
          <SettingOutlined style={{ fontSize: 20 }} />
        </div>
        <div>
          <Title level={4} style={{ margin: 0, color: 'var(--text-primary)' }}>设置与偏好</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>Settings & Preferences</Text>
        </div>
      </div>

      <Layout style={{
        background: 'transparent',
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid var(--border-color)',
        flex: 1,
        boxShadow: isDarkMode ? '0 10px 30px rgba(0,0,0,0.2)' : '0 10px 30px rgba(0,0,0,0.05)'
      }}>
        <Sider
          width={260}
          style={{ ...glassStyle, background: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : '#ffffff' }}
          theme={isDarkMode ? 'dark' : 'light'}
        >
          <div style={{ padding: '24px 16px' }}>
            <Text type="secondary" style={{ fontSize: 12, paddingLeft: 12, marginBottom: 8, display: 'block', textTransform: 'uppercase', letterSpacing: 1 }}>
              菜单
            </Text>
            <Menu
              mode="inline"
              selectedKeys={[activeKey]}
              onClick={({ key }) => setActiveKey(key)}
              style={{ background: 'transparent', border: 'none' }}
              items={menuItems.map(item => ({
                key: item.key,
                icon: item.icon,
                label: item.label,
                style: { marginBottom: 4, borderRadius: 6 }
              }))}
            />
          </div>
        </Sider>

        <Content style={{
          ...contentGlassStyle,
          padding: '40px 60px',
          overflowY: 'auto',
          background: isDarkMode ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255,255,255,0.7)'
        }}>
          <div style={{ maxWidth: 800, margin: '0 0' }}>

            {/* Section Header */}
            <div style={{ marginBottom: 32, paddingBottom: 16, borderBottom: '1px solid var(--border-color)' }}>
              <Title level={3} style={{ marginBottom: 8, color: 'var(--text-primary)' }}>{activeItem?.label}</Title>
              <Text type="secondary">{activeItem?.title}</Text>
            </div>

            <Form
              form={form}
              layout="vertical"
              onFinish={handleSave}
              initialValues={{
                provider: 'openai',
                openai_base_url: 'https://api.openai.com/v1',
                openai_model: 'gpt-3.5-turbo'
              }}
              requiredMark={false}
            >
              {/* --- Model Service Tab --- */}
              {activeKey === 'model' && (
                <div style={{ animation: 'fadeIn 0.3s ease' }}>
                  <Form.Item label="AI 服务提供商 (Provider)" name="provider">
                    <Select size="large" style={{ borderRadius: 8 }}>
                      <Option value="openai">OpenAI (Standard)</Option>
                      <Option value="azure" disabled>Azure OpenAI</Option>
                      <Option value="anthropic" disabled>Anthropic Claude</Option>
                    </Select>
                  </Form.Item>

                  <div style={{
                    background: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    padding: 24,
                    borderRadius: 12,
                    border: '1px solid var(--border-color)',
                    marginBottom: 32
                  }}>
                    <Space direction="vertical" size="large" style={{ width: '100%' }}>
                      <Form.Item
                        label="API Base URL"
                        name="openai_base_url"
                        rules={[{ required: true, message: 'Required' }]}
                      >
                        <Input
                          size="large"
                          placeholder="https://api.openai.com/v1"
                          prefix={<GlobalOutlined style={{ color: 'var(--text-secondary)' }} />}
                        />
                      </Form.Item>

                      <Form.Item
                        label="API Key"
                        name="openai_api_key"
                        rules={[{ required: true, message: 'Required' }]}
                      >
                        <Input.Password
                          size="large"
                          placeholder="sk-..."
                          prefix={<SafetyCertificateOutlined style={{ color: 'var(--text-secondary)' }} />}
                        />
                      </Form.Item>
                    </Space>
                  </div>

                  <Title level={5} style={{ marginBottom: 20 }}>模型参数</Title>
                  <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <Form.Item
                      name="openai_model"
                      label="默认模型 (Default Model)"
                      rules={[{ required: true, message: 'Required' }]}
                    >
                      <Input
                        size="large"
                        placeholder="gpt-3.5-turbo"
                        prefix={<RobotOutlined style={{ color: 'var(--text-secondary)' }} />}
                      />
                    </Form.Item>

                    <Form.Item
                      name="available_models"
                      label="可用模型列表 (Available Models)"
                      tooltip="调试时可选用的模型列表"
                    >
                      <Select
                        mode="tags"
                        style={{ width: '100%' }}
                        placeholder="输入并回车..."
                        size="large"
                        tokenSeparators={[',', ' ']}
                        open={false}
                      />
                    </Form.Item>
                  </Space>
                </div>
              )}

              {/* --- AI Behavior Tab --- */}
              {activeKey === 'behavior' && (
                <div style={{ animation: 'fadeIn 0.3s ease' }}>
                  <div style={{ marginBottom: 24 }}>
                    <Tag color="geekblue" style={{ padding: '4px 10px', fontSize: 13 }}>
                      <CheckCircleFilled style={{ marginRight: 6 }} />
                      Prompt Engineering Optimization
                    </Tag>
                  </div>

                  <Form.Item
                    name="optimize_prompt_template"
                    label="系统优化指令 (System Prompt)"
                    tooltip="AI 将基于此指令来优化您输入的提示词。"
                  >
                    <TextArea
                      rows={15}
                      placeholder="You are an expert prompt engineer..."
                      style={{ borderRadius: 12, padding: 16, fontFamily: 'Menlo, Monaco, monospace', fontSize: 13, lineHeight: 1.6 }}
                      showCount
                    />
                  </Form.Item>
                </div>
              )}

              {/* --- General Tab --- */}
              {activeKey === 'general' && (
                <div style={{ animation: 'fadeIn 0.3s ease', paddingTop: 40, textAlign: 'center' }}>
                  <Avatar size={100} icon={<UserOutlined />} style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }} />
                  <Title level={3} style={{ marginTop: 24, color: 'var(--text-primary)' }}>常规设置</Title>
                  <Paragraph type="secondary">
                    更多应用级偏好设置（如语言、快捷键、数据备份）正在开发中。
                  </Paragraph>
                </div>
              )}

              {/* Footer Actions - Sticky Bottom or just normal */}
              <Form.Item style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid var(--border-color)', textAlign: 'right' }}>
                <Space>
                  <Button size="large">取消</Button>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SaveOutlined />}
                    loading={loading}
                    size="large"
                    style={{ padding: '0 32px' }}
                  >
                    保存更改
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </div>
        </Content>
      </Layout>

      <style>{`
          @keyframes fadeIn {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
          }
      `}</style>
    </div>
  );
};

export default Settings;
