import { defineConfig } from 'vite';
import { resolve } from 'node:path';
const upstream = resolve('vendor/animama/src/frontend');
export default defineConfig({
  resolve: { alias: { 'react-i18next': resolve('i18n.ts'), 'zustand/vanilla': resolve('node_modules/zustand/esm/vanilla.mjs'), 'zustand': resolve('store.ts'), '@': `${upstream}/web/src`, '@animama/product-ui/anima-profile': `${upstream}/packages/product-ui/src/anima-profile.ts`, '@animama/product-ui/emotion': `${upstream}/packages/product-ui/src/emotion.ts`, '@animama/runtime-contracts/validators': `${upstream}/packages/runtime-contracts/src/validators.ts`, '@animama/runtime-contracts/locale': `${upstream}/packages/runtime-contracts/src/locale.ts`, '@animama/runtime-contracts': `${upstream}/packages/runtime-contracts/src/index.ts` } },
  define: { 'process.env.NODE_ENV': JSON.stringify('production'), __ANIMAMA_DEV_BUILD__: 'false', __ANIMAMA_APP_VERSION__: '"jarvis"' },
  build: { lib: { entry: 'stage.ts', name: 'JarvisCompanion', formats: ['iife'], fileName: () => 'companion.js' }, outDir: 'dist', assetsInlineLimit: 0 },
});
