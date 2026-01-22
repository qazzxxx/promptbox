require('dotenv').config();
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

// Helper: Migrate specific file if needed (Internal use)
async function migrateToSplitFormat(catName, fileName) {
    const filePath = path.join(DATA_DIR, catName, fileName); // .md file
    const content = await fs.readFile(filePath, 'utf8');
    const parsed = matter(content);

    const baseName = fileName.replace('.md', '');
    const jsonPath = path.join(DATA_DIR, catName, `${baseName}.json`);

    // Only migrate if we have frontmatter data to save
    if (Object.keys(parsed.data).length > 0) {
        const meta = {
            id: parsed.data.id || baseName,
            name: parsed.data.name || baseName, // Ensure we keep the name
            description: parsed.data.description,
            tags: parsed.data.tags || [],
            category_id: catName,
            is_favorite: parsed.data.is_favorite || false,
            created_at: parsed.data.created_at || new Date().toISOString(),
            updated_at: parsed.data.updated_at || new Date().toISOString(),
            type: parsed.data.type || 'text',
            versions: parsed.data.versions || []
        };

        await fs.writeJson(jsonPath, meta, { spaces: 2 });
        await fs.writeFile(filePath, parsed.content); // Overwrite MD with pure content
        return meta;
    }
    return null;
}

