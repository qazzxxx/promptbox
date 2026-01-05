import React, { useState, useEffect } from 'react';
import { Layout, Typography, Input, Tag, Empty, ConfigProvider, Modal, Form, Select, Button, message, ColorPicker, Radio } from 'antd';
import { 
  SearchOutlined, PlusOutlined, CodeOutlined,
  FormOutlined, PictureOutlined, ToolOutlined, 
  FileTextOutlined, BulbOutlined, RobotOutlined, 
  CoffeeOutlined, FolderOpenOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

import Sidebar from './components/Sidebar';
import ProjectCard from './components/ProjectCard';
import Workshop from './components/Workshop';
import Settings from './components/Settings';
import { projectsApi, categoriesApi } from './api';

// Config
dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const ICON_OPTIONS = [
  { key: 'folder', icon: <FolderOpenOutlined /> },
  { key: 'form', icon: <FormOutlined /> },
  { key: 'code', icon: <CodeOutlined /> },
  { key: 'picture', icon: <PictureOutlined /> },
  { key: 'tool', icon: <ToolOutlined /> },
  { key: 'file', icon: <FileTextOutlined /> },
  { key: 'bulb', icon: <BulbOutlined /> },
  { key: 'robot', icon: <RobotOutlined /> },
  { key: 'coffee', icon: <CoffeeOutlined /> },
];

// Theme
const themeConfig = {
  token: {
    colorPrimary: '#4f46e5',
    borderRadius: 8,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
    colorTextHeading: '#1e293b',
    colorText: '#334155',
    colorBgContainer: '#ffffff',
  },
  components: {
    Button: { controlHeight: 36, boxShadow: 'none' },
    Input: { controlHeight: 40, colorBorder: '#e2e8f0', hoverBorderColor: '#4f46e5' },
    Select: { controlHeight: 40, colorBorder: '#e2e8f0' },
    Card: { boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }
  }
};

const App = () => {
  // --- Global State ---
  const [categories, setCategories] = useState([]);
  const [projects, setProjects] = useState([]);
  
  // --- UI State ---
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);
  const [versions, setVersions] = useState([]);
  const [editingCategory, setEditingCategory] = useState(null);

  // --- Modal State ---
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [projectForm] = Form.useForm();
  const [categoryForm] = Form.useForm();

  // --- Effects ---
  useEffect(() => { loadCategories(); }, []);
  useEffect(() => { loadProjects(); }, [selectedCategory, showFavorites, searchQuery]);
  useEffect(() => { if (selectedProject) loadVersions(selectedProject.id); }, [selectedProject]);

  // --- Data Loading ---
  const loadCategories = async () => {
    try {
      const data = await categoriesApi.getAll();
      setCategories(data);
    } catch (e) {}
  };

  const loadProjects = async () => {
    try {
      const params = {};
      if (selectedCategory) params.category_id = selectedCategory;
      if (showFavorites) params.is_favorite = true;
      if (searchQuery) params.search = searchQuery;
      const data = await projectsApi.getAll(params);
      setProjects(data);
    } catch (e) {}
  };

  const loadVersions = async (id) => {
    try {
      const data = await projectsApi.getVersions(id);
      setVersions(data);
    } catch (e) {}
  };

  // --- Actions ---
  const handleCreateProject = async (values) => {
    try {
      const newProject = await projectsApi.create({
        ...values,
        tags: values.tags ? values.tags.split(/[,，]/).map(t => t.trim()) : [],
        type: values.type || 'text'
      });
      message.success('创建成功');
      setIsProjectModalOpen(false);
      projectForm.resetFields();
      loadProjects();
      setSelectedProject(newProject);
    } catch (e) {}
  };

  const handleCreateCategory = async (values) => {
    try {
      if (editingCategory) {
        await categoriesApi.update(editingCategory.id, values);
        message.success('分类已更新');
      } else {
        await categoriesApi.create(values);
        message.success('分类创建成功');
      }
      setIsCategoryModalOpen(false);
      setEditingCategory(null);
      categoryForm.resetFields();
      loadCategories();
    } catch (e) {}
  };

  const handleEditCategory = (category) => {
    setEditingCategory(category);
    categoryForm.setFieldsValue(category);
    setIsCategoryModalOpen(true);
  };

  const handleDeleteCategory = async (id) => {
    try {
      await categoriesApi.delete(id);
      message.success('分类已删除');
      if (selectedCategory === id) setSelectedCategory(null);
      loadCategories();
      loadProjects(); // Reload projects as their category might have been cleared
    } catch (e) {}
  };

  const handleToggleFavorite = async (id) => {
    try {
      await projectsApi.toggleFavorite(id);
      message.success('收藏状态已更新');
      // Update local state to avoid full reload
      setProjects(projects.map(p => 
        p.id === id ? { ...p, is_favorite: !p.is_favorite } : p
      ));
    } catch (e) {}
  };

  const handleSaveVersion = async (content, negative_prompt = null, parameters = {}) => {
    try {
      const newVersion = await projectsApi.createVersion(selectedProject.id, {
        project_id: selectedProject.id,
        version_num: 0,
        content,
        negative_prompt,
        parameters,
        changelog: 'Updated via Workshop'
      });
      setVersions([newVersion, ...versions]);
      message.success('版本已保存');
    } catch (e) {}
  };

  const handleDeleteProject = async (id) => {
    try {
      await projectsApi.delete(id);
      message.success('项目已删除');
      setSelectedProject(null);
      loadProjects();
    } catch (e) {}
  };

  const handleReorderCategories = async (newCategories) => {
    // Optimistic update
    setCategories(newCategories);
    try {
      const items = newCategories.map((c, index) => ({ id: c.id, sort_order: index + 1 }));
      await categoriesApi.reorder(items);
    } catch (e) {
      message.error('排序保存失败');
      loadCategories(); // Revert on error
    }
  };

  // --- Helper to open project modal with default category ---
  const openCreateProjectModal = () => {
    projectForm.resetFields();
    // Pre-select category if one is currently selected (and it's a valid ID)
    if (selectedCategory && typeof selectedCategory === 'number') {
        projectForm.setFieldsValue({ category_id: selectedCategory });
    }
    setIsProjectModalOpen(true);
  };

  // --- Render ---
  return (
    <ConfigProvider theme={themeConfig}>
      <Layout style={{ minHeight: '100vh' }}>
        <Sidebar 
          categories={categories}
          selectedCategory={selectedCategory}
          showFavorites={showFavorites}
          showSettings={showSettings}
          onSelectCategory={(id) => { setSelectedCategory(id); setShowFavorites(false); setSelectedProject(null); setShowSettings(false); }}
          onToggleFavorites={(show) => { setShowFavorites(show); setSelectedCategory(null); setSelectedProject(null); setShowSettings(false); }}
          onToggleSettings={() => { setShowSettings(true); setShowFavorites(false); setSelectedCategory(null); setSelectedProject(null); }}
          onAddProject={openCreateProjectModal}
          onAddCategory={() => {
            setEditingCategory(null);
            categoryForm.resetFields();
            setIsCategoryModalOpen(true);
          }}
          onEditCategory={handleEditCategory}
          onDeleteCategory={handleDeleteCategory}
          onReorderCategories={handleReorderCategories}
        />

        <Layout style={{ marginLeft: 260, padding: '32px 40px', minHeight: '100vh' }}>
          {showSettings ? (
            <Settings />
          ) : selectedProject ? (
            <Workshop 
              project={selectedProject}
              category={categories.find(c => c.id === selectedProject.category_id)}
              versions={versions}
              onBack={() => setSelectedProject(null)}
              onSaveVersion={handleSaveVersion}
              onDeleteProject={handleDeleteProject}
            />
          ) : (
            <div style={{ maxWidth: 1200, margin: '0 auto', width: '100%' }}>
              <div style={{ marginBottom: 40 }}>
                <Title level={2} style={{ fontWeight: 600, color: '#0f172a' }}>
                  {showFavorites ? '收藏夹' : (selectedCategory ? categories.find(c => c.id === selectedCategory)?.name : '全部项目')}
                </Title>
                <Text type="secondary" style={{ fontSize: 16 }}>
                  {projects.length} 个项目 · 管理并优化您的 AI 提示词库
                </Text>
              </div>

              {/* Toolbar */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
                <Input 
                  prefix={<SearchOutlined style={{ color: '#94a3b8' }} />} 
                  placeholder="搜索项目..." 
                  className="minimal-input"
                  style={{ width: 400 }}
                  onChange={(e) => {
                    // Simple debounce
                    const v = e.target.value;
                    setTimeout(() => setSearchQuery(v), 300);
                  }}
                />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                   {/* Quick Filter Chips can go here */}
                </div>
              </div>

              {/* Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
                {/* Add New Card - Placed First */}
                <div 
                  className="clean-card"
                  onClick={openCreateProjectModal}
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    borderStyle: 'dashed', 
                    cursor: 'pointer', 
                    background: '#f8fafc', 
                    height: 220, // Matched height with ProjectCard
                    padding: '20px 24px' // Consistent padding
                  }}
                >
                  <PlusOutlined style={{ fontSize: 24, color: '#94a3b8', marginBottom: 12 }} />
                  <Text type="secondary">新建项目</Text>
                </div>

                {projects.map(p => (
                  <ProjectCard 
                    key={p.id} 
                    project={p} 
                    category={categories.find(c => c.id === p.category_id)}
                    onClick={() => setSelectedProject(p)}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))}
              </div>
            </div>
          )}
        </Layout>

        {/* Modals */}
        <Modal 
          title="新建项目" 
          open={isProjectModalOpen} 
          onCancel={() => setIsProjectModalOpen(false)} 
          footer={null}
          width={480}
        >
          <Form form={projectForm} onFinish={handleCreateProject} layout="vertical" style={{ marginTop: 20 }}>
            <Form.Item name="name" label="项目名称" rules={[{ required: true }]}>
              <Input placeholder="例如：小红书文案生成" />
            </Form.Item>
            <Form.Item name="type" label="项目类型" initialValue="text">
               <Radio.Group buttonStyle="solid">
                 <Radio.Button value="text">文本 (LLM)</Radio.Button>
                 <Radio.Button value="image">绘图 (Image)</Radio.Button>
               </Radio.Group>
            </Form.Item>
            <Form.Item name="category_id" label="所属分类" rules={[{ required: true }]}>
              <Select placeholder="选择分类">
                {categories.map(c => (<Option key={c.id} value={c.id}>{c.name}</Option>))}
              </Select>
            </Form.Item>
            <Form.Item name="description" label="描述">
              <TextArea placeholder="此提示词的主要用途..." rows={3} />
            </Form.Item>
            <Form.Item name="tags" label="标签">
              <Input placeholder="标签1, 标签2" />
            </Form.Item>
            <div style={{ textAlign: 'right', marginTop: 32 }}>
              <Button onClick={() => setIsProjectModalOpen(false)} style={{ marginRight: 8 }}>取消</Button>
              <Button type="primary" htmlType="submit">创建项目</Button>
            </div>
          </Form>
        </Modal>

        <Modal
          title={editingCategory ? "编辑分类" : "新建分类"}
          open={isCategoryModalOpen}
          onCancel={() => setIsCategoryModalOpen(false)}
          footer={null}
          width={400}
        >
           <Form form={categoryForm} onFinish={handleCreateCategory} layout="vertical" style={{ marginTop: 20 }}>
            <Form.Item name="name" label="分类名称" rules={[{ required: true }]}>
              <Input placeholder="例如：视频脚本" />
            </Form.Item>
            <Form.Item 
              name="color" 
              label="标签颜色" 
              initialValue="#1677ff"
              getValueFromEvent={(color) => typeof color === 'string' ? color : color.toHexString()}
            >
              <ColorPicker showText />
            </Form.Item>
            <Form.Item name="icon" label="图标" initialValue="folder">
               <Radio.Group buttonStyle="solid">
                 {ICON_OPTIONS.map(opt => (
                   <Radio.Button value={opt.key} key={opt.key} style={{ margin: '0 8px 8px 0' }}>
                     {opt.icon}
                   </Radio.Button>
                 ))}
               </Radio.Group>
            </Form.Item>
            <div style={{ textAlign: 'right', marginTop: 32 }}>
              <Button onClick={() => setIsCategoryModalOpen(false)} style={{ marginRight: 8 }}>取消</Button>
              <Button type="primary" htmlType="submit">
                {editingCategory ? "更新分类" : "创建分类"}
              </Button>
            </div>
          </Form>
        </Modal>
      </Layout>
    </ConfigProvider>
  );
};

export default App;
