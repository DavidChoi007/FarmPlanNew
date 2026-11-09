import React from 'react';

interface LinkProps {
  to: string;
  className?: string;
  children: React.ReactNode;
}

export function getBasePath(): string {
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/FarmPlanNew')) {
    return '/FarmPlanNew';
  }
  return '';
}

export function normalizeAppPath(pathname: string): string {
  const base = getBasePath();
  if (base && pathname.startsWith(base)) {
    const rest = pathname.slice(base.length);
    return rest.startsWith('/') ? rest : `/${rest}`;
  }
  return pathname || '/';
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