// Helper: Read a project file
async function readProjectFile(catName, fileName) {
    const baseName = fileName.replace('.md', '').replace('.json', '');
    const mdName = `${baseName}.md`;
    const jsonName = `${baseName}.json`;

    const mdPath = path.join(DATA_DIR, catName, mdName);
    const jsonPath = path.join(DATA_DIR, catName, jsonName);

    // 1. Try to read JSON metadata
    if (await fs.pathExists(jsonPath)) {
        const meta = await fs.readJson(jsonPath);
        let content = '';
        if (await fs.pathExists(mdPath)) {
            content = await fs.readFile(mdPath, 'utf8');
        }
        return {
            ...meta,
            current_content: content
        };
    }

    // 2. Fallback: Old format (MD with frontmatter) -> Migrate it now?
    // Let's migrate on read to ensure consistency going forward
    if (await fs.pathExists(mdPath)) {
        const meta = await migrateToSplitFormat(catName, mdName);
        if (meta) {
            const content = await fs.readFile(mdPath, 'utf8');
            return { ...meta, current_content: content };
        }

        // If no frontmatter (pure MD without JSON?), treat as basic file?
        // Reuse old logic if migration didn't happen (shouldn't happen with matter)
        const content = await fs.readFile(mdPath, 'utf8');
        const parsed = matter(content);
        return {
            id: baseName,
            name: baseName,
            description: '',
            tags: [],
            category_id: catName,
            is_favorite: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            type: 'text',
            versions: [],
            current_content: parsed.content
        };
    }

    throw new Error("Project not found");
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

app.post('/api/projects', async (req, res) => {
    try {
        const { name, description, category_id, tags } = req.body;

        if (!category_id) return res.status(400).json({ error: "Category is required" });
        if (!name) return res.status(400).json({ error: "Name is required" });

        // Generate filename
        const safeName = name.replace(/[^a-z0-9\u4e00-\u9fa5]/gi, '_').toLowerCase();
        const baseName = `${safeName}-${Date.now()}`;
        const mdName = `${baseName}.md`;
        const jsonName = `${baseName}.json`;

        await fs.ensureDir(path.join(DATA_DIR, category_id));

        const now = new Date().toISOString();
        const meta = {
            id: baseName,
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

        // Write JSON
        await fs.writeJson(path.join(DATA_DIR, category_id, jsonName), meta, { spaces: 2 });
        // Write Empty MD
        await fs.writeFile(path.join(DATA_DIR, category_id, mdName), '');

        res.json({ ...meta, current_content: '' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/projects/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const cats = await fs.readdir(DATA_DIR);
        for (const cat of cats) {
            if (cat.startsWith('.')) continue;
            const catPath = path.join(DATA_DIR, cat);
            try {
                if (!(await fs.stat(catPath)).isDirectory()) continue;
            } catch { continue; }

            // Check if file exists (MD or JSON)
            if (await fs.pathExists(path.join(catPath, `${id}.md`)) ||
                await fs.pathExists(path.join(catPath, `${id}.json`))) {
                return res.json(await readProjectFile(cat, `${id}.md`));
            }
        }
        res.status(404).json({ error: "Project not found" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/projects/:id', async (req, res) => {
    const id = req.params.id;
    const { name, description, tags, category_id, is_favorite, current_content } = req.body;

    try {
        // Find the file
        let currentCat = null;
        let baseName = id;

        const cats = await fs.readdir(DATA_DIR);
        for (const cat of cats) {
            if (cat.startsWith('.')) continue;
            if (await fs.pathExists(path.join(DATA_DIR, cat, `${baseName}.md`)) ||
                await fs.pathExists(path.join(DATA_DIR, cat, `${baseName}.json`))) {
                currentCat = cat;
                break;
            }
        }

        if (!currentCat) return res.status(404).json({ error: "Project not found" });

        // Force migration if needed (ensures we have JSON to edit)
        if (await fs.pathExists(path.join(DATA_DIR, currentCat, `${baseName}.md`)) &&
            !await fs.pathExists(path.join(DATA_DIR, currentCat, `${baseName}.json`))) {
            await migrateToSplitFormat(currentCat, `${baseName}.md`);
        }

        const jsonPath = path.join(DATA_DIR, currentCat, `${baseName}.json`);
        const mdPath = path.join(DATA_DIR, currentCat, `${baseName}.md`);

        const meta = await fs.readJson(jsonPath);

        // Update Fields
        if (name) meta.name = name;
        if (description !== undefined) meta.description = description;
        if (tags) meta.tags = tags;
        if (is_favorite !== undefined) meta.is_favorite = is_favorite;

        meta.updated_at = new Date().toISOString();

        // Update Content if provided
        // Note: The frontend might pass `current_content` or just metadata.
        // We write content to MD.
        if (current_content !== undefined) {
            await fs.writeFile(mdPath, current_content);
        }

        // Handle Category Move
        if (category_id && category_id !== currentCat) {
            const newDir = path.join(DATA_DIR, category_id);
            await fs.ensureDir(newDir);

            meta.category_id = category_id;

            // Move JSON
            await fs.move(jsonPath, path.join(newDir, `${baseName}.json`));
            // Move MD
            if (await fs.pathExists(mdPath)) {
                await fs.move(mdPath, path.join(newDir, `${baseName}.md`));
            }

            // Update JSON with new category
            await fs.writeJson(path.join(newDir, `${baseName}.json`), meta, { spaces: 2 });

            return res.json(await readProjectFile(category_id, baseName));
        } else {
            await fs.writeJson(jsonPath, meta, { spaces: 2 });
            return res.json(await readProjectFile(currentCat, baseName));
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
            const mdPath = path.join(DATA_DIR, cat, `${id}.md`);
            const jsonPath = path.join(DATA_DIR, cat, `${id}.json`);

            let found = false;
            if (await fs.pathExists(mdPath)) {
                await fs.unlink(mdPath);
                found = true;
            }
            if (await fs.pathExists(jsonPath)) {
                await fs.unlink(jsonPath);
                found = true;
            }

            if (found) return res.json({ ok: true });
        }
        res.status(404).json({ error: "Project not found" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/projects/:id/favorite', async (req, res) => {
    const id = req.params.id;
    try {
        let currentCat = null;
        let baseName = id;

        const cats = await fs.readdir(DATA_DIR);
        for (const cat of cats) {
            if (cat.startsWith('.')) continue;
            if (await fs.pathExists(path.join(DATA_DIR, cat, `${baseName}.md`)) ||
                await fs.pathExists(path.join(DATA_DIR, cat, `${baseName}.json`))) {
                currentCat = cat;
                break;
            }
        }

        if (!currentCat) return res.status(404).json({ error: "Project not found" });

        // Ensure migration
        if (!await fs.pathExists(path.join(DATA_DIR, currentCat, `${baseName}.json`))) {
            await migrateToSplitFormat(currentCat, `${baseName}.md`);
        }

        const jsonPath = path.join(DATA_DIR, currentCat, `${baseName}.json`);
        const meta = await fs.readJson(jsonPath);

        meta.is_favorite = !meta.is_favorite;

        await fs.writeJson(jsonPath, meta, { spaces: 2 });

        res.json(await readProjectFile(currentCat, baseName));

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// --- Versions ---
// The frontend calls: POST /api/projects/:project_id/versions
app.post('/api/projects/:id/versions', async (req, res) => {
    const id = req.params.id;
    const { content, parameters } = req.body;

    try {
        let currentCat = null;
        const baseName = id;

        const cats = await fs.readdir(DATA_DIR);
        for (const cat of cats) {
            if (cat.startsWith('.')) continue;
            if (await fs.pathExists(path.join(DATA_DIR, cat, `${baseName}.md`)) ||
                await fs.pathExists(path.join(DATA_DIR, cat, `${baseName}.json`))) {
                currentCat = cat;
                break;
            }
        }

        if (!currentCat) return res.status(404).json({ error: "Project not found" });

        // Ensure migration
        if (!await fs.pathExists(path.join(DATA_DIR, currentCat, `${baseName}.json`))) {
            await migrateToSplitFormat(currentCat, `${baseName}.md`);
        }

        const jsonPath = path.join(DATA_DIR, currentCat, `${baseName}.json`);
        const mdPath = path.join(DATA_DIR, currentCat, `${baseName}.md`);

        const meta = await fs.readJson(jsonPath);

        // Add new version
        const versions = meta.versions || [];
        const newVersion = {
            id: Date.now(),
            version_num: versions.length + 1,
            content: content,
            parameters: parameters || {},
            created_at: new Date().toISOString()
        };

        versions.push(newVersion);
        meta.versions = versions;
        meta.updated_at = new Date().toISOString();

        // Save JSON
        await fs.writeJson(jsonPath, meta, { spaces: 2 });

        // Update MD Content
        await fs.writeFile(mdPath, content);

        res.json(newVersion);

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/projects/:id/versions', async (req, res) => {
    const id = req.params.id;
    try {
        let currentCat = null;
        const baseName = id;

        const cats = await fs.readdir(DATA_DIR);
        for (const cat of cats) {
            if (cat.startsWith('.')) continue;
            if (await fs.pathExists(path.join(DATA_DIR, cat, `${baseName}.md`)) ||
                await fs.pathExists(path.join(DATA_DIR, cat, `${baseName}.json`))) {
                currentCat = cat;
                break;
            }
        }

        if (!currentCat) return res.status(404).json({ error: "Project not found" });

        // Check JSON
        const jsonPath = path.join(DATA_DIR, currentCat, `${baseName}.json`);
        let meta = {};
        if (await fs.pathExists(jsonPath)) {
            meta = await fs.readJson(jsonPath);
        } else {
            // Fallback to reading parsed frontmatter if migration hasn't happened yet? 
            // Or just migrate on the fly by reading. `readProjectFile` does logical migration returning struct.
            // But here we need versions specifically.
            // If JSON doesn't exist, we can migrate now.
            const migrated = await migrateToSplitFormat(currentCat, `${baseName}.md`);
            meta = migrated || {};
        }

        const versions = meta.versions || [];
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

// --- Auth Routes ---
app.get('/api/auth/status', async (req, res) => {
    const settings = await getSettings();
    // Simple logic: if admin_password is set, auth is enabled.
    // Since we don't have session middleware yet, we'll assume not authenticated if enabled, 
    // or just properly implement a simple token check if needed.
    // For now, to fix the 404 and let the app run, we'll return logic based on settings.

    // If no password set, auth is disabled, so user is "authenticated" by default.
    const enabled = !!settings.admin_password;

    // TODO: Check for session/token cookie here if enabled.
    // For this fix, we assume not authenticated if enabled, or authenticated if disabled.
    const authenticated = !enabled;

    res.json({ enabled, authenticated });
});

app.post('/api/auth/login', async (req, res) => {
    const { password } = req.body;
    const settings = await getSettings();

    if (settings.admin_password && password === settings.admin_password) {
        // TODO: Set cookie or token
        return res.json({ ok: true });
    }
    return res.status(401).json({ error: "Invalid password" });
});

app.post('/api/auth/logout', (req, res) => {
    // TODO: Clear cookie
    res.json({ ok: true });
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


// Serve Static Files (Frontend)
app.use(express.static(path.join(__dirname, 'static')));

// Handle SPA routing: serve index.html for any unknown routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Data directory: ${DATA_DIR}`);
});
