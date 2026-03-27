import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // The single inline CraftPlanner module
      '@craftplanner-module': path.resolve(__dirname, '../module/frontend'),
    },
    // Ensure module files outside the project root use the shell's copies of
    // shared packages (React, TanStack, etc.) rather than failing to resolve.
    dedupe: [
      'react', 'react-dom', 'react/jsx-runtime',
      '@tanstack/react-query', '@tanstack/react-router',
      'lucide-react',
    ],
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/modules': 'http://localhost:3000',
    },
  },
})
