# Charts Directory (谱面文件夹)

This folder contains song charts (`.json`) for CYCLINE.
此文件夹用于存放 CYCLINE 的谱面文件（.json 格式）。

## Difficulty Ratings (难度分级说明)
Each song supports up to 4 difficulties:
每首歌曲支持最多 4 种难度：
- **EASY** (Lv. 1.0 - 3.5, Mint Green / 浅薄荷绿)
- **NORMAL** (Lv. 4.0 - 6.5, Amber Orange / 琥珀暖橙)
- **HARD** (Lv. 7.0 - 8.9, Coral Red / 珊瑚赤红)
- **EX** (Lv. 9.0 - 9.9, Astral Purple / 星云深紫) — *Extra climax difficulty; not present on every song (仅部分曲目追加)*
- **Rating Range (等级范围)**: `[1, 10)` (All levels are strictly between 1.0 and 9.9 / 等级严格在 1.0 到 9.9 之间)

## Note Types (音符类型说明)
1. **TAP (普通音符)**
   - 圆形圆润手绘按键，指针扫过时点击或按键判定。
   - Hand-drawn circular tap note. Hit when needle reaches angle.
2. **HOLD (长按音符)**
   - 沿时钟圆周延伸的发光弧线缎带（含起点、渐变带和终点）。在指针到达起点时按住，指针随弧度扫过期间持续增加 Combo 与连击火花，扫至末端完成判定。
   - Curved arc ribbon along track circumference. Press and hold when needle enters head, continuously pulses combo ticks, release at end.
   - `duration` (in seconds / 秒数): 持续时长。
3. **TOUCH (点触音符)**
   - 青碧色四角星芒菱形符文，周围有向内收缩的菱形判定框。
   - 既可以在画布上直接用手指或鼠标轻触音符本体判定，也可以在指针指到时按任意键判定。
   - Radiant diamond star rune with converging brackets. Can be tapped directly on canvas or hit with needle timing.

## How to add custom charts (如何添加新谱面)
1. Double-click `start_editor.bat` or open `editor.html` to launch the Chart Editor;
   双击 `start_editor.bat` 或在浏览器中打开 `editor.html` 进入独立制谱器；
2. Create or record your rhythm chart and click **"Save Chart File" / "保存谱面文件"**;
   制作并调整好你的谱面，点击保存导出为 `.json` 文件；
3. Drop the `.json` file into this `charts/` folder, or use the **"Import Local Chart" / "导入本地谱面"** button inside the game!
   将导出的 `.json` 文件直接放进此 `charts/` 目录，或者在游戏选曲界面点击“导入本地谱面”即可即时游玩！
