import { spawn } from 'child_process';
import path from 'path';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const userDataDir = path.join(process.env.TEMP, 'edge_audio_detect_' + Date.now());
const cdpPort = 9232;

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

          // Compute Spectral Flux / High Frequency Energy onset detection
          // In Bad Apple, let's track the energy differences every 10ms
          const hop = Math.floor(sr * 0.01); // 10ms
          const win = Math.floor(sr * 0.02); // 20ms
          const onsets = [];

          let prevE = 0;
          for (let i = 0; i < sr * 30; i += hop) {
            let e = 0;
            for (let j = 0; j < win; j++) {
              const s = channel[i + j] || 0;
              e += s * s;
            }
            const flux = Math.max(0, e - prevE);
            prevE = e;
            onsets.push({ time: i / sr, flux });
          }

          // Pick peaks with high flux
          const peaks = [];
          for (let k = 2; k < onsets.length - 2; k++) {
            const f = onsets[k].flux;
            if (f > 0.05 && f > onsets[k-1].flux && f > onsets[k-2].flux && f > onsets[k+1].flux && f > onsets[k+2].flux) {
              peaks.push(Math.round(onsets[k].time * 1000) / 1000);
            }
          }

          // Test different candidate offsets around 0.0s to 2.0s at BPM 138:
          // beatInterval = 60 / 138 = 0.4347826s
          const beatSec = 60 / 138;
          let bestOffset = 0;
          let bestScore = -1;

          for (let off = 0.0; off < 2.0; off += 0.005) {
            let score = 0;
            // Test 60 beats (about 26 seconds)
            for (let b = 0; b < 60; b++) {
              const expectedTime = off + b * beatSec;
              // Check distance to closest peak
              let minDist = 999;
              for (const p of peaks) {
                const d = Math.abs(p - expectedTime);
                if (d < minDist) minDist = d;
              }
              if (minDist < 0.035) { // within 35ms
                score += (0.035 - minDist);
              }
            }
            if (score > bestScore) {
              bestScore = score;
              bestOffset = off;
            }
          }

          return {
            detectedBestOffset: Math.round(bestOffset * 1000) / 1000,
            bestScore,
            totalPeaks: peaks.length,
            firstPeaks: peaks.slice(0, 20)
          };
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });

    console.log('Onset Detection Result:', JSON.stringify(result.result.value, null, 2));
    ws.close();
  } catch (e) {
    console.error('Detection error:', e);
  } finally {
    try { edgeProcess.kill(); } catch (e) {}
  }
}

run();
