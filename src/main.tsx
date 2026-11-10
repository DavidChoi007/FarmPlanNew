import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined' && window.location.hostname.endsWith('github.io')) {
  const origFetch = window.fetch.bind(window);
  let snapshotPromise: Promise<any> | null = null;
  let cachedImageMap: Record<string, string> = {};

  const getSnapshot = () => {
    if (!snapshotPromise) {
      snapshotPromise = origFetch('/FarmPlanNew/static-api/snapshot.json')
        .then((r) => r.json())
        .then((data) => {
          cachedImageMap = data?.imageMap || {};
          rewriteGithubPagesAssets();
          return data;
        })
        .catch(() => ({}));
    }
    return snapshotPromise;
  };

  const jsonResponse = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (!rawUrl.startsWith('/api/')) {
      return origFetch(input, init);
    }

    const snap = await getSnapshot();
    const u = new URL(rawUrl, window.location.origin);
    const p = u.pathname;

    if (p === '/api/agro-materials') {
      const cat = (u.searchParams.get('category') || 'FERTILIZER').toUpperCase();
      const subType = (u.searchParams.get('subType') || '').trim();
      const organicOnly = u.searchParams.get('organicOnly') === '1' || u.searchParams.get('organicOnly') === 'true';
      const q = (u.searchParams.get('q') || '').trim().toLowerCase();
      const page = Math.max(1, Number(u.searchParams.get('page')) || 1);
      const pageSize = Math.max(1, Number(u.searchParams.get('pageSize')) || 20);

      const src =
        cat === 'NUTRIENT'
          ? snap.nutrient
          : cat === 'PESTICIDE'
          ? snap.pesticide
          : snap.fertilizer;
      const allItems: any[] = Array.isArray(src?.allItems) ? src.allItems : Array.isArray(src?.items) ? src.items : [];
      const filtered = allItems.filter((it) => {
        if (subType && subType !== 'ALL' && it.sub_type !== subType && it.sub_type_name !== subType) return false;
        if (organicOnly && Number(it.is_organic) !== 1) return false;
        if (q) {
          const hay = `${it.product_name || ''} ${it.manufacturer || ''} ${it.material_id || ''} ${it.sub_type_name || ''} ${it.target_crops || ''} ${it.key_effect || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(page, totalPages);
      const pagedItems = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

      return jsonResponse({
        ...(src || {}),
        items: filtered,
        allItems,
        pagedItems,
        total,
        page: safePage,
        pageSize,
        totalPages,
      });
    }

    if (p === '/api/overview') return jsonResponse(snap.overview || {});
    if (p === '/api/mypage') return jsonResponse(snap.mypage || {});
    if (p === '/api/auth/login') {
      return jsonResponse({
        ok: true,
        member: snap.mypage?.member || {
          member_id: 'MEM-CLOUDBAE',
          email: 'CloudBae@naver.com',
          name: '배철민',
          nickname: 'CloudBae',
        },
      });
    }
    if (p === '/api/member-schedule-requests') return jsonResponse(snap.scheduleRequests || { items: [], total: 0 });
    if (p === '/api/schedule-provision') return jsonResponse(snap.scheduleProvision || {});
    if (p === '/api/templates') return jsonResponse(snap.templates || []);
    if (p === '/api/histories') return jsonResponse(snap.histories || []);
    if (p === '/api/prescriptions') return jsonResponse(snap.prescriptions || []);
    if (p === '/api/addresses/meta') return jsonResponse(snap.addressesMeta || { totalCount: 0, sidos: [], sigungusBySido: {} });
    if (p === '/api/payment-bank-accounts') return jsonResponse(snap.paymentBankAccounts || { items: [] });
    if (p === '/api/crop-growth-process-plans') return jsonResponse(snap.cropGrowthPlans || { items: [] });
    if (p === '/api/agro-recommendation-module') return jsonResponse(snap.agroRecModule || {});
    if (p === '/api/surveys') {
      const surveyId = u.searchParams.get('survey_id') || '';
      const baseSurveys = snap.surveys || { forms: [], responses: [] };
      const forms: any[] = Array.isArray(baseSurveys.forms) ? baseSurveys.forms : [];
      const activeSurvey =
        (surveyId && forms.find((f) => f.survey_id === surveyId)) ||
        baseSurveys.activeSurvey ||
        forms[0] ||
        null;
      return jsonResponse({
        ...baseSurveys,
        activeSurvey,
      });
    }
    if (p === '/api/surveys/public') {
      const surveyId = u.searchParams.get('survey_id') || 'SURV-HANFARM-2026';
      const baseSurveys = snap.surveys || { forms: [] };
      const forms: any[] = Array.isArray(baseSurveys.forms) ? baseSurveys.forms : [];
      const found =
        forms.find((f) => f.survey_id === surveyId) ||
        baseSurveys.activeSurvey ||
        forms[0] || {
          survey_id: surveyId,
          title: '한팜 맞춤형 재배관리 서비스 수요조사',
          is_active: 1,
        };
      return jsonResponse({ ok: true, survey: found });
    }
    if (p === '/api/surveys/submit') {
      return jsonResponse({
        ok: true,
        response_id: `RESP-${Date.now().toString().slice(-6)}`,
      });
    }
    if (p === '/api/purchase-intents') {
      let template = null;
      let entries = null;
      try {
        const rawTpl = localStorage.getItem('hanfarm_purchase_intent_template_v1');
        if (rawTpl) template = JSON.parse(rawTpl);
        const rawEntries = localStorage.getItem('hanfarm_purchase_intents_v1');
        if (rawEntries) entries = JSON.parse(rawEntries);
      } catch {
        // ignore
      }
      return jsonResponse({ ok: true, template, entries });
    }
    if (
      p === '/api/purchase-intents/template' ||
      p === '/api/purchase-intents/entry' ||
      p === '/api/purchase-intents/entry/delete'
    ) {
      return jsonResponse({ ok: true });
    }
    if (p === '/api/climate/dongs') return jsonResponse(snap.climateDongs || { dongs: [] });
    if (p === '/api/climate/daily') return jsonResponse(snap.climateDaily || { items: [] });
    if (p === '/api/climate-future/env-status') return jsonResponse(snap.climateFutureEnv || {});
    if (p === '/api/climate-future/daily') return jsonResponse(snap.climateFutureDaily || { items: [] });
    if (p === '/api/soil-surveys/env-status') return jsonResponse(snap.soilEnv || {});
    if (p === '/api/soil-surveys') return jsonResponse(snap.soilSurveys || { items: [] });

    return jsonResponse({ ok: true });
  };

  function rewriteGithubPagesAssets() {
    document.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
      const rawSrc = img.getAttribute('src') || '';
      if (rawSrc.startsWith('/images/')) {
        img.setAttribute('src', `/FarmPlanNew${rawSrc}`);
      } else if (rawSrc.startsWith('/api/agro-materials/image/')) {
        const parts = rawSrc.split('/');
        const id = decodeURIComponent(parts[4] || 'FERT-PRD-01');
        const slot = (parts[5] || 'thumb').split('?')[0];
        const key = `${id}-${slot}`;
        const mapped = cachedImageMap[key] || `${key}.svg`;
        img.setAttribute('src', `/FarmPlanNew/static-api/images/${mapped}`);
      }
    });
    document.querySelectorAll<HTMLAnchorElement>('a').forEach((a) => {
      const rawHref = a.getAttribute('href') || '';
      if (rawHref.startsWith('/docs/')) {
        a.setAttribute('href', `/FarmPlanNew${rawHref}`);
      }
    });
  }

  void getSnapshot();
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
