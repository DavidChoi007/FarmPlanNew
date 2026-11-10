import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { getBasePath } from './router.tsx';
import {
  KOREA_SIDO_LIST,
  KOREA_SIGUNGUS_BY_SIDO,
  generateKoreaAddressDataset,
  generateKoreaRoadAndJibunDatasets,
} from '../server/koreaAddresses.ts';

let cachedKoreaAddresses: ReturnType<typeof generateKoreaAddressDataset> | null = null;
function getKoreaAddressesCache() {
  if (!cachedKoreaAddresses) {
    cachedKoreaAddresses = generateKoreaAddressDataset();
  }
  return cachedKoreaAddresses;
}

let cachedRoadAndJibun: ReturnType<typeof generateKoreaRoadAndJibunDatasets> | null = null;
function getRoadAndJibunCache() {
  if (!cachedRoadAndJibun) {
    cachedRoadAndJibun = generateKoreaRoadAndJibunDatasets();
  }
  return cachedRoadAndJibun;
}

if (typeof window !== 'undefined') {
  const host = window.location.hostname.toLowerCase();
  const isStaticHost =
    host.endsWith('vercel.app') ||
    host.endsWith('github.io') ||
    (host !== 'localhost' && host !== '127.0.0.1' && !host.endsWith('.tmp.now'));

  const origFetch = window.fetch.bind(window);
  let snapshotPromise: Promise<any> | null = null;
  let cachedImageMap: Record<string, string> = {};

  const OVERVIEW_STORAGE_KEY = 'hanfarm_static_overview_v1';
  const MYPAGE_STORAGE_KEY = 'hanfarm_static_mypage_v1';
  const MEMBERS_STORAGE_KEY = 'hanfarm_static_members_v1';

  const getSnapshot = () => {
    if (!snapshotPromise) {
      const base = getBasePath();
      snapshotPromise = origFetch(`${base}/static-api/snapshot.json`)
        .then((r) => r.json())
        .then((data) => {
          cachedImageMap = data?.imageMap || {};
          try {
            const savedOv = localStorage.getItem(OVERVIEW_STORAGE_KEY);
            if (savedOv && data?.overview) {
              const parsedOv = JSON.parse(savedOv);
              data.overview = { ...data.overview, ...parsedOv };
            }
          } catch {
            // ignore
          }
          try {
            const savedMp = localStorage.getItem(MYPAGE_STORAGE_KEY);
            if (savedMp && data?.mypage) {
              const parsedMp = JSON.parse(savedMp);
              data.mypage = { ...data.mypage, ...parsedMp };
            }
          } catch {
            // ignore
          }
          rewriteStaticAssets();
          return data;
        })
        .catch(() => ({}));
    }
    return snapshotPromise;
  };

  const persistOverview = (ov: any) => {
    try {
      localStorage.setItem(OVERVIEW_STORAGE_KEY, JSON.stringify(ov));
    } catch {
      // ignore
    }
  };

  const persistMyPage = (mp: any) => {
    try {
      localStorage.setItem(MYPAGE_STORAGE_KEY, JSON.stringify(mp));
    } catch {
      // ignore
    }
  };

  const jsonResponse = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });

  const parseBody = (init?: RequestInit): any => {
    if (!init?.body) return {};
    try {
      return JSON.parse(String(init.body));
    } catch {
      return {};
    }
  };

  const handleStaticApi = async (rawUrl: string, init?: RequestInit): Promise<Response> => {
    const snap = await getSnapshot();
    const u = new URL(rawUrl, window.location.origin);
    const p = u.pathname;
    const method = (init?.method || 'GET').toUpperCase();

    // 1. 농자재 상품 조회·저장·삭제
    if (p === '/api/agro-materials') {
      const cat = (u.searchParams.get('category') || 'FERTILIZER').toUpperCase();
      const subType = (u.searchParams.get('subType') || u.searchParams.get('sub_type') || '').trim();
      const isOrganicParam = u.searchParams.get('is_organic') ?? u.searchParams.get('organicOnly') ?? 'ALL';
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
        if (isOrganicParam === '1' || isOrganicParam === 'true') {
          if (Number(it.is_organic) !== 1) return false;
        } else if (isOrganicParam === '0' || isOrganicParam === 'false') {
          if (Number(it.is_organic) !== 0) return false;
        }
        if (q) {
          const hay = `${it.product_name || ''} ${it.manufacturer || ''} ${it.material_id || ''} ${it.sub_type || ''} ${it.sub_type_name || ''} ${it.target_crops || ''} ${it.target_nutrient_or_pest || ''} ${it.key_effect || ''}`.toLowerCase();
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
        allItems: filtered,
        pagedItems,
        total,
        page: safePage,
        pageSize,
        totalPages,
      });
    }

    if (p === '/api/agro-materials/save' && method === 'POST') {
      const body = parseBody(init);
      const cat = String(body.material_category || 'FERTILIZER').toUpperCase();
      const src =
        cat === 'NUTRIENT'
          ? snap.nutrient
          : cat === 'PESTICIDE'
          ? snap.pesticide
          : snap.fertilizer;
      if (src) {
        const list: any[] = Array.isArray(src.allItems) ? src.allItems : Array.isArray(src.items) ? src.items : [];
        const idx = list.findIndex((x) => x.material_id === body.material_id);
        if (idx >= 0) list[idx] = { ...list[idx], ...body };
        else list.unshift(body);
        src.allItems = list;
        src.items = list;
      }
      return jsonResponse({ ok: true });
    }

    if (p === '/api/agro-materials/delete' && method === 'POST') {
      const { material_id } = parseBody(init);
      for (const src of [snap.fertilizer, snap.nutrient, snap.pesticide]) {
        if (src && Array.isArray(src.allItems)) {
          src.allItems = src.allItems.filter((x: any) => x.material_id !== material_id);
          src.items = src.allItems;
        }
      }
      return jsonResponse({ ok: true });
    }

    // 2. 기초코드 및 전체 Overview API
    if (p === '/api/overview') {
      return jsonResponse(snap.overview || {});
    }

    if (p === '/api/taxonomy/group' && method === 'POST') {
      const body = parseBody(init);
      const ov = (snap.overview = snap.overview || {});
      const list: any[] = Array.isArray(ov.groups) ? [...ov.groups] : [];
      const idx = list.findIndex((g) => g.group_id === body.group_id);
      const item = {
        ...(idx >= 0 ? list[idx] : {}),
        group_id: body.group_id,
        group_name: body.group_name,
        description: body.description || '',
        sort_order: Number(body.sort_order) || list.length + 1,
      };
      if (idx >= 0) list[idx] = item;
      else list.push(item);
      ov.groups = list;
      persistOverview(ov);
      return jsonResponse({ ok: true });
    }

    if (p === '/api/taxonomy/group/delete' && method === 'POST') {
      const { group_id } = parseBody(init);
      const ov = (snap.overview = snap.overview || {});
      ov.groups = (ov.groups || []).filter((g: any) => g.group_id !== group_id);
      persistOverview(ov);
      return jsonResponse({ ok: true });
    }

    if (p === '/api/taxonomy/crop' && method === 'POST') {
      const body = parseBody(init);
      const ov = (snap.overview = snap.overview || {});
      const list: any[] = Array.isArray(ov.crops) ? [...ov.crops] : [];
      const groupObj = (ov.groups || []).find((g: any) => g.group_id === body.group_id);
      const idx = list.findIndex((c) => c.crop_id === body.crop_id);
      const item = {
        ...(idx >= 0 ? list[idx] : {}),
        ...body,
        group_name: body.group_name || groupObj?.group_name || '',
        min_temp: body.min_temp !== undefined && body.min_temp !== '' ? Number(body.min_temp) : 10,
        max_temp: body.max_temp !== undefined && body.max_temp !== '' ? Number(body.max_temp) : 32,
        opt_temp: String(body.opt_temp ?? '18~25').trim(),
        planting_type: body.planting_type === '모종' ? '모종' : '씨',
        germination_temp: body.planting_type === '모종' ? '' : String(body.germination_temp ?? '').trim(),
      };
      if (idx >= 0) list[idx] = item;
      else list.push(item);
      ov.crops = list;
      persistOverview(ov);
      return jsonResponse({ ok: true });
    }

    if (p === '/api/taxonomy/crop/delete' && method === 'POST') {
      const { crop_id } = parseBody(init);
      const ov = (snap.overview = snap.overview || {});
      ov.crops = (ov.crops || []).filter((c: any) => c.crop_id !== crop_id);
      persistOverview(ov);
      return jsonResponse({ ok: true });
    }

    if (p === '/api/taxonomy/cultivar' && method === 'POST') {
      const body = parseBody(init);
      const ov = (snap.overview = snap.overview || {});
      const list: any[] = Array.isArray(ov.cultivars) ? [...ov.cultivars] : [];
      const cropObj = (ov.crops || []).find((c: any) => c.crop_id === body.crop_id);
      const idx = list.findIndex((cv) => cv.cultivar_id === body.cultivar_id);
      const item = {
        ...(idx >= 0 ? list[idx] : {}),
        ...body,
        crop_name: body.crop_name || cropObj?.crop_name || '',
        group_id: body.group_id || cropObj?.group_id || '',
      };
      if (idx >= 0) list[idx] = item;
      else list.push(item);
      ov.cultivars = list;
      persistOverview(ov);
      return jsonResponse({ ok: true });
    }

    if (p === '/api/taxonomy/cultivar/delete' && method === 'POST') {
      const { cultivar_id } = parseBody(init);
      const ov = (snap.overview = snap.overview || {});
      ov.cultivars = (ov.cultivars || []).filter((cv: any) => cv.cultivar_id !== cultivar_id);
      persistOverview(ov);
      return jsonResponse({ ok: true });
    }

    if (p === '/api/taxonomy/system' && method === 'POST') {
      const body = parseBody(init);
      const ov = (snap.overview = snap.overview || {});
      const list: any[] = Array.isArray(ov.systems) ? [...ov.systems] : [];
      const idx = list.findIndex((s) => s.system_id === body.system_id);
      if (idx >= 0) list[idx] = { ...list[idx], ...body };
      else list.push(body);
      ov.systems = list;
      persistOverview(ov);
      return jsonResponse({ ok: true });
    }

    if (p === '/api/taxonomy/system/delete' && method === 'POST') {
      const { system_id } = parseBody(init);
      const ov = (snap.overview = snap.overview || {});
      ov.systems = (ov.systems || []).filter((s: any) => s.system_id !== system_id);
      persistOverview(ov);
      return jsonResponse({ ok: true });
    }

    if (p === '/api/growth-types' && method === 'POST') {
      const body = parseBody(init);
      const ov = (snap.overview = snap.overview || {});
      const list: any[] = Array.isArray(ov.growthTypeCodes) ? [...ov.growthTypeCodes] : [];
      const idx = list.findIndex((gt) => gt.type_code === body.type_code);
      const item = {
        ...(idx >= 0 ? list[idx] : {}),
        ...body,
        sort_order: Number(body.sort_order) || (idx >= 0 ? list[idx].sort_order : list.length + 1),
      };
      if (idx >= 0) list[idx] = item;
      else list.push(item);
      ov.growthTypeCodes = list;
      persistOverview(ov);
      return jsonResponse({ ok: true });
    }

    if (p === '/api/growth-types/delete' && method === 'POST') {
      const { type_code } = parseBody(init);
      const ov = (snap.overview = snap.overview || {});
      ov.growthTypeCodes = (ov.growthTypeCodes || []).filter((gt: any) => gt.type_code !== type_code);
      persistOverview(ov);
      return jsonResponse({ ok: true });
    }

    if (p === '/api/growth-codes' && method === 'POST') {
      const body = parseBody(init);
      const ov = (snap.overview = snap.overview || {});
      const list: any[] = Array.isArray(ov.growthProcessCodes) ? [...ov.growthProcessCodes] : [];
      const idx = list.findIndex((gc) => gc.process_code === body.process_code);
      const item = {
        ...(idx >= 0 ? list[idx] : {}),
        ...body,
        sort_order: Number(body.sort_order) || (idx >= 0 ? list[idx].sort_order : list.length + 1),
      };
      if (idx >= 0) list[idx] = item;
      else list.push(item);
      ov.growthProcessCodes = list;
      persistOverview(ov);
      return jsonResponse({ ok: true });
    }

    if (p === '/api/growth-codes/delete' && method === 'POST') {
      const { process_code } = parseBody(init);
      const ov = (snap.overview = snap.overview || {});
      ov.growthProcessCodes = (ov.growthProcessCodes || []).filter((gc: any) => gc.process_code !== process_code);
      persistOverview(ov);
      return jsonResponse({ ok: true });
    }

    if (p === '/api/fertilizer-category-codes' && method === 'POST') {
      const body = parseBody(init);
      const ov = (snap.overview = snap.overview || {});
      const list: any[] = Array.isArray(ov.fertilizerCategoryCodes) ? [...ov.fertilizerCategoryCodes] : [];
      const idx = list.findIndex((c) => c.category_code === body.category_code);
      const item = {
        ...(idx >= 0 ? list[idx] : {}),
        ...body,
        sort_order: Number(body.sort_order) || (idx >= 0 ? list[idx].sort_order : list.length + 1),
      };
      if (idx >= 0) list[idx] = item;
      else list.push(item);
      ov.fertilizerCategoryCodes = list;
      persistOverview(ov);
      return jsonResponse({ ok: true });
    }

    if (p === '/api/fertilizer-category-codes/delete' && method === 'POST') {
      const { category_code } = parseBody(init);
      const ov = (snap.overview = snap.overview || {});
      ov.fertilizerCategoryCodes = (ov.fertilizerCategoryCodes || []).filter(
        (c: any) => c.category_code !== category_code
      );
      persistOverview(ov);
      return jsonResponse({ ok: true });
    }

    if (p === '/api/nutrient-category-codes' && method === 'POST') {
      const body = parseBody(init);
      const ov = (snap.overview = snap.overview || {});
      const list: any[] = Array.isArray(ov.nutrientCategoryCodes) ? [...ov.nutrientCategoryCodes] : [];
      const idx = list.findIndex((c) => c.category_code === body.category_code);
      const item = {
        ...(idx >= 0 ? list[idx] : {}),
        ...body,
        sort_order: Number(body.sort_order) || (idx >= 0 ? list[idx].sort_order : list.length + 1),
      };
      if (idx >= 0) list[idx] = item;
      else list.push(item);
      ov.nutrientCategoryCodes = list;
      persistOverview(ov);
      return jsonResponse({ ok: true });
    }

    if (p === '/api/nutrient-category-codes/delete' && method === 'POST') {
      const { category_code } = parseBody(init);
      const ov = (snap.overview = snap.overview || {});
      ov.nutrientCategoryCodes = (ov.nutrientCategoryCodes || []).filter(
        (c: any) => c.category_code !== category_code
      );
      persistOverview(ov);
      return jsonResponse({ ok: true });
    }

    if (p === '/api/pesticide-category-codes' && method === 'POST') {
      const body = parseBody(init);
      const ov = (snap.overview = snap.overview || {});
      const list: any[] = Array.isArray(ov.pesticideCategoryCodes) ? [...ov.pesticideCategoryCodes] : [];
      const idx = list.findIndex((c) => c.category_code === body.category_code);
      const item = {
        ...(idx >= 0 ? list[idx] : {}),
        ...body,
        sort_order: Number(body.sort_order) || (idx >= 0 ? list[idx].sort_order : list.length + 1),
      };
      if (idx >= 0) list[idx] = item;
      else list.push(item);
      ov.pesticideCategoryCodes = list;
      persistOverview(ov);
      return jsonResponse({ ok: true });
    }

    if (p === '/api/pesticide-category-codes/delete' && method === 'POST') {
      const { category_code } = parseBody(init);
      const ov = (snap.overview = snap.overview || {});
      ov.pesticideCategoryCodes = (ov.pesticideCategoryCodes || []).filter(
        (c: any) => c.category_code !== category_code
      );
      persistOverview(ov);
      return jsonResponse({ ok: true });
    }

    // 3. 회원 인증 (cloudbae@naver.com / 1234 로그인, 회원가입, 비밀번호 찾기) 및 마이페이지 API
    const getDefaultCloudBaeMember = () => ({
      member_id: 'MEM-CLOUDBAE',
      email: 'CloudBae@naver.com',
      password: '1234',
      signup_type: 'EMAIL',
      name: '배철민',
      nickname: 'CloudBae',
      gender: '남성',
      birth_date: '1978-05-15',
      age: 48,
      road_address: '충청북도 충주시 충원대로 268 (단월동)',
      road_address_detail: '한팜스마트농원 101호',
      postal_code: '27481',
      phone: '010-2026-0109',
      ...(snap.mypage?.member || {}),
    });

    const getStoredMembers = (): any[] => {
      try {
        const raw = localStorage.getItem(MEMBERS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {
        // ignore
      }
      return [getDefaultCloudBaeMember()];
    };

    const saveStoredMembers = (list: any[]) => {
      try {
        localStorage.setItem(MEMBERS_STORAGE_KEY, JSON.stringify(list));
      } catch {
        // ignore
      }
    };

    if (p === '/api/auth/check-email') {
      const email = (u.searchParams.get('email') || '').trim().toLowerCase();
      if (!email || !email.includes('@')) {
        return jsonResponse({ ok: false, available: false, message: '올바른 이메일 형식을 입력해 주세요.' }, 400);
      }
      const members = getStoredMembers();
      const exists =
        email === 'cloudbae@naver.com' ||
        members.some((m) => String(m.email || '').toLowerCase() === email);
      return jsonResponse({
        ok: true,
        available: !exists,
        message: exists ? '이미 가입된 이메일입니다.' : '사용 가능한 이메일입니다.',
      });
    }

    if (p === '/api/auth/login') {
      const body = parseBody(init);
      const loginType = String(body.login_type || 'EMAIL').toUpperCase();
      const rawEmail = String(body.email || '').trim();
      const password = String(body.password || '').trim();
      const members = getStoredMembers();

      if (loginType === 'GOOGLE_GMAIL') {
        const gmailEmail = rawEmail || 'cloudbae.farm@gmail.com';
        const existing = members.find((m) => String(m.email || '').toLowerCase() === gmailEmail.toLowerCase());
        if (existing) {
          const mp = snap.mypage || {};
          return jsonResponse({
            ok: true,
            ...mp,
            member: existing,
            farmlands: Array.isArray(mp.farmlands) ? mp.farmlands : [],
            cropPlans: Array.isArray(mp.cropPlans) ? mp.cropPlans : [],
            orders: Array.isArray(mp.orders) ? mp.orders : [],
          });
        }
        return jsonResponse({
          ok: true,
          needSignup: true,
          suggestedEmail: gmailEmail,
          suggestedName: gmailEmail.split('@')[0],
          message: 'Google Gmail 계정이 확인되었습니다. 기본 회원정보를 확인 후 가입을 완료해 주세요.',
        });
      }

      const normalizedEmail =
        !rawEmail || rawEmail.toLowerCase() === 'cloudbae' || rawEmail.toLowerCase() === 'cloudbae@naver.com'
          ? 'CloudBae@naver.com'
          : rawEmail;

      const found =
        members.find((m) => String(m.email || '').toLowerCase() === normalizedEmail.toLowerCase()) ||
        (normalizedEmail.toLowerCase() === 'cloudbae@naver.com' ? getDefaultCloudBaeMember() : null);

      if (!found) {
        return jsonResponse(
          {
            ok: false,
            message: '등록되지 않은 이메일 계정입니다. (기본 계정: CloudBae@naver.com / 1234)',
          },
          401
        );
      }

      const expectedPw = String(found.password || '1234');
      if (password && password !== expectedPw && password !== '1234') {
        return jsonResponse(
          {
            ok: false,
            message: '비밀번호가 일치하지 않습니다. (기본 비밀번호: 1234)',
          },
          401
        );
      }

      const mp = (snap.mypage = snap.mypage || {});
      mp.member = { ...found, name: found.name || '배철민' };
      persistMyPage(mp);

      return jsonResponse({
        ok: true,
        ...mp,
        member: mp.member,
        farmlands: Array.isArray(mp.farmlands) ? mp.farmlands : [],
        cropPlans: Array.isArray(mp.cropPlans) ? mp.cropPlans : [],
        orders: Array.isArray(mp.orders) ? mp.orders : [],
      });
    }

    if (p === '/api/auth/signup' && method === 'POST') {
      const body = parseBody(init);
      const members = getStoredMembers();
      const newMember = {
        member_id: `MEM-${Date.now()}`,
        email: String(body.email || 'user@naver.com').trim(),
        password: String(body.password || '1234').trim(),
        signup_type: body.signup_type === 'GOOGLE_GMAIL' ? 'GOOGLE_GMAIL' : 'EMAIL',
        name: String(body.name || '배철민').trim(),
        nickname: String(body.email || 'user').split('@')[0],
        gender: body.gender || '남성',
        birth_date: body.birth_date || '1980-05-15',
        age: Number(body.age) || 46,
        road_address: body.road_address || '충청북도 충주시 충원대로 268 (단월동)',
        road_address_detail: body.road_address_detail || '',
        postal_code: body.postal_code || '27481',
        phone: body.phone || '010-2026-0109',
      };
      const filtered = members.filter(
        (m) => String(m.email || '').toLowerCase() !== newMember.email.toLowerCase()
      );
      filtered.unshift(newMember);
      saveStoredMembers(filtered);

      const mp = (snap.mypage = snap.mypage || {});
      mp.member = newMember;
      persistMyPage(mp);
      return jsonResponse({
        ok: true,
        ...mp,
        member: newMember,
        farmlands: Array.isArray(mp.farmlands) ? mp.farmlands : [],
        cropPlans: Array.isArray(mp.cropPlans) ? mp.cropPlans : [],
        orders: Array.isArray(mp.orders) ? mp.orders : [],
      });
    }

    if (p === '/api/auth/find-password' && method === 'POST') {
      const body = parseBody(init);
      const step = String(body.step || 'VERIFY').toUpperCase();
      const emailInput = String(body.email || 'CloudBae@naver.com').trim();
      const members = getStoredMembers();
      const found =
        members.find((m) => String(m.email || '').toLowerCase() === emailInput.toLowerCase()) ||
        getDefaultCloudBaeMember();
      if (step === 'VERIFY') {
        return jsonResponse({
          ok: true,
          email: found.email,
          currentPasswordHint: '12**',
          message: '본인 확인이 완료되었습니다. 새 비밀번호를 설정해 주세요.',
        });
      }
      found.password = String(body.new_password || '1234').trim();
      saveStoredMembers(members);
      return jsonResponse({
        ok: true,
        email: found.email,
        message: '비밀번호가 성공적으로 변경되었습니다. 새 비밀번호로 로그인해 주세요.',
      });
    }

    if (p === '/api/mypage') {
      const mp = snap.mypage || {};
      return jsonResponse({
        ok: true,
        ...mp,
        member: mp.member || getDefaultCloudBaeMember(),
        farmlands: Array.isArray(mp.farmlands) ? mp.farmlands : [],
        cropPlans: Array.isArray(mp.cropPlans) ? mp.cropPlans : [],
        orders: Array.isArray(mp.orders) ? mp.orders : [],
      });
    }

    if (p === '/api/mypage/profile' && method === 'POST') {
      const body = parseBody(init);
      const mp = (snap.mypage = snap.mypage || {});
      mp.member = { ...(mp.member || getDefaultCloudBaeMember()), ...body };
      persistMyPage(mp);
      return jsonResponse({ ok: true, ...mp });
    }

    if (p === '/api/mypage/farmlands' && method === 'POST') {
      const body = parseBody(init);
      const mp = (snap.mypage = snap.mypage || {});
      const list = Array.isArray(mp.farmlands) ? [...mp.farmlands] : [];
      const newLand = {
        farmland_id: body.farmland_id || `LAND-${Date.now()}`,
        email: body.email || 'CloudBae@naver.com',
        farmland_title: body.farmland_title || '신규 재배지',
        bjd_code: body.bjd_code || '4313010700',
        sido: body.sido || '충청북도',
        sigungu: body.sigungu || '충주시',
        eupmyeondong: body.eupmyeondong || '단월동',
        detail_jibun: body.detail_jibun || '',
        area_pyeong: Number(body.area_pyeong) || 300,
        soil_ph: Number(body.soil_ph) || 6.2,
        soil_ec: Number(body.soil_ec) || 1.1,
      };
      list.push(newLand);
      mp.farmlands = list;
      persistMyPage(mp);
      return jsonResponse({ ok: true, ...mp });
    }

    if (p === '/api/mypage/farmlands/delete' && method === 'POST') {
      const { farmland_id } = parseBody(init);
      const mp = (snap.mypage = snap.mypage || {});
      mp.farmlands = (mp.farmlands || []).filter((f: any) => f.farmland_id !== farmland_id);
      persistMyPage(mp);
      return jsonResponse({ ok: true, ...mp });
    }

    if (p === '/api/mypage/crops' && method === 'POST') {
      const body = parseBody(init);
      const mp = (snap.mypage = snap.mypage || {});
      const list = Array.isArray(mp.cropPlans) ? [...mp.cropPlans] : [];
      const pct = Math.max(0, Math.min(100, Number(body.progress_pct ?? 25)));
      const newPlan = {
        crop_plan_id: body.crop_plan_id || `CPLAN-${Date.now()}`,
        email: body.email || 'CloudBae@naver.com',
        request_no: 'REQ-20261106-009',
        farmland_id: body.farmland_id || 'LAND-CB-01',
        sido: body.sido || '충청북도',
        sigungu: body.sigungu || '충주시',
        eupmyeondong: body.eupmyeondong || '단월동',
        crop_name: body.crop_name || '가을배추',
        cultivar_name: body.cultivar_name || '불암3호',
        planting_type: body.planting_type || '모종',
        area_pyeong: Number(body.area_pyeong) || 300,
        planting_date: body.planting_date || '2026-08-25',
        expected_harvest_date: body.expected_harvest_date || '2026-11-15',
        current_stage_name: pct >= 100 ? '06. 수확 완료' : '04. 생육 관리',
        progress_pct: pct,
        status_text: pct >= 100 ? '수확 완료 · 이력 반영' : '기후 연동 생육 관리중',
      };
      list.push(newPlan);
      mp.cropPlans = list;
      persistMyPage(mp);
      return jsonResponse({ ok: true, ...mp });
    }

    if (p === '/api/mypage/crops/progress' && method === 'POST') {
      const { crop_plan_id, progress_pct } = parseBody(init);
      const mp = (snap.mypage = snap.mypage || {});
      const pct = Math.max(0, Math.min(100, Number(progress_pct) || 0));
      mp.cropPlans = (mp.cropPlans || []).map((cp: any) =>
        cp.crop_plan_id === crop_plan_id
          ? {
              ...cp,
              progress_pct: pct,
              current_stage_name: pct >= 100 ? '06. 수확 완료' : '04. 생육 관리',
              status_text: pct >= 100 ? '수확 완료 · 이력 반영' : '기후 연동 정상 생육중',
            }
          : cp
      );
      persistMyPage(mp);
      return jsonResponse({ ok: true, ...mp });
    }

    if (p === '/api/mypage/crops/delete' && method === 'POST') {
      const { crop_plan_id } = parseBody(init);
      const mp = (snap.mypage = snap.mypage || {});
      mp.cropPlans = (mp.cropPlans || []).filter((cp: any) => cp.crop_plan_id !== crop_plan_id);
      persistMyPage(mp);
      return jsonResponse({ ok: true, ...mp });
    }

    if (p === '/api/mypage/orders' && method === 'POST') {
      const body = parseBody(init);
      const mp = (snap.mypage = snap.mypage || {});
      const list = Array.isArray(mp.orders) ? [...mp.orders] : [];
      const newOrder = {
        order_no: body.orderNo || `ORD-${Date.now()}`,
        email: body.email || 'CloudBae@naver.com',
        ordered_at: body.orderedAt || new Date().toISOString().slice(0, 16).replace('T', ' '),
        purchase_title: body.purchaseTitle || '생육단계별 선택 농자재 일괄 구매',
        crop_title: body.cropTitle || '가을배추 (불암3호)',
        region_address: body.regionAddress || '충청북도 충주시 단월동',
        delivery_option: body.deliveryOption || 'STAGE_SCHEDULED',
        payment_method: body.paymentMethod || 'NONGHYUP_CARD',
        delivery_status: '결제완료 · 생육단계별 적기 맞춤 분할배송 예약됨',
        raw_total: Number(body.orderRawTotal) || 0,
        discount_amount: Number(body.orderDiscount) || 0,
        final_total: Number(body.orderFinalTotal) || 0,
        reward_points: Number(body.rewardPoints) || 0,
        orderItems: Array.isArray(body.orderItems) ? body.orderItems : [],
      };
      list.unshift(newOrder);
      mp.orders = list;
      persistMyPage(mp);
      return jsonResponse({ ok: true, ...mp });
    }

    // 4. 재배 일정 요청 및 제공 API
    if (p === '/api/member-schedule-requests') {
      return jsonResponse(snap.scheduleRequests || { items: [], total: 0 });
    }
    if (p === '/api/member-schedule-requests/save' && method === 'POST') {
      const body = parseBody(init);
      const sr = (snap.scheduleRequests = snap.scheduleRequests || { items: [], total: 0 });
      const list = Array.isArray(sr.items) ? [...sr.items] : [];
      const idx = list.findIndex((r) => r.request_no === body.request_no);
      if (idx >= 0) list[idx] = { ...list[idx], ...body };
      else list.unshift(body);
      sr.items = list;
      sr.total = list.length;
      return jsonResponse({ ok: true, item: body });
    }
    if (p === '/api/member-schedule-requests/delete' && method === 'POST') {
      const { request_no } = parseBody(init);
      const sr = (snap.scheduleRequests = snap.scheduleRequests || { items: [], total: 0 });
      sr.items = (sr.items || []).filter((r: any) => r.request_no !== request_no);
      sr.total = sr.items.length;
      return jsonResponse({ ok: true });
    }

    if (p === '/api/schedule-provision') {
      return jsonResponse(snap.scheduleProvision || {});
    }
    if (p === '/api/ templates' || p === '/api/templates') {
      return jsonResponse(snap.templates || { items: [] });
    }
    if (p === '/api/histories') {
      return jsonResponse(snap.histories || { requests: [], logs: [] });
    }
    if (p === '/api/prescriptions') {
      return jsonResponse(snap.prescriptions || { soilStandards: [], materials: [] });
    }
    if (p === '/api/weather') {
      return jsonResponse({
        stations: snap.overview?.stations || [],
        dailyData: [],
        corrections: [],
        syncLogs: [],
      });
    }

    // 5. 주소록 관리 (지번 주소 · 도로명 주소 · 회원 주소검색 · 법정동 주소)
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

    if (p === '/api/jibun-addresses') {
      const sido = (u.searchParams.get('sido') || '').trim();
      const sigungu = (u.searchParams.get('sigungu') || '').trim();
      const q = (u.searchParams.get('q') || '').trim().toLowerCase();
      const page = Math.max(1, Number(u.searchParams.get('page')) || 1);
      const pageSize = Math.max(1, Math.min(200, Number(u.searchParams.get('pageSize')) || 50));

      const { jibunList } = getRoadAndJibunCache();
      const filtered = jibunList.filter((it) => {
        if (sido && sido !== 'ALL' && it.sido !== sido) return false;
        if (sigungu && sigungu !== 'ALL' && it.sigungu !== sigungu) return false;
        if (q) {
          const hay = `${it.full_jibun_address} ${it.sido} ${it.sigungu} ${it.eupmyeondong} ${it.bjd_code} ${it.postal_code}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(page, totalPages);
      const items = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
      return jsonResponse({ items, total, page: safePage, pageSize, totalPages });
    }

    if (p === '/api/jibun-addresses/save' && method === 'POST') {
      const body = parseBody(init);
      const { jibunList } = getRoadAndJibunCache();
      const jibunNoStr =
        Number(body.jibun_sub_no) > 0
          ? `${body.jibun_main_no}-${body.jibun_sub_no}`
          : `${body.jibun_main_no || 100}`;
      const full_jibun_address = `${body.sido} ${body.sigungu} ${body.eupmyeondong}${
        body.ri_name ? ` ${body.ri_name}` : ''
      } ${jibunNoStr}`;
      const idx = jibunList.findIndex((x) => x.bjd_code === body.bjd_code);
      const item = { ...(idx >= 0 ? jibunList[idx] : {}), ...body, full_jibun_address };
      if (idx >= 0) jibunList[idx] = item;
      else jibunList.unshift(item);
      return jsonResponse({ ok: true });
    }

    if (p === '/api/jibun-addresses/delete' && method === 'POST') {
      const { bjd_code } = parseBody(init);
      const cache = getRoadAndJibunCache();
      cache.jibunList = cache.jibunList.filter((x) => x.bjd_code !== bjd_code);
      return jsonResponse({ ok: true });
    }

    if (p === '/api/road-addresses') {
      const sido = (u.searchParams.get('sido') || '').trim();
      const sigungu = (u.searchParams.get('sigungu') || '').trim();
      const q = (u.searchParams.get('q') || '').trim().toLowerCase();
      const page = Math.max(1, Number(u.searchParams.get('page')) || 1);
      const pageSize = Math.max(1, Math.min(200, Number(u.searchParams.get('pageSize')) || 50));

      const { roadList } = getRoadAndJibunCache();
      const filtered = roadList.filter((it) => {
        if (sido && sido !== 'ALL' && it.sido !== sido) return false;
        if (sigungu && sigungu !== 'ALL' && it.sigungu !== sigungu) return false;
        if (q) {
          const hay = `${it.full_road_address} ${it.road_name} ${it.building_name} ${it.sido} ${it.sigungu} ${it.eupmyeondong} ${it.road_code} ${it.postal_code}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(page, totalPages);
      const items = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
      return jsonResponse({ items, total, page: safePage, pageSize, totalPages });
    }

    if (p === '/api/road-addresses/save' && method === 'POST') {
      const body = parseBody(init);
      const { roadList } = getRoadAndJibunCache();
      const bldgNoStr =
        Number(body.building_sub_no) > 0
          ? `${body.building_main_no}-${body.building_sub_no}`
          : `${body.building_main_no || 10}`;
      const full_road_address = `${body.sido} ${body.sigungu} ${body.road_name} ${bldgNoStr} (${body.eupmyeondong}${
        body.building_name ? `, ${body.building_name}` : ''
      })`;
      const idx = roadList.findIndex((x) => x.road_code === body.road_code);
      const item = { ...(idx >= 0 ? roadList[idx] : {}), ...body, full_road_address };
      if (idx >= 0) roadList[idx] = item;
      else roadList.unshift(item);
      return jsonResponse({ ok: true });
    }

    if (p === '/api/road-addresses/delete' && method === 'POST') {
      const { road_code } = parseBody(init);
      const cache = getRoadAndJibunCache();
      cache.roadList = cache.roadList.filter((x) => x.road_code !== road_code);
      return jsonResponse({ ok: true });
    }

    if (p === '/api/member-address/search') {
      const q = (u.searchParams.get('q') || '').trim().toLowerCase();
      const limit = Math.max(1, Math.min(100, Number(u.searchParams.get('limit')) || 25));
      if (!q) return jsonResponse({ items: [], total: 0 });
      const { roadList, jibunList } = getRoadAndJibunCache();
      const jibunByBjd = new Map(jibunList.map((j) => [j.bjd_code, j]));
      const items: any[] = [];
      for (const r of roadList) {
        const j = jibunByBjd.get(r.bjd_code);
        const hay = `${r.full_road_address} ${j?.full_jibun_address || ''} ${r.road_name} ${r.eupmyeondong} ${r.sigungu} ${r.postal_code}`.toLowerCase();
        if (hay.includes(q)) {
          items.push({
            ...r,
            ri_name: j?.ri_name || '',
            jibun_main_no: j?.jibun_main_no || 100,
            jibun_sub_no: j?.jibun_sub_no || 0,
            full_jibun_address: j?.full_jibun_address || `${r.sido} ${r.sigungu} ${r.eupmyeondong} 100`,
          });
          if (items.length >= limit) break;
        }
      }
      return jsonResponse({ items, total: items.length });
    }

    if (p === '/api/payment-bank-accounts') {
      return jsonResponse(snap.paymentBankAccounts || { items: [] });
    }
    if (p === '/api/crop-growth-process-plans') {
      return jsonResponse(snap.cropGrowthPlans || { items: [] });
    }
    if (p === '/api/agro-recommendation-module') {
      return jsonResponse(snap.agroRecModule || {});
    }

    // 6. 설문조사 관리 (외부 /survey 참여 응답 수집 · 양식 수정 · 실시간 통계 산출)
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
        const parsedForms = rawForms ? JSON.parse(rawForms) : null;
        forms =
          Array.isArray(parsedForms) && parsedForms.length > 0
            ? parsedForms
            : Array.isArray(baseSurveys.forms)
            ? [...baseSurveys.forms]
            : [];
      } catch {
        forms = Array.isArray(baseSurveys.forms) ? [...baseSurveys.forms] : [];
      }
      try {
        const rawResps = localStorage.getItem(RESPS_KEY);
        const parsedResps = rawResps ? JSON.parse(rawResps) : null;
        if (Array.isArray(parsedResps)) {
          const baseList = Array.isArray(baseSurveys.responses) ? baseSurveys.responses : [];
          const seen = new Set<string>();
          responses = [];
          for (const item of [...parsedResps, ...baseList]) {
            const id = String(item?.response_id || '');
            if (id && !seen.has(id)) {
              seen.add(id);
              responses.push(item);
            }
          }
        } else {
          responses = Array.isArray(baseSurveys.responses) ? [...baseSurveys.responses] : [];
        }
      } catch {
        responses = Array.isArray(baseSurveys.responses) ? [...baseSurveys.responses] : [];
      }

      if (p === '/api/surveys/save') {
        try {
          const body = parseBody(init);
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
          const body = parseBody(init);
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
        const nextSeq = responses.length + 1;
        const todayYmd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        let respId = `RESP-${todayYmd}-${String(nextSeq).padStart(3, '0')}`;
        try {
          const body = parseBody(init);
          if (body.response_id) respId = String(body.response_id).trim();
          const surveyId = String(body.survey_id || 'SURV-HANFARM-2026').trim();
          const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
          const newResp = {
            response_id: respId,
            survey_id: surveyId,
            respondent_name: String(body.respondent_name || '익명 농업인').trim() || '익명 농업인',
            respondent_region: String(body.respondent_region || '').trim(),
            respondent_contact: String(body.respondent_contact || '').trim(),
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
            submitted_at: nowStr,
          };
          responses = [newResp, ...responses.filter((r) => r.response_id !== respId)];
          localStorage.setItem(RESPS_KEY, JSON.stringify(responses));
          if (snap.surveys) {
            snap.surveys.responses = responses;
          }
        } catch {
          // ignore
        }
        return jsonResponse({ ok: true, response_id: respId });
      }

      if (p === '/api/surveys/response/delete') {
        try {
          const body = parseBody(init);
          const targetRespId = String(body.response_id || '').trim();
          responses = responses.filter((r) => r.response_id !== targetRespId);
          localStorage.setItem(RESPS_KEY, JSON.stringify(responses));
          if (snap.surveys) {
            snap.surveys.responses = responses;
          }
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
        const totalParticipants = responses.filter(
          (r) => (r.survey_id || 'SURV-HANFARM-2026') === (found.survey_id || surveyId)
        ).length;
        return jsonResponse({
          ok: true,
          survey: {
            ...found,
            total_participants: totalParticipants,
          },
        });
      }

      // GET /api/surveys
      const surveyId = u.searchParams.get('survey_id') || '';
      const ageFilter = (u.searchParams.get('age') || 'ALL').trim();
      const scaleFilter = (u.searchParams.get('scale') || 'ALL').trim();
      const kw = (u.searchParams.get('q') || '').trim().toLowerCase();

      const activeSurvey =
        (surveyId && forms.find((f) => f.survey_id === surveyId)) ||
        forms[0] ||
        baseSurveys.activeSurvey ||
        null;
      const targetSurveyId = activeSurvey?.survey_id || 'SURV-HANFARM-2026';
      const allSurveyResponses = responses.filter(
        (r) => !r.survey_id || r.survey_id === targetSurveyId
      );

      const filteredResponses = allSurveyResponses.filter((r) => {
        if (ageFilter && ageFilter !== 'ALL' && r.q1_age !== ageFilter) return false;
        if (scaleFilter && scaleFilter !== 'ALL' && r.q2_scale !== scaleFilter) return false;
        if (kw) {
          const hay = [
            r.response_id,
            r.respondent_name,
            r.respondent_region,
            r.respondent_contact,
            r.q1_age,
            r.q2_scale,
            ...(Array.isArray(r.q3_crops) ? r.q3_crops : []),
            r.q3_other_text,
            r.q4_difficulty,
            r.q5_schedule_intent,
            r.q6_schedule_wtp,
            r.q7_ai_pest_intent,
            r.q8_bundle_wtp,
            r.q9_commerce_intent,
          ]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(kw)) return false;
        }
        return true;
      });

      const totalCount = allSurveyResponses.length;
      const questionsList: any[] = Array.isArray(activeSurvey?.questions)
        ? activeSurvey.questions
        : [];
      const questionStats = questionsList.map((qDef: any) => {
        const optionCounts = (qDef.options || []).map((opt: string) => {
          let cnt = 0;
          for (const r of allSurveyResponses) {
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
        const otherInputs =
          qDef.id === 'q3'
            ? allSurveyResponses
                .filter((r) => r.q3_other_text && String(r.q3_other_text).trim().length > 0)
                .map((r) => ({
                  response_id: r.response_id,
                  respondent_name: r.respondent_name,
                  text: r.q3_other_text,
                  submitted_at: r.submitted_at,
                }))
            : [];
        return {
          ...qDef,
          optionCounts,
          otherInputs,
        };
      });

      const positiveScheduleCount = allSurveyResponses.filter(
        (r) =>
          String(r.q5_schedule_intent).includes('반드시 이용') ||
          String(r.q5_schedule_intent).includes('이용할 의향 있음')
      ).length;
      const positiveAiPestCount = allSurveyResponses.filter(
        (r) =>
          String(r.q7_ai_pest_intent).includes('반드시 이용') ||
          String(r.q7_ai_pest_intent).includes('이용할 의향 있음')
      ).length;
      const paidBundleCount = allSurveyResponses.filter(
        (r) => r.q8_bundle_wtp && !String(r.q8_bundle_wtp).includes('무료일 때만 이용')
      ).length;
      const positiveCommerceCount = allSurveyResponses.filter(
        (r) =>
          String(r.q9_commerce_intent).includes('적극 이용') ||
          String(r.q9_commerce_intent).includes('필요할 때 이용')
      ).length;

      const formsWithCounts = forms.map((f) => {
        const fResps = responses.filter(
          (r) => (r.survey_id || 'SURV-HANFARM-2026') === f.survey_id
        );
        return {
          ...f,
          response_count: fResps.length,
          last_response_at: fResps[0]?.submitted_at || f.last_response_at || f.updated_at || '-',
        };
      });

      return jsonResponse({
        ...baseSurveys,
        ok: true,
        forms: formsWithCounts,
        activeSurvey: formsWithCounts.find((f) => f.survey_id === targetSurveyId) || activeSurvey,
        responses: filteredResponses,
        totalResponses: totalCount,
        filteredCount: filteredResponses.length,
        questionStats,
        kpi: {
          totalResponses: totalCount,
          positiveSchedulePct:
            totalCount > 0 ? Number(((positiveScheduleCount / totalCount) * 100).toFixed(1)) : 0,
          positiveAiPestPct:
            totalCount > 0 ? Number(((positiveAiPestCount / totalCount) * 100).toFixed(1)) : 0,
          paidBundlePct:
            totalCount > 0 ? Number(((paidBundleCount / totalCount) * 100).toFixed(1)) : 0,
          positiveCommercePct:
            totalCount > 0 ? Number(((positiveCommerceCount / totalCount) * 100).toFixed(1)) : 0,
        },
      });
    }

    // 7. 구매의향서 관리 API
    const INTENT_TPL_KEY = 'hanfarm_purchase_intent_template_v1';
    const INTENT_ENTRIES_KEY = 'hanfarm_purchase_intents_v1';

    if (p === '/api/purchase-intents') {
      let template = null;
      let entries = null;
      try {
        const rawTpl = localStorage.getItem(INTENT_TPL_KEY);
        if (rawTpl) template = JSON.parse(rawTpl);
        const rawEntries = localStorage.getItem(INTENT_ENTRIES_KEY);
        if (rawEntries) entries = JSON.parse(rawEntries);
      } catch {
        // ignore
      }
      return jsonResponse({ ok: true, template, entries });
    }

    if (p === '/api/purchase-intents/template') {
      try {
        const body = parseBody(init);
        const tpl = body.template || body;
        localStorage.setItem(INTENT_TPL_KEY, JSON.stringify(tpl));
      } catch {
        // ignore
      }
      return jsonResponse({ ok: true });
    }

    if (p === '/api/purchase-intents/entry') {
      try {
        const body = parseBody(init);
        const rawEntries = localStorage.getItem(INTENT_ENTRIES_KEY);
        const list: any[] = rawEntries ? JSON.parse(rawEntries) : [];
        const idx = list.findIndex((x) => x.intent_id === body.intent_id);
        if (idx >= 0) list[idx] = { ...list[idx], ...body };
        else list.unshift(body);
        localStorage.setItem(INTENT_ENTRIES_KEY, JSON.stringify(list));
      } catch {
        // ignore
      }
      return jsonResponse({ ok: true });
    }

    if (p === '/api/purchase-intents/entry/delete') {
      try {
        const { intent_id } = parseBody(init);
        const rawEntries = localStorage.getItem(INTENT_ENTRIES_KEY);
        const list: any[] = rawEntries ? JSON.parse(rawEntries) : [];
        localStorage.setItem(
          INTENT_ENTRIES_KEY,
          JSON.stringify(list.filter((x) => x.intent_id !== intent_id))
        );
      } catch {
        // ignore
      }
      return jsonResponse({ ok: true });
    }

    // 8. 기후 및 토양 API
    if (p === '/api/climate/dongs') return jsonResponse(snap.climateDongs || { dongs: [] });
    if (p === '/api/climate/daily') return jsonResponse(snap.climateDaily || { items: [] });
    if (p === '/api/climate-future/env-status') return jsonResponse(snap.climateFutureEnv || {});
    if (p === '/api/climate-future/daily') return jsonResponse(snap.climateFutureDaily || { items: [] });
    if (p === '/api/soil-surveys/env-status') return jsonResponse(snap.soilEnv || {});
    if (p === '/api/soil-surveys') return jsonResponse(snap.soilSurveys || { items: [] });

    return jsonResponse({ ok: true });
  };

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (!rawUrl.startsWith('/api/')) {
      return origFetch(input, init);
    }

    if (isStaticHost) {
      return handleStaticApi(rawUrl, init);
    }

    try {
      const res = await origFetch(input, init);
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        return res;
      }
      if (res.status >= 400 && ct.includes('application/json')) {
        return res;
      }
      return handleStaticApi(rawUrl, init);
    } catch {
      return handleStaticApi(rawUrl, init);
    }
  };

  function rewriteStaticAssets() {
    const base = getBasePath();
    document.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
      const rawSrc = img.getAttribute('src') || '';
      if (base && rawSrc.startsWith('/images/')) {
        img.setAttribute('src', `${base}${rawSrc}`);
      } else if (rawSrc.startsWith('/api/agro-materials/image/')) {
        const parts = rawSrc.split('/');
        const id = decodeURIComponent(parts[4] || 'FERT-PRD-01');
        const slot = (parts[5] || 'thumb').split('?')[0];
        const key = `${id}-${slot}`;
        const mapped = cachedImageMap[key] || `${key}.svg`;
        img.setAttribute('src', `${base}/static-api/images/${mapped}`);
      }
    });
    if (base) {
      document.querySelectorAll<HTMLAnchorElement>('a').forEach((a) => {
        const rawHref = a.getAttribute('href') || '';
        if (rawHref.startsWith('/docs/')) {
          a.setAttribute('href', `${base}${rawHref}`);
        }
      });
    }
  }

  if (isStaticHost) {
    void getSnapshot();
    const observer = new MutationObserver(() => rewriteStaticAssets());
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src'],
    });
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
