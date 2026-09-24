import { spawn } from 'child_process';
import path from 'path';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const userDataDir = path.join(process.env.TEMP, 'edge_audio_drums_' + Date.now());
const cdpPort = 9233;

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
          const res = await fetch('audio/bad_apple.mp3');
          const ab = await res.arrayBuffer();
          const actx = new AudioContext();
          const buffer = await actx.decodeAudioData(ab);
          const channel = buffer.getChannelData(0);
          const sr = buffer.sampleRate;

          // Bandpass / Lowpass filter for bass kick drums (< 120Hz)
          // Quick simulation with a running lowpass boxcar or simple differencing
          const kickFilterWin = Math.floor(sr / 120); // ~400 samples
          const kicks = [];
          const hop = Math.floor(sr * 0.005); // 5ms

          let prevEnergy = 0;
          for (let i = Math.floor(sr * 14); i < sr * 20; i += hop) {
            let sum = 0;
            for (let j = 0; j < kickFilterWin; j++) {
              sum += Math.abs(channel[i + j] || 0);
            }
            const energy = sum / kickFilterWin;
            const diff = energy - prevEnergy;
            prevEnergy = energy;
            if (diff > 0.04) {
              kicks.push({ time: Math.round((i / sr) * 1000) / 1000, diff: Math.round(diff * 1000) / 1000 });
            }
          }

          // Pick local peaks in kicks
          const peaks = [];
          for (let k = 1; k < kicks.length - 1; k++) {
            if (kicks[k].diff > kicks[k-1].diff && kicks[k].diff > kicks[k+1].diff && kicks[k].diff > 0.05) {
              peaks.push(kicks[k]);
            }
          }

          return peaks;
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });

    console.log('Detected Kick Peaks around 14s-20s:', JSON.stringify(result.result.value, null, 2));
    ws.close();
  } catch (e) {
    console.error('Kick detection error:', e);
  } finally {
    try { edgeProcess.kill(); } catch (e) {}
  }
}

run();
