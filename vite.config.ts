import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function applyRouteMeta(html: string, title: string, description: string): string {
  return html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="description" content="${description}" />`
    )
    .replace(
      /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:title" content="${title}" />`
    )
    .replace(
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:description" content="${description}" />`
    )
    .replace(
      /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="twitter:title" content="${title}" />`
    )
    .replace(
      /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="twitter:description" content="${description}" />`
    );
}

function routeOpenGraphPlugin(): Plugin {
  return {
    name: 'route-open-graph-plugin',
    transformIndexHtml(html, ctx) {
      const reqUrl = (ctx.originalUrl || ctx.path || '').toLowerCase();
      if (reqUrl.includes('/survey')) {
        return applyRouteMeta(html, '재배컨설팅 서비스 설문조사', '재배컨설팅 서비스 설문조사');
      }
      if (reqUrl.includes('/purchase-intent')) {
        return applyRouteMeta(html, '구매 및 구독 의향서', '구매 및 구독 의향서');
      }
      return html;
    },
    closeBundle() {
      const distDir = path.resolve(process.cwd(), 'dist');
      const indexHtmlPath = path.join(distDir, 'index.html');
      if (!fs.existsSync(indexHtmlPath)) return;

      const baseHtml = fs.readFileSync(indexHtmlPath, 'utf-8');
      const surveyHtml = applyRouteMeta(
        baseHtml,
        '재배컨설팅 서비스 설문조사',
        '재배컨설팅 서비스 설문조사'
      );
      const purchaseIntentHtml = applyRouteMeta(
        baseHtml,
        '구매 및 구독 의향서',
        '구매 및 구독 의향서'
      );

      const writeRouteHtml = (relPath: string, content: string) => {
        const fullPath = path.join(distDir, relPath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content, 'utf-8');
      };

      writeRouteHtml('survey/index.html', surveyHtml);
      writeRouteHtml('survey.html', surveyHtml);
      writeRouteHtml('survey/SURV-HANFARM-2026/index.html', surveyHtml);
      writeRouteHtml('survey/SURV-HANFARM-2026.html', surveyHtml);

      writeRouteHtml('purchase-intent/index.html', purchaseIntentHtml);
      writeRouteHtml('purchase-intent.html', purchaseIntentHtml);

      writeRouteHtml('admin/index.html', baseHtml);
      writeRouteHtml('admin.html', baseHtml);
      writeRouteHtml('404.html', baseHtml);
    },
  };
}

export default defineConfig({
  base: '/',
  plugins: [react(), routeOpenGraphPlugin()],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/index.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/index.[ext]',
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
});
