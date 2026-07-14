# 👾 psinetron-opencode-visualizer

[![MIT License](https://img.shields.io/github/license/psinetron/opencode-visualiser)](https://github.com/psinetron/opencode-visualiser/blob/main/LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/psinetron/opencode-visualiser.svg)](https://github.com/psinetron/opencode-visualiser/stargazers)
[![NPM Version](https://img.shields.io/npm/v/psinetron-opencode-visualizer.svg)](https://www.npmjs.com/package/psinetron-opencode-visualizer)

**Turning raw OpenCode terminal logs into cozy 2D pixel office chaos.** Watch your agents work, idle, and celebrate success in a bustling virtual office.

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
- **Multi-Agent Support:** Visualizes multiple agents (Explore, Scout, etc.) simultaneously in the same shared office space.
- **Customization (Skins):** Each agent has a custom skin saved in `.opencode/viz-skin.json`.
- **Unique Agent Animations:** Each of the 5 characters has its own set of unique idle, walk, work, and reaction animations.
- **Zero Friction Launch:** No dependencies to install — runs on the Bun runtime bundled with OpenCode. Launches a cross-platform, isolated Chrome "app" window using native OS calls. No heavy Electron needed.

---

## 🚀 Installation

No prerequisites — OpenCode ships with the Bun runtime, which handles plugin installation and execution automatically. You do **not** need to install Bun separately.

### Via CLI (recommended)

```sh
opencode plugin psinetron-opencode-visualizer
```

This installs the plugin from npm and registers it in your project's `opencode.json`. Add `--global` (or `-g`) to install it across all projects, or `--force` (or `-f`) to replace an existing version.

## Via OpenCode UI

1. Press `Control+P` (`Ctrl+P` on Windows/Linux) to open the command palette
2. Select **Install plugin**
3. Enter the package name: `psinetron-opencode-visualizer`

OpenCode will install the plugin and automatically add it to your project's `opencode.json`.

### Manual configuration

Add the plugin name to your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["psinetron-opencode-visualizer"]
}
```

OpenCode downloads and caches the package from npm automatically on next startup.

### From local files (development)

If you've cloned this repo and want to run from source, point the plugin entry directly at `index.ts`:

```json
{
  "plugin": ["./path/to/OpenCodeVisualizer/index.ts"]
}
```

Alternatively, copy `index.ts` and the `visualizer/` folder into `.opencode/plugins/` — OpenCode auto-loads any `.ts`/`.js` file placed in that directory.

### After installation

Start (or restart) OpenCode. The plugin spins up a local server on `http://localhost:5173` and opens a Chrome app window automatically. If the browser doesn't open, visit the URL manually.

Each running OpenCode instance appears as a pixel-art character in the office. When you close an instance, its character walks out. If the instance hosting the server is closed, a surviving instance picks up the server role automatically — no interruption.

---

## 🔄 Updating

To update to the latest version, first try reinstalling with the `--force` flag:

```sh
opencode plugin psinetron-opencode-visualizer --force
```

If the old version still persists after that, OpenCode's package cache is stale. Clear it manually and restart:

```sh
rm -rf ~/.cache/opencode/packages/psinetron-opencode-visualizer
rm -rf ~/.cache/opencode/packages/psinetron-opencode-visualizer@latest
```

On Windows (PowerShell):

```powershell
Remove-Item -Recurse -Force ~\.cache\opencode\packages\psinetron-opencode-visualizer
Remove-Item -Recurse -Force ~\.cache\opencode\packages\psinetron-opencode-visualizer@latest
```

Then restart OpenCode — it will re-download the latest version from npm on startup.

---

## 🎨 Customization (Skins)

The plugin automatically assigns a random pixel art skin to each agent and saves it to `.opencode/viz-skin.json` in your project folder. You can manually edit this file to change skins.

Available skins: `person1`, `person2`, `person3`, `person4`, `person5`.

---

## Support the project

If plugin helps streamline your workflow, consider supporting the project. There are several ways you can help:

**1. Give it a Star**
The easiest way to support EchoesVault is to click the **Star** 🌟 button at the top of this repository. It helps more developers discover the tool and encourages further development.

**2. Direct Sponsorship**
Click the **Sponsor** button at the top of this repository (next to the Star button) to open the sponsorship dialog and choose how you'd like to support the development directly.

**3. OpenCode GO Subscription**
EchoesVault is built on top of [OpenCode](https://opencode.ai/go?ref=EZW07YHVTG). By subscribing to **OpenCode GO**, you unlock unlimited agent usage. Using [this referral link](https://opencode.ai/go?ref=EZW07YHVTG) gives you a $5 discount on your subscription and helps fund my work at the same time.

---

## 📜 License

MIT License. See LICENSE for more information. Built, not bought, by psinetron.
