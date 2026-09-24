import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const userDataDir = path.join(process.env.TEMP, 'edge_cdp_' + Date.now());
const cdpPort = 9223;

const edgeProcess = spawn(edgePath, [
  '--headless=new',
  `--remote-debugging-port=${cdpPort}`,
  `--user-data-dir=${userDataDir}`,
  '--no-sandbox',
  '--disable-gpu',
  '--window-size=1280,800',
  'about:blank'
], { stdio: 'ignore' });

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function getWsUrl() {
  for (let i = 0; i < 30; i++) {
    await wait(300);
    try {
      const res = await fetch(`http://127.0.0.1:${cdpPort}/json/version`);
      if (res.ok) {
        const data = await res.json();
        return data.webSocketDebuggerUrl;
      }
    } catch (e) {}
  }
  throw new Error('CDP port not responding');
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.pending = new Map();
  }

  async connect() {
    await new Promise((res, rej) => {
      this.ws.onopen = res;
      this.ws.onerror = rej;
    });

    this.ws.onmessage = (msg) => {
      const parsed = JSON.parse(msg.data);
      if (parsed.id && this.pending.has(parsed.id)) {
        const { res, rej } = this.pending.get(parsed.id);
        this.pending.delete(parsed.id);
        if (parsed.error) rej(parsed.error);
        else res(parsed.result);
      }
    };
  }

  send(method, params = {}) {
    return new Promise((res, rej) => {
      const id = this.id++;
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.ws.close();
  }
}

async function run() {
  try {
    await getWsUrl();

    // Get the page target
    const listRes = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
    const listData = await listRes.json();
    const pageTarget = listData.find(t => t.type === 'page') || listData[0];
    console.log('Found page target:', pageTarget.id);

    const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await client.connect();

    console.log('Enabling Page & Runtime...');
    await client.send('Page.enable');
    await client.send('Runtime.enable');

    console.log('Navigating to http://localhost:5173/ ...');
    await client.send('Page.navigate', { url: 'http://localhost:5173/' });
    await wait(2500);

    // 1. Title Screen
    console.log('Capturing Title Screen...');
    const shot0 = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(rootDir, 'screenshot_title.png'), Buffer.from(shot0.data, 'base64'));
    console.log('Saved screenshot_title.png');

    // 2. Click to enter Song Select
    console.log('Entering Song Select...');
    await client.send('Runtime.evaluate', {
      expression: `
        const titleScene = document.getElementById('sceneTitle');
        if (titleScene) titleScene.click();
      `
    });
    // Wait for entrance transition animation
    await wait(1800);

    // Song Select screenshot
    console.log('Capturing Song Select...');
    const shot1 = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(rootDir, 'screenshot_song_select.png'), Buffer.from(shot1.data, 'base64'));
    console.log('Saved screenshot_song_select.png');

    // 3. Start Song
    console.log('Starting selected song...');
    await client.send('Runtime.evaluate', {
      expression: `
        const startBtn = document.getElementById('btnStartSelect');
        if (startBtn) startBtn.click();
      `
    });
    await wait(3500);

    // Gameplay screenshot
    console.log('Capturing Gameplay...');
    const shot2 = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(rootDir, 'screenshot_gameplay.png'), Buffer.from(shot2.data, 'base64'));
    console.log('Saved screenshot_gameplay.png');

    // 4. Standalone Editor
    console.log('Navigating to Editor...');
    await client.send('Page.navigate', { url: 'http://localhost:5173/editor.template.html' });
    await wait(2000);

    console.log('Capturing Editor...');
    const shot3 = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(rootDir, 'screenshot_editor.png'), Buffer.from(shot3.data, 'base64'));
    console.log('Saved screenshot_editor.png');

    client.close();
    console.log('All screenshots captured successfully!');
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    edgeProcess.kill();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

run();
