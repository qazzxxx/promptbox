import React from 'react';
import { Layout, Menu, Button, Typography, Dropdown, Modal } from 'antd';
import {
  RocketOutlined, PlusOutlined, AppstoreOutlined,
  FolderOpenOutlined, StarOutlined, MoreOutlined,
  EditOutlined, DeleteOutlined, HolderOutlined,
  FormOutlined, CodeOutlined, PictureOutlined, ToolOutlined,
  FileTextOutlined, BulbOutlined, RobotOutlined, CoffeeOutlined,
  SettingOutlined, SunOutlined, MoonOutlined, LogoutOutlined
} from '@ant-design/icons';
import { Switch } from 'antd';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const { Sider } = Layout;
const { Text } = Typography;

const ICON_MAP = {
  folder: <FolderOpenOutlined />,
  form: <FormOutlined />,
  code: <CodeOutlined />,
  picture: <PictureOutlined />,
  tool: <ToolOutlined />,
  file: <FileTextOutlined />,
  bulb: <BulbOutlined />,
  robot: <RobotOutlined />,
  coffee: <CoffeeOutlined />,
};

const SortableCategoryItem = ({ category, selected, onSelect, onEdit, onDelete, isDarkMode }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 999 : 'auto',
    position: 'relative',
    opacity: isDragging ? 0.5 : 1,
    height: 40,
    lineHeight: '40px',
    padding: '0 12px',
    margin: '4px 8px',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    backgroundColor: selected ? 'var(--menu-selected-bg)' : 'transparent',
    color: selected ? 'var(--primary-color)' : 'var(--text-primary)',
  };

  const IconComponent = ICON_MAP[category.icon] || <FolderOpenOutlined />;
  // Handle hex color or preset color name. For simplicity, just use style color if it's hex, or map it.
  // Actually, standardizing on using the color directly is easiest if we assume hex or valid css.
  // If it's a preset name like 'blue', we might need a map or just let it fall back (ant icons don't support color name prop directly in style).
  const iconColor = category.color && category.color.startsWith('#') ? category.color : undefined;

  // Hover state handling via CSS class or inline (inline is harder for hover).
  // Let's rely on a wrapper class 'sidebar-item' and add some global css or just inline simple hover logic using state is overkill.
  // We can use a simple className and inject style.

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="sidebar-item"
      onClick={() => onSelect(category.id)}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.04)' }}
      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.backgroundColor = 'transparent' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          style={{ cursor: 'grab', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: 4 }}
          onClick={e => e.stopPropagation()}
        >
          <HolderOutlined />
        </div>

        <span style={{ color: iconColor, fontSize: 16, display: 'flex', alignItems: 'center' }}>
          {IconComponent}
        </span>

        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 14 }}>
          {category.name}
        </span>
      </div>

      <Dropdown
        menu={{
          items: [
            { key: 'edit', label: '编辑', icon: <EditOutlined />, onClick: (e) => { e.domEvent.stopPropagation(); onEdit(category); } },
            { key: 'delete', label: '删除', icon: <DeleteOutlined />, danger: true, onClick: (e) => { e.domEvent.stopPropagation(); onDelete(category.id); } }
          ]
        }}
        trigger={['click']}
      >
        <div onClick={(e) => e.stopPropagation()} style={{ padding: '4px 8px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}>
          <MoreOutlined />
        </div>
      </Dropdown>
    </div>
  );
};

