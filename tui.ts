const VISUALIZER_URL = "http://localhost:5173"

interface ToastApi {
  show(input: { message: string; variant: "success" | "error" | "info" | "warning" }): void
}

interface KeymapBinding {
  description: string
  handler: () => void | Promise<void>
}

interface KeymapApi {
  registerLayer(input: { id: string; bindings: Record<string, KeymapBinding> }): () => void
}

interface PluginApi {
  ui: { toast: ToastApi }
  keymap: KeymapApi
}

const TuiVisualizerPlugin = async (api: PluginApi) => {
  api.keymap.registerLayer({
    id: "ocv-commands",
    bindings: {
      "/visualizer": {
        description: "Show the session visualizer URL",
        handler: () => {
          api.ui.toast.show({
            message: `Visualizer: ${VISUALIZER_URL}`,
            variant: "info",
          })
        },
      },
    },
  })
}

export { TuiVisualizerPlugin }
export default { tui: TuiVisualizerPlugin }
