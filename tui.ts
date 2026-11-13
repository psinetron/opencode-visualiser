import { discoverServer, visualizerUrl } from "./visualizer/discovery"

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
        handler: async () => {
          try {
            const port = await discoverServer()
            api.ui.toast.show({
              message: port === null ? "Visualizer is not running. Start the visualizer server plugin first." : `Visualizer: ${visualizerUrl(port)}`,
              variant: port === null ? "warning" : "info",
            })
          } catch (error) {
            api.ui.toast.show({ message: String(error), variant: "error" })
          }
        },
      },
    },
  })
}

export { TuiVisualizerPlugin }
export default { tui: TuiVisualizerPlugin }
