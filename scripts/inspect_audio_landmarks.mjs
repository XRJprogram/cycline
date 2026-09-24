import { spawn } from 'child_process';
import path from 'path';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const userDataDir = path.join(process.env.TEMP, 'edge_audio_beats_' + Date.now());
const cdpPort = 9229;

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
          const arrayBuffer = await res.arrayBuffer();
          const actx = new AudioContext();
          const audioBuffer = await actx.decodeAudioData(arrayBuffer);

          const channel = audioBuffer.getChannelData(0);
          const sr = audioBuffer.sampleRate;

          function findPeakInRange(startSec, endSec) {
            const startSample = Math.floor(startSec * sr);
            const endSample = Math.floor(endSec * sr);
            let maxVal = 0;
            let maxSample = startSample;
            for (let i = startSample; i < endSample; i++) {
              const abs = Math.abs(channel[i]);
              if (abs > maxVal) {
                maxVal = abs;
                maxSample = i;
              }
            }
            return { time: maxSample / sr, val: maxVal };
          }

          // Let's test the drum drop around 14s - 16s:
          const drumDropPeaks = [];
          for (let t = 14.5; t < 16.5; t += 0.43478) {
            drumDropPeaks.push(findPeakInRange(t - 0.1, t + 0.1));
          }

          // Let's test the first beat around 1.3s:
          const introPeak = findPeakInRange(1.2, 1.45);

          return {
            introPeak,
            drumDropPeaks
          };
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });

    console.log('Beat Landmarks Result:', JSON.stringify(result.result.value, null, 2));
    ws.close();
  } catch (e) {
    console.error('Beat landmarks error:', e);
  } finally {
    try { edgeProcess.kill(); } catch (e) {}
  }
}

run();
