import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const artifactDir = 'C:\\Users\\xrjpr\\.gemini\\antigravity-cli\\brain\\d0be7df2-4377-4414-be98-100edd41595f';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/game.html';

  let filePath = path.join(rootDir, reqPath);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(rootDir, 'public', reqPath);
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(4179, async () => {
  console.log('Test server listening on http://localhost:4179');

  const edgePaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  const edgeBin = edgePaths.find(p => fs.existsSync(p));
  if (!edgeBin) {
    console.error('Edge browser not found');
    server.close();
    process.exit(1);
  }

  const browser = spawn(edgeBin, [
    '--headless=new',
    '--remote-debugging-port=9231',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-fre',
    '--disable-sync',
    '--disable-extensions',
    '--guest',
    '--autoplay-policy=no-user-gesture-required',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,720',
    'http://localhost:4179/game.html'
  ]);

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  
  // Wait for CDP readiness
  for (let i = 0; i < 30; i++) {
    await sleep(200);
    try {
      const res = await fetch('http://localhost:9231/json/version');
      if (res.ok) break;
    } catch (_) {}
  }

  // Connect CDP
  const versionRes = await fetch('http://localhost:9231/json/list');
  const pages = await versionRes.json();
  const page = pages.find(p => p.type === 'page' && p.url.includes('4179')) || pages[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);

  await new Promise(r => ws.onopen = r);

  let msgId = 1;
  const send = (method, params = {}) => new Promise(resolve => {
    const id = msgId++;
    const handler = (evt) => {
      const resp = JSON.parse(evt.data);
      if (resp.id === id) {
        ws.removeEventListener('message', handler);
        resolve(resp.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
  await send('Page.enable');
  await send('Runtime.enable');

  const capture = async (name) => {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(shot.data, 'base64');
    const outPath = path.join(artifactDir, name);
    fs.writeFileSync(outPath, buf);
    console.log(`Saved screenshot: ${name}`);
  };

  // 1. Initial Title Screen with Uiua386 Font
  await sleep(500);
  await capture('14_title_screen_uiua386.png');

  // Check font loaded
  const fontCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      return {
        fontLoaded: document.fonts.check('16px Uiua386'),
        bodyFont: getComputedStyle(document.body).fontFamily
      };
    })()`,
    returnByValue: true
  });
  console.log('Font check:', fontCheck.result.value);

  // 2. Click Title to Trigger Extended Transition (-140px up, 380px up from bottom)
  await send('Runtime.evaluate', { expression: `document.getElementById('sceneTitle').click()` });
  await sleep(100);
  await capture('15_title_extended_exit_100ms.png');

  await sleep(250);
  await capture('16_select_extended_rising_350ms.png');

  await sleep(500);
  await capture('17_select_settled_uiua386.png');

  // 3. Switch to Bad Apple EX (index 0 is Bad Apple, select EX difficulty)
  await send('Runtime.evaluate', {
    expression: `(() => {
      const app = window.gameApp;
      app.setFocusedSong(0, true);
      app.selectDifficulty('EX');
    })()`
  });
  await sleep(300);
  await capture('18_bad_apple_ex_selected.png');

  // 4. Start Gameplay for Bad Apple EX (Auto-play enabled)
  await send('Runtime.evaluate', {
    expression: `(() => {
      const app = window.gameApp;
      app.judge.isAutoPlay = true;
      app.btnStartSelect.click();
    })()`
  });

  // Measure 0 - 1: Lead-in waiting time (0.0s - 3.48s)
  await sleep(800);
  await capture('19_bad_apple_ex_leadin_measure0.png');

  await sleep(1800);
  await capture('20_bad_apple_ex_leadin_measure1.png');

  // Measure 2: First notes arriving
  await sleep(1500);
  await capture('21_bad_apple_ex_intro_notes_multi_cycle.png');

  // Pre-Chorus 1 (56.0s): Density shifts to 0.65, track unfurls revealing 2 full cycles
  await send('Runtime.evaluate', {
    expression: `(() => {
      const app = window.gameApp;
      app.audio.seek(56.0);
    })()`
  });
  await sleep(1200);
  await capture('24_bad_apple_ex_prechorus_density_unfold.png');

  // Chorus 1 (69.5s): 1.75-cycle sweeping hold & Fourier track climax
  await send('Runtime.evaluate', {
    expression: `(() => {
      const app = window.gameApp;
      app.audio.seek(69.2);
    })()`
  });
  await sleep(1200);
  await capture('22_bad_apple_ex_chorus_multi_cycle_hold.png');

  // Grand Climax Chorus 2 (153.0s): Epic 2-cycle double-revolution hold (8.0 beats = 720 degrees)
  await send('Runtime.evaluate', {
    expression: `(() => {
      const app = window.gameApp;
      app.audio.seek(153.2);
    })()`
  });
  await sleep(1200);
  await capture('25_bad_apple_ex_grand_climax_double_cycle_hold.png');

  // Clean up
  browser.kill();
  server.close();
  console.log('Verification completed successfully!');
  process.exit(0);
});
