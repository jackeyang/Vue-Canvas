import { fileURLToPath, URL } from 'node:url'
import { loadEnv } from 'vite'
import type { ProxyOptions } from 'vite'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const proxyTarget = env.VITE_PROXY_TARGET
  const proxy: Record<string, ProxyOptions> = {}
  if (proxyTarget) {
    proxy['/api'] = { target: proxyTarget, changeOrigin: true }
  }

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: Number(env.VITE_DEV_PORT) || 8081,
      proxy,
    },
    build: {
      target: 'es2022',
      // 生产包不发布源码映射，避免泄漏源码
      sourcemap: false,
    },
    test: {
      environment: 'jsdom',
      include: ['tests/**/*.spec.ts'],
      restoreMocks: true,
      coverage: {
        provider: 'v8',
        reporter: ['text-summary', 'lcov'],
        include: ['src/common/**/*.ts', 'src/components/**/*.vue'],
      },
    },
  }
})
