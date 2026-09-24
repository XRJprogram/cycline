# CYCLINE (旋时律动)

> **CYCLINE** 是一款极简纯粹、优雅流畅的拟物时钟表盘旋轨节奏游戏（Orbital Rhythm Game）。
> 灵感源自钟表机械指针的精准扫掠与行星同心公转轨道。游戏原生支持零依赖单文件本地运行与专业级在线可视化制谱器。

---

## 🌟 特性一览 (Key Features)

- **独特的钟表旋轨玩法 (Orbital Gameplay)**:
  - 核心主时针以精准 BPM 扫视同心时钟轨道，判定点与音符在时钟圆盘上交织碰撞。
  - **多重轨道变奏 (Multi-Cycle Orbits)**：支持动态额外轨道（Orbit 1+）从主轨道平滑浮出与收回，带来层级分明的双环交互体验。
  - **多样化音符体系**:
    - **TAP (单点音符)**: 纯正天蓝色圆形音符，精准捕捉重拍节奏。
    - **HOLD (长按弧音符)**: 优雅蔚蓝时钟圆弧，沿着轨道扫掠持续蓄力与连续连击。
    - **TOUCH (触碰音符)**: 轻盈淡蓝色光圈符文，支持点按或指尖滑动触发，提前判定时保持渲染并在到达指针时触发灵动反馈。
- **电影级视觉与交互体验**:
  - 全球化定制像素/几何字体 `Uiua386`，搭配极简冰白（Soft Ice-White）与海军蓝（Navy Blue）美学。
  - 唱片轮盘切歌（Arc Wheel Slider），支持惯性滑动、鼠标滚轮多轨飞跃与键盘快捷键。
  - 实体黑胶唱盘展示歌曲专属定制艺术封面（Album Disk Art），聚焦时拟物顺时针旋转。
  - 卡片集成难度选择器与本地历史最高纪录显示（Best Score / Rank / AP / FC）。
  - 大气从容的标题飞出与选曲入场动效、结算界面纯粹的单按钮继续设计。
  - 充满仪式感的 **TRACK CLEAR** 终曲庆祝动效（指针平滑缓停、同心冲击波、庆祝粒子花火）。
- **专业级制谱器 (Built-in Chart Editor)**:
  - 独立单文件 `editor.html`，无需联网即可进行可视化谱面创作。
  - 支持多重轨道编辑、音符时间轴微调、密度事件配置、音频本地载入与一键导出导入 JSON。
- **100% 离线单文件运行 (Zero-Asset Offline Standalone)**:
  - 内置 `game.html` 与 `editor.html`，字体与封面资源完全 Base64 矢量/数据内联，双击 `start_game.bat` 或直接在浏览器打开即可畅玩。

---

## 🎵 收录曲目与难度 (Song List & Difficulties)

| 曲目 Title | 艺术家 Artist | BPM | 包含难度 Difficulties | 轨道特色 Orbital Features |
| :--- | :--- | :---: | :--- | :--- |
| **Bad Apple!! feat. nomico** | Alstroemeria Records | 138 | EASY 3 / NORMAL 5+ / HARD 8 / **EX 9+** | 多阶段额外旋轨、精准无缝剪辑高潮切分音 |
| **Canon in D (Electro Rock)** | Classical Remix | 140 | EASY 2 / NORMAL 5 / HARD 7+ / **EX 9** | 电音摇滚变速扫弦、对偶轨道音阶推进 |
| **Clockwork Rhythm** | Cycline Sound Lab | 120 | EASY 2+ / NORMAL 5 / HARD 8 / **EX 9+** | 机械钟表齿轮齿跳、多重拍次切分律动 |
| **Morning Ticking** | Cycline Chill | 80 | EASY 2 / NORMAL 4 / HARD 7 / **EX 8+** | 惬意晨光慢钟律动、舒展双环连音回旋 |
| **Overclocked Orbit** | Cycline Rush | 160 | EASY 3+ / NORMAL 6 / HARD 8+ / **EX 9+** | 高速超频回旋、密集 16 分音符风暴推进 |

---

## 🎮 操作指南 (Controls)

### 选曲界面 (Song Select)
- **切换曲目**: 鼠标拖拽轮盘、鼠标滚轮、键盘 `A` / `D` 或方向键 `←` / `→`
- **切换难度**: 点击卡片内难度按钮，或按键盘数字键 `1` (EASY)、`2` (NORMAL)、`3` (HARD)、`4` (EX)
- **开始游戏**: 直接点击已聚焦卡片，或按 `Enter` / `Space`
- **返回标题**: 按 `Escape` 或左上角返回按钮

### 游戏玩法 (Gameplay)
- **TAP & HOLD**:
  - 鼠标左键点击或按住表盘任意区域
  - 键盘任意按键（支持多键并发）：`Space`、`F`、`J`、`D`、`K` 等
- **TOUCH**:
  - 鼠标点击或手指触碰音符所在位置；支持滑动经过连刷触碰
- **快捷控制**:
  - `Escape`: 暂停 / 继续
  - `R`: 重新开始
  - 离开标签页或窗口失焦时自动贴心暂停

### 结算界面 (Result)
- **继续返回选曲**: 按 `Space`、`Enter`、`Escape` 或点击「继续」按钮

---

## 🛠 开发与构建 (Development & Build)

本项目采用 **Vite + TypeScript + HTML5 Canvas 2D + Web Audio API** 开发构建。

```bash
# 1. 安装依赖
npm install

# 2. 启动本地开发服务器
npm run dev

# 3. 编译打包生成离线独立单文件 (game.html, editor.html, start_*.bat)
npm run build
```

---

## 📄 开源许可 (License)

MIT License © 2026 CYCLINE Project.
