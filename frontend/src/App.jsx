import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation, useParams, Navigate } from 'react-router-dom';
import { Layout, Typography, Input, Tag, Empty, ConfigProvider, Modal, Form, Select, Button, message, ColorPicker, Radio, Tabs, Spin, Segmented, Switch } from 'antd';
import {
  SearchOutlined, PlusOutlined, CodeOutlined,
  FormOutlined, PictureOutlined, ToolOutlined,
  FileTextOutlined, BulbOutlined, RobotOutlined,
  CoffeeOutlined, FolderOpenOutlined, SunOutlined, MoonOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-markdown';
import 'prismjs/themes/prism.css';

import Sidebar from './components/Sidebar';
import ProjectCard from './components/ProjectCard';
import Workshop from './components/Workshop';
import Settings from './components/Settings';
import LockScreen from './components/LockScreen';
import { projectsApi, categoriesApi, aiApi, authApi } from './api';

// Config
dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;
const { TabPane } = Tabs; // We might need tabs for Create Modal

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
const App = () => {
  // --- Global State ---
  const [categories, setCategories] = useState([]);
  const [projects, setProjects] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(localStorage.getItem('theme') === 'dark');

  // --- Auth State ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthEnabled, setIsAuthEnabled] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // --- UI State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);
  const [versions, setVersions] = useState([]);
  const [editingCategory, setEditingCategory] = useState(null);

  const [editingProject, setEditingProject] = useState(null); // Track project being edited

  const navigate = useNavigate();
  const location = useLocation();

  // --- UI State Derived from URL ---
  const getInitialStateFromUrl = useCallback(() => {
    const path = location.pathname;
    if (path === '/favorites') {
      return { type: 'favorites', id: null };
    } else if (path === '/settings') {
      return { type: 'settings', id: null };
    } else if (path.startsWith('/category/')) {
      const id = path.split('/')[2];
      return { type: 'category', id: decodeURIComponent(id) };
    } else if (path.startsWith('/project/')) {
      const id = path.split('/')[2];
      return { type: 'project', id: decodeURIComponent(id) };
    }
    return { type: 'all', id: null };
  }, [location.pathname]);

  const stateFromUrl = getInitialStateFromUrl();

  const showFavorites = stateFromUrl.type === 'favorites';
  const showSettings = stateFromUrl.type === 'settings';
  const selectedCategory = stateFromUrl.type === 'category' ? stateFromUrl.id : null;
  const selectedProjectId = stateFromUrl.type === 'project' ? stateFromUrl.id : null;

  // Update selectedProject based on selectedProjectId
  useEffect(() => {
    if (selectedProjectId) {
      const proj = projects.find(p => p.id === selectedProjectId);
      if (proj) {
        setSelectedProject(proj);
      } else {
        // If not found in current list, maybe it's not loaded or doesn't exist
        // We could fetch it specifically, but for now let's try to load projects first
      }
    } else {
      setSelectedProject(null);
    }
  }, [selectedProjectId, projects]);

  // --- Modal State ---
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [projectForm] = Form.useForm();
  const [categoryForm] = Form.useForm();

  // AI Create State
  const [createMode, setCreateMode] = useState(localStorage.getItem('createMode') || 'manual'); // 'manual' or 'ai'
  const [aiAnalysisPrompt, setAiAnalysisPrompt] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Theme
  const themeConfig = {
    token: {
      colorPrimary: '#4f46e5',
      borderRadius: 8,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
      colorTextHeading: isDarkMode ? '#f1f5f9' : '#1e293b',
      colorText: isDarkMode ? '#cbd5e1' : '#334155',
      colorBgContainer: isDarkMode ? '#1e293b' : '#ffffff',
      colorBgLayout: isDarkMode ? '#0f172a' : '#f8fafc',
      colorBorder: isDarkMode ? '#334155' : '#e2e8f0',
    },
    components: {
      Button: { controlHeight: 36, boxShadow: 'none' },
      Input: {
        controlHeight: 40,
        colorBorder: isDarkMode ? '#334155' : '#e2e8f0',
        hoverBorderColor: '#4f46e5',
        colorBgContainer: isDarkMode ? '#0f172a' : '#ffffff',
      },
      Select: {
        controlHeight: 40,
        colorBorder: isDarkMode ? '#334155' : '#e2e8f0',
        colorBgContainer: isDarkMode ? '#0f172a' : '#ffffff',
      },
      Card: {
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        colorBgContainer: isDarkMode ? '#1e293b' : '#ffffff',
      },
      Modal: {
        colorBgElevated: isDarkMode ? '#1e293b' : '#ffffff',
      },
      Menu: {
        colorItemBgSelected: isDarkMode ? '#334155' : '#eef2ff',
        colorItemTextSelected: '#4f46e5',
      }
    }
  };

  // --- Effects ---
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Auth Check
  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!isAuthEnabled || isAuthenticated) {
      loadCategories();
    }
  }, [isAuthenticated, isAuthEnabled]);

  useEffect(() => {
    if (!isAuthEnabled || isAuthenticated) {
      loadProjects();
    }
  }, [selectedCategory, showFavorites, searchQuery, isAuthenticated, isAuthEnabled]);
  useEffect(() => { if (selectedProject) loadVersions(selectedProject.id); }, [selectedProject]);

  const checkAuth = async () => {
    try {
      const status = await authApi.status();
      setIsAuthEnabled(status.enabled);
      setIsAuthenticated(status.authenticated);
    } catch (e) {
      console.error("Auth check failed", e);
      // Default to safe state or retry?
      // If checking auth fails (e.g. 500), maybe assume enabled but strict?
      // Or assume disabled if offline? Better to assume enabled to be safe, but local app...
      // Let's assume network error -> show lock screen just in case if enabled?
      // For now, simple fallback
    } finally {
      setAuthLoading(false);
    }
  };

  // --- Data Loading ---
  const loadCategories = async () => {
    try {
      const data = await categoriesApi.getAll();
      setCategories(data);
    } catch (e) { }
  };

  const loadProjects = async () => {
    try {
      const params = {};
      if (selectedCategory) params.category_id = selectedCategory;
      if (showFavorites) params.is_favorite = true;
      if (searchQuery) params.search = searchQuery;
      const data = await projectsApi.getAll(params);
      setProjects(data);

      // If we are on a project page but selectedProject is not set (e.g. direct URL access)
      if (selectedProjectId && !selectedProject) {
        const proj = data.find(p => p.id === selectedProjectId);
        if (proj) setSelectedProject(proj);
      }
    } catch (e) { }
  };

  const loadVersions = async (id) => {
    try {
      const data = await projectsApi.getVersions(id);
      setVersions(data);
    } catch (e) { }
  };

  // --- Actions ---
  // handleCreateProject is defined below with extended signature

  const handleEditProjectMetadata = (project) => {
    setEditingProject(project);
    setCreateMode('manual'); // Force manual mode for editing
    projectForm.setFieldsValue({
      ...project,
      tags: project.tags.join(', ')
    });
    setIsProjectModalOpen(true);
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
    } catch (e) { }
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
    } catch (e) { }
  };

  const handleToggleFavorite = async (id) => {
    try {
      await projectsApi.toggleFavorite(id);
      message.success('收藏状态已更新');
      // Update local state to avoid full reload
      setProjects(projects.map(p =>
        p.id === id ? { ...p, is_favorite: !p.is_favorite } : p
      ));
    } catch (e) { }
  };

  const handleCopyProjectPrompt = async (id) => {
    try {
      const versions = await projectsApi.getVersions(id);
      if (versions && versions.length > 0) {
        const content = versions[0].content;
        await navigator.clipboard.writeText(content);
        message.success('提示词已复制到剪贴板');
      } else {
        message.warning('该项目暂无提示词内容');
      }
    } catch (e) {
      message.error('复制失败');
    }
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
    } catch (e) { }
  };

  const handleDeleteProject = async (id) => {
    try {
      await projectsApi.delete(id);
      message.success('项目已删除');
      setSelectedProject(null);
      loadProjects();
    } catch (e) { }
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

  const renderProjectGrid = () => (
    <div style={{ maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      <div style={{ marginBottom: 40 }}>
        <Title level={2} style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
          {showFavorites ? '收藏夹' : (selectedCategory ? categories.find(c => c.id === selectedCategory)?.name : '全部项目')}
        </Title>
        <Text type="secondary" style={{ fontSize: 16, color: 'var(--text-secondary)' }}>
          {projects.length} 个项目 · 管理并优化您的 AI 提示词库
        </Text>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
        <Input
          prefix={<SearchOutlined style={{ color: 'var(--text-secondary)' }} />}
          placeholder="搜索项目..."
          className="minimal-input"
          style={{ width: 400 }}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Quick Filter Chips can go here */}
        </div>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 24 }}>
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
            background: 'var(--bg-color)',
            height: 220, // Matched height with ProjectCard
            padding: '20px 24px' // Consistent padding
          }}
        >
          <PlusOutlined style={{ fontSize: 24, color: 'var(--text-secondary)', marginBottom: 12 }} />
          <Text type="secondary" style={{ color: 'var(--text-secondary)' }}>新建项目</Text>
        </div>

        {projects.map(p => (
          <ProjectCard
            key={p.id}
            project={p}
            category={categories.find(c => c.id === p.category_id)}
            onClick={() => navigate(`/project/${p.id}`)}
            onToggleFavorite={handleToggleFavorite}
            onCopyPrompt={handleCopyProjectPrompt}
            onEdit={handleEditProjectMetadata}
            onDelete={handleDeleteProject}
          />
        ))}
      </div>
    </div>
  );

  const handleCreateModeChange = (value) => {
    setCreateMode(value);
    localStorage.setItem('createMode', value);
  };

  // --- Helper to open project modal with default category ---
  const openCreateProjectModal = () => {
    projectForm.resetFields();
    setEditingProject(null); // Ensure we are creating new
    // Don't reset createMode here, let it persist
    setAiAnalysisPrompt('');
    setIsAnalyzing(false);

    // Pre-select category if one is currently selected (and it's a valid ID)
    if (selectedCategory && typeof selectedCategory === 'number') {
      projectForm.setFieldsValue({ category_id: selectedCategory });
    }
    setIsProjectModalOpen(true);
  };

  const handleAiAnalyze = async () => {
    if (!aiAnalysisPrompt.trim()) {
      message.warning("请输入提示词内容");
      return;
    }
    setIsAnalyzing(true);
    try {
      const res = await aiApi.analyze({ prompt: aiAnalysisPrompt });

      // Find category ID by name (res.category_suggested)
      // If not found, default to '通用' or first category
      let catId = null;
      if (res.category_suggested) {
        const found = categories.find(c => c.name === res.category_suggested);
        if (found) catId = found.id;
      }
      if (!catId) {
        // Fallback: try '通用'
        const common = categories.find(c => c.name === '通用');
        if (common) catId = common.id;
        else if (categories.length > 0) catId = categories[0].id;
      }

      projectForm.setFieldsValue({
        name: res.name,
        description: res.description,
        tags: res.tags.join(', '),
        type: res.type,
        category_id: catId
      });

      message.success("解析成功，请确认信息");
      handleCreateModeChange('manual'); // Switch to form view to review/save
    } catch (e) {
      // Error handled globally mostly, but we can stay in AI mode
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Custom Create Project Wrapper to handle content saving
  const handleCreateProjectWrapper = async (values) => {
    // If we have aiAnalysisPrompt, we should save it as the first version content
    // But handleCreateProject is generic.
    // Let's modify handleCreateProject to accept an optional initial content

    // Actually we can just append it to the API call inside handleCreateProject if needed?
    // But handleCreateProject only takes 'values' from form.

    // Let's pass the prompt content if it exists and we just came from AI mode (or simply if it exists)
    // But wait, we switched mode to 'manual' so the user sees the form.
    // We can keep aiAnalysisPrompt in state until the modal closes.

    await handleCreateProject(values, aiAnalysisPrompt);
  };

  const handleCreateProject = async (values, initialContent = '') => {
    try {
      if (editingProject) {
        // Update existing project
        const updatedProject = await projectsApi.update(editingProject.id, {
          ...editingProject, // Keep existing fields
          ...values,
          tags: values.tags ? values.tags.split(/[,，]/).map(t => t.trim()) : []
        });
        message.success('更新成功');
        setEditingProject(null);
      } else {
        // Create new project
        const newProject = await projectsApi.create({
          ...values,
          tags: values.tags ? values.tags.split(/[,，]/).map(t => t.trim()) : [],
          type: values.type || 'text'
        });

        // If we have initial content (from AI analysis), save it as version 1
        if (initialContent) {
          await projectsApi.createVersion(newProject.id, {
            project_id: newProject.id,
            version_num: 1,
            content: initialContent,
            changelog: 'Initial version from AI Analysis'
          });
        }

        message.success('创建成功');
        setSelectedProject(newProject);
      }
      setIsProjectModalOpen(false);
      projectForm.resetFields();
      loadProjects();
    } catch (e) { }
  };


  const handleLogout = async () => {
    try {
      await authApi.logout();
      setIsAuthenticated(false);
      message.success('已退出登录');
    } catch (e) {
      message.error('退出失败');
    }
  };

  if (authLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: isDarkMode ? '#0f172a' : '#f8fafc' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (isAuthEnabled && !isAuthenticated) {
    return (
      <ConfigProvider theme={themeConfig}>
        <LockScreen onUnlock={() => setIsAuthenticated(true)} />
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider theme={themeConfig}>
      <Layout style={{ minHeight: '100vh' }}>
        <Sidebar
          categories={categories}
          selectedCategory={selectedCategory}
          showFavorites={showFavorites}
          showSettings={showSettings}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          onSelectCategory={(id) => { navigate(id ? `/category/${id}` : '/'); }}
          onToggleFavorites={(show) => { navigate(show ? '/favorites' : '/'); }}
          onToggleSettings={() => { navigate('/settings'); }}
          onAddProject={openCreateProjectModal}
          onAddCategory={() => {
            setEditingCategory(null);
            categoryForm.resetFields();
            setIsCategoryModalOpen(true);
          }}
          onEditCategory={handleEditCategory}
          onDeleteCategory={handleDeleteCategory}
          onReorderCategories={handleReorderCategories}
          onLogout={isAuthEnabled ? handleLogout : null}
        />

        <Layout style={{ marginLeft: 260, padding: '32px 40px', minHeight: '100vh' }}>
          <Routes>
            <Route path="/settings" element={<Settings isDarkMode={isDarkMode} />} />
            <Route path="/project/:id" element={
              selectedProject ? (
                <Workshop
                  project={selectedProject}
                  category={categories.find(c => c.id === selectedProject.category_id)}
                  versions={versions}
                  isDarkMode={isDarkMode}
                  onBack={() => navigate(-1)}
                  onSaveVersion={handleSaveVersion}
                  onDeleteProject={handleDeleteProject}
                />
              ) : (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <Spin size="large" />
                </div>
              )
            } />
            <Route path="/favorites" element={renderProjectGrid()} />
            <Route path="/category/:id" element={renderProjectGrid()} />
            <Route path="/" element={renderProjectGrid()} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>

        {/* Modals */}
        <Modal
          title={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>{editingProject ? "编辑项目信息" : "新建项目"}</span>
              {!editingProject && (
                <Segmented
                  value={createMode}
                  onChange={handleCreateModeChange}
                  disabled={isAnalyzing}
                  style={{ marginRight: 28 }}
                  options={[
                    { label: '手动填写', value: 'manual', icon: <FormOutlined /> },
                    { label: 'AI 解析', value: 'ai', icon: <RobotOutlined /> },
                  ]}
                />
              )}
            </div>
          }
          open={isProjectModalOpen}
          onCancel={() => setIsProjectModalOpen(false)}
          footer={null}
          width={600}
        >
          {createMode === 'ai' ? (
            <div style={{ marginTop: 24 }}>
              <div style={{ background: 'var(--bg-color)', padding: 16, borderRadius: 8, marginBottom: 16, border: '1px solid var(--border-color)' }}>
                <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 8, color: 'var(--text-secondary)' }}>
                  <RobotOutlined /> 直接输入或粘贴提示词，AI 将自动分析并提取标题、分类、标签等信息。
                </Text>
              </div>
              <div style={{ marginBottom: 24, border: '1px solid var(--border-color)', borderRadius: 6, padding: 5, minHeight: 180, backgroundColor: 'var(--input-bg)' }}>
                <Editor
                  value={aiAnalysisPrompt}
                  onValueChange={code => setAiAnalysisPrompt(code)}
                  highlight={code => highlight(code, languages.markdown, 'markdown')}
                  padding={10}
                  placeholder="在此输入您的 Prompt..."
                  className="npm-editor"
                  style={{
                    fontFamily: '"Fira code", "Fira Mono", monospace',
                    fontSize: 14,
                    minHeight: '180px',
                    outline: 'none',
                    color: 'var(--text-primary)',
                  }}
                  textareaClassName="focus:outline-none"
                />
              </div>
              <Button
                type="primary"
                block
                size="large"
                icon={<RobotOutlined />}
                loading={isAnalyzing}
                onClick={handleAiAnalyze}
              >
                智能解析并填充
              </Button>
            </div>
          ) : (
            <Form form={projectForm} onFinish={handleCreateProjectWrapper} layout="vertical" style={{ marginTop: 20 }}>
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
                <Button type="primary" htmlType="submit">{editingProject ? "保存修改" : "创建项目"}</Button>
              </div>
            </Form>
          )}
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
