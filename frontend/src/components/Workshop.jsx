import React, { useState, useEffect } from 'react';
import { Typography, Button, Input, Tabs, Timeline, Tag, Empty, message, Form, Breadcrumb, Popconfirm, Select, Modal } from 'antd';
import { 
  LeftOutlined, EditOutlined, RobotOutlined, SaveOutlined, 
  CopyOutlined, CheckOutlined, DeleteOutlined, PlayCircleOutlined,
  SettingOutlined, PictureOutlined, FileTextOutlined, 
  HistoryOutlined, DiffOutlined, UndoOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';
import Editor from 'react-simple-code-editor'; // Import Editor
import { aiApi, settingsApi } from '../api';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// Highlighter for {{variables}}
const highlightVariables = (code) => {
  return code.split(/(\{\{[^}]+\}\})/g).map((part, i) => {
    if (part.startsWith('{{') && part.endsWith('}}')) {
      return (
        <span 
          key={i} 
          style={{ 
            color: '#4f46e5', 
            fontWeight: 600, 
            background: '#e0e7ff', 
            borderRadius: 4,
            padding: '0 2px'
          }}
        >
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
};

const Workshop = ({ 
  project, 
  category, 
  versions, 
  onBack, 
  onSaveVersion, 
  onDeleteProject 
}) => {
  const [promptInput, setPromptInput] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [optimizedResult, setOptimizedResult] = useState('');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState(null); 
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState(project.type || 'text'); 
  const [selectedModel, setSelectedModel] = useState(null);
  const [availableModels, setAvailableModels] = useState([]);
  
  // Diff & Rollback State
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
  const [diffVersion, setDiffVersion] = useState(null);

  // Copy with Variables Modal State
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);

  // Variables State
  const [variables, setVariables] = useState({});
  const [previewResult, setPreviewResult] = useState('');

  // Load Settings for Models
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const s = await settingsApi.get();
      // Parse available_models if it's string (should be list from backend now)
      let models = s.available_models || [];
      // Fallback if empty
      if (models.length === 0) models = ['gpt-3.5-turbo', 'gpt-4', 'dall-e-3'];
      setAvailableModels(models);
      setSelectedModel(s.openai_model || models[0]);
    } catch (e) {
      setAvailableModels(['gpt-3.5-turbo', 'gpt-4', 'dall-e-3']);
    }
  };

  // Init
  useEffect(() => {
    if (versions.length > 0) {
      setPromptInput(versions[0].content);
    }
  }, [versions]);

  // Extract variables {{var}}
  useEffect(() => {
    const regex = /\{\{([^}]+)\}\}/g;
    const found = [];
    let match;
    while ((match = regex.exec(promptInput)) !== null) {
      found.push(match[1]);
    }
    // Only update if changed to avoid loop
    const newVars = { ...variables };
    let changed = false;
    found.forEach(v => {
      if (!(v in newVars)) {
        newVars[v] = '';
        changed = true;
      }
    });
    // Remove unused
    Object.keys(newVars).forEach(k => {
      if (!found.includes(k)) {
        delete newVars[k];
        changed = true;
      }
    });
    
    if (changed) setVariables(newVars);
  }, [promptInput]);

  const handleOptimize = async () => {
    if (!promptInput) return;
    setIsOptimizing(true);
    try {
      const res = await aiApi.optimize({ prompt: promptInput });
      setOptimizedResult(res.optimized_prompt);
      message.success('优化完成');
    } catch (e) {
      // Error is handled by api interceptor, but we can log or show specific hints
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleRunAI = async () => {
    let finalPrompt = promptInput;
    // Replace variables
    Object.keys(variables).forEach(key => {
      finalPrompt = finalPrompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), variables[key] || '');
    });

    if (!finalPrompt) return;

    setIsRunning(true);
    setRunResult(null);
    try {
      const res = await aiApi.run({
        prompt: finalPrompt,
        negative_prompt: negativePrompt,
        type: mode,
        model: selectedModel,
        parameters: {} // Can add UI for params later
      });
      setRunResult({ type: mode, content: res.result });
      message.success('执行完成');
    } catch (e) {
      // Handled
    } finally {
      setIsRunning(false);
    }
  };

  const handleCopy = () => {
    const text = optimizedResult || promptInput;
    if (!text) return;

    // Check for variables if we are copying promptInput
    // (If copying optimized result, it likely doesn't have vars, or we treat it as plain text)
    // Actually, optimized result MIGHT have vars if the AI kept them.
    // Let's check regex on the text to be copied.
    const hasVariables = /\{\{([^}]+)\}\}/.test(text);

    if (hasVariables) {
      setIsCopyModalOpen(true);
    } else {
      doCopy(text);
    }
  };

  const doCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    message.success('已复制到剪贴板');
  };

  const handleSmartCopy = (fillVariables) => {
    let text = optimizedResult || promptInput;
    if (fillVariables) {
        Object.keys(variables).forEach(key => {
            text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), variables[key] || '');
        });
    }
    doCopy(text);
    setIsCopyModalOpen(false);
  };

  const handleTestRun = () => {
    let text = promptInput;
    Object.keys(variables).forEach(key => {
      text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), variables[key] || `[${key}]`);
    });
    setPreviewResult(text);
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button icon={<LeftOutlined />} type="text" onClick={onBack} style={{ color: '#64748b' }} />
          <Breadcrumb 
            items={[
              { title: <span style={{ cursor: 'pointer' }} onClick={onBack}>项目库</span> },
              { title: project.name }
            ]} 
          />
        </div>
        <Popconfirm title="确定删除项目？" onConfirm={() => onDeleteProject(project.id)} okText="删除" cancelText="取消" okType="danger">
          <Button type="text" danger icon={<DeleteOutlined />}>删除项目</Button>
        </Popconfirm>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 32 }}>
        <div>
          <Title level={2} style={{ margin: '0 0 8px 0', fontWeight: 600 }}>{project.name}</Title>
          <Text type="secondary" style={{ fontSize: 15 }}>{project.description || '暂无描述'}</Text>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <Tag color="purple">{category?.name}</Tag>
            {project.tags.map(t => <Tag key={t} bordered={false} style={{ background: '#f1f5f9', color: '#475569' }}>#{t}</Tag>)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button icon={copied ? <CheckOutlined /> : <CopyOutlined />} onClick={handleCopy}>复制</Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={() => onSaveVersion(optimizedResult || promptInput, negativePrompt, {})}>保存版本</Button>
        </div>
      </div>

      {/* Editor Layout */}
      <div style={{ display: 'flex', gap: 24, height: 'calc(100vh - 250px)' }}>
        
        {/* Left: Editor */}
        <div className="clean-card" style={{ flex: 1.2, display: 'flex', flexDirection: 'column', padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button 
                size="small" 
                type={mode === 'text' ? 'primary' : 'default'} 
                icon={<FileTextOutlined />} 
                onClick={() => setMode('text')}
              >
                文本
              </Button>
              <Button 
                size="small" 
                type={mode === 'image' ? 'primary' : 'default'} 
                icon={<PictureOutlined />} 
                onClick={() => setMode('image')}
              >
                绘图
              </Button>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Select 
                 size="small" 
                 style={{ width: 140 }} 
                 value={selectedModel} 
                 onChange={setSelectedModel}
                 placeholder="选择模型"
              >
                 {availableModels.map(m => <Option key={m} value={m}>{m}</Option>)}
              </Select>
              <Button type="primary" size="small" ghost icon={<RobotOutlined />} loading={isOptimizing} onClick={handleOptimize}>AI 优化</Button>
              <Button type="primary" size="small" icon={<PlayCircleOutlined />} loading={isRunning} onClick={handleRunAI}>运行</Button>
            </div>
          </div>
          <div style={{ border: '1px solid #d9d9d9', borderRadius: 6, padding: 5, flex: 1, overflow: 'auto' }}>
            <Editor
              value={promptInput}
              onValueChange={code => setPromptInput(code)}
              highlight={highlightVariables}
              padding={10}
              placeholder="输入提示词... 使用 {{variable}} 定义变量"
              style={{
                fontFamily: '"Fira code", "Fira Mono", monospace',
                fontSize: 15,
                minHeight: '100%',
                outline: 'none',
              }}
              textareaClassName="focus:outline-none" 
            />
          </div>

          {mode === 'image' && (
             <div style={{ marginTop: 16, borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
                <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>反向提示词 (Negative Prompt)</Text>
                <TextArea 
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  autoSize={{ minRows: 2, maxRows: 4 }}
                  placeholder="不想看到的元素..."
                />
             </div>
          )}
          
          {/* Variables Panel */}
          {Object.keys(variables).length > 0 && (
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text strong style={{ fontSize: 13 }}>变量测试</Text>
                <Button type="dashed" size="small" icon={<PlayCircleOutlined />} onClick={handleTestRun}>生成预览</Button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {Object.keys(variables).map(v => (
                  <Input 
                    key={v} 
                    addonBefore={v} 
                    value={variables[v]} 
                    onChange={e => setVariables({...variables, [v]: e.target.value})}
                    size="small"
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Tabs */}
        <div className="clean-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Tabs 
            defaultActiveKey="1" 
            tabBarStyle={{ padding: '0 24px', margin: 0 }}
            className="full-height-tabs"
            items={[
              {
                key: '1',
                label: '预览/结果',
                children: (
                  <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                    {runResult ? (
                      <div style={{ flex: 1, overflowY: 'auto' }}>
                        <Tag color="blue" style={{ marginBottom: 12 }}>运行结果</Tag>
                        {runResult.type === 'image' ? (
                          <div style={{ textAlign: 'center' }}>
                            <img src={runResult.content} alt="Generated" style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: 8 }} />
                          </div>
                        ) : (
                          <div className="markdown-body">
                            <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                              {runResult.content}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>
                    ) : previewResult ? (
                      <div style={{ flex: 1, overflowY: 'auto' }}>
                        <Tag color="green" style={{ marginBottom: 12 }}>变量预览</Tag>
                        <div className="markdown-body">
                           <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                             {previewResult}
                           </ReactMarkdown>
                        </div>
                      </div>
                    ) : optimizedResult ? (
                      <div style={{ flex: 1, overflowY: 'auto' }}>
                         <Tag color="orange" style={{ marginBottom: 12 }}>优化建议</Tag>
                         <div className="markdown-body">
                            <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                              {optimizedResult}
                            </ReactMarkdown>
                         </div>
                      </div>
                    ) : (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                         <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无结果" />
                      </div>
                    )}
                  </div>
                )
              },
              {
                key: '2',
                label: '版本历史',
                children: (
                  <div style={{ padding: 24, overflowY: 'auto', height: '100%' }}>
                    <Timeline
                      items={versions.map(v => ({
                        color: '#4f46e5',
                        children: (
                          <div style={{ paddingBottom: 20 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <Text strong>v{v.version_num}</Text>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(v.created_at).format('MM-DD HH:mm')}</Text>
                                <Button 
                                  type="text" 
                                  size="small" 
                                  icon={<DiffOutlined />} 
                                  title="对比当前内容"
                                  onClick={() => {
                                    setDiffVersion(v);
                                    setIsDiffModalOpen(true);
                                  }}
                                />
                                <Button 
                                  type="text" 
                                  size="small" 
                                  icon={<UndoOutlined />} 
                                  title="恢复此版本"
                                  onClick={() => {
                                    setPromptInput(v.content);
                                    if(v.negative_prompt) setNegativePrompt(v.negative_prompt);
                                    message.success('已恢复版本 v' + v.version_num);
                                  }}
                                />
                              </div>
                            </div>
                            <div 
                              style={{ background: '#f8fafc', padding: 12, borderRadius: 8, fontSize: 13, color: '#334155', cursor: 'pointer' }}
                              onClick={() => {
                                // Default click action: just view? Or maybe removed now that we have explicit buttons.
                                // Let's keep it as "Copy to editor" or "Preview"
                                // For now, let's just do nothing on click since we have explicit buttons, to avoid confusion.
                              }}
                            >
                              {v.content}
                            </div>
                          </div>
                        )
                      }))}
                    />
                  </div>
                )
              }
            ]}
          />
        </div>
      </div>

      <Modal
        title={diffVersion ? `版本对比 (v${diffVersion.version_num} vs 当前)` : '版本对比'}
        open={isDiffModalOpen}
        onCancel={() => setIsDiffModalOpen(false)}
        width={1000}
        footer={null}
        style={{ top: 20 }}
      >
        <div style={{ height: '70vh', overflowY: 'auto' }}>
          {diffVersion && (
            <ReactDiffViewer
              oldValue={diffVersion.content}
              newValue={promptInput}
              splitView={true}
              compareMethod={DiffMethod.WORDS}
              styles={{
                variables: {
                  light: {
                    diffViewerBackground: '#fff',
                    diffViewerTitleBackground: '#f8fafc',
                    addedBackground: '#e6ffec',
                    addedColor: '#24292e',
                    removedBackground: '#ffebe9',
                    removedColor: '#24292e',
                    wordAddedBackground: '#acf2bd',
                    wordRemovedBackground: '#fdb8c0',
                  }
                }
              }}
              leftTitle={`v${diffVersion.version_num} (${dayjs(diffVersion.created_at).format('MM-DD HH:mm')})`}
              rightTitle="当前编辑内容"
            />
          )}
        </div>
      </Modal>

      {/* Copy with Variables Modal */}
      <Modal
        title="检测到变量"
        open={isCopyModalOpen}
        onCancel={() => setIsCopyModalOpen(false)}
        footer={null}
      >
         <Paragraph>当前提示词包含变量，请确认变量内容：</Paragraph>
         <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 24 }}>
           {Object.keys(variables).map(v => (
             <div key={v} style={{ marginBottom: 12 }}>
               <Text strong style={{ display: 'block', marginBottom: 4 }}>{v}</Text>
               <Input 
                 value={variables[v]} 
                 onChange={e => setVariables({...variables, [v]: e.target.value})}
                 placeholder={`请输入 ${v} 的值`}
               />
             </div>
           ))}
         </div>
         <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button onClick={() => handleSmartCopy(false)}>复制原始模板 (保留变量)</Button>
            <Button type="primary" onClick={() => handleSmartCopy(true)}>复制填入后内容</Button>
         </div>
      </Modal>
    </div>
  );
};

export default Workshop;
