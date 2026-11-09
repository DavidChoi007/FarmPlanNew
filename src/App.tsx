import React, { useEffect, useState } from 'react';
import UserIntroPage from './pages/UserIntroPage.tsx';
import AdminDashboardPage from './pages/AdminDashboardPage.tsx';
import SurveyPublicPage from './pages/SurveyPublicPage.tsx';
import PurchaseIntentPublicPage from './pages/PurchaseIntentPublicPage.tsx';

export default function App() {
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  if (pathname.startsWith('/survey')) {
    return <SurveyPublicPage />;
  }

  if (pathname.startsWith('/purchase-intent')) {
    return <PurchaseIntentPublicPage />;
  }

  if (pathname.startsWith('/admin')) {
    return <AdminDashboardPage />;
  }

  return <UserIntroPage />;
}
