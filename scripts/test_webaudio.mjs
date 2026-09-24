import { spawn } from 'child_process';
import path from 'path';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const userDataDir = path.join(process.env.TEMP, 'edge_webaudio_' + Date.now());
const cdpPort = 9231;

const edgeProcess = spawn(edgePath, [
  '--headless=new',
  `--remote-debugging-port=${cdpPort}`,
  `--user-data-dir=${userDataDir}`,
  '--no-sandbox',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-fre',
  'http://localhost:5173/'
], { stdio: 'ignore' });

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  try {
    for (let i = 0; i < 30; i++) {
      await wait(300);
      try {
        const res = await fetch(`http://127.0.0.1:${cdpPort}/json/version`);
        if (res.ok) break;
      } catch (e) {}
    }

    const listRes = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
    const listData = await listRes.json();
    const pageTarget = listData.find(t => t.url.includes('localhost') || t.url.includes('5173')) || listData[0];

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    const send = (method, params = {}) => new Promise((res) => {
      const id = Math.floor(Math.random() * 100000);
      const onMsg = (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.id === id) {
          ws.removeEventListener('message', onMsg);
          res(msg.result);
        }
      };
      ws.addEventListener('message', onMsg);
      ws.send(JSON.stringify({ id, method, params }));
    });

    await send('Page.enable');
    await send('Page.navigate', { url: 'http://localhost:5173/' });
    await wait(1500);

    const result = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          const actx = new AudioContext();
          const t0 = performance.now();
          const res = await fetch('audio/bad_apple.mp3');
          const ab = await res.arrayBuffer();
          const buffer = await actx.decodeAudioData(ab);
          const decodeTime = performance.now() - t0;

          // Now test AudioBufferSourceNode playback
          const source = actx.createBufferSource();
          source.buffer = buffer;
          source.connect(actx.destination);

          const startAudioTime = actx.currentTime + 0.05; // 50ms smooth lookahead
          source.start(startAudioTime, 1.312); // start directly from offset

          const samples = [];
          for (let i = 0; i < 10; i++) {
            await new Promise(r => setTimeout(r, 20));
            const currentSongTime = actx.currentTime - startAudioTime;
            samples.push({
              actxTime: actx.currentTime.toFixed(3),
              currentSongTime: currentSongTime.toFixed(3)
            });
          }

          return {
            decodeTimeMs: Math.round(decodeTime),
            duration: buffer.duration,
            samples
          };
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });

    console.log('Web Audio Test Result:', JSON.stringify(result.result.value, null, 2));
    ws.close();
  } catch (e) {
    console.error('WebAudio test error:', e);
  } finally {
    try { edgeProcess.kill(); } catch (e) {}
  }
}

run();
