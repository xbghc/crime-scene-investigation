import { fileURLToPath } from 'node:url'
import { includeIgnoreFile } from '@eslint/compat'
import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

/* 单根配置同时覆盖 client(Vue+TS) 与 server(TS)；格式化交给 Prettier，
   skipFormatting 关掉与 Prettier 冲突的 ESLint 规则。
   includeIgnoreFile 复用 .gitignore，自动排除调试脚本等忽略文件。 */
const gitignorePath = fileURLToPath(new URL('.gitignore', import.meta.url))

export default defineConfigWithVueTs(
  includeIgnoreFile(gitignorePath),
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}'],
  },
  {
    name: 'app/files-to-ignore',
    ignores: [
      '**/dist/**',
      '**/.histoire/**',
      '**/.lostpixel/**',
      '**/coverage/**',
      'ecosystem.config.js',
      'e2e/**',
    ],
  },
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
  skipFormatting,
)
