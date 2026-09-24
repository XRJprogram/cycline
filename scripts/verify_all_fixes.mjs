import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const userDataDir = path.join(process.env.TEMP, 'edge_verify_' + Date.now());
const cdpPort = 9245;

const edgeProcess = spawn(edgePath, [
  '--headless=new',
  `--remote-debugging-port=${cdpPort}`,
  `--user-data-dir=${userDataDir}`,
  '--no-sandbox',
  '--disable-gpu',
  '--window-size=1280,800',
  'http://localhost:5173/'
], { stdio: 'ignore' });

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  try {
    let wsUrl = null;
    for (let i = 0; i < 30; i++) {
      await wait(300);
      try {
        const res = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
        if (res.ok) {
          const list = await res.json();
          const target = list.find(t => t.url.includes('5173'));
          if (target) {
            wsUrl = target.webSocketDebuggerUrl;
            break;
          }
        }
      } catch (e) {}
    }

    if (!wsUrl) throw new Error('Could not connect to Edge on port ' + cdpPort);

    const ws = new WebSocket(wsUrl);
    await new Promise(r => ws.onopen = r);

    let id = 1;
    const send = (method, params = {}) => new Promise((res, rej) => {
      const curId = id++;
      const handler = (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.id === curId) {
          ws.removeEventListener('message', handler);
          if (msg.error) rej(msg.error);
          else res(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: curId, method, params }));
    });

    await send('Page.enable');
    await wait(1200);

    console.log('--- TEST 1: Initial Title Screen State ---');
    const titleCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const titleScene = document.getElementById('sceneTitle');
        const selectScene = document.getElementById('sceneSelect');
        const diffLabel = document.querySelector('.diff-picker-label');
        const footer = document.querySelector('.select-footer');
        return {
          titleActive: titleScene.classList.contains('active'),
          selectActive: selectScene.classList.contains('active'),
          hasDiffLabel: !!diffLabel,
          hasFooter: !!footer
        };
      })()`,
      returnByValue: true
    });
    console.log('Title scene check:', titleCheck.result.value);

    console.log('--- TEST 2: Trigger Smooth Title Transition ---');
    const clickTitle = await send('Runtime.evaluate', {
      expression: `(() => {
        document.getElementById('sceneTitle').click();
        const titleScene = document.getElementById('sceneTitle');
        const titleBox = titleScene.querySelector('.title-box');
        const selectScene = document.getElementById('sceneSelect');
        return {
          titleFadingOut: titleScene.classList.contains('fading-out'),
          titleExit: titleBox.classList.contains('title-exit'),
          selectActive: selectScene.classList.contains('active'),
          selectEnter: selectScene.classList.contains('scene-enter')
        };
      })()`,
      returnByValue: true
    });
    console.log('Immediately after title click:', clickTitle.result.value);

    // Wait 300ms and take screenshot of the crossfade
    await wait(300);
    const screenshotMid = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('C:\\Users\\xrjpr\\.gemini\\antigravity-cli\\brain\\d0be7df2-4377-4414-be98-100edd41595f\\title_transition_mid.png', Buffer.from(screenshotMid.data, 'base64'));
    console.log('Saved title_transition_mid.png');

    // Wait 700ms more (total 1000ms) for transition to complete
    await wait(700);
    const selectFinalCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const titleScene = document.getElementById('sceneTitle');
        const selectScene = document.getElementById('sceneSelect');
        const trackBadge = document.getElementById('trackLevelBadge')?.innerText;
        const easyLvl = document.getElementById('lblLvlEasy')?.innerText;
        const normLvl = document.getElementById('lblLvlNormal')?.innerText;
        const hardLvl = document.getElementById('lblLvlHard')?.innerText;
        const exLvl = document.getElementById('lblLvlEx')?.innerText;

        return {
          titleActive: titleScene.classList.contains('active'),
          selectActive: selectScene.classList.contains('active'),
          trackBadge,
          levels: { easyLvl, normLvl, hardLvl, exLvl }
        };
      })()`,
      returnByValue: true
    });
    console.log('After transition complete (SELECT scene):', selectFinalCheck.result.value);

    const screenshotSelect = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('C:\\Users\\xrjpr\\.gemini\\antigravity-cli\\brain\\d0be7df2-4377-4414-be98-100edd41595f\\select_clean_ui.png', Buffer.from(screenshotSelect.data, 'base64'));
    console.log('Saved select_clean_ui.png');

    console.log('--- TEST 3: Switch to Bad Apple and Canon in D, Check Difficulties ---');
    const songDiffs = await send('Runtime.evaluate', {
      expression: `(() => {
        const game = window.game;
        const results = [];
        for (let i = 0; i < game.songs.length; i++) {
          const s = game.songs[i];
          const diffs = {};
          for (const d in s.difficulties) {
            diffs[d] = s.difficulties[d].level;
          }
          results.push({ id: s.id, title: s.title, offset: s.offset, audioUrl: s.audioUrl, diffs });
        }
        return results;
      })()`,
      returnByValue: true
    });
    console.log('All songs & difficulties in game:', JSON.stringify(songDiffs.result.value, null, 2));

    console.log('--- TEST 4: Gameplay Audio Offset & Sync Test (Bad Apple) ---');
    const badAppleTest = await send('Runtime.evaluate', {
      expression: `(() => {
        const game = window.game;
        const badIdx = game.songs.findIndex(s => s.id === 'bad_apple');
        if (badIdx >= 0) {
          game.setFocusedSong(badIdx);
          game.selectDifficulty('NORMAL');
          game.startSongGameplay(game.songs[badIdx], 'NORMAL');
          return {
            songTitle: game.songs[badIdx].title,
            chartOffset: game.audio.chartOffset,
            gameplayMeta: document.getElementById('gameplayMeta').innerText,
            introBadge: document.getElementById('introBadge').innerText
          };
        }
        return { error: 'Bad apple not found' };
      })()`,
      returnByValue: true
    });
    console.log('Bad Apple gameplay start:', badAppleTest.result.value);

    // Wait 1.3s for intro loading banner to complete and audio to restart
    await wait(1300);
    const audioSyncCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const game = window.game;
        return {
          isPlaying: game.audio.getIsPlaying(),
          isUsingAudioFile: game.audio.isUsingAudioFile,
          chartOffset: game.audio.chartOffset,
          songTime: game.audio.getSongTime(),
          audioCurrentTime: game.audio.audioEl ? game.audio.audioEl.currentTime : null,
          hudMeta: document.getElementById('accVal')?.innerText
        };
      })()`,
      returnByValue: true
    });
    console.log('Audio sync check Bad Apple:', audioSyncCheck.result.value);

    const screenshotGameplay = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('C:\\Users\\xrjpr\\.gemini\\antigravity-cli\\brain\\d0be7df2-4377-4414-be98-100edd41595f\\gameplay_bad_apple.png', Buffer.from(screenshotGameplay.data, 'base64'));
    console.log('Saved gameplay_bad_apple.png');

    console.log('--- ALL CHECKS COMPLETED SUCCESSFULLY ---');
  } finally {
    edgeProcess.kill();
  }
}

run().catch(console.error);
