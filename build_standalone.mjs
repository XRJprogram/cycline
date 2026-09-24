import fs from 'fs';
import path from 'path';
import esbuild from 'esbuild';

const distDir = path.resolve('dist');
const assetsDir = path.join(distDir, 'assets');

if (!fs.existsSync(assetsDir)) {
  console.error('Dist assets directory not found! Run vite build first.');
  process.exit(1);
}

const files = fs.readdirSync(assetsDir);

// Read Uiua386.ttf as base64 for offline zero-asset standalone packaging
let fontBase64 = '';
const fontPath = fs.existsSync('Uiua386.ttf') ? 'Uiua386.ttf' : path.join('public', 'fonts', 'Uiua386.ttf');
if (fs.existsSync(fontPath)) {
  const fontBuf = fs.readFileSync(fontPath);
  fontBase64 = `data:font/truetype;charset=utf-8;base64,${fontBuf.toString('base64')}`;
}

// Read artwork images as base64 for offline zero-asset standalone packaging
const imageMap = {};
const imgDir = fs.existsSync('images') ? 'images' : path.join('public', 'images');
if (fs.existsSync(imgDir)) {
  for (const f of fs.readdirSync(imgDir)) {
    if (f.endsWith('.jpg') || f.endsWith('.png')) {
      const id = path.basename(f, path.extname(f));
      const buf = fs.readFileSync(path.join(imgDir, f));
      imageMap[id] = `data:image/jpeg;base64,${buf.toString('base64')}`;
    }
  }
}
const imagesScript = Object.keys(imageMap).length > 0 
  ? `<script>window.__CYCLINE_IMAGES__ = ${JSON.stringify(imageMap)};</script>\n`
  : '';

// 1. GAME BUNDLING (Output: game.html + start_game.bat)
const mainJs = files.find(f => (f.startsWith('main-') || f.startsWith('index-')) && f.endsWith('.js'));
const mainCss = files.find(f => (f.startsWith('main-') || f.startsWith('index-') || f.startsWith('style-')) && f.endsWith('.css'));

if (mainJs && mainCss) {
  let cssContent = fs.readFileSync(path.join(assetsDir, mainCss), 'utf-8');
  if (fontBase64) {
    cssContent = cssContent.replace(/\/fonts\/[Uu]iua386\.ttf/g, fontBase64);
  }
  const bundleResult = esbuild.buildSync({
    entryPoints: [path.join(assetsDir, mainJs)],
    bundle: true,
    format: 'iife',
    write: false
  });
  const jsContent = bundleResult.outputFiles[0].text;

  let gameHtml = fs.readFileSync('index.html', 'utf-8');
  gameHtml = gameHtml.replace(
    /<link\s+rel=["']stylesheet["']\s+href=["'][^"']+["']\s*\/?>/i,
    `<style>\n${cssContent}\n</style>`
  );
  gameHtml = gameHtml.replace(
    /<script\s+type=["']module["']\s+src=["'][^"']+["']><\/script>/i,
    `${imagesScript}<script>\n${jsContent}\n</script>`
  );

  fs.writeFileSync('game.html', gameHtml, 'utf-8');

  const gameBat = `@echo off\r\nstart "" "%~dp0game.html"\r\nexit\r\n`;
  fs.writeFileSync('start_game.bat', gameBat, 'utf-8');
  console.log('✓ Successfully generated: game.html and start_game.bat');
}

// 2. EDITOR BUNDLING (Output: editor.html + start_editor.bat)
const editorJs = files.find(f => (f.startsWith('editor-') || f.startsWith('editor.template-')) && f.endsWith('.js'));
const editorCss = files.find(f => (f.startsWith('editor-') || f.startsWith('editor.template-')) && f.endsWith('.css'));

if (editorJs && editorCss) {
  let cssContent = fs.readFileSync(path.join(assetsDir, editorCss), 'utf-8');
  if (fontBase64) {
    cssContent = cssContent.replace(/\/fonts\/[Uu]iua386\.ttf/g, fontBase64);
  }
  const bundleResult = esbuild.buildSync({
    entryPoints: [path.join(assetsDir, editorJs)],
    bundle: true,
    format: 'iife',
    write: false
  });
  const jsContent = bundleResult.outputFiles[0].text;

  const templateFile = fs.existsSync('editor.template.html') ? 'editor.template.html' : 'editor.html';
  let edHtml = fs.readFileSync(templateFile, 'utf-8');
  edHtml = edHtml.replace(
    /<link\s+rel=["']stylesheet["']\s+href=["'][^"']+["']\s*\/?>/i,
    `<style>\n${cssContent}\n</style>`
  );
  edHtml = edHtml.replace(
    /<script\s+type=["']module["']\s+src=["'][^"']+["']><\/script>/i,
    `<script>\n${jsContent}\n</script>`
  );

  fs.writeFileSync('editor.html', edHtml, 'utf-8');

  const editorBat = `@echo off\r\nstart "" "%~dp0editor.html"\r\nexit\r\n`;
  fs.writeFileSync('start_editor.bat', editorBat, 'utf-8');
  console.log('✓ Successfully generated: editor.html and start_editor.bat');
}

// 3. CLEAN UP ANY REMAINING CHINESE-NAMED ARTIFACTS
const legacyFiles = ['双击直接玩.html', '启动游戏.bat', '制谱器.html', '启动制谱器.bat'];
for (const f of legacyFiles) {
  if (fs.existsSync(f)) {
    try {
      fs.unlinkSync(f);
      console.log(`✓ Cleaned up redundant legacy file: ${f}`);
    } catch (_) {}
  }
}
