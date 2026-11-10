import React from 'react';

interface LinkProps {
  to: string;
  className?: string;
  children: React.ReactNode;
}

export function getBasePath(): string {
  if (typeof window !== 'undefined') {
    if (window.location.pathname.toLowerCase().startsWith('/farmplannew')) {
      return '/FarmPlanNew';
    }
    if (window.location.hostname.endsWith('github.io')) {
      return '/FarmPlanNew';
    }
  }
  return '';
}

export function normalizeAppPath(pathname: string): string {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const pageParam = (params.get('page') || '').trim();
    if (pageParam === 'purchase-intent') return '/purchase-intent';
    if (pageParam === 'survey') return '/survey';
    if (pageParam === 'admin') return '/admin';

    const hash = (window.location.hash || '').replace(/^#/, '').trim();
    if (hash.startsWith('/purchase-intent')) return '/purchase-intent';
    if (hash.startsWith('/survey')) return hash;
    if (hash.startsWith('/admin')) return '/admin';
  }

  const base = getBasePath();
  if (base && pathname.toLowerCase().startsWith(base.toLowerCase())) {
    const rest = pathname.slice(base.length);
    return rest.startsWith('/') ? rest : `/${rest}`;
  }
  return pathname || '/';
}

export function encodeSharePayload(obj: unknown): string {
  try {
    const json = JSON.stringify(obj);
    const bytes = new TextEncoder().encode(json);
    let bin = '';
    bytes.forEach((b) => {
      bin += String.fromCharCode(b);
    });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch {
    return '';
  }
}

export function decodeSharePayload<T = any>(encoded: string | null | undefined): T | null {
  if (!encoded) return null;
  try {
    const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    const bin = atob(b64 + pad);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export function navigateTo(to: string) {
  const base = getBasePath();
  const target = to.startsWith('/') ? `${base}${to === '/' && base ? '/' : to}` : to;
  window.history.pushState({}, '', target);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function Link({ to, className, children }: LinkProps) {
  const base = getBasePath();
  const href = to.startsWith('/') ? `${base}${to === '/' && base ? '/' : to}` : to;
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    navigateTo(to);
  };
  return (
    <a href={href} onClick={handleClick} className={className}>
      {children}
    </a>
  );
}
