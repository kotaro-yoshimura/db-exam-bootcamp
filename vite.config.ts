import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * vite-plugin-singlefile の出力完了後（closeBundle）に dist/index.html と dist/sw.js を後処理し、
 * ローカル単一HTML起動（iPadショートカット等）と HTTPS PWA 配信の両方を100%両立させる：
 * 1. <script type="module" crossorigin> をクラシック <script> に変換し </body> 直前（#root後）へ移動
 * 2. 不要な crossorigin 属性を除去
 * 3. dist/index.html のSHA-256ハッシュを dist/sw.js の __PWA_CACHE_VERSION__ に自動埋め込み
 */
function iosQuickLookCompatiblePlugin(): Plugin {
  let outDir = 'dist';
  return {
    name: 'ios-quicklook-classic-script',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir || 'dist';
    },
    closeBundle() {
      const distDir = path.resolve(process.cwd(), outDir);
      const htmlPath = path.join(distDir, 'index.html');
      if (!fs.existsSync(htmlPath)) return;

      let html = fs.readFileSync(htmlPath, 'utf8');
      const openTagMatch = html.match(/<script\s+type="module"[^>]*>/i);
      if (openTagMatch && openTagMatch.index !== undefined) {
        const startIdx = openTagMatch.index;
        const codeStart = startIdx + openTagMatch[0].length;
        const closeIdx = html.indexOf('</script>', codeStart);
        if (closeIdx >= 0) {
          const jsCode = html.slice(codeStart, closeIdx);
          if (jsCode.trim().length >= 100) {
            // 元の <head> 内モジュールscriptタグを除去
            html = html.slice(0, startIdx) + html.slice(closeIdx + '</script>'.length);
            // <style ... crossorigin> / <link ... crossorigin> 等の crossorigin 属性を除去
            html = html.replace(/<(style|link)([^>]*)\scrossorigin(?:="[^"]*")?/gi, '<$1$2');
            // </body> の直前（<div id="root"></div> の後）にクラシック <script> として挿入
            html = html.replace('</body>', () => `    <script>${jsCode}</script>\n  </body>`);
            fs.writeFileSync(htmlPath, html, 'utf8');
          }
        }
      }

      // PWA Service Worker のキャッシュバージョンをビルド成果物ハッシュで自動更新
      const swPath = path.join(distDir, 'sw.js');
      if (fs.existsSync(swPath)) {
        const contentHash = crypto.createHash('sha256').update(html).digest('hex').slice(0, 12);
        const swContent = fs.readFileSync(swPath, 'utf8');
        const updatedSw = swContent.replace(/__PWA_CACHE_VERSION__/g, contentHash);
        fs.writeFileSync(swPath, updatedSw, 'utf8');
      }
    },
  };
}

// 単一HTMLローカル起動（iPhone/iPadオフライン）と HTTPS PWA 配信の両立設定
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    viteSingleFile({
      removeViteModuleLoader: true,
    }),
    iosQuickLookCompatiblePlugin(),
  ],
  build: {
    target: 'es2020',
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 100000000,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
      },
    },
  },
  optimizeDeps: {
    exclude: ['sql.js'],
  },
});