const Sidebar = ({
  categories,
  selectedCategory,
  onSelectCategory,
  onAddProject,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onReorderCategories,
  showFavorites,
  onToggleFavorites,
  showSettings,
  onToggleSettings,

  isDarkMode,
  setIsDarkMode,
  onLogout
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = categories.findIndex((c) => c.id === active.id);
      const newIndex = categories.findIndex((c) => c.id === over.id);
      const newCategories = arrayMove(categories, oldIndex, newIndex);
      onReorderCategories(newCategories);
    }
  };

  const handleDeleteClick = (id) => {
    Modal.confirm({
      title: '确认删除分类？',
      content: '删除后该分类下的项目将变为"无分类"，此操作不可恢复。',
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk() {
        onDeleteCategory(id);
      }
    });
  };

  return (
    <Sider width={260} className="minimal-sider" theme={isDarkMode ? 'dark' : 'light'} style={{ position: 'fixed', height: '100vh', left: 0, top: 0, zIndex: 10 }}>
      <div style={{ padding: '32px 24px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 36,
          height: 36,
          background: 'linear-gradient(135deg, var(--primary-color) 0%, #818cf8 100%)',
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
          flexShrink: 0
        }}>
          <RocketOutlined style={{ fontSize: 20 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
          <Text strong style={{
            fontSize: 18,
            color: 'var(--text-primary)',
            letterSpacing: '0.5px',
            fontWeight: 700
          }}>云词</Text>
          <Text type="secondary" style={{
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '1.2px',
            fontWeight: 500,
            opacity: 0.6
          }}>Cloud Prompts</Text>
        </div>
      </div>

      <div style={{ padding: '12px 20px' }}>
        <Button type="primary" block icon={<PlusOutlined />} onClick={onAddProject} style={{ borderRadius: 6, fontWeight: 500 }}>
          新建项目
        </Button>
      </div>

      <Menu
        mode="inline"
        theme={isDarkMode ? 'dark' : 'light'}
        selectedKeys={[
          showSettings ? 'settings' : (showFavorites ? 'fav' : (selectedCategory && !selectedCategory.toString().startsWith('cat') ? 'none' : 'all'))
        ]}
        style={{ border: 'none', padding: '0 8px', background: 'transparent' }}
        onClick={(e) => {
          if (e.key === 'fav') onToggleFavorites(true);
          else if (e.key === 'settings') onToggleSettings();
          else if (e.key === 'all') { onToggleFavorites(false); onSelectCategory(null); }
        }}
        items={[
          { key: 'all', icon: <AppstoreOutlined />, label: '全部项目', className: !selectedCategory && !showFavorites && !showSettings ? 'ant-menu-item-selected' : '' },
          { key: 'fav', icon: <StarOutlined />, label: '收藏夹' },
          { key: 'settings', icon: <SettingOutlined />, label: '设置' },
        ]}
      />

      <div style={{ padding: '16px 24px 8px', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
        分类库
      </div>

      <div style={{ padding: '0 8px', flex: 1, overflowY: 'auto' }}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={categories.map(c => c.id)}
            strategy={verticalListSortingStrategy}
          >
            {categories.map((category) => (
              <SortableCategoryItem
                key={category.id}
                category={category}
                isDarkMode={isDarkMode}
                selected={selectedCategory === category.id && !showFavorites}
                onSelect={onSelectCategory}
                onEdit={onEditCategory}
                onDelete={handleDeleteClick}
              />
            ))}
          </SortableContext>
        </DndContext>

        <div
          onClick={onAddCategory}
          style={{
            padding: '0 12px', height: 40, display: 'flex', alignItems: 'center', gap: 10,
            cursor: 'pointer', margin: '4px 8px', borderRadius: 8, color: 'var(--text-secondary)', fontSize: 14
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--menu-selected-bg)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <PlusOutlined style={{ fontSize: 14 }} />
          <span>新建分类</span>
        </div>
      </div>

      {/* Theme and Logout */}
      <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
            {isDarkMode ? <MoonOutlined /> : <SunOutlined />}
            <Text size="small" style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              {isDarkMode ? '深色模式' : '浅色模式'}
            </Text>
          </div>
          <Switch
            checked={isDarkMode}
            onChange={setIsDarkMode}
            size="small"
          />
        </div>

        {onLogout && (
          <div
            onClick={onLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)',
              cursor: 'pointer', fontSize: 13, padding: '4px 0'
            }}
          >
            <LogoutOutlined />
            <span>退出登录</span>
          </div>
        )}
      </div>
    </Sider>
  );
};

export default Sidebar;
