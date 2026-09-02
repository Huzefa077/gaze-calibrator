import react from '@vitejs/plugin-react'
import { defineConfig, transformWithOxc } from 'vite'

const visionTrackerJsxPlugin = {
  name: 'vision-tracker-jsx',
  enforce: 'pre',
  async transform(code, id) {
    if (!id.endsWith('/src/components/VisionTracker/VisionTracker.js')) {
      return null
    }

    return transformWithOxc(code, id, { lang: 'jsx' })
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [visionTrackerJsxPlugin, react()],
  optimizeDeps: {
    noDiscovery: true,
    include: [
      'react',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react-dom',
      'react-dom/client',
      'react-router-dom',
    ],
  },
})
