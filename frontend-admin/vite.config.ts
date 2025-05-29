import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    // Optional: Configure proxy if your Cloudflare Worker runs on a different port during local dev
    // proxy: {
    //   '/api': {
    //     target: 'http://localhost:8787', // Your Cloudflare Worker's local address
    //     changeOrigin: true,
    //   }
    // }
  }
})
