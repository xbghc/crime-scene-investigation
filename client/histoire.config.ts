import { defineConfig } from 'histoire'
import { HstVue } from '@histoire/plugin-vue'

export default defineConfig({
  plugins: [HstVue()],
  setupFile: 'src/histoire.setup.ts',
  storyMatch: ['src/**/*.story.vue'],
  vite: {
    server: {
      port: 8031,
    },
  },
  tree: {
    groups: [
      { id: 'ui', title: 'UI 原语' },
      { id: 'game', title: '游戏组件' },
      { id: 'phases', title: '阶段视图' },
      { id: 'pages', title: '页面' },
    ],
  },
  theme: {
    title: '犯罪现场',
    darkClass: 'dark',
    defaultColorScheme: 'dark',
    colors: {
      primary: { 50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5', 400: '#f87171', 500: '#a61c1c', 600: '#991b1b', 700: '#7f1d1d', 800: '#6b1616', 900: '#4c0f0f' },
    },
  },
  responsivePresets: [
    { label: 'iPhone SE', width: 375, height: 667 },
    { label: 'iPhone X', width: 375, height: 812 },
    { label: 'iPhone 14 Pro Max', width: 430, height: 932 },
    { label: 'Android', width: 360, height: 740 },
  ],
  backgroundPresets: [
    { label: 'App 背景', color: '#0d1117' },
    { label: 'Card 背景', color: '#21262d' },
    { label: 'Secondary', color: '#161b22' },
  ],
})
