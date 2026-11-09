import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const EXTERNAL_API_ORIGIN = 'https://22415286db83b0.lhr.life';

if (typeof window !== 'undefined' && window.location.hostname.endsWith('github.io')) {
  const origFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.startsWith('/api/')) {
      return origFetch(`${EXTERNAL_API_ORIGIN}${input}`, init);
    }
    return origFetch(input, init);
  };

  const rewriteGithubPagesAssets = () => {
    document.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
      const rawSrc = img.getAttribute('src') || '';
      if (rawSrc.startsWith('/images/')) {
        img.setAttribute('src', `/FarmPlanNew${rawSrc}`);
      } else if (rawSrc.startsWith('/api/')) {
        img.setAttribute('src', `${EXTERNAL_API_ORIGIN}${rawSrc}`);
      }
    });
  };

  const observer = new MutationObserver(() => rewriteGithubPagesAssets());
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src'],
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
