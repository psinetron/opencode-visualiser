# 👾 psinetron-opencode-visualizer

[![MIT License](https://img.shields.io/github/license/psinetron/opencode-visualiser)](https://github.com/psinetron/opencode-visualiser/blob/main/LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/psinetron/opencode-visualiser.svg)](https://github.com/psinetron/opencode-visualiser/stargazers)
[![NPM Version](https://img.shields.io/npm/v/psinetron-opencode-visualizer.svg)](https://www.npmjs.com/package/psinetron-opencode-visualizer)

**Bringing the custom cruiser ethos to AI orchestration.** Turning raw OpenCode terminal logs into cozy 2D pixel office chaos. Watch your agents work, idle, and celebrate success in a bustling virtual office.

---

## 🔥 Witness the Chaos

<img src="images/cover.png" width="100%" alt="OpenCode Visualizer" />

<!--
THIS IS THE MOST IMPORTANT PART FOR HYPE.
When you create your video-demo for X.com (MP4), convert it to a small GIF (e.g., using CapCut or online converters like ezgif) and place it here.

For example, uncomment the line below when you have a GIF in your repo:

<img src="visualizer-demo.gif" width="100%" alt="OpenCode Visualizer Demo" />

*Placeholder for the awesome video demo you are going to record. It should show the JSON logs in the terminal transforming into the pixel art office.*
-->

---

## ✨ Features

- **Real-time Visualization:** Watch your OpenCode agents move around their office as they execute tools, search files, and write code.
- **Cozy Pixel Art Aesthetic:** A calming, gamified view of complex AI orchestration.
- **Mult-Agent Support:** Visualizes multiple agents (Explore, Scout, etc.) simultaneously in the same shared office space.
- **Customization (Skins):** Each agent has a custom skin saved in `.opencode/viz-skin.json`.
- **Unique Agent Animations:** Each of the 5 characters has its own set of unique idle, walk, work, and reaction animations.
- **Zero Friction Launch:** Pure Bun & TypeScript. Launches a cross-platform, isolated Chrome "app" window using native OS calls. No heavy Electron needed.

---

## 🚀 Installation

*Note: Requires [Bun](https://bun.sh) to be installed.*

### Via OpenCode UI (recommended)

1. Press `Control+P` (`Ctrl+P` on Windows/Linux) to open the command palette
2. Select **Install plugin**
3. Enter the package name: `psinetron-opencode-visualizer`

OpenCode will install the plugin and automatically add it to your project's `opencode.json`.

### Manual configuration

Add the plugin to your OpenCode config (`opencode.json`):

```json
{
  "plugin": ["psinetron-opencode-visualizer"]
}
```

Or install from a local path:

```json
{
  "plugin": ["./path/to/OpenCodeVisualizer"]
}
```



---

## 🎨 Customization (Skins)

The plugin automatically assigns a random pixel art skin to each agent and saves it to `.opencode/viz-skin.json` in your project folder. You can manually edit this file to change skins.

Available skins: `person1`, `person2`, `person3`, `person4`, `person5`.

---

## 📜 License

MIT License. See LICENSE for more information. Built, not bought, by psinetron.
