import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// relative base: the same build works at the site root, under GitHub Pages' /jank-lab/case-2/, or inside another page
export default defineConfig({
  base: './',
  plugins: [react()],
})
