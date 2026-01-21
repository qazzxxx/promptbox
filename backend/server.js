const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const matter = require('gray-matter');
const { openai } = require('openai'); // Will use the SDK constructor inside routes
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 8000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');

app.use(cors());
app.use(express.json());

// Ensure data directory exists
fs.ensureDirSync(DATA_DIR);
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Helper: Read Settings
async function getSettings() {
    try {
        if (await fs.pathExists(SETTINGS_FILE)) {
            return await fs.readJson(SETTINGS_FILE);
        }
    } catch (e) {
        console.error("Error reading settings", e);
    }
    // Default settings
    return {
        id: 1,
        openai_api_key: "",
        openai_base_url: "https://api.openai.com/v1",
        openai_model: "gpt-3.5-turbo",
        available_models: ["gpt-3.5-turbo", "gpt-4", "dall-e-3"],
        provider: "openai",
        optimize_prompt_template: ""
    };
}

// Helper: Save Settings
async function saveSettings(settings) {
    await fs.writeJson(SETTINGS_FILE, settings, { spaces: 2 });
    return settings;
}

// --- Category Routes ---

// Get Categories (Subdirectories in DATA_DIR)
app.get('/api/categories', async (req, res) => {
    try {
        const items = await fs.readdir(DATA_DIR, { withFileTypes: true });
        const categories = [];

        for (const item of items) {
            if (item.isDirectory() && !item.name.startsWith('.')) {
                // Try to read a metadata file for the category if we want to store color/icon
                // For now, we'll just use the folder name, or maybe a .meta.json inside it
                // To keep it simple and match existing UI which expects id, name, color, icon, sort_order
                // We will default these values or look for a special file.

                // Strategy: Look for `_category.json` inside the folder
                const metaPath = path.join(DATA_DIR, item.name, '_category.json');
                let meta = {
                    id: item.name, // Use name as ID for simplicity in FS mode, or hash it
                    name: item.name,
                    color: 'blue',
                    icon: null,
                    sort_order: 99
                };

                if (await fs.pathExists(metaPath)) {
                    const fileMeta = await fs.readJson(metaPath);
                    meta = { ...meta, ...fileMeta };
                }

                categories.push(meta);
            }
        }

        // Sort by sort_order
        categories.sort((a, b) => a.sort_order - b.sort_order);
        res.json(categories);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Reorder Categories
app.put('/api/categories/reorder', async (req, res) => {
    try {
        const items = req.body; // Expects [{id, sort_order}, ...]

        for (const item of items) {
            const dirPath = path.join(DATA_DIR, item.id);
            if (await fs.pathExists(dirPath)) {
                const metaPath = path.join(dirPath, '_category.json');
                let meta = {};
                if (await fs.pathExists(metaPath)) {
                    meta = await fs.readJson(metaPath);
                } else {
                    meta = {
                        id: item.id,
                        name: item.id,
                        color: 'blue'
                    };
                }
                meta.sort_order = item.sort_order;
                await fs.writeJson(metaPath, meta);
            }
        }
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/categories', async (req, res) => {
    try {
        const { name, color, icon } = req.body;
        if (!name) return res.status(400).json({ error: "Name is required" });

        const dirPath = path.join(DATA_DIR, name);
        if (await fs.pathExists(dirPath)) {
            return res.status(400).json({ error: "Category already exists" });
        }

        await fs.ensureDir(dirPath);

        // Save metadata
        const meta = {
            id: name, // Using name as ID
            name,
            color: color || 'blue',
            icon: icon || null,
            sort_order: Date.now() // Simple sort order
        };
        await fs.writeJson(path.join(dirPath, '_category.json'), meta);

        res.json(meta);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Update Category (Rename folder or update metadata)
app.put('/api/categories/:id', async (req, res) => {
    // id is the folder name in this implementation
    const oldName = req.params.id;
    const { name, color, icon } = req.body;

    // Note: If name changes, we must rename the directory
    const oldPath = path.join(DATA_DIR, oldName);
    const newPath = path.join(DATA_DIR, name);

    try {
        if (!await fs.pathExists(oldPath)) {
            return res.status(404).json({ error: "Category not found" });
        }

        if (name !== oldName) {
            if (await fs.pathExists(newPath)) {
                return res.status(400).json({ error: "Target category name already exists" });
            }
            await fs.rename(oldPath, newPath);
        }

        // Update metadata
        const metaPath = path.join(newPath, '_category.json');
        let meta = {};
        if (await fs.pathExists(metaPath)) {
            meta = await fs.readJson(metaPath);
        }

        meta.name = name;
        meta.color = color || meta.color;
        meta.icon = icon || meta.icon;
        meta.id = name; // Update ID if name changed

        await fs.writeJson(metaPath, meta);

        res.json(meta);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/categories/:id', async (req, res) => {
    const name = req.params.id;
    const dirPath = path.join(DATA_DIR, name);
    try {
        if (await fs.pathExists(dirPath)) {
            // Check if directory is empty or if we should delete explicitly
            // For safety, let's move files to a 'Trash' or just delete if user requested
            // The requirement says "directly through folders", so standard delete is expected.
            await fs.remove(dirPath);
        }
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// --- Project Routes (Markdown Files) ---

// Helper: Read a project file
async function readProjectFile(catName, fileName) {
    const filePath = path.join(DATA_DIR, catName, fileName);
    const content = await fs.readFile(filePath, 'utf8');
    const parsed = matter(content);

    return {
        id: parsed.data.id || fileName.replace('.md', ''),
        name: parsed.data.name || fileName.replace('.md', ''),
        description: parsed.data.description,
        tags: parsed.data.tags || [],
        category_id: catName, // category_id represents the folder name
        is_favorite: parsed.data.is_favorite || false,
        created_at: parsed.data.created_at,
        updated_at: parsed.data.updated_at,
        type: parsed.data.type || 'text',
        // In the new model, the "versions" are stored in frontmatter or we consider the body the "latest" version
        // We can expose the body as the latest version content for simpler UI adaptation
        versions: parsed.data.versions || [],

        // If versions array is empty, we can construct a virtual one from the body
        // This helps if the user edits the file manually and just puts text in the body
        current_content: parsed.content
    };
}

// Get Projects
app.get('/api/projects', async (req, res) => {
    try {
        const { category_id, search, is_favorite } = req.query;
        let projects = [];

        // If category_id (folder) is specified, search only there
        const catsToSearch = category_id ? [category_id] : (await fs.readdir(DATA_DIR)).filter(n => !n.startsWith('.'));

        for (const cat of catsToSearch) {
            const catPath = path.join(DATA_DIR, cat);
            // Verify catPath is actually a directory
            try {
                const stat = await fs.stat(catPath);
                if (!stat.isDirectory()) continue;
            } catch { continue; }

            const files = await fs.readdir(catPath);
            for (const file of files) {
                if (file.endsWith('.md')) {
                    const fw = await readProjectFile(cat, file);
                    projects.push(fw);
                }
            }
        }

        // Filters
        if (is_favorite === 'true') {
            projects = projects.filter(p => p.is_favorite);
        }
        if (search) {
            const lowerSearch = search.toLowerCase();
            projects = projects.filter(p =>
                (p.name && p.name.toLowerCase().includes(lowerSearch)) ||
                (p.description && p.description.toLowerCase().includes(lowerSearch)) ||
                (p.current_content && p.current_content.toLowerCase().includes(lowerSearch))
            );
        }

        // Sort by updated_at desc
        projects.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

        res.json(projects);

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// Create Project
app.post('/api/projects', async (req, res) => {
    try {
        const { name, description, category_id, tags } = req.body;

        if (!category_id) return res.status(400).json({ error: "Category is required" });
        if (!name) return res.status(400).json({ error: "Name is required" });

        // Generate filename
        const safeName = name.replace(/[^a-z0-9\u4e00-\u9fa5]/gi, '_').toLowerCase();
        const fileName = `${safeName}-${Date.now()}.md`;
        const filePath = path.join(DATA_DIR, category_id, fileName);

        await fs.ensureDir(path.join(DATA_DIR, category_id));

        const now = new Date().toISOString();
        const frontmatter = {
            id: fileName.replace('.md', ''), // Use filename base as ID
            name,
            description,
            tags: tags || [],
            category_id,
            is_favorite: false,
            created_at: now,
            updated_at: now,
            type: 'text',
            versions: []
        };

        const fileContent = matter.stringify('', frontmatter);
        await fs.writeFile(filePath, fileContent);

        res.json(await readProjectFile(category_id, fileName));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/projects/:id', async (req, res) => {
    // We need to find the project file. Since ID is filename-based, we might know the name, 
    // but not the category if ID doesn't contain it. 
    // Wait, the previous implementation used Int IDs.
    // The frontend might expect /api/projects/:id.
    // If we use filename as ID, we need to locate it.

    // Scan all categories to find the ID
    const id = req.params.id;
    try {
        const cats = await fs.readdir(DATA_DIR);
        for (const cat of cats) {
            if (cat.startsWith('.')) continue;
            const catPath = path.join(DATA_DIR, cat);
            try {
                const stat = await fs.stat(catPath);
                if (!stat.isDirectory()) continue;
            } catch { continue; }

            // Check if file exists in this category
            // We assume ID corresponds to filename (minus .md potentially or we store ID in frontmatter)
            // If ID matches the filename (e.g. "project-123"), we look for "project-123.md"

            const potentialFile = path.join(catPath, `${id}.md`);
            if (await fs.pathExists(potentialFile)) {
                return res.json(await readProjectFile(cat, `${id}.md`));
            }

            // If we stored explicit IDs in frontmatter, we'd have to parse every file which is slow.
            // For this refactor, let's assume valid IDs are the filenames without extension.
        }
        res.status(404).json({ error: "Project not found" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/projects/:id', async (req, res) => {
    const id = req.params.id;
    const { name, description, tags, category_id, is_favorite } = req.body;

    try {
        // Find the file first
        let currentCat = null;
        let fileName = `${id}.md`;

        const cats = await fs.readdir(DATA_DIR);
        for (const cat of cats) {
            if (cat.startsWith('.')) continue;
            if (await fs.pathExists(path.join(DATA_DIR, cat, fileName))) {
                currentCat = cat;
                break;
            }
        }

        if (!currentCat) return res.status(404).json({ error: "Project not found" });

        const filePath = path.join(DATA_DIR, currentCat, fileName);
        const fileContent = await fs.readFile(filePath, 'utf8');
        const parsed = matter(fileContent);

        // Update Fields
        if (name) parsed.data.name = name;
        if (description !== undefined) parsed.data.description = description;
        if (tags) parsed.data.tags = tags;
        if (is_favorite !== undefined) parsed.data.is_favorite = is_favorite;

        parsed.data.updated_at = new Date().toISOString();

        // Handle Category Move
        if (category_id && category_id !== currentCat) {
            const newDir = path.join(DATA_DIR, category_id);
            await fs.ensureDir(newDir);
            const newPath = path.join(newDir, fileName);

            parsed.data.category_id = category_id;
            const newContent = matter.stringify(parsed.content, parsed.data);

            await fs.writeFile(newPath, newContent);
            await fs.unlink(filePath);

            return res.json(await readProjectFile(category_id, fileName));
        } else {
            const newContent = matter.stringify(parsed.content, parsed.data);
            await fs.writeFile(filePath, newContent);
            return res.json(await readProjectFile(currentCat, fileName));
        }

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/projects/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const cats = await fs.readdir(DATA_DIR);
        for (const cat of cats) {
            if (cat.startsWith('.')) continue;
            if (await fs.pathExists(path.join(DATA_DIR, cat, `${id}.md`))) {
                await fs.unlink(path.join(DATA_DIR, cat, `${id}.md`));
                return res.json({ ok: true });
            }
        }
        res.status(404).json({ error: "Project not found" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/projects/:id/favorite', async (req, res) => {
    // Toggle favorite
    // This requires finding it, reading it, flipping bit, writing it.
    // Reusing the PUT logic effectively
    const id = req.params.id;
    try {
        let currentCat = null;
        let fileName = `${id}.md`;

        const cats = await fs.readdir(DATA_DIR);
        for (const cat of cats) {
            if (cat.startsWith('.')) continue;
            if (await fs.pathExists(path.join(DATA_DIR, cat, fileName))) {
                currentCat = cat;
                break;
            }
        }

        if (!currentCat) return res.status(404).json({ error: "Project not found" });

        const filePath = path.join(DATA_DIR, currentCat, fileName);
        const parsed = matter(await fs.readFile(filePath, 'utf8'));

        parsed.data.is_favorite = !parsed.data.is_favorite;

        await fs.writeFile(filePath, matter.stringify(parsed.content, parsed.data));

        // Fix: create a proper response object
        const result = await readProjectFile(currentCat, fileName);
        // Ensure it matches the frontend's Project type
        res.json(result);

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// --- Versions ---
// The frontend calls: POST /api/projects/:project_id/versions
app.post('/api/projects/:id/versions', async (req, res) => {
    const id = req.params.id;
    const { content, parameters } = req.body; // `content` is the prompt text

    try {
        let currentCat = null;
        let fileName = `${id}.md`;

        const cats = await fs.readdir(DATA_DIR);
        for (const cat of cats) {
            if (cat.startsWith('.')) continue;
            if (await fs.pathExists(path.join(DATA_DIR, cat, fileName))) {
                currentCat = cat;
                break;
            }
        }

        if (!currentCat) return res.status(404).json({ error: "Project not found" });
        const filePath = path.join(DATA_DIR, currentCat, fileName);
        const parsed = matter(await fs.readFile(filePath, 'utf8'));

        // Add new version to frontmatter
        const versions = parsed.data.versions || [];
        const newVersion = {
            id: Date.now(), // Use timestamp as ID
            version_num: versions.length + 1,
            content: content || parsed.content,
            parameters: parameters || {},
            created_at: new Date().toISOString()
        };

        versions.push(newVersion);
        parsed.data.versions = versions;
        parsed.data.updated_at = new Date().toISOString();

        // Update the main body content to match the latest version
        parsed.content = content || parsed.content;

        await fs.writeFile(filePath, matter.stringify(parsed.content, parsed.data));

        res.json(newVersion);

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/projects/:id/versions', async (req, res) => {
    const id = req.params.id;
    try {
        let currentCat = null;
        let fileName = `${id}.md`;

        const cats = await fs.readdir(DATA_DIR);
        for (const cat of cats) {
            if (cat.startsWith('.')) continue;
            if (await fs.pathExists(path.join(DATA_DIR, cat, fileName))) {
                currentCat = cat;
                break;
            }
        }

        if (!currentCat) return res.status(404).json({ error: "Project not found" });
        const filePath = path.join(DATA_DIR, currentCat, fileName);
        const parsed = matter(await fs.readFile(filePath, 'utf8'));

        const versions = parsed.data.versions || [];
        // Sort descendant
        versions.sort((a, b) => b.version_num - a.version_num);

        res.json(versions);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- Settings and AI ---

app.get('/api/settings', async (req, res) => {
    res.json(await getSettings());
});

app.put('/api/settings', async (req, res) => {
    try {
        const saved = await saveSettings(req.body);
        res.json(saved);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/ai/run', async (req, res) => {
    // Similar to Python logic but using Node SDK
    const { prompt, type, model, parameters } = req.body;
    const settings = await getSettings();

    if (!settings.openai_api_key) {
        return res.status(400).json({ detail: "请先在设置中配置 API Key" });
    }

    try {
        const client = new OpenAI({
            apiKey: settings.openai_api_key,
            baseURL: settings.openai_base_url,
            timeout: 60000 // 60s
        });

        if (type === 'image') {
            const response = await client.images.generate({
                model: model || "dall-e-3",
                prompt: prompt,
                size: "1024x1024",
                quality: "standard",
                n: 1,
            });
            res.json({ result: response.data[0].url });
        } else {
            // Text
            const response = await client.chat.completions.create({
                model: model || settings.openai_model,
                messages: [{ role: "user", content: prompt }],
                temperature: parameters?.temperature ? parseFloat(parameters.temperature) : 0.7,
                max_tokens: parameters?.max_tokens ? parseInt(parameters.max_tokens) : 2000
            });
            res.json({ result: response.choices[0].message.content });
        }

    } catch (e) {
        console.error("AI Error", e);
        res.status(500).json({ detail: `执行失败: ${e.message}` });
    }
});

app.post('/api/ai/analyze', async (req, res) => {
    const { prompt } = req.body;
    const settings = await getSettings();

    if (!settings.openai_api_key) {
        return res.status(400).json({ detail: "请先在设置中配置 API Key" });
    }

    try {
        const client = new OpenAI({
            apiKey: settings.openai_api_key,
            baseURL: settings.openai_base_url,
            timeout: 30000
        });

        const categories = (await fs.readdir(DATA_DIR)).filter(n => !n.startsWith('.'));
        const catStr = categories.join(", ");

        const systemPrompt = `
        Analyze the user's prompt and extract structured metadata in valid JSON format.
        Fields:
        - name: A short, catchy title (max 20 chars).
        - description: A brief summary of what this prompt does (max 100 chars).
        - tags: A list of 1-3 keywords.
        - type: 'text' (for LLM/ChatGPT prompts) or 'image' (for Midjourney/Stable Diffusion prompts).
        - category_suggested: Choose the best fit from: [${catStr}]. If none fit well, use '通用'.
        
        Output strictly JSON. No markdown code blocks.
        `;

        const response = await client.chat.completions.create({
            model: settings.openai_model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt }
            ],
            temperature: 0.3,
            response_format: { type: "json_object" }
        });

        const content = response.choices[0].message.content;
        const data = JSON.parse(content);

        res.json({
            name: data.name || "New Project",
            description: data.description || "",
            tags: data.tags || [],
            type: data.type || "text",
            category_suggested: data.category_suggested || "通用"
        });

    } catch (e) {
        console.error("AI Analyze Error", e);
        res.json({
            name: "New Project",
            description: "",
            tags: [],
            type: "text",
            category_suggested: "通用"
        });
    }
});

app.post('/api/ai/optimize', async (req, res) => {
    const { prompt } = req.body;
    const settings = await getSettings();

    if (!settings.openai_api_key) {
        return res.status(400).json({ detail: "请先在设置中配置 API Key" });
    }

    try {
        const client = new OpenAI({
            apiKey: settings.openai_api_key,
            baseURL: settings.openai_base_url,
            timeout: 300000
        });

        const systemPrompt = settings.optimize_prompt_template || `你是一个专业的提示词工程师 (Prompt Engineer)。
你的任务是优化用户提供的 Prompt，使其更加清晰、结构化，并能引导 AI 生成更高质量的结果。
请保持原意不变，但进行以下改进：
1. 明确角色设定 (Role)
2. 补充背景信息 (Context)
3. 细化任务描述 (Task)
4. 规定输出格式 (Format)

请直接输出优化后的 Prompt 内容，不要包含解释性文字。`;

        const response = await client.chat.completions.create({
            model: settings.openai_model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt }
            ],
            temperature: 0.7
        });

        res.json({ optimized_prompt: response.choices[0].message.content });

    } catch (e) {
        console.error("AI Optimize Error", e);
        res.status(500).json({ detail: `AI 调用失败: ${e.message}` });
    }
});


// Serve Static Files (Frontend) - if we want to bundle it
app.use(express.static(path.join(__dirname, 'static')));

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Data directory: ${DATA_DIR}`);
});
