// OpenCode Visualizer — TUI entrypoint.
//
// One default export serves both TUI plugin APIs (mirrors ./index.ts for the server side):
//   - OpenCode 2.x reads `id` + `setup(api)`  (V2 TUI plugin API)
//   - OpenCode 1.x calls `tui(api)`           (V1 TUI plugin API, module form: { tui })
// Both adapters register the same `/visualizer` command on the shared URL.
const VISUALIZER_URL = "http://localhost:5173"

const COMMAND_ID = "ocv.visualizer"
const COMMAND_TITLE = "Visualizer: show URL"
const COMMAND_DESCRIPTION = "Show the session visualizer URL"
const COMMAND_SLASH = "visualizer"

interface ToastOptions {
  message: string
  variant?: "info" | "success" | "warning" | "error"
}

// Structural subset of the OpenCode 2.x TUI plugin context (`@opencode/plugin/tui`) that this
// plugin uses. Declared locally so the V2 SDK (and its dependency tree) is not needed to build
// or test this package.
interface V2KeymapCommand {
  id?: string
  title?: string
  description?: string
  slash?: { name: string; aliases?: string[] }
  run: (input?: string) => void | Promise<void>
}

interface V2Context {
  keymap: { layer(factory: () => { commands?: readonly V2KeymapCommand[] }): void }
  ui: { toast: { show(options: ToastOptions): void } }
}

interface V2Definition {
  id: string
  setup(ctx: V2Context): void | Promise<void>
}

// Structural subset of the OpenCode 1.x TUI plugin context (`@opencode-ai/plugin/tui`).
interface V1Command {
  title: string
  value: string
  description?: string
  slash?: { name: string; aliases?: string[] }
  onSelect?: () => void
}

interface V1Context {
  command: { register(cb: () => V1Command[]): () => void }
  ui: { toast(input: ToastOptions): void }
}

type V1TuiPlugin = (api: V1Context) => Promise<void>

// ─── OpenCode 2.x ───────────────────────────────────────────────────

const v2: V2Definition = {
  id: "psinetron-opencode-visualizer",
  async setup(api) {
    api.keymap.layer(() => ({
      commands: [
        {
          id: COMMAND_ID,
          title: COMMAND_TITLE,
          description: COMMAND_DESCRIPTION,
          slash: { name: COMMAND_SLASH },
          run: () =>
            api.ui.toast.show({
              message: `Visualizer: ${VISUALIZER_URL}`,
              variant: "info",
            }),
        },
      ],
    }))
  },
}

// ─── OpenCode 1.x ───────────────────────────────────────────────────

const TuiVisualizerPlugin: V1TuiPlugin = async (api) => {
  api.command.register(() => [
    {
      title: COMMAND_TITLE,
      value: COMMAND_SLASH,
      description: COMMAND_DESCRIPTION,
      slash: { name: COMMAND_SLASH },
      onSelect: () =>
        api.ui.toast({
          message: `Visualizer: ${VISUALIZER_URL}`,
          variant: "info",
        }),
    },
  ])
}

export { TuiVisualizerPlugin }
export default { ...v2, tui: TuiVisualizerPlugin }
