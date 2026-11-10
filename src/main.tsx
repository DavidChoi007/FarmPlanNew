import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {
  KOREA_SIDO_LIST,
  KOREA_SIGUNGUS_BY_SIDO,
  generateKoreaAddressDataset,
} from '../server/koreaAddresses.ts';

let cachedKoreaAddresses: ReturnType<typeof generateKoreaAddressDataset> | null = null;
function getKoreaAddressesCache() {
  if (!cachedKoreaAddresses) {
    cachedKoreaAddresses = generateKoreaAddressDataset();
  }
  return cachedKoreaAddresses;
}

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
    if (p === '/api/addresses/meta') {
      return jsonResponse(
        snap.addressesMeta?.sidos?.length
          ? snap.addressesMeta
          : {
              totalCount: getKoreaAddressesCache().length,
              sidos: KOREA_SIDO_LIST,
              sigungusBySido: KOREA_SIGUNGUS_BY_SIDO,
            }
      );
    }
    if (p === '/api/addresses') {
      const sido = (u.searchParams.get('sido') || '').trim();
      const sigungu = (u.searchParams.get('sigungu') || '').trim();
      const q = (u.searchParams.get('q') || '').trim().toLowerCase();
      const page = Math.max(1, Number(u.searchParams.get('page')) || 1);
      const pageSize = Math.max(1, Math.min(200, Number(u.searchParams.get('pageSize')) || 50));

      const allAddr = getKoreaAddressesCache();
      const filtered = allAddr.filter((it) => {
        if (sido && sido !== 'ALL' && it.sido !== sido) return false;
        if (sigungu && sigungu !== 'ALL' && it.sigungu !== sigungu) return false;
        if (q) {
          const hay = `${it.full_address} ${it.sido} ${it.sigungu} ${it.eupmyeondong} ${it.bjd_code}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(page, totalPages);
      const items = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
      return jsonResponse({
        items,
        total,
        page: safePage,
        pageSize,
        totalPages,
      });
    }
    if (p === '/api/payment-bank-accounts') return jsonResponse(snap.paymentBankAccounts || { items: [] });
    if (p === '/api/crop-growth-process-plans') return jsonResponse(snap.cropGrowthPlans || { items: [] });
    if (p === '/api/agro-recommendation-module') return jsonResponse(snap.agroRecModule || {});
    if (
      p === '/api/surveys' ||
      p === '/api/surveys/public' ||
      p === '/api/surveys/save' ||
      p === '/api/surveys/delete' ||
      p === '/api/surveys/submit' ||
      p === '/api/surveys/response/delete'
    ) {
      const FORMS_KEY = 'hanfarm_surveys_forms_v1';
      const RESPS_KEY = 'hanfarm_surveys_responses_v1';
      const baseSurveys = snap.surveys || { forms: [], responses: [] };
      let forms: any[] = [];
      let responses: any[] = [];
      try {
        const rawForms = localStorage.getItem(FORMS_KEY);
        forms = rawForms ? JSON.parse(rawForms) : Array.isArray(baseSurveys.forms) ? [...baseSurveys.forms] : [];
      } catch {
        forms = Array.isArray(baseSurveys.forms) ? [...baseSurveys.forms] : [];
      }
      try {
        const rawResps = localStorage.getItem(RESPS_KEY);
        responses = rawResps ? JSON.parse(rawResps) : Array.isArray(baseSurveys.responses) ? [...baseSurveys.responses] : [];
      } catch {
        responses = Array.isArray(baseSurveys.responses) ? [...baseSurveys.responses] : [];
      }

      if (p === '/api/surveys/save') {
        try {
          const body = init?.body ? JSON.parse(String(init.body)) : {};
          const surveyId = String(body.survey_id || 'SURV-HANFARM-2026').trim();
          const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
          const idx = forms.findIndex((f) => f.survey_id === surveyId);
          const nextForm = {
            ...(idx >= 0 ? forms[idx] : {}),
            ...body,
            survey_id: surveyId,
            is_active: body.is_active === undefined ? 1 : Number(body.is_active) ? 1 : 0,
            updated_at: nowStr,
            questions: Array.isArray(body.questions) ? body.questions : idx >= 0 ? forms[idx].questions : [],
          };
          if (idx >= 0) {
            forms[idx] = nextForm;
          } else {
            forms.unshift(nextForm);
          }
          localStorage.setItem(FORMS_KEY, JSON.stringify(forms));
          if (snap.surveys) {
            snap.surveys.forms = forms;
            snap.surveys.activeSurvey = nextForm;
          }
          return jsonResponse({ ok: true, survey_id: surveyId, survey: nextForm });
        } catch {
          return jsonResponse({ ok: true });
        }
      }

      if (p === '/api/surveys/delete') {
        try {
          const body = init?.body ? JSON.parse(String(init.body)) : {};
          const targetId = String(body.survey_id || '').trim();
          forms = forms.filter((f) => f.survey_id !== targetId);
          responses = responses.filter((r) => r.survey_id !== targetId);
          localStorage.setItem(FORMS_KEY, JSON.stringify(forms));
          localStorage.setItem(RESPS_KEY, JSON.stringify(responses));
        } catch {
          // ignore
        }
        return jsonResponse({ ok: true });
      }

      if (p === '/api/surveys/submit') {
        const respId = `RESP-${Date.now().toString().slice(-6)}`;
        try {
          const body = init?.body ? JSON.parse(String(init.body)) : {};
          const surveyId = String(body.survey_id || 'SURV-HANFARM-2026').trim();
          const newResp = {
            response_id: respId,
            survey_id: surveyId,
            respondent_name: body.respondent_name || '익명 농업인',
            respondent_region: body.respondent_region || '',
            respondent_contact: body.respondent_contact || '',
            q1_age: body.q1_age || '',
            q2_scale: body.q2_scale || '',
            q3_crops: Array.isArray(body.q3_crops) ? body.q3_crops : [],
            q3_other_text: body.q3_other_text || '',
            q4_difficulty: body.q4_difficulty || '',
            q5_schedule_intent: body.q5_schedule_intent || '',
            q6_schedule_wtp: body.q6_schedule_wtp || '',
            q7_ai_pest_intent: body.q7_ai_pest_intent || '',
            q8_bundle_wtp: body.q8_bundle_wtp || '',
            q9_commerce_intent: body.q9_commerce_intent || '',
            answers_map: body.answers_map || {},
            submitted_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
          };
          responses.unshift(newResp);
          localStorage.setItem(RESPS_KEY, JSON.stringify(responses));
        } catch {
          // ignore
        }
        return jsonResponse({ ok: true, response_id: respId });
      }

      if (p === '/api/surveys/response/delete') {
        try {
          const body = init?.body ? JSON.parse(String(init.body)) : {};
          const targetRespId = String(body.response_id || '').trim();
          responses = responses.filter((r) => r.response_id !== targetRespId);
          localStorage.setItem(RESPS_KEY, JSON.stringify(responses));
        } catch {
          // ignore
        }
        return jsonResponse({ ok: true });
      }

      if (p === '/api/surveys/public') {
        const surveyId = u.searchParams.get('survey_id') || 'SURV-HANFARM-2026';
        const found =
          forms.find((f) => f.survey_id === surveyId) ||
          forms[0] ||
          baseSurveys.activeSurvey || {
            survey_id: surveyId,
            title: '한팜 맞춤형 재배관리 서비스 수요조사',
            is_active: 1,
          };
        return jsonResponse({ ok: true, survey: found });
      }

      // GET /api/surveys
      const surveyId = u.searchParams.get('survey_id') || '';
      const activeSurvey =
        (surveyId && forms.find((f) => f.survey_id === surveyId)) ||
        forms[0] ||
        baseSurveys.activeSurvey ||
        null;
      const targetSurveyId = activeSurvey?.survey_id || 'SURV-HANFARM-2026';
      const surveyResponses = responses.filter(
        (r) => !r.survey_id || r.survey_id === targetSurveyId
      );
      const totalCount = surveyResponses.length;
      const questionsList: any[] = Array.isArray(activeSurvey?.questions)
        ? activeSurvey.questions
        : [];
      const questionStats = questionsList.map((qDef: any) => {
        const optionCounts = (qDef.options || []).map((opt: string) => {
          let cnt = 0;
          for (const r of surveyResponses) {
            const customVal = r.answers_map?.[qDef.id];
            if (Array.isArray(customVal) && customVal.includes(opt)) cnt++;
            else if (typeof customVal === 'string' && customVal === opt) cnt++;
            else if (qDef.id === 'q1' && r.q1_age === opt) cnt++;
            else if (qDef.id === 'q2' && r.q2_scale === opt) cnt++;
            else if (qDef.id === 'q3' && Array.isArray(r.q3_crops) && r.q3_crops.includes(opt)) cnt++;
            else if (qDef.id === 'q4' && r.q4_difficulty === opt) cnt++;
            else if (qDef.id === 'q5' && r.q5_schedule_intent === opt) cnt++;
            else if (qDef.id === 'q6' && r.q6_schedule_wtp === opt) cnt++;
            else if (qDef.id === 'q7' && r.q7_ai_pest_intent === opt) cnt++;
            else if (qDef.id === 'q8' && r.q8_bundle_wtp === opt) cnt++;
            else if (qDef.id === 'q9' && r.q9_commerce_intent === opt) cnt++;
          }
          const pct = totalCount > 0 ? Number(((cnt / totalCount) * 100).toFixed(1)) : 0;
          return { option: opt, count: cnt, pct };
        });
        return {
          ...qDef,
          optionCounts,
          otherInputs: [],
        };
      });

      const formsWithCounts = forms.map((f) => ({
        ...f,
        response_count: responses.filter((r) => (r.survey_id || 'SURV-HANFARM-2026') === f.survey_id).length,
      }));

      return jsonResponse({
        ...baseSurveys,
        ok: true,
        forms: formsWithCounts,
        activeSurvey,
        responses: surveyResponses,
        totalResponses: totalCount,
        filteredCount: surveyResponses.length,
        questionStats,
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
