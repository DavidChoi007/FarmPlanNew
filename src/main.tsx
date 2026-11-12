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
  const DELETED_CAT_CODES_KEY = 'hanfarm_deleted_category_codes_v1';
  const CAT_PURGE_MIGRATION_KEY = 'hanfarm_cat_test_purged_v2';

  const getDeletedCatCodeSet = (): Set<string> => {
    try {
      const raw = localStorage.getItem(DELETED_CAT_CODES_KEY);
      if (!raw) return new Set();
      const arr = JSON.parse(raw);
      return new Set(Array.isArray(arr) ? arr.map(String) : []);
    } catch {
      return new Set();
    }
  };

  const markCatCodeDeleted = (table: string, code?: string, name?: string) => {
    try {
      const s = getDeletedCatCodeSet();
      const cleanCode = String(code || '').trim();
      const cleanName = String(name || '').trim();
      if (cleanCode) s.add(`${table}:${cleanCode}`);
      if (cleanName) s.add(`${table}:name:${cleanName}`);
      localStorage.setItem(DELETED_CAT_CODES_KEY, JSON.stringify([...s]));
    } catch {
      // ignore
    }
  };

  const unmarkCatCodeDeleted = (table: string, code?: string, name?: string) => {
    try {
      const s = getDeletedCatCodeSet();
      const cleanCode = String(code || '').trim();
      const cleanName = String(name || '').trim();
      let changed = false;
      if (cleanCode && s.delete(`${table}:${cleanCode}`)) changed = true;
      if (cleanName && s.delete(`${table}:name:${cleanName}`)) changed = true;
      if (changed) {
        localStorage.setItem(DELETED_CAT_CODES_KEY, JSON.stringify([...s]));
      }
    } catch {
      // ignore
    }
  };

  const filterOutDeletedCodes = (table: string, list: any[]): any[] => {
    if (!Array.isArray(list)) return [];
    const deletedSet = getDeletedCatCodeSet();
    return list.filter((c: any) => {
      const code = String(c?.category_code || c?.code || '').trim();
      const name = String(c?.category_name || c?.sub_type_name || c?.name || '').trim();
      if (!code && !name) return false;
      if (code && deletedSet.has(`${table}:${code}`)) return false;
      if (name && deletedSet.has(`${table}:name:${name}`)) return false;
      return true;
    });
  };

  try {
    if (!localStorage.getItem(CAT_PURGE_MIGRATION_KEY)) {
      markCatCodeDeleted('seed_category_code', 'CAT-SEED-06', 'test');
      markCatCodeDeleted('seedling_category_code', 'CAT-SDL-06', 'TEST');
      const savedRaw = localStorage.getItem(OVERVIEW_STORAGE_KEY);
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw);
        if (Array.isArray(parsed?.seedCategoryCodes)) {
          parsed.seedCategoryCodes = filterOutDeletedCodes('seed_category_code', parsed.seedCategoryCodes);
        }
        if (Array.isArray(parsed?.seedlingCategoryCodes)) {
          parsed.seedlingCategoryCodes = filterOutDeletedCodes('seedling_category_code', parsed.seedlingCategoryCodes);
        }
        localStorage.setItem(OVERVIEW_STORAGE_KEY, JSON.stringify(parsed));
      }
      localStorage.setItem(CAT_PURGE_MIGRATION_KEY, '1');
    }
  } catch {
    // ignore migration errors
  }

  const resolveFertilizerMainType = (
    subTypeOrCode?: string | null,
    explicitMainType?: string | null
  ): '천연비료' | '화학비료' => {
    const m = String(explicitMainType || '').trim();
    if (m === '천연비료' || m === '화학비료') return m;
    const s = String(subTypeOrCode || '').trim();
    if (
      s.includes('유기질') ||
      s.includes('퇴비') ||
      s.includes('토양개량') ||
      s.includes('칼슘') ||
      s.includes('규산') ||
      s === 'CAT-ORG-COMP' ||
      s === 'CAT-SOIL-CALC'
    ) {
      return '천연비료';
    }
    return '화학비료';
  };

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
              const defaultSeedCodes = data.overview.seedCategoryCodes;
              const defaultSeedlingCodes = data.overview.seedlingCategoryCodes;
              data.overview = { ...data.overview, ...parsedOv };
              if (!Array.isArray(data.overview.seedCategoryCodes) || data.overview.seedCategoryCodes.length === 0) {
                data.overview.seedCategoryCodes = defaultSeedCodes || [];
              }
              if (!Array.isArray(data.overview.seedlingCategoryCodes) || data.overview.seedlingCategoryCodes.length === 0) {
                data.overview.seedlingCategoryCodes = defaultSeedlingCodes || [];
              }
              data.overview.seedCategoryCodes = filterOutDeletedCodes('seed_category_code', data.overview.seedCategoryCodes);
              data.overview.seedlingCategoryCodes = filterOutDeletedCodes('seedling_category_code', data.overview.seedlingCategoryCodes);
              data.overview.fertilizerCategoryCodes = filterOutDeletedCodes('fertilizer_category_code', data.overview.fertilizerCategoryCodes || []);
              data.overview.nutrientCategoryCodes = filterOutDeletedCodes('nutrient_category_code', data.overview.nutrientCategoryCodes || []);
              data.overview.pesticideCategoryCodes = filterOutDeletedCodes('pesticide_category_code', data.overview.pesticideCategoryCodes || []);
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
          if (data?.overview && Array.isArray(data.overview.fertilizerCategoryCodes)) {
            const defaultOrder: Record<string, number> = {
              'CAT-ORG-COMP': 1,
              'CAT-SOIL-CALC': 2,
              'CAT-NPK-COMP': 3,
              'CAT-NK-TOP': 4,
              'CAT-CRF-SLOW': 5,
              'CAT-SINGLE-K': 6,
            };
            data.overview.fertilizerCategoryCodes = data.overview.fertilizerCategoryCodes
              .map((c: any) => {
                const key = c.category_code || c.code;
                const label = c.sub_type_name || c.category_name || c.name || key;
                return {
                  ...c,
                  main_type: resolveFertilizerMainType(label, c.main_type),
                  sort_order: defaultOrder[key] ?? Number(c.sort_order || 99),
                };
              })
              .sort((a: any, b: any) => Number(a.sort_order || 99) - Number(b.sort_order || 99));
          }
          if (data?.fertilizer) {
            if (Array.isArray(data.fertilizer.fertilizerCategories)) {
              const defaultOrder: Record<string, number> = {
                'CAT-ORG-COMP': 1,
                'CAT-SOIL-CALC': 2,
                'CAT-NPK-COMP': 3,
                'CAT-NK-TOP': 4,
                'CAT-CRF-SLOW': 5,
                'CAT-SINGLE-K': 6,
              };
              data.fertilizer.fertilizerCategories = data.fertilizer.fertilizerCategories
                .map((c: any) => {
                  const key = c.category_code || c.code;
                  const label = c.sub_type_name || c.category_name || c.name || key;
                  return {
                    ...c,
                    main_type: resolveFertilizerMainType(label, undefined),
                    sort_order: defaultOrder[key] ?? Number(c.sort_order || 99),
                  };
                })
                .sort((a: any, b: any) => Number(a.sort_order || 99) - Number(b.sort_order || 99));
            }
            if (Array.isArray(data.fertilizer.allItems)) {
              data.fertilizer.allItems = data.fertilizer.allItems.map((it: any) => ({
                ...it,
                main_type: resolveFertilizerMainType(it.sub_type || it.sub_type_name || it.sub_type_code, it.main_type),
              }));
            }
            if (Array.isArray(data.fertilizer.items)) {
              data.fertilizer.items = data.fertilizer.items.map((it: any) => ({
                ...it,
                main_type: resolveFertilizerMainType(it.sub_type || it.sub_type_name || it.sub_type_code, it.main_type),
              }));
            }
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

    const SB_URL = 'https://eaycjzvtlstijkucmbau.supabase.co';
    const SB_KEY =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheWNqenZ0bHN0aWprdWNtYmF1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzkxMjcwNSwiZXhwIjoyMTA5NDg4NzA1fQ.2MkDiCld3tG2rTNi3XVtIkRh9I96r06H5w_mo1IEwP4';
    const getKstNowStr = () =>
      new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');

    const sbSelect = async (table: string, query = 'select=*'): Promise<any[] | null> => {
      try {
        const r = await origFetch(`${SB_URL}/rest/v1/${table}?${query}`, {
          method: 'GET',
          headers: {
            apikey: SB_KEY,
            Authorization: `Bearer ${SB_KEY}`,
            Accept: 'application/json',
          },
          cache: 'no-store',
        });
        if (!r.ok) return null;
        const data = await r.json();
        return Array.isArray(data) ? data : null;
      } catch {
        return null;
      }
    };

    const sbUpsert = async (table: string, payload: Record<string, any>, onConflict: string) => {
      try {
        await origFetch(`${SB_URL}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
          method: 'POST',
          headers: {
            apikey: SB_KEY,
            Authorization: `Bearer ${SB_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=minimal',
          },
          body: JSON.stringify(payload),
        });
      } catch {
        // ignore network errors
      }
    };

    const sbDelete = async (table: string, filterQuery: string) => {
      try {
        await origFetch(`${SB_URL}/rest/v1/${table}?${filterQuery}`, {
          method: 'DELETE',
          headers: {
            apikey: SB_KEY,
            Authorization: `Bearer ${SB_KEY}`,
          },
        });
      } catch {
        // ignore network errors
      }
    };

    const normalizeCategoryCodeList = (
      rawList: any[],
      productItems: any[] = [],
      isFertilizer = false
    ) => {
      const items = Array.isArray(productItems) ? productItems : [];
      return (Array.isArray(rawList) ? rawList : [])
        .map((c: any, idx: number) => {
          const code = String(c.category_code || c.code || '').trim();
          const name = String(c.category_name || c.sub_type_name || c.name || code).trim();
          const desc = String(c.description ?? c.desc ?? '').trim();
          const sortOrder = Number(c.sort_order) || idx + 1;
          const matchedCount = items.filter(
            (it: any) =>
              (code && it.category_code === code) ||
              (name && (it.sub_type === name || it.sub_type_name === name))
          ).length;
          const productCount = items.length > 0 ? matchedCount : Number(c.product_count) || 0;
          const mainType = isFertilizer
            ? resolveFertilizerMainType(name || code, c.main_type)
            : c.main_type;
          return {
            ...c,
            category_code: code,
            category_name: name,
            description: desc,
            sort_order: sortOrder,
            product_count: productCount,
            code,
            name,
            desc,
            ...(mainType ? { main_type: mainType } : {}),
          };
        })
        .sort((a: any, b: any) => Number(a.sort_order || 99) - Number(b.sort_order || 99));
    };

    const bindAgroItemsToCategoryCodes = (items: any[], catCodeList: any[]) => {
      if (!Array.isArray(items)) return [];
      const byCode = new Map<string, string>();
      for (const c of Array.isArray(catCodeList) ? catCodeList : []) {
        const code = String(c.category_code || c.code || '').trim();
        const name = String(c.category_name || c.name || '').trim();
        if (code && name) byCode.set(code, name);
      }
      return items.map((it: any) => {
        const code = String(it?.category_code || '').trim();
        const boundName = code ? byCode.get(code) : undefined;
        if (boundName && (it.sub_type !== boundName || it.sub_type_name !== boundName)) {
          return { ...it, sub_type: boundName, sub_type_name: boundName };
        }
        return it;
      });
    };

    const mergeCategoryCodeSources = async (
      table: string,
      localList: any[],
      remoteList: any[] | null
    ): Promise<any[]> => {
      const deletedSet = getDeletedCatCodeSet();
      const safeLocal = filterOutDeletedCodes(table, localList);
      if (Array.isArray(remoteList)) {
        for (const r of remoteList) {
          const code = String(r?.category_code || r?.code || '').trim();
          const name = String(r?.category_name || r?.sub_type_name || r?.name || '').trim();
          if ((code && deletedSet.has(`${table}:${code}`)) || (name && deletedSet.has(`${table}:name:${name}`))) {
            if (code) {
              sbDelete(table, `category_code=eq.${encodeURIComponent(code)}`).catch(() => {});
            }
          }
        }
        const safeRemote = filterOutDeletedCodes(table, remoteList);
        if (safeRemote.length > 0) {
          return [...safeRemote].sort(
            (a: any, b: any) => Number(a.sort_order || 99) - Number(b.sort_order || 99)
          );
        }
      }
      return safeLocal;
    };

    const syncOverviewAndAgroCategories = async (pullFromSupabase = false) => {
      const ov = (snap.overview = snap.overview || {});
      try {
        const savedOvRaw = localStorage.getItem(OVERVIEW_STORAGE_KEY);
        if (savedOvRaw) {
          const parsedSavedOv = JSON.parse(savedOvRaw);
          if (Array.isArray(parsedSavedOv?.seedCategoryCodes)) {
            ov.seedCategoryCodes = filterOutDeletedCodes('seed_category_code', parsedSavedOv.seedCategoryCodes);
          }
          if (Array.isArray(parsedSavedOv?.seedlingCategoryCodes)) {
            ov.seedlingCategoryCodes = filterOutDeletedCodes('seedling_category_code', parsedSavedOv.seedlingCategoryCodes);
          }
          if (Array.isArray(parsedSavedOv?.fertilizerCategoryCodes)) {
            ov.fertilizerCategoryCodes = filterOutDeletedCodes('fertilizer_category_code', parsedSavedOv.fertilizerCategoryCodes);
          }
          if (Array.isArray(parsedSavedOv?.nutrientCategoryCodes)) {
            ov.nutrientCategoryCodes = filterOutDeletedCodes('nutrient_category_code', parsedSavedOv.nutrientCategoryCodes);
          }
          if (Array.isArray(parsedSavedOv?.pesticideCategoryCodes)) {
            ov.pesticideCategoryCodes = filterOutDeletedCodes('pesticide_category_code', parsedSavedOv.pesticideCategoryCodes);
          }
        }
      } catch {
        // ignore localStorage read errors
      }
      ov.seedCategoryCodes = filterOutDeletedCodes('seed_category_code', ov.seedCategoryCodes || snap.seed?.seedCategories || []);
      ov.seedlingCategoryCodes = filterOutDeletedCodes('seedling_category_code', ov.seedlingCategoryCodes || snap.seedling?.seedlingCategories || []);
      ov.fertilizerCategoryCodes = filterOutDeletedCodes('fertilizer_category_code', ov.fertilizerCategoryCodes || snap.fertilizer?.fertilizerCategories || []);
      ov.nutrientCategoryCodes = filterOutDeletedCodes('nutrient_category_code', ov.nutrientCategoryCodes || snap.nutrient?.nutrientCategories || []);
      ov.pesticideCategoryCodes = filterOutDeletedCodes('pesticide_category_code', ov.pesticideCategoryCodes || snap.pesticide?.pesticideCategories || []);

      if (pullFromSupabase) {
        try {
          const [sbSeedCats, sbSeedlingCats, sbFertCats, sbNutrCats, sbPestCats] = await Promise.all([
            sbSelect('seed_category_code', 'select=*&order=sort_order.asc'),
            sbSelect('seedling_category_code', 'select=*&order=sort_order.asc'),
            sbSelect('fertilizer_category_code', 'select=*&order=sort_order.asc'),
            sbSelect('nutrient_category_code', 'select=*&order=sort_order.asc'),
            sbSelect('pesticide_category_code', 'select=*&order=sort_order.asc'),
          ]);
          ov.seedCategoryCodes = await mergeCategoryCodeSources(
            'seed_category_code',
            ov.seedCategoryCodes || snap.seed?.seedCategories || [],
            sbSeedCats
          );
          ov.seedlingCategoryCodes = await mergeCategoryCodeSources(
            'seedling_category_code',
            ov.seedlingCategoryCodes || snap.seedling?.seedlingCategories || [],
            sbSeedlingCats
          );
          ov.fertilizerCategoryCodes = await mergeCategoryCodeSources(
            'fertilizer_category_code',
            ov.fertilizerCategoryCodes || snap.fertilizer?.fertilizerCategories || [],
            sbFertCats
          );
          ov.nutrientCategoryCodes = await mergeCategoryCodeSources(
            'nutrient_category_code',
            ov.nutrientCategoryCodes || snap.nutrient?.nutrientCategories || [],
            sbNutrCats
          );
          ov.pesticideCategoryCodes = await mergeCategoryCodeSources(
            'pesticide_category_code',
            ov.pesticideCategoryCodes || snap.pesticide?.pesticideCategories || [],
            sbPestCats
          );
        } catch {
          // ignore network errors
        }
      }

      if (snap.seed) {
        const rawSeedItems = Array.isArray(snap.seed.allItems)
          ? snap.seed.allItems
          : Array.isArray(snap.seed.items)
          ? snap.seed.items
          : [];
        const normSeedCats = normalizeCategoryCodeList(
          ov.seedCategoryCodes || snap.seed.seedCategories || [],
          rawSeedItems
        );
        const boundSeedItems = bindAgroItemsToCategoryCodes(rawSeedItems, normSeedCats);
        snap.seed.allItems = boundSeedItems;
        snap.seed.items = boundSeedItems;
        ov.seedCategoryCodes = normalizeCategoryCodeList(normSeedCats, boundSeedItems);
        snap.seed.seedCategories = ov.seedCategoryCodes;
        snap.seed.fertilizerCategories = ov.seedCategoryCodes;
        snap.seed.subTypes = ov.seedCategoryCodes.map((c: any) => c.category_name);
      }

      if (snap.seedling) {
        const rawSeedlingItems = Array.isArray(snap.seedling.allItems)
          ? snap.seedling.allItems
          : Array.isArray(snap.seedling.items)
          ? snap.seedling.items
          : [];
        const normSeedlingCats = normalizeCategoryCodeList(
          ov.seedlingCategoryCodes || snap.seedling.seedlingCategories || [],
          rawSeedlingItems
        );
        const boundSeedlingItems = bindAgroItemsToCategoryCodes(rawSeedlingItems, normSeedlingCats);
        snap.seedling.allItems = boundSeedlingItems;
        snap.seedling.items = boundSeedlingItems;
        ov.seedlingCategoryCodes = normalizeCategoryCodeList(normSeedlingCats, boundSeedlingItems);
        snap.seedling.seedlingCategories = ov.seedlingCategoryCodes;
        snap.seedling.fertilizerCategories = ov.seedlingCategoryCodes;
        snap.seedling.subTypes = ov.seedlingCategoryCodes.map((c: any) => c.category_name);
      }

      if (snap.fertilizer) {
        const rawFertItems = Array.isArray(snap.fertilizer.allItems)
          ? snap.fertilizer.allItems
          : Array.isArray(snap.fertilizer.items)
          ? snap.fertilizer.items
          : [];
        const normFertCats = normalizeCategoryCodeList(
          ov.fertilizerCategoryCodes || snap.fertilizer.fertilizerCategories || [],
          rawFertItems,
          true
        );
        const boundFertItems = bindAgroItemsToCategoryCodes(rawFertItems, normFertCats);
        snap.fertilizer.allItems = boundFertItems;
        snap.fertilizer.items = boundFertItems;
        ov.fertilizerCategoryCodes = normalizeCategoryCodeList(normFertCats, boundFertItems, true);
        snap.fertilizer.fertilizerCategories = ov.fertilizerCategoryCodes;
        snap.fertilizer.subTypes = ov.fertilizerCategoryCodes.map((c: any) => c.category_name);
      }

      if (snap.nutrient) {
        const rawNutrItems = Array.isArray(snap.nutrient.allItems)
          ? snap.nutrient.allItems
          : Array.isArray(snap.nutrient.items)
          ? snap.nutrient.items
          : [];
        const normNutrCats = normalizeCategoryCodeList(
          ov.nutrientCategoryCodes || snap.nutrient.nutrientCategories || [],
          rawNutrItems
        );
        const boundNutrItems = bindAgroItemsToCategoryCodes(rawNutrItems, normNutrCats);
        snap.nutrient.allItems = boundNutrItems;
        snap.nutrient.items = boundNutrItems;
        ov.nutrientCategoryCodes = normalizeCategoryCodeList(normNutrCats, boundNutrItems);
        snap.nutrient.nutrientCategories = ov.nutrientCategoryCodes;
        snap.nutrient.subTypes = ov.nutrientCategoryCodes.map((c: any) => c.category_name);
      }

      if (snap.pesticide) {
        const rawPestItems = Array.isArray(snap.pesticide.allItems)
          ? snap.pesticide.allItems
          : Array.isArray(snap.pesticide.items)
          ? snap.pesticide.items
          : [];
        const normPestCats = normalizeCategoryCodeList(
          ov.pesticideCategoryCodes || snap.pesticide.pesticideCategories || [],
          rawPestItems
        );
        const boundPestItems = bindAgroItemsToCategoryCodes(rawPestItems, normPestCats);
        snap.pesticide.allItems = boundPestItems;
        snap.pesticide.items = boundPestItems;
        ov.pesticideCategoryCodes = normalizeCategoryCodeList(normPestCats, boundPestItems);
        snap.pesticide.pesticideCategories = ov.pesticideCategoryCodes;
        snap.pesticide.subTypes = ov.pesticideCategoryCodes.map((c: any) => c.category_name);
      }

      persistOverview(ov);
      return ov;
    };

    // 1. 농자재 상품 조회·저장·삭제
    if (p === '/api/agro-materials') {
      await syncOverviewAndAgroCategories(true);
      const ov = snap.overview || {};
      const cat = (u.searchParams.get('category') || 'FERTILIZER').toUpperCase();
      const mainType = (u.searchParams.get('main_type') || u.searchParams.get('mainType') || '').trim();
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
          : cat === 'SEED'
          ? snap.seed
          : cat === 'SEEDLING'
          ? snap.seedling
          : snap.fertilizer;

      const activeCategoryCodeList: any[] =
        cat === 'NUTRIENT'
          ? ov.nutrientCategoryCodes || []
          : cat === 'PESTICIDE'
          ? ov.pesticideCategoryCodes || []
          : cat === 'SEED'
          ? ov.seedCategoryCodes || []
          : cat === 'SEEDLING'
          ? ov.seedlingCategoryCodes || []
          : ov.fertilizerCategoryCodes || [];

      const matchedCatObj =
        subType && subType !== 'ALL'
          ? activeCategoryCodeList.find(
              (c: any) =>
                c.category_name === subType || c.name === subType || c.category_code === subType || c.code === subType
            )
          : null;

      const allItems: any[] = Array.isArray(src?.allItems) ? src.allItems : Array.isArray(src?.items) ? src.items : [];
      const filtered = allItems.filter((it) => {
        if (cat === 'FERTILIZER' && mainType && mainType !== 'ALL') {
          const itemMain = resolveFertilizerMainType(it.sub_type || it.sub_type_name || it.sub_type_code, it.main_type);
          if (itemMain !== mainType) return false;
        }
        if (subType && subType !== 'ALL') {
          const matchesSubName = it.sub_type === subType || it.sub_type_name === subType || it.category_code === subType;
          const matchesCatCode = matchedCatObj && it.category_code && it.category_code === matchedCatObj.category_code;
          if (!matchesSubName && !matchesCatCode) return false;
        }
        if (isOrganicParam === '1' || isOrganicParam === 'true') {
          if (Number(it.is_organic) !== 1) return false;
        } else if (isOrganicParam === '0' || isOrganicParam === 'false') {
          if (Number(it.is_organic) !== 0) return false;
        }
        if (q) {
          const hay = `${it.product_name || ''} ${it.manufacturer || ''} ${it.material_id || ''} ${it.main_type || ''} ${it.sub_type || ''} ${it.sub_type_name || ''} ${it.target_crops || ''} ${it.target_nutrient_or_pest || ''} ${it.key_effect || ''}`.toLowerCase();
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
        subTypes: activeCategoryCodeList.map((c: any) => c.category_name || c.name),
        fertilizerCategories: ov.fertilizerCategoryCodes,
        nutrientCategories: ov.nutrientCategoryCodes,
        pesticideCategories: ov.pesticideCategoryCodes,
        seedCategories: ov.seedCategoryCodes,
        seedlingCategories: ov.seedlingCategoryCodes,
      });
    }

    if (p === '/api/agro-materials/save' && method === 'POST') {
      const body = parseBody(init);
      const cat = String(body.material_category || 'FERTILIZER').toUpperCase();
      if (cat === 'FERTILIZER') {
        body.main_type = resolveFertilizerMainType(body.sub_type || body.sub_type_code, body.main_type);
      }
      const src =
        cat === 'NUTRIENT'
          ? snap.nutrient
          : cat === 'PESTICIDE'
          ? snap.pesticide
          : cat === 'SEED'
          ? snap.seed
          : cat === 'SEEDLING'
          ? snap.seedling
          : snap.fertilizer;
      if (src) {
        const list: any[] = Array.isArray(src.allItems) ? src.allItems : Array.isArray(src.items) ? src.items : [];
        const idx = list.findIndex((x) => x.material_id === body.material_id);
        if (idx >= 0) list[idx] = { ...list[idx], ...body };
        else list.unshift(body);
        src.allItems = list;
        src.items = list;
      }
      await syncOverviewAndAgroCategories(false);
      return jsonResponse({ ok: true });
    }

    if (p === '/api/agro-materials/delete' && method === 'POST') {
      const { material_id } = parseBody(init);
      for (const src of [snap.fertilizer, snap.nutrient, snap.pesticide, snap.seed, snap.seedling]) {
        if (src && Array.isArray(src.allItems)) {
          src.allItems = src.allItems.filter((x: any) => x.material_id !== material_id);
          src.items = src.allItems;
        }
      }
      await syncOverviewAndAgroCategories(false);
      return jsonResponse({ ok: true });
    }

    // 2. 기초코드 및 전체 Overview API
    if (p === '/api/overview') {
      const ov = await syncOverviewAndAgroCategories(true);
      return jsonResponse(ov || {});
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

    if (p === '/api/fertilizer-category-codes' && method === 'GET') {
      const ov = await syncOverviewAndAgroCategories(true);
      return jsonResponse({ items: ov.fertilizerCategoryCodes || [] });
    }

    if (p === '/api/fertilizer-category-codes' && method === 'POST') {
      const body = parseBody(init);
      const ov = (snap.overview = snap.overview || {});
      const list: any[] = Array.isArray(ov.fertilizerCategoryCodes) ? [...ov.fertilizerCategoryCodes] : [];
      const idx = list.findIndex((c) => c.category_code === body.category_code);
      const item = {
        ...(idx >= 0 ? list[idx] : {}),
        ...body,
        main_type: resolveFertilizerMainType(body.sub_type_name || body.category_name || body.category_code, body.main_type),
        sort_order: Number(body.sort_order) || (idx >= 0 ? list[idx].sort_order : list.length + 1),
        _updatedAt: Date.now(),
      };
      if (idx >= 0) list[idx] = item;
      else list.push(item);
      ov.fertilizerCategoryCodes = list;
      unmarkCatCodeDeleted('fertilizer_category_code', item.category_code, item.category_name);
      await sbUpsert(
        'fertilizer_category_code',
        {
          category_code: item.category_code,
          category_name: item.category_name || item.sub_type_name || item.category_code,
          description: item.description || '',
          sort_order: Number(item.sort_order) || 1,
        },
        'category_code'
      );
      persistOverview(ov);
      await syncOverviewAndAgroCategories(false);
      return jsonResponse({ ok: true });
    }

    if (p === '/api/fertilizer-category-codes/delete' && method === 'POST') {
      const { category_code, category_name } = parseBody(init);
      const ov = (snap.overview = snap.overview || {});
      const targetItem = (ov.fertilizerCategoryCodes || []).find(
        (c: any) => (c.category_code || c.code) === category_code
      );
      const targetName = category_name || targetItem?.category_name || targetItem?.sub_type_name || targetItem?.name || '';
      markCatCodeDeleted('fertilizer_category_code', category_code, targetName);
      const keepFilter = (c: any) =>
        (c?.category_code || c?.code) !== category_code &&
        (!targetName || (c?.category_name || c?.sub_type_name || c?.name) !== targetName);
      ov.fertilizerCategoryCodes = (ov.fertilizerCategoryCodes || []).filter(keepFilter);
      if (snap.fertilizer && Array.isArray(snap.fertilizer.fertilizerCategories)) {
        snap.fertilizer.fertilizerCategories = snap.fertilizer.fertilizerCategories.filter(keepFilter);
      }
      await sbDelete('fertilizer_category_code', `category_code=eq.${encodeURIComponent(category_code)}`);
      if (targetName) {
        await sbDelete('fertilizer_category_code', `category_name=eq.${encodeURIComponent(targetName)}`);
      }
      persistOverview(ov);
      await syncOverviewAndAgroCategories(true);
      return jsonResponse({ ok: true });
    }

    if (p === '/api/nutrient-category-codes' && method === 'GET') {
      const ov = await syncOverviewAndAgroCategories(true);
      return jsonResponse({ items: ov.nutrientCategoryCodes || [] });
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
        _updatedAt: Date.now(),
      };
      if (idx >= 0) list[idx] = item;
      else list.push(item);
      ov.nutrientCategoryCodes = list;
      unmarkCatCodeDeleted('nutrient_category_code', item.category_code, item.category_name);
      await sbUpsert(
        'nutrient_category_code',
        {
          category_code: item.category_code,
          category_name: item.category_name || item.category_code,
          description: item.description || '',
          sort_order: Number(item.sort_order) || 1,
        },
        'category_code'
      );
      persistOverview(ov);
      await syncOverviewAndAgroCategories(false);
      return jsonResponse({ ok: true });
    }

    if (p === '/api/nutrient-category-codes/delete' && method === 'POST') {
      const { category_code, category_name } = parseBody(init);
      const ov = (snap.overview = snap.overview || {});
      const targetItem = (ov.nutrientCategoryCodes || []).find(
        (c: any) => (c.category_code || c.code) === category_code
      );
      const targetName = category_name || targetItem?.category_name || targetItem?.name || '';
      markCatCodeDeleted('nutrient_category_code', category_code, targetName);
      const keepFilter = (c: any) =>
        (c?.category_code || c?.code) !== category_code &&
        (!targetName || (c?.category_name || c?.name) !== targetName);
      ov.nutrientCategoryCodes = (ov.nutrientCategoryCodes || []).filter(keepFilter);
      if (snap.nutrient && Array.isArray(snap.nutrient.nutrientCategories)) {
        snap.nutrient.nutrientCategories = snap.nutrient.nutrientCategories.filter(keepFilter);
      }
      await sbDelete('nutrient_category_code', `category_code=eq.${encodeURIComponent(category_code)}`);
      if (targetName) {
        await sbDelete('nutrient_category_code', `category_name=eq.${encodeURIComponent(targetName)}`);
      }
      persistOverview(ov);
      await syncOverviewAndAgroCategories(true);
      return jsonResponse({ ok: true });
    }

    if (p === '/api/pesticide-category-codes' && method === 'GET') {
      const ov = await syncOverviewAndAgroCategories(true);
      return jsonResponse({ items: ov.pesticideCategoryCodes || [] });
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
        _updatedAt: Date.now(),
      };
      if (idx >= 0) list[idx] = item;
      else list.push(item);
      ov.pesticideCategoryCodes = list;
      unmarkCatCodeDeleted('pesticide_category_code', item.category_code, item.category_name);
      await sbUpsert(
        'pesticide_category_code',
        {
          category_code: item.category_code,
          category_name: item.category_name || item.category_code,
          description: item.description || '',
          sort_order: Number(item.sort_order) || 1,
        },
        'category_code'
      );
      persistOverview(ov);
      await syncOverviewAndAgroCategories(false);
      return jsonResponse({ ok: true });
    }

    if (p === '/api/pesticide-category-codes/delete' && method === 'POST') {
      const { category_code, category_name } = parseBody(init);
      const ov = (snap.overview = snap.overview || {});
      const targetItem = (ov.pesticideCategoryCodes || []).find(
        (c: any) => (c.category_code || c.code) === category_code
      );
      const targetName = category_name || targetItem?.category_name || targetItem?.name || '';
      markCatCodeDeleted('pesticide_category_code', category_code, targetName);
      const keepFilter = (c: any) =>
        (c?.category_code || c?.code) !== category_code &&
        (!targetName || (c?.category_name || c?.name) !== targetName);
      ov.pesticideCategoryCodes = (ov.pesticideCategoryCodes || []).filter(keepFilter);
      if (snap.pesticide && Array.isArray(snap.pesticide.pesticideCategories)) {
        snap.pesticide.pesticideCategories = snap.pesticide.pesticideCategories.filter(keepFilter);
      }
      await sbDelete('pesticide_category_code', `category_code=eq.${encodeURIComponent(category_code)}`);
      if (targetName) {
        await sbDelete('pesticide_category_code', `category_name=eq.${encodeURIComponent(targetName)}`);
      }
      persistOverview(ov);
      await syncOverviewAndAgroCategories(true);
      return jsonResponse({ ok: true });
    }

    if (p === '/api/seed-category-codes' && method === 'GET') {
      const ov = await syncOverviewAndAgroCategories(true);
      return jsonResponse({ items: ov.seedCategoryCodes || [] });
    }

    if (p === '/api/seed-category-codes' && method === 'POST') {
      const body = parseBody(init);
      const ov = (snap.overview = snap.overview || {});
      const list: any[] = Array.isArray(ov.seedCategoryCodes) ? [...ov.seedCategoryCodes] : [];
      const idx = list.findIndex((c) => c.category_code === body.category_code);
      const prevName = idx >= 0 ? list[idx].category_name || list[idx].name : '';
      const item = {
        ...(idx >= 0 ? list[idx] : {}),
        ...body,
        sort_order: Number(body.sort_order) || (idx >= 0 ? list[idx].sort_order : list.length + 1),
        _updatedAt: Date.now(),
      };
      if (idx >= 0) list[idx] = item;
      else list.push(item);
      ov.seedCategoryCodes = list;
      unmarkCatCodeDeleted('seed_category_code', item.category_code, item.category_name);
      if (snap.seed && Array.isArray(snap.seed.allItems) && body.category_name) {
        snap.seed.allItems = snap.seed.allItems.map((it: any) =>
          it.category_code === body.category_code || (prevName && it.sub_type === prevName)
            ? { ...it, category_code: body.category_code, sub_type: body.category_name, sub_type_name: body.category_name }
            : it
        );
        snap.seed.items = snap.seed.allItems;
      }
      await sbUpsert(
        'seed_category_code',
        {
          category_code: item.category_code,
          category_name: item.category_name || item.category_code,
          description: item.description || '',
          sort_order: Number(item.sort_order) || 1,
        },
        'category_code'
      );
      persistOverview(ov);
      await syncOverviewAndAgroCategories(false);
      return jsonResponse({ ok: true });
    }

    if (p === '/api/seed-category-codes/delete' && method === 'POST') {
      const { category_code, category_name } = parseBody(init);
      const ov = (snap.overview = snap.overview || {});
      const targetItem = (ov.seedCategoryCodes || []).find(
        (c: any) => (c.category_code || c.code) === category_code
      );
      const targetName = category_name || targetItem?.category_name || targetItem?.name || '';
      markCatCodeDeleted('seed_category_code', category_code, targetName);
      const keepFilter = (c: any) =>
        (c?.category_code || c?.code) !== category_code &&
        (!targetName || (c?.category_name || c?.name) !== targetName);
      ov.seedCategoryCodes = (ov.seedCategoryCodes || []).filter(keepFilter);
      if (snap.seed && Array.isArray(snap.seed.seedCategories)) {
        snap.seed.seedCategories = snap.seed.seedCategories.filter(keepFilter);
      }
      await sbDelete('seed_category_code', `category_code=eq.${encodeURIComponent(category_code)}`);
      if (targetName) {
        await sbDelete('seed_category_code', `category_name=eq.${encodeURIComponent(targetName)}`);
      }
      persistOverview(ov);
      await syncOverviewAndAgroCategories(true);
      return jsonResponse({ ok: true });
    }

    if (p === '/api/seedling-category-codes' && method === 'GET') {
      const ov = await syncOverviewAndAgroCategories(true);
      return jsonResponse({ items: ov.seedlingCategoryCodes || [] });
    }

    if (p === '/api/seedling-category-codes' && method === 'POST') {
      const body = parseBody(init);
      const ov = (snap.overview = snap.overview || {});
      const list: any[] = Array.isArray(ov.seedlingCategoryCodes) ? [...ov.seedlingCategoryCodes] : [];
      const idx = list.findIndex((c) => c.category_code === body.category_code);
      const prevName = idx >= 0 ? list[idx].category_name || list[idx].name : '';
      const item = {
        ...(idx >= 0 ? list[idx] : {}),
        ...body,
        sort_order: Number(body.sort_order) || (idx >= 0 ? list[idx].sort_order : list.length + 1),
        _updatedAt: Date.now(),
      };
      if (idx >= 0) list[idx] = item;
      else list.push(item);
      ov.seedlingCategoryCodes = list;
      unmarkCatCodeDeleted('seedling_category_code', item.category_code, item.category_name);
      if (snap.seedling && Array.isArray(snap.seedling.allItems) && body.category_name) {
        snap.seedling.allItems = snap.seedling.allItems.map((it: any) =>
          it.category_code === body.category_code || (prevName && it.sub_type === prevName)
            ? { ...it, category_code: body.category_code, sub_type: body.category_name, sub_type_name: body.category_name }
            : it
        );
        snap.seedling.items = snap.seedling.allItems;
      }
      await sbUpsert(
        'seedling_category_code',
        {
          category_code: item.category_code,
          category_name: item.category_name || item.category_code,
          description: item.description || '',
          sort_order: Number(item.sort_order) || 1,
        },
        'category_code'
      );
      persistOverview(ov);
      await syncOverviewAndAgroCategories(false);
      return jsonResponse({ ok: true });
    }

    if (p === '/api/seedling-category-codes/delete' && method === 'POST') {
      const { category_code, category_name } = parseBody(init);
      const ov = (snap.overview = snap.overview || {});
      const targetItem = (ov.seedlingCategoryCodes || []).find(
        (c: any) => (c.category_code || c.code) === category_code
      );
      const targetName = category_name || targetItem?.category_name || targetItem?.name || '';
      markCatCodeDeleted('seedling_category_code', category_code, targetName);
      const keepFilter = (c: any) =>
        (c?.category_code || c?.code) !== category_code &&
        (!targetName || (c?.category_name || c?.name) !== targetName);
      ov.seedlingCategoryCodes = (ov.seedlingCategoryCodes || []).filter(keepFilter);
      if (snap.seedling && Array.isArray(snap.seedling.seedlingCategories)) {
        snap.seedling.seedlingCategories = snap.seedling.seedlingCategories.filter(keepFilter);
      }
      await sbDelete('seedling_category_code', `category_code=eq.${encodeURIComponent(category_code)}`);
      if (targetName) {
        await sbDelete('seedling_category_code', `category_name=eq.${encodeURIComponent(targetName)}`);
      }
      persistOverview(ov);
      await syncOverviewAndAgroCategories(true);
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

    const cascadeDeleteScheduleData = (params: {
      crop_plan_id?: string;
      request_no?: string;
      display_request_no?: string;
    }) => {
      const mp = (snap.mypage = snap.mypage || {});
      const sr = (snap.scheduleRequests = snap.scheduleRequests || { items: [], total: 0 });
      const matchedCropPlan = (mp.cropPlans || []).find(
        (cp: any) =>
          (params.crop_plan_id && cp.crop_plan_id === params.crop_plan_id) ||
          (params.request_no && cp.request_no === params.request_no)
      );
      const targetReqNos = Array.from(
        new Set(
          [
            params.request_no,
            params.display_request_no,
            matchedCropPlan?.request_no,
          ].filter(Boolean)
        )
      ) as string[];
      const targetPlanIds = Array.from(
        new Set([params.crop_plan_id, matchedCropPlan?.crop_plan_id].filter(Boolean))
      ) as string[];

      // 1. 마이페이지 재배작물 플랜 리스트 삭제
      mp.cropPlans = (mp.cropPlans || []).filter(
        (cp: any) =>
          !targetPlanIds.includes(cp.crop_plan_id) && !targetReqNos.includes(cp.request_no)
      );
      persistMyPage(mp);

      // 2. 재배일정 요청 리스트 삭제
      sr.items = (sr.items || []).filter(
        (r: any) =>
          !targetReqNos.includes(r.request_no) && !targetPlanIds.includes(r.crop_plan_id)
      );
      sr.total = sr.items.length;

      // 3. 재배일정 제공(scheduleProvision) 내 요청 목록 삭제
      if (snap.scheduleProvision && Array.isArray(snap.scheduleProvision.allRequests)) {
        snap.scheduleProvision.allRequests = snap.scheduleProvision.allRequests.filter(
          (r: any) => !targetReqNos.includes(r.request_no)
        );
      }

      // 4. 재배이력(histories) 내 요청 및 이력 로그 삭제
      if (snap.histories) {
        if (Array.isArray(snap.histories.requests)) {
          snap.histories.requests = snap.histories.requests.filter(
            (r: any) => !targetReqNos.includes(r.request_id) && !targetReqNos.includes(r.request_no)
          );
        }
        if (Array.isArray(snap.histories.logs)) {
          snap.histories.logs = snap.histories.logs.filter(
            (l: any) => !targetReqNos.includes(l.request_id)
          );
        }
      }

      // 5. localStorage 내 연관 추천 제품·추천 근거 DB 및 커스텀 일정 데이터 삭제 + 영구 삭제 키 기록
      try {
        const recDbKey = 'hanfarm_schedule_stage_recommendations_db_v1';
        const recDb = JSON.parse(localStorage.getItem(recDbKey) || '{}');
        [...targetReqNos, ...targetPlanIds].forEach((k) => {
          delete recDb[k];
        });
        localStorage.setItem(recDbKey, JSON.stringify(recDb));

        const customKey = 'hanfarm_custom_schedule_items_v1';
        const customDb = JSON.parse(localStorage.getItem(customKey) || '{}');
        [...targetReqNos, ...targetPlanIds].forEach((k) => {
          delete customDb[k];
        });
        localStorage.setItem(customKey, JSON.stringify(customDb));

        const delKey = 'hanfarm_deleted_schedule_keys_v1';
        const prevDeleted: string[] = JSON.parse(localStorage.getItem(delKey) || '[]');
        const nextDeleted = Array.from(
          new Set([...prevDeleted, ...targetReqNos, ...targetPlanIds])
        );
        localStorage.setItem(delKey, JSON.stringify(nextDeleted));
      } catch {
        // ignore storage errors
      }

      return { mp, targetReqNos, targetPlanIds };
    };

    if (p === '/api/mypage/crops/delete' && method === 'POST') {
      const body = parseBody(init);
      const { mp, targetReqNos, targetPlanIds } = cascadeDeleteScheduleData(body);
      return jsonResponse({
        ok: true,
        deleted_request_nos: targetReqNos,
        deleted_crop_plan_ids: targetPlanIds,
        ...mp,
      });
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
      const body = parseBody(init);
      const { targetReqNos, targetPlanIds } = cascadeDeleteScheduleData(body);
      return jsonResponse({
        ok: true,
        deleted_request_nos: targetReqNos,
        deleted_crop_plan_ids: targetPlanIds,
      });
    }

    if (p === '/api/schedule-provision') {
      const baseProv = JSON.parse(JSON.stringify(snap.scheduleProvision || {}));
      const reqNoParam = (u.searchParams.get('request_no') || '').trim();
      const allReqList: any[] = Array.isArray(snap.scheduleRequests?.items)
        ? snap.scheduleRequests.items
        : Array.isArray(baseProv.allRequests)
        ? baseProv.allRequests
        : [];
      const matchedReq = reqNoParam
        ? allReqList.find((r: any) => r.request_no === reqNoParam)
        : null;
      if (matchedReq) {
        baseProv.activeRequest = {
          ...(baseProv.activeRequest || {}),
          ...matchedReq,
        };
      }
      const activeReq = baseProv.activeRequest || {};
      const safeAreaPyeong = Math.max(10, Number(activeReq.area_pyeong || 300));
      const areaRatio = Number((safeAreaPyeong / 100).toFixed(2));
      const regionLabel =
        [activeReq.sido, activeReq.sigungu, activeReq.eupmyeondong].filter(Boolean).join(' ') ||
        '충청북도 충주시 단월동';

      const normalizeStageSingleMaterial = (it: any) => {
        const rawMats: any[] = Array.isArray(it?.materials) ? it.materials : [];
        if (rawMats.length === 0) return [];
        const sorted = [...rawMats].sort(
          (a, b) => Number(b?.match_score || 90) - Number(a?.match_score || 90)
        );
        const top = { ...sorted[0] };
        const secondScore = sorted[1]?.match_score;
        const cat = String(top.material_category || 'FERTILIZER').toUpperCase();
        const unitSpecStr = String(
          top.unit_spec || (cat === 'FERTILIZER' ? '20kg/포' : '500ml/병')
        );
        const unitMatch = unitSpecStr.match(/(포|병|봉|통|팩|판|박스|개|롤)/);
        const unitLabel = unitMatch ? unitMatch[1] : cat === 'FERTILIZER' ? '포' : '병';

        let baseUnitsPer100 = Number(top.base_units_per_100pyeong || 0);
        if (!(baseUnitsPer100 > 0)) {
          const dosageStr = String(top.dosage_per_100pyeong || '');
          const rMatch = dosageStr.match(
            /(\d+(?:\.\d+)?)\s*[~~-]\s*(\d+(?:\.\d+)?)\s*(포|병|봉|통|팩|개)/
          );
          const sMatch = dosageStr.match(/(\d+(?:\.\d+)?)\s*(포|병|봉|통|팩|개)/);
          if (rMatch) {
            baseUnitsPer100 = Number(((Number(rMatch[1]) + Number(rMatch[2])) / 2).toFixed(1));
          } else if (sMatch && Number(sMatch[1]) > 0 && Number(sMatch[1]) <= 15) {
            baseUnitsPer100 = Number(sMatch[1]);
          } else {
            baseUnitsPer100 = cat === 'FERTILIZER' ? 1.5 : 0.5;
          }
        }

        const rawNeeded = Number(((safeAreaPyeong / 100) * baseUnitsPer100).toFixed(2));
        const recommendedQty = Math.max(1, Math.ceil(rawNeeded));
        const unitPrice = Number(top.unit_price || 15000);
        const totalCost = recommendedQty * unitPrice;
        const finalScore = Number(top.match_score || 96);
        const stageTitle = String(it.sub_item_name || it.process_name || '해당 생육과정');

        const quantityCalcFormula = `재배지 ${safeAreaPyeong.toLocaleString()}평 ÷ 100평(${areaRatio}배) × 100평당 기준 ${baseUnitsPer100}${unitLabel} = 산출 ${rawNeeded}${unitLabel} → 포장단위 올림 총 ${recommendedQty}${unitLabel}(${unitSpecStr}) 필요`;
        const rationaleStage =
          top.rationale_stage ||
          `[${stageTitle}] 공정 생리 목표 달성을 위한 핵심 성분(${
            top.target_nutrient_or_pest || top.nutrient_ratio_summary || '맞춤 유효성분'
          }) 기준에 최적 부합합니다.`;
        const rationaleSoil =
          top.rationale_soil ||
          `${regionLabel} 토양검정 화학성(pH·유기물·유효인산·치환성 양이온) 진단 결과에 맞춰 양분 균형과 흡수율을 보정합니다.`;
        const rationaleClimate =
          top.rationale_climate ||
          `해당 시기 예상 기온·습도 기상 여건 및 PLS 안전사용기준을 충족하여 약해 없이 안정적인 효과를 발휘합니다.`;
        const rationaleDosage = `재배지 면적 ${safeAreaPyeong.toLocaleString()}평 기준: 100평당 기준량(${baseUnitsPer100}${unitLabel} · ${
          top.dosage_per_100pyeong || '정량 희석 살포'
        }) × 면적비율(${areaRatio}배) = ${rawNeeded}${unitLabel} 산출 → 총 ${recommendedQty}${unitLabel}(${unitSpecStr}) 필요 (예상금액 ${totalCost.toLocaleString()}원)`;

        const rationaleBullets = [
          `• [최고 추천점수 1종 선정 (${finalScore}점)] '${stageTitle}' 생육과정 후보 자재(${Math.max(
            rawMats.length,
            Number(top.candidate_pool_size || 4)
          )}종 평가${secondScore ? `, 차순위 ${secondScore}점` : ''}) 중 추천점수 1위(${finalScore}점)로 선정된 핵심 1종 제품입니다.`,
          `• [생육과정 필수 요구성분·기능 부합] ${rationaleStage}`,
          `• [토양검정 화학성 맞춤 보정] ${rationaleSoil}`,
          `• [지역 기후·PLS 안전기준 적합성] ${rationaleClimate}`,
          `• [재배지 평수(${safeAreaPyeong.toLocaleString()}평) 기반 필요 갯수 산출] ${rationaleDosage}`,
        ];

        return [
          {
            ...top,
            match_score: finalScore,
            unit_spec: unitSpecStr,
            unit_label: unitLabel,
            unit_price: unitPrice,
            area_pyeong: safeAreaPyeong,
            area_ratio: areaRatio,
            base_units_per_100pyeong: baseUnitsPer100,
            raw_needed_units: rawNeeded,
            recommended_qty: recommendedQty,
            total_cost: totalCost,
            quantity_calc_formula: quantityCalcFormula,
            recommended_for_area: `재배지 ${safeAreaPyeong.toLocaleString()}평 계산: 총 ${recommendedQty}${unitLabel}(${unitSpecStr}) 필요 (100평당 ${baseUnitsPer100}${unitLabel} × ${areaRatio}배 산출 · 권장 구매 ${recommendedQty}개)`,
            rationale_top1: rationaleBullets[0].replace(/^•\s*/, ''),
            rationale_stage: rationaleStage,
            rationale_soil: rationaleSoil,
            rationale_climate: rationaleClimate,
            rationale_dosage: rationaleDosage,
            rationale_bullets: rationaleBullets,
            selection_rationale: rationaleBullets.join('\n'),
            is_top1_recommended: true,
          },
        ];
      };

      if (Array.isArray(baseProv.scheduleItems)) {
        baseProv.scheduleItems = baseProv.scheduleItems.map((it: any) => ({
          ...it,
          materials: normalizeStageSingleMaterial(it),
        }));
      }
      if (Array.isArray(baseProv.stageGroups)) {
        const byItemId = new Map<string, any>();
        (baseProv.scheduleItems || []).forEach((it: any) => byItemId.set(it.item_id, it));
        baseProv.stageGroups = baseProv.stageGroups.map((grp: any) => ({
          ...grp,
          items: Array.isArray(grp.items)
            ? grp.items.map((gi: any) => byItemId.get(gi.item_id) || {
                ...gi,
                materials: normalizeStageSingleMaterial(gi),
              })
            : [],
        }));
      }

      try {
        const dbKey = 'hanfarm_schedule_stage_recommendations_db_v1';
        const prevDb = JSON.parse(localStorage.getItem(dbKey) || '{}');
        const reqKey = String(activeReq.request_no || 'REQ-DEFAULT');
        prevDb[reqKey] = (baseProv.scheduleItems || []).map((it: any) => ({
          request_no: reqKey,
          item_id: it.item_id,
          process_code: it.process_code,
          stage_group_name: it.stage_group_name,
          sub_item_name: it.sub_item_name,
          area_pyeong: safeAreaPyeong,
          recommended_material: it.materials?.[0] || null,
          updated_at: new Date().toISOString(),
        }));
        localStorage.setItem(dbKey, JSON.stringify(prevDb));
      } catch {
        // ignore storage quota errors
      }

      return jsonResponse(baseProv);
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

    // 6. 설문조사 관리 (외부 /survey 참여 응답 수집 · 양식 수정 · 실시간 통계 산출 · Supabase 클라우드 실시간 동기화)
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

      const normalizeFormItem = (raw: any) => {
        if (!raw || typeof raw !== 'object') return raw;
        let questions = Array.isArray(raw.questions) && raw.questions.length > 0 ? raw.questions : [];
        if (questions.length === 0 && typeof raw.questions_json === 'string' && raw.questions_json.trim()) {
          try {
            const parsed = JSON.parse(raw.questions_json);
            if (Array.isArray(parsed)) questions = parsed;
          } catch {
            // ignore
          }
        }
        return {
          ...raw,
          survey_id: String(raw.survey_id || 'SURV-HANFARM-2026').trim(),
          title: String(raw.title || '한팜 맞춤형 재배관리 서비스 수요조사').trim(),
          greeting_text: String(raw.greeting_text || '안녕하세요.').trim(),
          intro_text: String(
            raw.intro_text ||
              '한팜(HANFARM)은 농업인이 보다 쉽고 효율적으로 작물을 재배할 수 있도록 맞춤형 재배일정 및 AI 병해충 진단 서비스를 개발하고 있습니다.'
          ).trim(),
          duration_text: String(
            raw.duration_text ||
              '본 설문은 서비스 개발과 적정 구독료 설정을 위한 조사이며, 약 2~3분 정도 소요됩니다.'
          ).trim(),
          notice_text: String(
            raw.notice_text ||
              '※ 본 설문은 맞춤형 재배일정과 AI 병해충 진단이 실제 농작업에 활용할 수 있을 만큼 충분한 정확도와 신뢰성을 갖추었다는 가정하에 응답해 주시기 바랍니다.'
          ).trim(),
          footer_title: String(raw.footer_title || '설문에 참여해 주셔서 감사합니다.').trim(),
          footer_sub: String(
            raw.footer_sub ||
              '본 설문 결과는 한팜의 서비스 개발 및 사업성 검토를 위한 목적으로 활용됩니다.'
          ).trim(),
          is_active: raw.is_active === undefined ? 1 : Number(raw.is_active) ? 1 : 0,
          updated_at: String(raw.updated_at || '2026-11-09 22:28:31'),
          questions,
          questions_json: JSON.stringify(questions),
        };
      };

      const toSupabaseFormRow = (form: any) => {
        const norm = normalizeFormItem(form);
        return {
          survey_id: norm.survey_id,
          title: norm.title,
          greeting_text: norm.greeting_text,
          intro_text: norm.intro_text,
          duration_text: norm.duration_text,
          notice_text: norm.notice_text,
          footer_title: norm.footer_title,
          footer_sub: norm.footer_sub,
          questions_json: norm.questions_json,
          is_active: norm.is_active,
          updated_at: norm.updated_at,
        };
      };

      const normalizeRespItem = (raw: any) => {
        if (!raw || typeof raw !== 'object') return raw;
        let q3Crops = Array.isArray(raw.q3_crops) ? raw.q3_crops : [];
        if (q3Crops.length === 0 && typeof raw.q3_crops_json === 'string' && raw.q3_crops_json.trim()) {
          try {
            const parsed = JSON.parse(raw.q3_crops_json);
            if (Array.isArray(parsed)) q3Crops = parsed;
          } catch {
            // ignore
          }
        }
        let answersMap = raw.answers_map && typeof raw.answers_map === 'object' ? raw.answers_map : {};
        if (Object.keys(answersMap).length === 0 && typeof raw.answers_json === 'string' && raw.answers_json.trim()) {
          try {
            const parsed = JSON.parse(raw.answers_json);
            if (parsed && typeof parsed === 'object') answersMap = parsed;
          } catch {
            // ignore
          }
        }
        return {
          ...raw,
          q3_crops: q3Crops,
          q3_crops_json: JSON.stringify(q3Crops),
          answers_map: answersMap,
          answers_json: JSON.stringify(answersMap),
        };
      };

      const toSupabaseRespRow = (resp: any) => {
        const norm = normalizeRespItem(resp);
        return {
          response_id: String(norm.response_id || ''),
          survey_id: String(norm.survey_id || 'SURV-HANFARM-2026'),
          respondent_name: String(norm.respondent_name || '익명 농업인'),
          respondent_region: String(norm.respondent_region || ''),
          respondent_contact: String(norm.respondent_contact || ''),
          q1_age: String(norm.q1_age || ''),
          q2_scale: String(norm.q2_scale || ''),
          q3_crops_json: norm.q3_crops_json,
          q3_other_text: String(norm.q3_other_text || ''),
          q4_difficulty: String(norm.q4_difficulty || ''),
          q5_schedule_intent: String(norm.q5_schedule_intent || ''),
          q6_schedule_wtp: String(norm.q6_schedule_wtp || ''),
          q7_ai_pest_intent: String(norm.q7_ai_pest_intent || ''),
          q8_bundle_wtp: String(norm.q8_bundle_wtp || ''),
          q9_commerce_intent: String(norm.q9_commerce_intent || ''),
          answers_json: norm.answers_json,
          submitted_at: String(norm.submitted_at || getKstNowStr()),
        };
      };

      const baseSurveys = snap.surveys || { forms: [], responses: [] };
      let forms: any[] = [];
      let responses: any[] = [];
      try {
        const rawForms = localStorage.getItem(FORMS_KEY);
        const parsedForms = rawForms ? JSON.parse(rawForms) : null;
        forms = (
          Array.isArray(parsedForms) && parsedForms.length > 0
            ? parsedForms
            : Array.isArray(baseSurveys.forms)
            ? [...baseSurveys.forms]
            : []
        ).map(normalizeFormItem);
      } catch {
        forms = (Array.isArray(baseSurveys.forms) ? [...baseSurveys.forms] : []).map(normalizeFormItem);
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
              responses.push(normalizeRespItem(item));
            }
          }
        } else {
          responses = (Array.isArray(baseSurveys.responses) ? [...baseSurveys.responses] : []).map(
            normalizeRespItem
          );
        }
      } catch {
        responses = (Array.isArray(baseSurveys.responses) ? [...baseSurveys.responses] : []).map(
          normalizeRespItem
        );
      }

      if (p === '/api/surveys/save') {
        try {
          const body = parseBody(init);
          const surveyId = String(body.survey_id || 'SURV-HANFARM-2026').trim();
          const nowStr = getKstNowStr();
          const idx = forms.findIndex((f) => f.survey_id === surveyId);
          const nextForm = normalizeFormItem({
            ...(idx >= 0 ? forms[idx] : {}),
            ...body,
            survey_id: surveyId,
            is_active: body.is_active === undefined ? 1 : Number(body.is_active) ? 1 : 0,
            updated_at: nowStr,
            questions: Array.isArray(body.questions) ? body.questions : idx >= 0 ? forms[idx].questions : [],
          });
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
          await sbUpsert('survey_form', toSupabaseFormRow(nextForm), 'survey_id');
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
          if (targetId) {
            await sbDelete('survey_response', `survey_id=eq.${encodeURIComponent(targetId)}`);
            await sbDelete('survey_form', `survey_id=eq.${encodeURIComponent(targetId)}`);
          }
        } catch {
          // ignore
        }
        return jsonResponse({ ok: true });
      }

      if (p === '/api/surveys/submit') {
        const nextSeq = responses.length + 1;
        const todayYmd = getKstNowStr().slice(0, 10).replace(/-/g, '');
        let respId = `RESP-${todayYmd}-${String(nextSeq).padStart(3, '0')}`;
        try {
          const body = parseBody(init);
          if (body.response_id) respId = String(body.response_id).trim();
          const surveyId = String(body.survey_id || 'SURV-HANFARM-2026').trim();
          const nowStr = getKstNowStr();
          const newResp = normalizeRespItem({
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
          });
          responses = [newResp, ...responses.filter((r) => r.response_id !== respId)];
          localStorage.setItem(RESPS_KEY, JSON.stringify(responses));
          if (snap.surveys) {
            snap.surveys.responses = responses;
          }
          await sbUpsert('survey_response', toSupabaseRespRow(newResp), 'response_id');
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
          if (targetRespId) {
            await sbDelete('survey_response', `response_id=eq.${encodeURIComponent(targetRespId)}`);
          }
        } catch {
          // ignore
        }
        return jsonResponse({ ok: true });
      }

      // GET 요청 (/api/surveys 또는 /api/surveys/public) 시 Supabase 클라우드 DB와 localStorage 양방향 최신 동기화
      try {
        const [remoteFormsRaw, remoteRespsRaw] = await Promise.all([
          sbSelect('survey_form', 'select=*&order=updated_at.desc'),
          sbSelect('survey_response', 'select=*&order=submitted_at.desc'),
        ]);
        if (Array.isArray(remoteFormsRaw) && remoteFormsRaw.length > 0) {
          const remoteForms = remoteFormsRaw.map(normalizeFormItem);
          const mergedMap = new Map<string, any>();
          for (const rf of remoteForms) {
            mergedMap.set(rf.survey_id, rf);
          }
          for (const lf of forms) {
            const rf = mergedMap.get(lf.survey_id);
            if (!rf) {
              mergedMap.set(lf.survey_id, lf);
              sbUpsert('survey_form', toSupabaseFormRow(lf), 'survey_id');
            } else {
              const localTime = String(lf.updated_at || '');
              const remoteTime = String(rf.updated_at || '');
              const isRemoteInitialSeed = remoteTime === '2026-11-09 22:28:31';
              const isLocalContentModified =
                lf.title !== rf.title ||
                lf.greeting_text !== rf.greeting_text ||
                lf.intro_text !== rf.intro_text ||
                lf.duration_text !== rf.duration_text ||
                lf.notice_text !== rf.notice_text ||
                lf.footer_title !== rf.footer_title ||
                lf.footer_sub !== rf.footer_sub ||
                Number(lf.is_active) !== Number(rf.is_active) ||
                lf.questions_json !== rf.questions_json;
              if (localTime > remoteTime || (isRemoteInitialSeed && isLocalContentModified)) {
                const syncedLocal =
                  localTime <= remoteTime ? { ...lf, updated_at: getKstNowStr() } : lf;
                mergedMap.set(lf.survey_id, syncedLocal);
                sbUpsert('survey_form', toSupabaseFormRow(syncedLocal), 'survey_id');
              } else {
                mergedMap.set(lf.survey_id, rf);
              }
            }
          }
          forms = Array.from(mergedMap.values());
          localStorage.setItem(FORMS_KEY, JSON.stringify(forms));
          if (snap.surveys) {
            snap.surveys.forms = forms;
            snap.surveys.activeSurvey = forms[0];
          }
        }
        if (Array.isArray(remoteRespsRaw)) {
          const remoteResps = remoteRespsRaw.map(normalizeRespItem);
          const respMap = new Map<string, any>();
          for (const rr of remoteResps) {
            if (rr.response_id) respMap.set(rr.response_id, rr);
          }
          for (const lr of responses) {
            if (lr.response_id && !respMap.has(lr.response_id)) {
              respMap.set(lr.response_id, lr);
              sbUpsert('survey_response', toSupabaseRespRow(lr), 'response_id');
            }
          }
          responses = Array.from(respMap.values());
          localStorage.setItem(RESPS_KEY, JSON.stringify(responses));
          if (snap.surveys) {
            snap.surveys.responses = responses;
          }
        }
      } catch {
        // ignore network errors and fall back to localStorage
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

    // 7. 구매의향서 관리 API (Supabase purchase_intent_config / purchase_intent_entry 양방향 실시간 동기화)
    const INTENT_TPL_KEY = 'hanfarm_purchase_intent_template_v1';
    const INTENT_ENTRIES_KEY = 'hanfarm_purchase_intents_v1';
    const INTENT_DELETED_KEY = 'hanfarm_purchase_intents_deleted_v1';

    const normalizeIntentEntry = (raw: any) => {
      if (!raw || typeof raw !== 'object') return raw;
      let desiredServices = Array.isArray(raw.desired_services) ? raw.desired_services : [];
      if (
        desiredServices.length === 0 &&
        typeof raw.desired_services_json === 'string' &&
        raw.desired_services_json.trim()
      ) {
        try {
          const parsed = JSON.parse(raw.desired_services_json);
          if (Array.isArray(parsed)) desiredServices = parsed;
        } catch {
          // ignore
        }
      }
      let finalIntents = Array.isArray(raw.final_intents) ? raw.final_intents : [];
      if (
        finalIntents.length === 0 &&
        typeof raw.final_intents_json === 'string' &&
        raw.final_intents_json.trim()
      ) {
        try {
          const parsed = JSON.parse(raw.final_intents_json);
          if (Array.isArray(parsed)) finalIntents = parsed;
        } catch {
          // ignore
        }
      }
      return {
        intent_id: String(raw.intent_id || '').trim(),
        applicant_name: String(raw.applicant_name || '').trim(),
        contact: String(raw.contact || '').trim(),
        main_crops: String(raw.main_crops || '').trim(),
        desired_services: desiredServices,
        monthly_wtp: String(raw.monthly_wtp || '월 10,000원').trim(),
        final_intents: finalIntents,
        written_date: String(raw.written_date || '2026-11-09').trim(),
        agreed_final: raw.agreed_final === false || raw.agreed_final === 0 ? false : true,
        agreed_privacy: raw.agreed_privacy === false || raw.agreed_privacy === 0 ? false : true,
        created_at: String(raw.created_at || getKstNowStr().slice(0, 16)).trim(),
        _synced_to_sb: Boolean(raw._synced_to_sb),
      };
    };

    const toSupabaseIntentEntryRow = (entry: any) => {
      const norm = normalizeIntentEntry(entry);
      return {
        intent_id: norm.intent_id,
        applicant_name: norm.applicant_name,
        contact: norm.contact,
        main_crops: norm.main_crops,
        desired_services_json: JSON.stringify(norm.desired_services || []),
        monthly_wtp: norm.monthly_wtp,
        final_intents_json: JSON.stringify(norm.final_intents || []),
        written_date: norm.written_date,
        agreed_final: norm.agreed_final ? 1 : 0,
        agreed_privacy: norm.agreed_privacy ? 1 : 0,
        created_at: norm.created_at,
      };
    };

    if (p === '/api/purchase-intents') {
      let template: any = null;
      let entries: any[] | null = null;
      let deletedIds: string[] = [];
      try {
        const rawTpl = localStorage.getItem(INTENT_TPL_KEY);
        if (rawTpl) template = JSON.parse(rawTpl);
      } catch {
        // ignore
      }
      try {
        const rawEntries = localStorage.getItem(INTENT_ENTRIES_KEY);
        if (rawEntries) {
          const parsed = JSON.parse(rawEntries);
          if (Array.isArray(parsed)) entries = parsed.map(normalizeIntentEntry);
        }
      } catch {
        // ignore
      }
      try {
        const rawDeleted = localStorage.getItem(INTENT_DELETED_KEY);
        if (rawDeleted) {
          const parsedDel = JSON.parse(rawDeleted);
          if (Array.isArray(parsedDel)) deletedIds = parsedDel.map((x) => String(x));
        }
      } catch {
        // ignore
      }

      try {
        const [remoteCfgRows, remoteEntryRows] = await Promise.all([
          sbSelect('purchase_intent_config', 'select=*&config_id=eq.DEFAULT'),
          sbSelect('purchase_intent_entry', 'select=*&order=intent_id.desc'),
        ]);

        if (Array.isArray(remoteCfgRows) && remoteCfgRows.length > 0) {
          const cfgRow = remoteCfgRows[0];
          let remoteTpl: any = null;
          try {
            remoteTpl = cfgRow?.template_json ? JSON.parse(cfgRow.template_json) : null;
          } catch {
            remoteTpl = null;
          }
          const remoteUpdatedAt = String(cfgRow?.updated_at || '2026-11-09 22:28:31');
          if (remoteTpl) {
            const stripMeta = (obj: any) => {
              if (!obj || typeof obj !== 'object') return {};
              const { updated_at, _synced_to_sb, ...rest } = obj;
              return rest;
            };
            const localTime = String(template?.updated_at || '');
            const isUnsyncedLocalMod =
              template &&
              !template._synced_to_sb &&
              JSON.stringify(stripMeta(template)) !== JSON.stringify(stripMeta(remoteTpl));
            if (template && (localTime > remoteUpdatedAt || (remoteUpdatedAt === '2026-11-09 22:28:31' && isUnsyncedLocalMod))) {
              const nowStr = localTime > remoteUpdatedAt ? localTime : getKstNowStr();
              const syncedTpl = { ...stripMeta(template), updated_at: nowStr, _synced_to_sb: true };
              template = syncedTpl;
              localStorage.setItem(INTENT_TPL_KEY, JSON.stringify(syncedTpl));
              await sbUpsert(
                'purchase_intent_config',
                {
                  config_id: 'DEFAULT',
                  template_json: JSON.stringify(stripMeta(syncedTpl)),
                  updated_at: nowStr,
                },
                'config_id'
              );
            } else {
              const syncedRemote = { ...stripMeta(remoteTpl), updated_at: remoteUpdatedAt, _synced_to_sb: true };
              template = syncedRemote;
              localStorage.setItem(INTENT_TPL_KEY, JSON.stringify(syncedRemote));
            }
          }
        } else if (template) {
          const nowStr = String(template.updated_at || getKstNowStr());
          const { _synced_to_sb, ...cleanTpl } = template;
          await sbUpsert(
            'purchase_intent_config',
            {
              config_id: 'DEFAULT',
              template_json: JSON.stringify(cleanTpl),
              updated_at: nowStr,
            },
            'config_id'
          );
          template = { ...cleanTpl, updated_at: nowStr, _synced_to_sb: true };
          localStorage.setItem(INTENT_TPL_KEY, JSON.stringify(template));
        }

        if (Array.isArray(remoteEntryRows)) {
          const deletedSet = new Set(deletedIds);
          const remoteMap = new Map<string, any>();
          for (const rr of remoteEntryRows) {
            const norm = normalizeIntentEntry({ ...rr, _synced_to_sb: true });
            if (norm.intent_id) remoteMap.set(norm.intent_id, norm);
          }
          for (const delId of deletedSet) {
            if (remoteMap.has(delId)) {
              remoteMap.delete(delId);
              await sbDelete('purchase_intent_entry', `intent_id=eq.${encodeURIComponent(delId)}`);
            }
          }
          if (Array.isArray(entries)) {
            const stripEntryMeta = (e: any) => {
              const { _synced_to_sb, ...rest } = normalizeIntentEntry(e);
              return rest;
            };
            for (const le of entries) {
              if (!le?.intent_id || deletedSet.has(le.intent_id)) continue;
              const existingRemote = remoteMap.get(le.intent_id);
              if (!existingRemote && !le._synced_to_sb) {
                const syncedLe = { ...normalizeIntentEntry(le), _synced_to_sb: true };
                remoteMap.set(le.intent_id, syncedLe);
                await sbUpsert('purchase_intent_entry', toSupabaseIntentEntryRow(syncedLe), 'intent_id');
              } else if (
                existingRemote &&
                !le._synced_to_sb &&
                JSON.stringify(stripEntryMeta(le)) !== JSON.stringify(stripEntryMeta(existingRemote))
              ) {
                const syncedLe = { ...normalizeIntentEntry(le), _synced_to_sb: true };
                remoteMap.set(le.intent_id, syncedLe);
                await sbUpsert('purchase_intent_entry', toSupabaseIntentEntryRow(syncedLe), 'intent_id');
              }
            }
          }
          entries = Array.from(remoteMap.values()).sort((a, b) =>
            String(b.intent_id || '').localeCompare(String(a.intent_id || ''))
          );
          localStorage.setItem(INTENT_ENTRIES_KEY, JSON.stringify(entries));
        }
      } catch {
        // ignore network errors and fall back to localStorage
      }

      return jsonResponse({ ok: true, template, entries });
    }

    if (p === '/api/purchase-intents/template') {
      try {
        const body = parseBody(init);
        const rawTpl = body.template || body;
        const { _synced_to_sb, ...cleanTpl } = rawTpl || {};
        const nowStr = getKstNowStr();
        const savedTpl = { ...cleanTpl, updated_at: nowStr, _synced_to_sb: true };
        localStorage.setItem(INTENT_TPL_KEY, JSON.stringify(savedTpl));
        await sbUpsert(
          'purchase_intent_config',
          {
            config_id: 'DEFAULT',
            template_json: JSON.stringify({ ...cleanTpl, updated_at: nowStr }),
            updated_at: nowStr,
          },
          'config_id'
        );
        return jsonResponse({ ok: true, template: savedTpl, updatedAt: nowStr });
      } catch {
        // ignore
      }
      return jsonResponse({ ok: true });
    }

    if (p === '/api/purchase-intents/entry') {
      try {
        const body = parseBody(init);
        const normEntry = {
          ...normalizeIntentEntry({
            ...body,
            intent_id: body.intent_id || `LOI-2026-${Date.now().toString().slice(-4)}`,
          }),
          _synced_to_sb: true,
        };
        const rawEntries = localStorage.getItem(INTENT_ENTRIES_KEY);
        const list: any[] = rawEntries ? JSON.parse(rawEntries) : [];
        const idx = list.findIndex((x) => x.intent_id === normEntry.intent_id);
        if (idx >= 0) list[idx] = { ...list[idx], ...normEntry };
        else list.unshift(normEntry);
        localStorage.setItem(INTENT_ENTRIES_KEY, JSON.stringify(list));
        try {
          const rawDeleted = localStorage.getItem(INTENT_DELETED_KEY);
          if (rawDeleted) {
            const delList: string[] = JSON.parse(rawDeleted);
            localStorage.setItem(
              INTENT_DELETED_KEY,
              JSON.stringify(delList.filter((id) => id !== normEntry.intent_id))
            );
          }
        } catch {
          // ignore
        }
        await sbUpsert('purchase_intent_entry', toSupabaseIntentEntryRow(normEntry), 'intent_id');
        return jsonResponse({ ok: true, intent_id: normEntry.intent_id, entry: normEntry });
      } catch {
        // ignore
      }
      return jsonResponse({ ok: true });
    }

    if (p === '/api/purchase-intents/entry/delete') {
      try {
        const { intent_id } = parseBody(init);
        const targetId = String(intent_id || '').trim();
        const rawEntries = localStorage.getItem(INTENT_ENTRIES_KEY);
        const list: any[] = rawEntries ? JSON.parse(rawEntries) : [];
        localStorage.setItem(
          INTENT_ENTRIES_KEY,
          JSON.stringify(list.filter((x) => x.intent_id !== targetId))
        );
        if (targetId) {
          try {
            const rawDeleted = localStorage.getItem(INTENT_DELETED_KEY);
            const delList: string[] = rawDeleted ? JSON.parse(rawDeleted) : [];
            if (!delList.includes(targetId)) {
              delList.push(targetId);
              localStorage.setItem(INTENT_DELETED_KEY, JSON.stringify(delList));
            }
          } catch {
            // ignore
          }
          await sbDelete('purchase_intent_entry', `intent_id=eq.${encodeURIComponent(targetId)}`);
        }
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
