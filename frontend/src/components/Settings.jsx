import React, { useState, useEffect } from 'react';
import { Typography, Form, Input, Select, Button, message, Card, Divider, Layout, Menu } from 'antd';
import { SaveOutlined, SettingOutlined, RobotOutlined, GlobalOutlined } from '@ant-design/icons';
import { settingsApi } from '../api';

const { Title, Text } = Typography;
const { Option } = Select;
const { Sider, Content } = Layout;

const { TextArea } = Input;

const Settings = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [activeKey, setActiveKey] = useState('ai');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await settingsApi.get();
      form.setFieldsValue(data);
    } catch (e) {
      // message.error('加载设置失败');
    }
  };

  const handleSave = async (values) => {
    setLoading(true);
    try {
      await settingsApi.update(values);
      message.success('设置已保存');
    } catch (e) {
      // Error handled by interceptor
    } finally {
      setLoading(false);
    }
  };

  const menuItems = [
    { key: 'ai', icon: <RobotOutlined />, label: 'AI 模型设置' },
    { key: 'general', icon: <GlobalOutlined />, label: '常规设置' },
  ];

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', width: '100%' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 12 }}>
          <SettingOutlined /> 设置
        </Title>
      </div>

      <Layout style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0', minHeight: 600 }}>
        <Sider width={240} theme="light" style={{ borderRight: '1px solid #f0f0f0' }}>
          <Menu
            mode="inline"
            selectedKeys={[activeKey]}
            onClick={({ key }) => setActiveKey(key)}
            style={{ border: 'none', height: '100%' }}
            items={menuItems}
          />
        </Sider>
        
        <Content style={{ padding: '32px 40px', background: '#fff' }}>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSave}
            initialValues={{
              provider: 'openai',
              openai_base_url: 'https://api.openai.com/v1',
              openai_model: 'gpt-3.5-turbo'
            }}
          >
            {activeKey === 'ai' && (
              <div className="settings-section">
                <Title level={4} style={{ marginBottom: 24 }}>AI 模型配置</Title>
                
                <Title level={5} type="secondary" style={{ fontSize: 14, marginTop: 0 }}>服务提供商</Title>
                <Form.Item name="provider" style={{ marginBottom: 24 }}>
                  <Select size="large">
                    <Option value="openai">OpenAI (或兼容接口)</Option>
                    {/* Future providers can be added here */}
                  </Select>
                </Form.Item>

                <Divider />

                <Title level={5} type="secondary" style={{ fontSize: 14 }}>接口详情</Title>
                <Form.Item 
                  name="openai_base_url" 
                  label="API Base URL" 
                  tooltip="API 基础地址，例如 https://api.openai.com/v1"
                  rules={[{ required: true, message: '请输入 Base URL' }]}
                >
                  <Input size="large" placeholder="https://api.openai.com/v1" />
                </Form.Item>

                <Form.Item 
                  name="openai_api_key" 
                  label="API Key" 
                  rules={[{ required: true, message: '请输入 API Key' }]}
                >
                  <Input.Password size="large" placeholder="sk-..." />
                </Form.Item>

                <Form.Item 
                  name="openai_model" 
                  label="默认模型 (Default Model)" 
                  tooltip="例如 gpt-3.5-turbo, gpt-4"
                  rules={[{ required: true, message: '请输入模型名称' }]}
                >
                  <Input size="large" placeholder="gpt-3.5-turbo" />
                </Form.Item>

                <Form.Item
                  name="available_models"
                  label="可用模型列表 (Available Models)"
                  tooltip="以逗号分隔的模型列表，用于在运行/调试时选择。例如：gpt-3.5-turbo, gpt-4, claude-3-opus"
                >
                  <Select
                     mode="tags"
                     style={{ width: '100%' }}
                     placeholder="输入模型名称并回车添加"
                     size="large"
                     tokenSeparators={[',', ' ']}
                  />
                </Form.Item>

                <Divider />

                <Title level={5} type="secondary" style={{ fontSize: 14 }}>优化提示词 (System Prompt)</Title>
                <Form.Item 
                  name="optimize_prompt_template" 
                  tooltip="AI 在进行提示词优化时使用的系统指令。保持默认即可，也可根据需求自定义。"
                  initialValue={`你是一个专业的提示词工程师 (Prompt Engineer)。
你的任务是优化用户提供的 Prompt，使其更加清晰、结构化，并能引导 AI 生成更高质量的结果。
请保持原意不变，但进行以下改进：
1. 明确角色设定 (Role)
2. 补充背景信息 (Context)
3. 细化任务描述 (Task)
4. 规定输出格式 (Format)

请直接输出优化后的 Prompt 内容，不要包含解释性文字。`}
                >
                  <TextArea rows={8} placeholder="输入系统提示词..." />
                </Form.Item>
              </div>
            )}

            {activeKey === 'general' && (
               <div className="settings-section">
                  <Title level={4} style={{ marginBottom: 24 }}>常规设置</Title>
                  <div style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8' }}>
                    <GlobalOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                    <p>更多常规设置即将推出...</p>
                  </div>
               </div>
            )}

            <Divider style={{ marginTop: 40 }} />
            
            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading} size="large">
                保存更改
              </Button>
            </Form.Item>
          </Form>
        </Content>
      </Layout>
    </div>
  );
};

export default Settings;
