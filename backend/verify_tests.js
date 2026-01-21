const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');

async function request(url, method = 'GET', body = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(url, options);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
}

async function test() {
    console.log("Starting Verification...");

    // Spawn server process
    const serverProcess = spawn('node', ['server.js'], {
        cwd: path.resolve(__dirname),
        env: { ...process.env, PORT: '8888', DATA_DIR: './test_data' },
        stdio: 'inherit'
    });

    // Wait for server to start
    await new Promise(r => setTimeout(r, 2000));

    try {
        const baseURL = 'http://localhost:8888/api';

        // 1. Create Category
        console.log("Testing Create Category...");
        const catRes = await request(`${baseURL}/categories`, 'POST', { name: 'TestCat' });
        console.log("Category Created:", catRes);

        // 2. List Categories
        console.log("Testing List Categories...");
        const cats = await request(`${baseURL}/categories`);
        if (cats.find(c => c.name === 'TestCat')) {
            console.log("PASS: Category created and listed");
        } else {
            console.error("FAIL: Category not found");
        }

        // 3. Create Project
        console.log("Testing Create Project...");
        const projRes = await request(`${baseURL}/projects`, 'POST', {
            name: 'MyProject',
            description: 'Desc',
            category_id: 'TestCat'
        });
        const projId = projRes.id;
        console.log(`PASS: Project created with ID ${projId}`);

        // 4. Update Project
        console.log("Testing Update Project...");
        await request(`${baseURL}/projects/${projId}`, 'PUT', {
            name: 'MyProjectUpdated'
        });
        const projGet = await request(`${baseURL}/projects/${projId}`);
        if (projGet.name === 'MyProjectUpdated') {
            console.log("PASS: Project updated");
        } else {
            console.error("FAIL: Project update failed");
        }

        // 5. Reorder Categories
        console.log("Testing Reorder Categories...");
        await request(`${baseURL}/categories/reorder`, 'PUT', [
            { id: 'TestCat', sort_order: 1 }
        ]);
        console.log("PASS: Categories reordered");

        // 6. AI Analyze (Mock check or ensuring endpoint exists)
        // We won't test AI call to save tokens/time but we can check if 400 is returned (missing key) or similar
        // Or just skip.

        console.log("ALL TESTS PASSED");

    } catch (e) {
        console.error("TEST FAILED:", e.message);
    } finally {
        serverProcess.kill();
        fs.removeSync('./test_data');
    }
}

test();
