import { spawn } from 'child_process';
import path from 'path';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const userDataDir = path.join(process.env.TEMP, 'edge_audio_analyze_' + Date.now());
const cdpPort = 9228;

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

          const duration = audioBuffer.duration;
          const sampleRate = audioBuffer.sampleRate;
          const channelData = audioBuffer.getChannelData(0);

          // Find RMS energy in 20ms windows for the first 10 seconds
          const windowSize = Math.floor(sampleRate * 0.02); // 20ms
          const hopSize = Math.floor(sampleRate * 0.005); // 5ms
          const maxSamples = Math.min(channelData.length, Math.floor(sampleRate * 10));

          const energies = [];
          for (let i = 0; i < maxSamples - windowSize; i += hopSize) {
            let sum = 0;
            for (let j = 0; j < windowSize; j++) {
              const val = channelData[i + j];
              sum += val * val;
            }
            const rms = Math.sqrt(sum / windowSize);
            const time = i / sampleRate;
            energies.push({ time, rms });
          }

          // Find first notable onset where RMS > 0.05
          const firstOnset = energies.find(e => e.rms > 0.03);

          // Peaks in first 6 seconds
          const peaks = [];
          for (let k = 1; k < energies.length - 1; k++) {
            if (energies[k].time > 6.0) break;
            if (energies[k].rms > 0.05 && energies[k].rms > energies[k-1].rms && energies[k].rms > energies[k+1].rms) {
              peaks.push({ time: Math.round(energies[k].time * 1000) / 1000, rms: Math.round(energies[k].rms * 1000) / 1000 });
            }
          }

          return {
            duration,
            sampleRate,
            firstOnset: firstOnset ? firstOnset.time : null,
            first10Peaks: peaks.slice(0, 15)
          };
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });

    console.log('Audio Analysis Result:', JSON.stringify(result.result.value, null, 2));
    ws.close();
  } catch (e) {
    console.error('Analysis error:', e);
  } finally {
    try { edgeProcess.kill(); } catch (e) {}
  }
}

run();
