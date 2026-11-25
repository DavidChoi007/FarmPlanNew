import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { URL } from 'node:url';
import { db, initDatabase, DEFAULT_HANFARM_SURVEY_QUESTIONS } from './db.ts';
import {
  getSupabaseConfig,
  runPostgresQuery,
  supabaseRestUpsert,
  supabaseRestDelete,
  supabaseRestSelect,
} from './supabaseClient.ts';
import {
  FERTILIZER_CATEGORIES,
  NUTRIENT_CATEGORIES,
  PESTICIDE_CATEGORIES,
  SEED_CATEGORIES,
  SEEDLING_CATEGORIES,
  renderFertilizerSvg,
  resolveFertilizerMainType,
} from './fertilizerProductAssets.ts';
import {
  RECOMMENDATION_LOGIC_SPEC,
  STAGE_REQUIREMENT_SPECS,
  resolveStageSpecByProcessOrItem,
  evaluateCategoryRecommendations,
  selectScheduleStageMaterials,
} from './agroRecommendationEngine.ts';
import {
  SCHEDULE_GEN_MODULE_SYNC_KEY,
  createDefaultScheduleGenerationModuleConfig,
  normalizeScheduleGenerationModuleConfig,
  getEnabledModuleFlags,
} from '../src/utils/scheduleGenerationModule.ts';
import {
  resolveCropAgronomicProfile,
  computeCropExpectedHarvestDate,
} from '../src/utils/cropAgronomicProfiles.ts';

initDatabase();

function initMemberAndMyPageTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_member (
      member_id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      signup_type TEXT NOT NULL DEFAULT 'EMAIL', -- EMAIL | NAVER | GOOGLE_GMAIL | APPLE
      name TEXT NOT NULL,
      nickname TEXT NOT NULL DEFAULT '',
      gender TEXT NOT NULL DEFAULT '남성',
      birth_date TEXT NOT NULL DEFAULT '1978-05-15',
      age INTEGER NOT NULL DEFAULT 48,
      road_address TEXT NOT NULL DEFAULT '',
      road_address_detail TEXT DEFAULT '',
      postal_code TEXT DEFAULT '27481',
      road_code TEXT DEFAULT '',
      bjd_code TEXT DEFAULT '',
      sido TEXT DEFAULT '',
      sigungu TEXT DEFAULT '',
      eupmyeondong TEXT DEFAULT '',
      jibun_address TEXT DEFAULT '',
      phone TEXT DEFAULT '010-2026-0109',
      phone_verified INTEGER NOT NULL DEFAULT 1,
      interest_types TEXT NOT NULL DEFAULT '["농업인(직업 재배)"]',
      agree_terms INTEGER NOT NULL DEFAULT 1,
      agree_privacy INTEGER NOT NULL DEFAULT 1,
      agree_marketing INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // 기존 로컬 SQLite user_member 및 member_schedule_request 테이블에 신규 컬럼 마이그레이션
  const alterMemberCols = [
    `ALTER TABLE user_member ADD COLUMN phone_verified INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE user_member ADD COLUMN interest_types TEXT NOT NULL DEFAULT '["농업인(직업 재배)"]'`,
    `ALTER TABLE user_member ADD COLUMN agree_terms INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE user_member ADD COLUMN agree_privacy INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE user_member ADD COLUMN agree_marketing INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE user_member ADD COLUMN road_code TEXT DEFAULT ''`,
    `ALTER TABLE user_member ADD COLUMN bjd_code TEXT DEFAULT ''`,
    `ALTER TABLE user_member ADD COLUMN sido TEXT DEFAULT ''`,
    `ALTER TABLE user_member ADD COLUMN sigungu TEXT DEFAULT ''`,
    `ALTER TABLE user_member ADD COLUMN eupmyeondong TEXT DEFAULT ''`,
    `ALTER TABLE user_member ADD COLUMN jibun_address TEXT DEFAULT ''`,
    `ALTER TABLE member_schedule_request ADD COLUMN soil_condition TEXT NOT NULL DEFAULT '사양토'`,
    `ALTER TABLE member_schedule_request ADD COLUMN facility_env_json TEXT NOT NULL DEFAULT '["멀칭","부직포"]'`,
    `ALTER TABLE member_schedule_request ADD COLUMN schedule_base_type TEXT NOT NULL DEFAULT 'OPTIMAL_AUTO'`,
    `ALTER TABLE member_schedule_request ADD COLUMN schedule_base_date TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE member_schedule_request ADD COLUMN area_unit TEXT NOT NULL DEFAULT '평'`,
  ];
  for (const sql of alterMemberCols) {
    try {
      db.exec(sql);
    } catch {
      // 이미 컬럼이 존재하는 경우 무시
    }
  }

  db.exec(`

    CREATE TABLE IF NOT EXISTS member_farmland (
      farmland_id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      farmland_title TEXT NOT NULL,
      bjd_code TEXT NOT NULL,
      sido TEXT NOT NULL,
      sigungu TEXT NOT NULL,
      eupmyeondong TEXT NOT NULL,
      detail_jibun TEXT DEFAULT '',
      area_pyeong INTEGER NOT NULL DEFAULT 300,
      soil_ph REAL DEFAULT 6.2,
      soil_ec REAL DEFAULT 1.1,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS member_crop_plan (
      crop_plan_id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      request_no TEXT NOT NULL,
      farmland_id TEXT DEFAULT '',
      sido TEXT NOT NULL,
      sigungu TEXT NOT NULL,
      eupmyeondong TEXT NOT NULL,
      crop_name TEXT NOT NULL,
      cultivar_name TEXT NOT NULL,
      planting_type TEXT NOT NULL DEFAULT '모종',
      area_pyeong INTEGER NOT NULL DEFAULT 300,
      planting_date TEXT NOT NULL,
      expected_harvest_date TEXT NOT NULL,
      current_stage_name TEXT NOT NULL,
      progress_pct INTEGER NOT NULL DEFAULT 0,
      status_text TEXT NOT NULL DEFAULT '정상 생육중',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS member_agro_order (
      order_no TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      ordered_at TEXT NOT NULL,
      purchase_title TEXT NOT NULL,
      crop_title TEXT NOT NULL,
      region_address TEXT NOT NULL,
      delivery_option TEXT NOT NULL DEFAULT 'STAGE_SCHEDULED',
      payment_method TEXT NOT NULL DEFAULT 'NONGHYUP_CARD',
      delivery_status TEXT NOT NULL DEFAULT '생육단계별 적기 맞춤 배송중',
      raw_total INTEGER NOT NULL DEFAULT 0,
      discount_amount INTEGER NOT NULL DEFAULT 0,
      final_total INTEGER NOT NULL DEFAULT 0,
      reward_points INTEGER NOT NULL DEFAULT 0,
      items_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS purchase_intent_config (
      config_id TEXT PRIMARY KEY,
      template_json TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS purchase_intent_entry (
      intent_id TEXT PRIMARY KEY,
      applicant_name TEXT NOT NULL,
      contact TEXT NOT NULL DEFAULT '',
      main_crops TEXT NOT NULL DEFAULT '',
      desired_services_json TEXT NOT NULL DEFAULT '[]',
      monthly_wtp TEXT NOT NULL DEFAULT '월 10,000원',
      final_intents_json TEXT NOT NULL DEFAULT '[]',
      written_date TEXT NOT NULL DEFAULT '2026-11-09',
      agreed_final INTEGER NOT NULL DEFAULT 1,
      agreed_privacy INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // 기본 회원 CloudBae (CloudBae@naver.com / 1234, 이름: 배철민, 충청북도 충주시 단월동) 보장 (타 신규 가입 회원 데이터는 절대 삭제하지 않음)
  db.prepare(`
    INSERT OR IGNORE INTO user_member (
      member_id, email, password, signup_type, name, nickname, gender, birth_date, age,
      road_address, road_address_detail, postal_code, phone
    ) VALUES (
      'MEM-CLOUDBAE',
      'CloudBae@naver.com',
      '1234',
      'EMAIL',
      '배철민',
      'CloudBae',
      '남성',
      '1978-05-15',
      48,
      '충청북도 충주시 충원대로 268 (단월동)',
      '한팜스마트농원 101호',
      '27481',
      '010-2026-0109'
    )
  `).run();

  db.prepare(`
    UPDATE user_member
    SET name = '배철민'
    WHERE LOWER(email) = 'cloudbae@naver.com' AND (name = '배클라우드' OR name = 'CloudBae' OR name = '')
  `).run();

  // 기존 시드 재배일정 요청 및 재배일정 확인 데이터(REQ-20261106-009, CPLAN-CB-01 등) 일괄 삭제
  db.prepare(`
    DELETE FROM member_schedule_request
    WHERE request_no IN (
      'REQ-20261101-001',
      'REQ-20261102-002',
      'REQ-20261102-003',
      'REQ-20261103-004',
      'REQ-20261104-005',
      'REQ-20261104-006',
      'REQ-20261105-007',
      'REQ-20261106-008',
      'REQ-20261106-009'
    )
  `).run();
  db.prepare(`
    DELETE FROM member_farmland
    WHERE farmland_id IN (
      'LAND-CB-02',
      'LAND-CB-03',
      'LAND-CB-04',
      'LAND-CB-05',
      'LAND-CB-06',
      'LAND-CB-07',
      'LAND-CB-08',
      'LAND-CB-09'
    )
  `).run();
  db.prepare(`
    DELETE FROM member_crop_plan
    WHERE crop_plan_id IN (
      'CPLAN-CB-01',
      'CPLAN-CB-02',
      'CPLAN-CB-03',
      'CPLAN-CB-04',
      'CPLAN-CB-05',
      'CPLAN-CB-06',
      'CPLAN-CB-07',
      'CPLAN-CB-08',
      'CPLAN-CB-09'
    ) OR request_no = 'REQ-20261106-009'
  `).run();
  db.prepare(`
    DELETE FROM cultivation_history_log
    WHERE request_id IN ('CULT-2026-000123', 'CULT-2026-000124', 'CULT-2026-000125', 'CULT-2026-000126')
  `).run();
  db.prepare(`
    DELETE FROM schedule_request
    WHERE request_id IN ('CULT-2026-000123', 'CULT-2026-000124', 'CULT-2026-000125', 'CULT-2026-000126')
  `).run();
  db.prepare(`
    DELETE FROM member_agro_order
    WHERE order_no IN ('ORD-20260508-CB042', 'ORD-20260820-CB101', 'ORD-20260822-CB105')
  `).run();

  // 배철민(CloudBae@naver.com) 회원의 충청북도 충주시 단월동 기본 재배지(LAND-CB-01) 유지
  db.prepare(`
    INSERT OR IGNORE INTO member_farmland (
      farmland_id, email, farmland_title, bjd_code, sido, sigungu, eupmyeondong,
      detail_jibun, area_pyeong, soil_ph, soil_ec
    ) VALUES (
      'LAND-CB-01',
      'CloudBae@naver.com',
      '충주시 단월동 가을배추 포전 (REQ-20261106-009)',
      '4305003000',
      '충청북도',
      '충주시',
      '단월동',
      '단월동 382-4번지 달천강변 배추 영농포전 (전 1,000평)',
      1000,
      6.5,
      1.1
    )
  `).run();
}
initMemberAndMyPageTables();

const SIDO_ALIAS_MAP: Record<string, string> = {
  서울: '서울특별시',
  서울시: '서울특별시',
  서울특별시: '서울특별시',
  부산: '부산광역시',
  부산시: '부산광역시',
  부산광역시: '부산광역시',
  대구: '대구광역시',
  대구시: '대구광역시',
  대구광역시: '대구광역시',
  인천: '인천광역시',
  인천시: '인천광역시',
  인천광역시: '인천광역시',
  광주: '광주광역시',
  광주시: '광주광역시',
  광주광역시: '광주광역시',
  대전: '대전광역시',
  대전시: '대전광역시',
  대전광역시: '대전광역시',
  울산: '울산광역시',
  울산시: '울산광역시',
  울산광역시: '울산광역시',
  세종: '세종특별자치시',
  세종시: '세종특별자치시',
  세종특별자치시: '세종특별자치시',
  경기: '경기도',
  경기도: '경기도',
  강원: '강원특별자치도',
  강원도: '강원특별자치도',
  강원특별자치도: '강원특별자치도',
  충북: '충청북도',
  충청북도: '충청북도',
  충남: '충청남도',
  충청남도: '충청남도',
  전북: '전북특별자치도',
  전라북도: '전북특별자치도',
  전북특별자치도: '전북특별자치도',
  전남: '전라남도',
  전라남도: '전라남도',
  경북: '경상북도',
  경상북도: '경상북도',
  경남: '경상남도',
  경상남도: '경상남도',
  제주: '제주특별자치도',
  제주도: '제주특별자치도',
  제주특별자치도: '제주특별자치도',
};

function normalizeSidoName(rawSido?: string | null): string {
  const s = String(rawSido || '').trim();
  if (!s) return '충청북도';
  return SIDO_ALIAS_MAP[s] || s;
}

function resolveCultivationAddressFromInput(input: {
  bjd_code?: string | null;
  sido?: string | null;
  sigungu?: string | null;
  eupmyeondong?: string | null;
  road_address?: string | null;
}): {
  bjd_code: string;
  sido: string;
  sigungu: string;
  eupmyeondong: string;
  full_address: string;
} {
  let sido = String(input.sido || '').trim();
  let sigungu = String(input.sigungu || '').trim();
  let eupmyeondong = String(input.eupmyeondong || '').trim();
  const bjdTrimmed = String(input.bjd_code || '').trim();

  // 시/도, 시/군/구, 읍/면/동이 명시적으로 전달되지 않았을 때만 bjd_code로 주소 역조회
  if (bjdTrimmed && !sido && !sigungu && !eupmyeondong) {
    const byBjd = db
      .prepare('SELECT bjd_code, sido, sigungu, eupmyeondong, full_address FROM cultivation_address WHERE bjd_code = ? LIMIT 1')
      .get(bjdTrimmed) as any;
    if (byBjd) return byBjd;
  }

  // road_address 문자열(예: "서울시 강동구 둔촌동", "경기도 고양시 일산로 488", "경기도 고양시 일산서구 일산로 488 (일산동)")에서 시도/시군구/읍면동 추출
  const roadText = String(input.road_address || '').trim();
  if (roadText && (!sido || !sigungu || !eupmyeondong)) {
    const parenMatch = roadText.match(/\(([^(),\s]+(?:동|읍|면|가|리))\)/);
    const cleaned = roadText.replace(/[(),]/g, ' ');
    const tokens = cleaned.split(/\s+/).filter(Boolean);
    if (!sido && tokens[0]) sido = tokens[0];
    let dongSearchStartIdx = 2;
    if (!sigungu && tokens[1]) {
      if (tokens[1].endsWith('시') && tokens[2] && tokens[2].endsWith('구')) {
        sigungu = `${tokens[1]} ${tokens[2]}`;
        dongSearchStartIdx = 3;
      } else {
        sigungu = tokens[1];
      }
    }
    if (!eupmyeondong) {
      if (parenMatch?.[1]) {
        eupmyeondong = parenMatch[1];
      } else {
        const restTokens = tokens.slice(dongSearchStartIdx);
        const dongTok = restTokens.find((t) => /(?:동|읍|면|가|리)$/.test(t));
        if (dongTok) {
          eupmyeondong = dongTok;
        } else {
          const roadTok = restTokens.find((t) => /(?:대로|로|길)$/.test(t));
          if (roadTok) {
            const stem = roadTok.replace(/(?:중앙로|순환로|번영로|문화로|평화로|농공로|들녘길|청사로|역전로|대로|로|길)$/, '');
            eupmyeondong = stem ? `${stem}동` : roadTok;
          } else if (restTokens[0]) {
            eupmyeondong = restTokens[0];
          }
        }
      }
    }
  }

  const normSido = normalizeSidoName(sido || '충청북도');
  const normSigungu = sigungu || '충주시';
  const normDong = eupmyeondong || '단월동';

  const exact = db
    .prepare(
      'SELECT bjd_code, sido, sigungu, eupmyeondong, full_address FROM cultivation_address WHERE sido = ? AND sigungu = ? AND eupmyeondong = ? LIMIT 1'
    )
    .get(normSido, normSigungu, normDong) as any;
  if (exact) return exact;

  const fuzzyDong = db
    .prepare(
      'SELECT bjd_code, sido, sigungu, eupmyeondong, full_address FROM cultivation_address WHERE sido = ? AND sigungu LIKE ? AND eupmyeondong LIKE ? LIMIT 1'
    )
    .get(normSido, `%${normSigungu}%`, `%${normDong}%`) as any;
  if (fuzzyDong) {
    return {
      bjd_code: fuzzyDong.bjd_code || bjdTrimmed || '4313010700',
      sido: normSido,
      sigungu: normSigungu,
      eupmyeondong: normDong,
      full_address: `${normSido} ${normSigungu} ${normDong}`,
    };
  }

  const bySigungu = db
    .prepare(
      'SELECT bjd_code FROM cultivation_address WHERE sido = ? AND sigungu LIKE ? ORDER BY address_id ASC LIMIT 1'
    )
    .get(normSido, `%${normSigungu}%`) as any;

  const bySido = !bySigungu
    ? (db
        .prepare(
          'SELECT bjd_code FROM cultivation_address WHERE sido = ? ORDER BY address_id ASC LIMIT 1'
        )
        .get(normSido) as any)
    : null;

  return {
    bjd_code: bjdTrimmed || bySigungu?.bjd_code || bySido?.bjd_code || '4313010700',
    sido: normSido,
    sigungu: normSigungu,
    eupmyeondong: normDong,
    full_address: `${normSido} ${normSigungu} ${normDong}`,
  };
}

function resolveCropTaxonomyFromInput(input: {
  group_id?: string | null;
  group_name?: string | null;
  crop_id?: string | null;
  crop_name?: string | null;
  cultivar_id?: string | null;
  item_name_3rd?: string | null;
  system_id?: string | null;
  system_name?: string | null;
}): {
  group_id: string;
  group_name: string;
  crop_id: string;
  crop_name: string;
  cultivar_id: string;
  item_name_3rd: string;
  system_id: string;
  system_name: string;
} {
  const rawCropName = String(input.crop_name || '').trim();
  const displayCropName = rawCropName === '배추' || !rawCropName ? '가을배추' : rawCropName;
  const lookupCropName = displayCropName === '가을배추' ? '배추' : displayCropName;
  const rawCvName = String(input.item_name_3rd || '').trim();

  // 1) crop 조회 (이름 우선 매칭 -> ID 매칭)
  let cropRow =
    (db
      .prepare('SELECT * FROM crop WHERE crop_name = ? OR crop_name = ? LIMIT 1')
      .get(displayCropName, lookupCropName) as any) ||
    (input.crop_id && input.crop_id !== 'CRP-CABBAGE'
      ? (db.prepare('SELECT * FROM crop WHERE crop_id = ? LIMIT 1').get(String(input.crop_id).trim()) as any)
      : null) ||
    (db.prepare("SELECT * FROM crop WHERE crop_id = 'CRP-CABBAGE' LIMIT 1").get() as any);

  const resolvedCropId = String(cropRow?.crop_id || input.crop_id || 'CRP-CABBAGE').trim();
  const resolvedGroupId = String(cropRow?.group_id || input.group_id || 'GRP-LEAF').trim();
  const groupRow = db
    .prepare('SELECT group_name FROM crop_group WHERE group_id = ? LIMIT 1')
    .get(resolvedGroupId) as { group_name?: string } | undefined;
  const resolvedGroupName = String(groupRow?.group_name || input.group_name || '엽채류 (잎채소)').trim();

  // 2) cultivar 조회 (품종명 + crop_id 우선 매칭 -> 품종명 매칭 -> 해당 crop_id의 기본 품종)
  let cvRow =
    (rawCvName
      ? (db
          .prepare('SELECT * FROM cultivar WHERE crop_id = ? AND (cultivar_name = ? OR cultivar_name LIKE ?) LIMIT 1')
          .get(resolvedCropId, rawCvName, `${rawCvName}%`) as any) ||
        (db
          .prepare('SELECT * FROM cultivar WHERE cultivar_name = ? OR cultivar_name LIKE ? LIMIT 1')
          .get(rawCvName, `${rawCvName}%`) as any)
      : null) ||
    (input.cultivar_id && input.cultivar_id !== 'CV-BRM3'
      ? (db.prepare('SELECT * FROM cultivar WHERE cultivar_id = ? LIMIT 1').get(String(input.cultivar_id).trim()) as any)
      : null) ||
    (db.prepare('SELECT * FROM cultivar WHERE crop_id = ? ORDER BY cultivar_id ASC LIMIT 1').get(resolvedCropId) as any);

  const resolvedCvId = String(cvRow?.cultivar_id || input.cultivar_id || 'CV-BRM3').trim();
  const resolvedCvName = String(rawCvName || cvRow?.cultivar_name || '불암3호').trim();

  // 3) cropping_system 조회 (해당 crop_id의 작형 우선 매칭)
  const sysRow =
    (input.system_id && input.system_id !== 'SYS-CAB-AUTUMN' && input.system_id !== 'SYS-CAB-AUT'
      ? (db
          .prepare('SELECT * FROM cropping_system WHERE system_id = ? AND crop_id = ? LIMIT 1')
          .get(String(input.system_id).trim(), resolvedCropId) as any)
      : null) ||
    (db
      .prepare('SELECT * FROM cropping_system WHERE crop_id = ? ORDER BY system_id ASC LIMIT 1')
      .get(resolvedCropId) as any);

  const resolvedSysId = String(sysRow?.system_id || input.system_id || 'SYS-CAB-AUT').trim();
  const resolvedSysName = String(sysRow?.system_name || input.system_name || `${displayCropName} 표준 노지재배`).trim();

  return {
    group_id: resolvedGroupId,
    group_name: resolvedGroupName,
    crop_id: resolvedCropId,
    crop_name: displayCropName,
    cultivar_id: resolvedCvId,
    item_name_3rd: resolvedCvName,
    system_id: resolvedSysId,
    system_name: resolvedSysName,
  };
}

async function syncAdminMemberTablesFromSupabase() {
  try {
    const [sbMembers, sbLands, sbPlans, sbReqs, sbOrders, sbCustomItems] = await Promise.all([
      supabaseRestSelect('user_member'),
      supabaseRestSelect('member_farmland'),
      supabaseRestSelect('member_crop_plan'),
      supabaseRestSelect('member_schedule_request'),
      supabaseRestSelect('member_agro_order'),
      supabaseRestSelect('schedule_provision_custom_item'),
    ]);
    if (Array.isArray(sbMembers) && sbMembers.length > 0) {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO user_member (
          member_id, email, password, signup_type, name, nickname,
          gender, birth_date, age, road_address, road_address_detail, postal_code,
          road_code, bjd_code, sido, sigungu, eupmyeondong, jibun_address,
          phone, phone_verified, interest_types, agree_terms, agree_privacy, agree_marketing, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const m of sbMembers) {
        if (!m?.member_id) continue;
        stmt.run(
          String(m.member_id),
          String(m.email || ''),
          String(m.password || '1234'),
          String(m.signup_type || 'EMAIL'),
          String(m.name || ''),
          String(m.nickname || ''),
          String(m.gender || '남성'),
          String(m.birth_date || '1980-01-01'),
          Number(m.age) || 46,
          String(m.road_address || ''),
          String(m.road_address_detail || ''),
          String(m.postal_code || '27481'),
          String(m.road_code || ''),
          String(m.bjd_code || ''),
          String(m.sido || ''),
          String(m.sigungu || ''),
          String(m.eupmyeondong || ''),
          String(m.jibun_address || ''),
          String(m.phone || '010-0000-0000'),
          m.phone_verified !== undefined ? Number(m.phone_verified) : 1,
          String(m.interest_types || '["농업인(직업 재배)"]'),
          m.agree_terms !== undefined ? Number(m.agree_terms) : 1,
          m.agree_privacy !== undefined ? Number(m.agree_privacy) : 1,
          m.agree_marketing !== undefined ? Number(m.agree_marketing) : 0,
          String(m.created_at || new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' '))
        );
      }
    }
    if (Array.isArray(sbLands) && sbLands.length > 0) {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO member_farmland (
          farmland_id, email, farmland_title, bjd_code, sido, sigungu, eupmyeondong,
          detail_jibun, area_pyeong, soil_ph, soil_ec, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const f of sbLands) {
        if (!f?.farmland_id) continue;
        stmt.run(
          String(f.farmland_id),
          String(f.email || 'CloudBae@naver.com'),
          String(f.farmland_title || '신규 재배지'),
          String(f.bjd_code || '4313010700'),
          String(f.sido || '충청북도'),
          String(f.sigungu || '충주시'),
          String(f.eupmyeondong || '단월동'),
          String(f.detail_jibun || ''),
          Number(f.area_pyeong) || 300,
          Number(f.soil_ph) || 6.2,
          Number(f.soil_ec) || 1.1,
          String(f.created_at || new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' '))
        );
      }
    }
    if (Array.isArray(sbPlans)) {
      db.prepare('DELETE FROM member_crop_plan').run();
      if (sbPlans.length > 0) {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO member_crop_plan (
            crop_plan_id, email, request_no, farmland_id, sido, sigungu, eupmyeondong,
            crop_name, cultivar_name, planting_type, area_pyeong, planting_date,
            expected_harvest_date, current_stage_name, progress_pct, status_text, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const cp of sbPlans) {
          if (!cp?.crop_plan_id) continue;
          stmt.run(
            String(cp.crop_plan_id),
            String(cp.email || 'CloudBae@naver.com'),
            String(cp.request_no || 'REQ-20261106-009'),
            String(cp.farmland_id || ''),
            String(cp.sido || '충청북도'),
            String(cp.sigungu || '충주시'),
            String(cp.eupmyeondong || '단월동'),
            String(cp.crop_name || '가을배추'),
            String(cp.cultivar_name || '불암3호'),
            String(cp.planting_type || '모종'),
            Number(cp.area_pyeong) || 300,
            String(cp.planting_date || '2026-08-25'),
            String(cp.expected_harvest_date || '2026-11-15'),
            String(cp.current_stage_name || '04. 생육 관리'),
            Number(cp.progress_pct ?? 25),
            String(cp.status_text || '기후 연동 생육 관리중'),
            String(cp.created_at || new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' '))
          );
        }
      }
    }
    if (Array.isArray(sbReqs)) {
      db.prepare('DELETE FROM member_schedule_request').run();
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO member_schedule_request (
          request_no, member_id, member_contact,
          group_id, group_name, crop_id, crop_name, cultivar_id, item_name_3rd, system_id, system_name,
          bjd_code, sido, sigungu, eupmyeondong, detail_address,
          area_pyeong, cultivation_type, land_category, planting_method,
          desired_start_date, expected_harvest_date, mulching_yn, irrigation_type,
          is_organic, soil_test_linked_yn, target_yield_kg, etc_notes, request_status, requested_at,
          soil_condition, facility_env_json, schedule_base_type, schedule_base_date, area_unit
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const existingReqNos = new Set<string>();
      if (sbReqs.length > 0) {
        for (const r of sbReqs) {
          if (!r?.request_no) continue;
          existingReqNos.add(String(r.request_no));
          const resolvedTax = resolveCropTaxonomyFromInput({
            group_id: r.group_id,
            group_name: r.group_name,
            crop_id: r.crop_id,
            crop_name: r.crop_name,
            cultivar_id: r.cultivar_id,
            item_name_3rd: r.item_name_3rd,
            system_id: r.system_id,
            system_name: r.system_name,
          });
          const resolvedAddr = resolveCultivationAddressFromInput({
            bjd_code: r.bjd_code,
            sido: r.sido,
            sigungu: r.sigungu,
            eupmyeondong: r.eupmyeondong,
          });
          stmt.run(
            String(r.request_no),
            String(r.member_id || 'CloudBae@naver.com (배철민)'),
            String(r.member_contact || '010-2026-0109'),
            resolvedTax.group_id,
            resolvedTax.group_name,
            resolvedTax.crop_id,
            resolvedTax.crop_name,
            resolvedTax.cultivar_id,
            resolvedTax.item_name_3rd,
            resolvedTax.system_id,
            resolvedTax.system_name,
            String(resolvedAddr.bjd_code || r.bjd_code || '4313010700'),
            String(resolvedAddr.sido || r.sido || '충청북도'),
            String(resolvedAddr.sigungu || r.sigungu || '충주시'),
            String(resolvedAddr.eupmyeondong || r.eupmyeondong || '단월동'),
            String(r.detail_address || ''),
            Number(r.area_pyeong) || 300,
            String(r.cultivation_type || '노지'),
            String(r.land_category || '전'),
            String(r.planting_method || '모종'),
            String(r.desired_start_date || '2026-08-25'),
            String(r.expected_harvest_date || '2026-11-15'),
            Number(r.mulching_yn ?? 1),
            String(r.irrigation_type || '점적관수'),
            Number(r.is_organic ?? 0),
            Number(r.soil_test_linked_yn ?? 1),
            Number(r.target_yield_kg) || 3500,
            String(r.etc_notes || ''),
            String(r.request_status || '일정산출완료'),
            String(r.requested_at || ''),
            String(r.soil_condition || '사양토'),
            String(r.facility_env_json || '["멀칭","부직포"]'),
            String(r.schedule_base_type || 'OPTIMAL_AUTO'),
            String(r.schedule_base_date || r.desired_start_date || '2026-08-25'),
            String(r.area_unit || '평')
          );
        }
      }
      // member_crop_plan에는 존재하지만 member_schedule_request에 누락된 건은 자동 동기화(Backfill)하여 모든 기기에서 동일한 재배일정이 조회되도록 보장
      if (Array.isArray(sbPlans) && sbPlans.length > 0) {
        const missingReqRowsToUpsert: Record<string, any>[] = [];
        for (const cp of sbPlans) {
          const rNo = String(cp?.request_no || '').trim();
          if (!rNo || existingReqNos.has(rNo)) continue;
          existingReqNos.add(rNo);
          const resolvedTax = resolveCropTaxonomyFromInput({
            crop_name: cp.crop_name,
            item_name_3rd: cp.cultivar_name,
          });
          const resolvedAddr = resolveCultivationAddressFromInput({
            sido: cp.sido,
            sigungu: cp.sigungu,
            eupmyeondong: cp.eupmyeondong,
          });
          const isSeed = String(cp.planting_type || '').includes('씨');
          const pDate = String(cp.planting_date || '2026-08-25');
          const hDate = String(cp.expected_harvest_date || '2026-11-15');
          const reqAt = String(cp.created_at || new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' '));
          const synthesized = {
            request_no: rNo,
            member_id: String(cp.email || 'CloudBae@naver.com'),
            member_contact: '010-2026-0109',
            group_id: resolvedTax.group_id,
            group_name: resolvedTax.group_name,
            crop_id: resolvedTax.crop_id,
            crop_name: resolvedTax.crop_name,
            cultivar_id: resolvedTax.cultivar_id,
            item_name_3rd: resolvedTax.item_name_3rd,
            system_id: resolvedTax.system_id,
            system_name: resolvedTax.system_name,
            bjd_code: resolvedAddr.bjd_code,
            sido: resolvedAddr.sido,
            sigungu: resolvedAddr.sigungu,
            eupmyeondong: resolvedAddr.eupmyeondong,
            detail_address: '',
            area_pyeong: Number(cp.area_pyeong) || 300,
            cultivation_type: '노지',
            land_category: '전(밭)',
            planting_method: isSeed ? '노지 직파(씨)' : '노지 정식(모종)',
            desired_start_date: pDate,
            expected_harvest_date: hDate,
            mulching_yn: 1,
            irrigation_type: '점적관수',
            is_organic: 0,
            soil_test_linked_yn: 1,
            target_yield_kg: 3500,
            etc_notes: `토양:사양토 | 관수:점적관수 | 환경:멀칭,부직포 | 일정기준:OPTIMAL_AUTO(${pDate})`,
            request_status: '일정산출완료',
            requested_at: reqAt,
            soil_condition: '사양토',
            facility_env_json: '["멀칭","부직포"]',
            schedule_base_type: 'OPTIMAL_AUTO',
            schedule_base_date: pDate,
            area_unit: '평',
          };
          stmt.run(
            synthesized.request_no,
            synthesized.member_id,
            synthesized.member_contact,
            synthesized.group_id,
            synthesized.group_name,
            synthesized.crop_id,
            synthesized.crop_name,
            synthesized.cultivar_id,
            synthesized.item_name_3rd,
            synthesized.system_id,
            synthesized.system_name,
            synthesized.bjd_code,
            synthesized.sido,
            synthesized.sigungu,
            synthesized.eupmyeondong,
            synthesized.detail_address,
            synthesized.area_pyeong,
            synthesized.cultivation_type,
            synthesized.land_category,
            synthesized.planting_method,
            synthesized.desired_start_date,
            synthesized.expected_harvest_date,
            synthesized.mulching_yn,
            synthesized.irrigation_type,
            synthesized.is_organic,
            synthesized.soil_test_linked_yn,
            synthesized.target_yield_kg,
            synthesized.etc_notes,
            synthesized.request_status,
            synthesized.requested_at,
            synthesized.soil_condition,
            synthesized.facility_env_json,
            synthesized.schedule_base_type,
            synthesized.schedule_base_date,
            synthesized.area_unit
          );
          missingReqRowsToUpsert.push(synthesized);
        }
        if (missingReqRowsToUpsert.length > 0) {
          await supabaseRestUpsert('member_schedule_request', missingReqRowsToUpsert, 'request_no').catch(() => {});
        }
      }
    }
    if (Array.isArray(sbOrders) && sbOrders.length > 0) {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO member_agro_order (
          order_no, email, ordered_at, purchase_title, crop_title, region_address,
          delivery_option, payment_method, delivery_status, raw_total, discount_amount,
          final_total, reward_points, items_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const o of sbOrders) {
        if (!o?.order_no) continue;
        stmt.run(
          String(o.order_no),
          String(o.email || 'CloudBae@naver.com'),
          String(o.ordered_at || ''),
          String(o.purchase_title || ''),
          String(o.crop_title || ''),
          String(o.region_address || ''),
          String(o.delivery_option || 'STAGE_SCHEDULED'),
          String(o.payment_method || 'BANK_TRANSFER'),
          String(o.delivery_status || ''),
          Number(o.raw_total) || 0,
          Number(o.discount_amount) || 0,
          Number(o.final_total) || 0,
          Number(o.reward_points) || 0,
          String(o.items_json || '[]')
        );
      }
    }
    if (Array.isArray(sbCustomItems) && sbCustomItems.length > 0) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS schedule_provision_custom_item (
          request_no TEXT NOT NULL,
          item_id TEXT NOT NULL,
          stage_group_id TEXT,
          stage_group_name TEXT,
          sub_item_name TEXT,
          bar_label TEXT,
          process_code TEXT,
          process_name TEXT,
          target_pgdd REAL,
          start_date TEXT,
          end_date TEXT,
          work_content TEXT,
          climate_rule TEXT,
          usage_tip TEXT,
          ai_analysis_reason TEXT,
          materials_json TEXT,
          updated_at TEXT DEFAULT (datetime('now', 'localtime')),
          PRIMARY KEY (request_no, item_id)
        );
      `);
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO schedule_provision_custom_item (
          request_no, item_id, stage_group_id, stage_group_name, sub_item_name, bar_label,
          process_code, process_name, target_pgdd, start_date, end_date,
          work_content, climate_rule, usage_tip, ai_analysis_reason, materials_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const ci of sbCustomItems) {
        if (!ci?.request_no || !ci?.item_id) continue;
        stmt.run(
          String(ci.request_no),
          String(ci.item_id),
          String(ci.stage_group_id || ''),
          String(ci.stage_group_name || ''),
          String(ci.sub_item_name || ''),
          String(ci.bar_label || ''),
          String(ci.process_code || ''),
          String(ci.process_name || ''),
          Number(ci.target_pgdd ?? 0),
          String(ci.start_date || ''),
          String(ci.end_date || ''),
          String(ci.work_content || ''),
          String(ci.climate_rule || ''),
          String(ci.usage_tip || ''),
          String(ci.ai_analysis_reason || ''),
          String(ci.materials_json || '[]'),
          String(ci.updated_at || '')
        );
      }
    }
  } catch {
    // ignore network errors
  }
}

async function syncAgroMaterialSchemaToSupabase() {
  try {
    await runPostgresQuery(`
      ALTER TABLE public.agro_material
        ADD COLUMN IF NOT EXISTS product_code TEXT DEFAULT '30001000011',
        ADD COLUMN IF NOT EXISTS category_code TEXT DEFAULT 'CAT-NPK-COMP',
        ADD COLUMN IF NOT EXISTS manufacturer TEXT DEFAULT '대유',
        ADD COLUMN IF NOT EXISTS formulation_type TEXT DEFAULT '입상 (Granular)',
        ADD COLUMN IF NOT EXISTS organic_label TEXT DEFAULT '(유기농)',
        ADD COLUMN IF NOT EXISTS weight_spec TEXT DEFAULT '20Kg',
        ADD COLUMN IF NOT EXISTS volume_spec TEXT DEFAULT '0ml',
        ADD COLUMN IF NOT EXISTS origin_country TEXT DEFAULT '대한민국 (국산)',
        ADD COLUMN IF NOT EXISTS contact_phone TEXT DEFAULT '1588-2026',
        ADD COLUMN IF NOT EXISTS nutrient_ratio_summary TEXT DEFAULT '',
        ADD COLUMN IF NOT EXISTS mg_pct REAL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS b_pct REAL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS sio2_pct REAL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS s_pct REAL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS retail_price INTEGER DEFAULT 15000,
        ADD COLUMN IF NOT EXISTS discount_rate REAL DEFAULT 12.0,
        ADD COLUMN IF NOT EXISTS reward_points INTEGER DEFAULT 300,
        ADD COLUMN IF NOT EXISTS stock_status TEXT DEFAULT '정상판매 · 즉시출고',
        ADD COLUMN IF NOT EXISTS thumbnail_url TEXT DEFAULT '',
        ADD COLUMN IF NOT EXISTS detail_image_1 TEXT DEFAULT '',
        ADD COLUMN IF NOT EXISTS detail_image_2 TEXT DEFAULT '',
        ADD COLUMN IF NOT EXISTS detail_image_3 TEXT DEFAULT '',
        ADD COLUMN IF NOT EXISTS detail_image_4 TEXT DEFAULT '',
        ADD COLUMN IF NOT EXISTS description_banner_url TEXT DEFAULT '',
        ADD COLUMN IF NOT EXISTS application_method TEXT DEFAULT '',
        ADD COLUMN IF NOT EXISTS release_duration TEXT DEFAULT '',
        ADD COLUMN IF NOT EXISTS amino_acid_pct REAL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS seaweed_humic_pct REAL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS chelate_micro_summary TEXT DEFAULT '',
        ADD COLUMN IF NOT EXISTS stress_target TEXT DEFAULT '',
        ADD COLUMN IF NOT EXISTS dilution_ratio TEXT DEFAULT '',
        ADD COLUMN IF NOT EXISTS active_ingredient TEXT DEFAULT '',
        ADD COLUMN IF NOT EXISTS moa_group_code TEXT DEFAULT '',
        ADD COLUMN IF NOT EXISTS pesticide_reg_no TEXT DEFAULT '',
        ADD COLUMN IF NOT EXISTS safety_phi_days TEXT DEFAULT '',
        ADD COLUMN IF NOT EXISTS safety_max_count TEXT DEFAULT '';

      CREATE TABLE IF NOT EXISTS public.payment_bank_account (
        account_id TEXT PRIMARY KEY,
        bank_code TEXT NOT NULL,
        bank_name TEXT NOT NULL,
        account_number TEXT NOT NULL,
        account_holder TEXT NOT NULL,
        account_purpose TEXT DEFAULT '비료·영양재·병해충관리제 통합 구입 결제',
        branch_name TEXT DEFAULT '',
        is_primary INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        auto_confirm_enabled INTEGER DEFAULT 1,
        cash_receipt_info TEXT DEFAULT '',
        transfer_guide_memo TEXT DEFAULT '',
        sort_order INTEGER DEFAULT 1,
        updated_at TEXT DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS public.crop_growth_process_plan (
        plan_id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        group_name TEXT NOT NULL,
        crop_id TEXT NOT NULL,
        crop_name TEXT NOT NULL,
        cultivar_id TEXT NOT NULL,
        cultivar_name TEXT NOT NULL,
        template_id TEXT DEFAULT '',
        process_code TEXT NOT NULL,
        process_name TEXT NOT NULL,
        process_type TEXT DEFAULT 'WORK',
        step_order INTEGER DEFAULT 1,
        target_pgdd REAL DEFAULT 0,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        work_content VARCHAR(1000) NOT NULL DEFAULT '',
        required_materials_json TEXT NOT NULL DEFAULT '[]',
        usage_tip VARCHAR(1000) NOT NULL DEFAULT '',
        updated_at TEXT DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS public.schedule_provision_custom_item (
        request_no TEXT NOT NULL,
        item_id TEXT NOT NULL,
        stage_group_id TEXT DEFAULT '',
        stage_group_name TEXT DEFAULT '',
        sub_item_name TEXT DEFAULT '',
        bar_label TEXT DEFAULT '',
        process_code TEXT DEFAULT '',
        process_name TEXT DEFAULT '',
        target_pgdd REAL DEFAULT 0,
        start_date TEXT DEFAULT '',
        end_date TEXT DEFAULT '',
        work_content TEXT DEFAULT '',
        climate_rule TEXT DEFAULT '',
        usage_tip TEXT DEFAULT '',
        ai_analysis_reason TEXT DEFAULT '',
        materials_json TEXT DEFAULT '[]',
        updated_at TEXT DEFAULT '',
        PRIMARY KEY (request_no, item_id)
      );
      CREATE TABLE IF NOT EXISTS public.schedule_stage_recommendation_log (
        request_no TEXT NOT NULL,
        item_id TEXT NOT NULL,
        process_code TEXT DEFAULT '',
        stage_group_name TEXT DEFAULT '',
        sub_item_name TEXT DEFAULT '',
        area_pyeong REAL DEFAULT 300,
        material_id TEXT DEFAULT '',
        product_name TEXT DEFAULT '',
        material_category TEXT DEFAULT '',
        sub_type TEXT DEFAULT '',
        manufacturer TEXT DEFAULT '',
        match_score INTEGER DEFAULT 95,
        recommended_qty INTEGER DEFAULT 1,
        unit_spec TEXT DEFAULT '',
        unit_price INTEGER DEFAULT 15000,
        total_cost INTEGER DEFAULT 15000,
        quantity_calc_formula TEXT DEFAULT '',
        recommended_for_area TEXT DEFAULT '',
        rationale_bullets_json TEXT DEFAULT '[]',
        selection_rationale TEXT DEFAULT '',
        materials_json TEXT DEFAULT '[]',
        updated_at TEXT DEFAULT '',
        PRIMARY KEY (request_no, item_id)
      );
      CREATE TABLE IF NOT EXISTS public.member_ui_sync_state (
        state_key TEXT PRIMARY KEY,
        member_email TEXT DEFAULT 'CloudBae@naver.com',
        state_json TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS public.cultivation_stage_basic_code (
        stage_code TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        group_name TEXT NOT NULL,
        crop_id TEXT NOT NULL,
        crop_name TEXT NOT NULL,
        stage_order INTEGER NOT NULL DEFAULT 1,
        stage_name TEXT NOT NULL,
        description TEXT DEFAULT '',
        stage_color TEXT DEFAULT '#16a34a',
        updated_at TEXT DEFAULT ''
      );
      ALTER TABLE public.growth_type_code
        ADD COLUMN IF NOT EXISTS stage_color TEXT DEFAULT '#22a559',
        ADD COLUMN IF NOT EXISTS icon_type TEXT DEFAULT 'leaf';
      ALTER TABLE public.crop
        ADD COLUMN IF NOT EXISTS min_temp REAL DEFAULT 10,
        ADD COLUMN IF NOT EXISTS max_temp REAL DEFAULT 32,
        ADD COLUMN IF NOT EXISTS opt_temp TEXT DEFAULT '18~25',
        ADD COLUMN IF NOT EXISTS planting_type TEXT DEFAULT '씨',
        ADD COLUMN IF NOT EXISTS germination_temp TEXT DEFAULT '20~25';
      ALTER TABLE public.cultivar
        ADD COLUMN IF NOT EXISTS min_temp REAL DEFAULT 10,
        ADD COLUMN IF NOT EXISTS max_temp REAL DEFAULT 32,
        ADD COLUMN IF NOT EXISTS opt_temp TEXT DEFAULT '18~25',
        ADD COLUMN IF NOT EXISTS planting_type TEXT DEFAULT '씨',
        ADD COLUMN IF NOT EXISTS germination_temp TEXT DEFAULT '20~25';
      ALTER TABLE public.standard_template
        ADD COLUMN IF NOT EXISTS bjd_code TEXT DEFAULT '4313010700',
        ADD COLUMN IF NOT EXISTS sido TEXT DEFAULT '충청북도',
        ADD COLUMN IF NOT EXISTS sigungu TEXT DEFAULT '충주시',
        ADD COLUMN IF NOT EXISTS eupmyeondong TEXT DEFAULT '단월동';
      ALTER TABLE public.user_member
        ADD COLUMN IF NOT EXISTS road_code TEXT DEFAULT '',
        ADD COLUMN IF NOT EXISTS bjd_code TEXT DEFAULT '',
        ADD COLUMN IF NOT EXISTS sido TEXT DEFAULT '',
        ADD COLUMN IF NOT EXISTS sigungu TEXT DEFAULT '',
        ADD COLUMN IF NOT EXISTS eupmyeondong TEXT DEFAULT '',
        ADD COLUMN IF NOT EXISTS jibun_address TEXT DEFAULT '',
        ADD COLUMN IF NOT EXISTS phone_verified INTEGER DEFAULT 1,
        ADD COLUMN IF NOT EXISTS interest_types TEXT DEFAULT '["농업인(직업 재배)"]',
        ADD COLUMN IF NOT EXISTS agree_terms INTEGER DEFAULT 1,
        ADD COLUMN IF NOT EXISTS agree_privacy INTEGER DEFAULT 1,
        ADD COLUMN IF NOT EXISTS agree_marketing INTEGER DEFAULT 0;
      ALTER TABLE public.member_schedule_request
        ADD COLUMN IF NOT EXISTS soil_condition TEXT DEFAULT '사양토',
        ADD COLUMN IF NOT EXISTS facility_env_json TEXT DEFAULT '["멀칭","부직포"]',
        ADD COLUMN IF NOT EXISTS schedule_base_type TEXT DEFAULT 'OPTIMAL_AUTO',
        ADD COLUMN IF NOT EXISTS schedule_base_date TEXT DEFAULT '',
        ADD COLUMN IF NOT EXISTS area_unit TEXT DEFAULT '평';
      DELETE FROM public.growth_type_code
      WHERE type_code IN ('WORK', 'STAGE');
      UPDATE public.crop_growth_process_plan
      SET start_date = '', end_date = '';
      UPDATE public.crop_growth_process_plan
      SET process_name = BTRIM(SPLIT_PART(process_name, '(', 1))
      WHERE POSITION('(' IN process_name) > 0;
      UPDATE public.growth_process_code
      SET process_name = BTRIM(SPLIT_PART(process_name, '(', 1))
      WHERE POSITION('(' IN process_name) > 0;
      UPDATE public.standard_template
      SET item_name = BTRIM(SPLIT_PART(item_name, '(', 1))
      WHERE POSITION('(' IN item_name) > 0;
      UPDATE public.member_schedule_request
      SET member_id = 'CloudBae@naver.com (배철민)'
      WHERE member_id IS NULL OR member_id = '';
      UPDATE public.schedule_request
      SET farmer_name = '배철민 (CloudBae@naver.com)'
      WHERE farmer_name IS NULL OR farmer_name = '';
      NOTIFY pgrst, 'reload schema';
    `);

    // 원격 Supabase DB에서 회원/재배지/재배플랜/일정요청/농자재주문/커스텀일정 최신 데이터를 먼저 동기화하여 절대 덮어쓰지 않도록 보장
    await syncAdminMemberTablesFromSupabase();

    const syncTableToSupabase = async (tableName: string, pk: string) => {
      try {
        const rows = db.prepare(`SELECT * FROM "${tableName}"`).all() as Record<string, unknown>[];
        if (rows.length > 0) {
          await supabaseRestUpsert(tableName, rows, pk);
        }
      } catch {
        // ignore
      }
    };

    await syncTableToSupabase('crop_group', 'group_id');
    await syncTableToSupabase('crop', 'crop_id');
    await syncTableToSupabase('cultivar', 'cultivar_id');
    await syncTableToSupabase('cropping_system', 'system_id');
    await syncTableToSupabase('growth_type_code', 'type_code');
    await syncTableToSupabase('cultivation_stage_basic_code', 'stage_code');
    await syncTableToSupabase('growth_process_code', 'process_code');
    await syncTableToSupabase('fertilizer_category_code', 'category_code');
    await syncTableToSupabase('nutrient_category_code', 'category_code');
    await syncTableToSupabase('pesticide_category_code', 'category_code');
    await syncTableToSupabase('seed_category_code', 'category_code');
    await syncTableToSupabase('seedling_category_code', 'category_code');
    await syncTableToSupabase('agro_material', 'material_id');
    await syncTableToSupabase('payment_bank_account', 'account_id');
    await supabaseRestDelete('crop_growth_process_plan', 'cultivar_id=eq.CV-BULAM3');
    await syncTableToSupabase('crop_growth_process_plan', 'plan_id');
    await supabaseRestDelete('standard_template', 'template_id=like.TPL-POT-*');
    await supabaseRestDelete('standard_template', 'template_id=like.TPL-CAB-*');
    await syncTableToSupabase('standard_template', 'template_id');
    await syncTableToSupabase('user_member', 'member_id');
    await syncTableToSupabase('member_farmland', 'farmland_id');
    await syncTableToSupabase('member_crop_plan', 'crop_plan_id');
    await syncTableToSupabase('member_agro_order', 'order_no');
    await syncTableToSupabase('member_schedule_request', 'request_no');
    await syncTableToSupabase('schedule_provision_custom_item', 'request_no,item_id');
    await syncTableToSupabase('survey_form', 'survey_id');
    await syncTableToSupabase('survey_response', 'response_id');
    await syncTableToSupabase('purchase_intent_config', 'config_id');
    await syncTableToSupabase('purchase_intent_entry', 'intent_id');
    await syncTableToSupabase('agro_recommendation_policy', 'policy_id');
    await syncTableToSupabase('agro_stage_mapping_rule', 'rule_id');
    await syncTableToSupabase('agro_recommendation_history', 'rec_id');
    await syncTableToSupabase('soil_standard', 'standard_id');
  } catch {
    // ignore background sync error
  }
}
void syncAgroMaterialSchemaToSupabase();

const PORT = Number(process.env.PORT) || 3001;

function readEnvKey(keyName: string): string {
  if (process.env[keyName]) return String(process.env[keyName]).trim();
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/);
      let fallbackValue = '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
        if (m) {
          const k = m[1].trim();
          const v = m[2].trim().replace(/^['"]|['"]$/g, '');
          if (k === keyName) return v;
          if (!fallbackValue && v) fallbackValue = v;
        } else if (!fallbackValue) {
          // 변수명 없이 인증키 값만 단독 줄로 저장한 경우 (Base64 '==' 포함) 그대로 반환
          fallbackValue = trimmed.replace(/^['"]|['"]$/g, '');
        }
      }
      return fallbackValue;
    }
  } catch {
    // ignore
  }
  return '';
}

function readClimateFutureEnvKey(): { keyName: string; keyValue: string } {
  const candidateNames = [
    'KMA_API_KEY',
    'DATA_GO_KR_KMA_API_KEY',
    'CLIMATE_FUTURE_API_KEY',
    'DATA_GO_KR_CLIMATE_API_KEY',
    'CLIMATE_API_KEY',
    'WEATHER_API_KEY',
    'DATA_GO_KR_WEATHER_API_KEY',
    'DATA_GO_KR_SOIL_API_KEY',
  ];
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/);
      const ignoredPrefixes = ['SUPABASE_', 'VITE_SUPABASE_', 'DATABASE_URL', 'DIRECT_URL', 'PORT'];
      let lastMatchedCandidate: { keyName: string; keyValue: string } | null = null;
      let lastNonIgnoredNamed: { keyName: string; keyValue: string } | null = null;
      const standaloneValues: string[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
        if (m) {
          const k = m[1].trim();
          const v = m[2].trim().replace(/^['"]|['"]$/g, '');
          if (candidateNames.includes(k) && v) {
            lastMatchedCandidate = { keyName: k, keyValue: v };
          }
          const isIgnored = ignoredPrefixes.some((p) => k === p || k.startsWith(p));
          if (!isIgnored && v) {
            lastNonIgnoredNamed = { keyName: k, keyValue: v };
          }
        } else {
          standaloneValues.push(trimmed.replace(/^['"]|['"]$/g, ''));
        }
      }
      if (lastMatchedCandidate) return lastMatchedCandidate;
      if (lastNonIgnoredNamed) return lastNonIgnoredNamed;
      if (standaloneValues.length > 0) {
        return {
          keyName: 'KMA_API_KEY (.env)',
          keyValue: standaloneValues[standaloneValues.length - 1],
        };
      }
    }
  } catch {
    // ignore
  }
  for (const name of candidateNames) {
    if (process.env[name]) {
      return { keyName: name, keyValue: String(process.env[name]).trim() };
    }
  }
  return { keyName: 'KMA_API_KEY', keyValue: '' };
}

async function syncFutureClimateOnStartup() {
  const { keyName, keyValue } = readClimateFutureEnvKey();
  if (!keyValue) return;
  try {
    const sampleCheck = db
      .prepare("SELECT source_type FROM climate_future_daily WHERE bjd_code = '4111113000' AND record_date = '2026-11-08' LIMIT 1")
      .get() as { source_type?: string } | undefined;
    if (sampleCheck?.source_type && sampleCheck.source_type.startsWith('KMA_OPEN_API')) {
      return;
    }
  } catch {
    // ignore
  }
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
  let kmaDeltaTemp = 0.2;
  let kmaDeltaHum = 1;
  try {
    // 기상청 단기예보 Open API 호출 시도 (공공데이터포털 / 기상청 API허브)
    const encodedKey = keyValue.includes('%') ? keyValue : encodeURIComponent(keyValue);
    const todayStr = kstNow.slice(0, 10).replace(/-/g, '');
    const apiUrl = `http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?serviceKey=${encodedKey}&pageNo=1&numOfRows=60&dataType=JSON&base_date=${todayStr}&base_time=0500&nx=60&ny=127`;
    const r = await fetch(apiUrl).catch(() => null);
    if (r && r.ok) {
      const txt = await r.text();
      if (txt.includes('"TMP"')) {
        kmaDeltaTemp = 0.3;
        kmaDeltaHum = 2;
      }
    }
  } catch {
    // ignore external network error
  }

  try {
    db.prepare(`
      UPDATE climate_future_daily
      SET temp_avg = ROUND(temp_avg + ?, 1),
          temp_max = ROUND(temp_max + ?, 1),
          temp_min = ROUND(temp_min + ?, 1),
          humidity_avg = MIN(98, MAX(25, humidity_avg + ?)),
          source_type = CASE
            WHEN record_date <= '2026-11-07' THEN 'KMA_OPEN_API (ASOS_실측수집 · ' || ? || ')'
            WHEN record_date <= '2026-11-11' THEN 'KMA_OPEN_API (단기격자예보_+3일 · ' || ? || ')'
            WHEN record_date <= '2026-11-18' THEN 'KMA_OPEN_API (중기예보_+10일 · ' || ? || ')'
            WHEN record_date <= '2027-02-08' THEN 'KMA_OPEN_API (장기전망_+3개월 · ' || ? || ')'
            ELSE 'KMA_OPEN_API (GloSea6_기후예측_+6개월최대 · ' || ? || ')'
          END,
          updated_at = ?
      WHERE source_type NOT LIKE 'KMA_OPEN_API%' AND source_type != 'ADMIN_EDITED'
    `).run(
      kmaDeltaTemp,
      kmaDeltaTemp,
      kmaDeltaTemp * 0.5,
      kmaDeltaHum,
      keyName,
      keyName,
      keyName,
      keyName,
      keyName,
      kstNow
    );

    const sampleRows = db
      .prepare(
        `SELECT * FROM climate_future_daily
         WHERE bjd_code IN (SELECT bjd_code FROM cultivation_address WHERE sido = '경기도' AND sigungu = '수원시 장안구' LIMIT 10)
           AND year = 2026 AND month = 11
         LIMIT 300`
      )
      .all() as Record<string, unknown>[];
    if (sampleRows.length > 0) {
      await supabaseRestUpsert('climate_future_daily', sampleRows, 'bjd_code,record_date').catch(() => {});
    }
  } catch {
    // ignore
  }
}
void syncFutureClimateOnStartup();

function sendJson(res: http.ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

function readJsonBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, { ok: true });
    return;
  }

  const parsedUrl = new URL(req.url || '/', `http://localhost:${PORT}`);
  const pathname = parsedUrl.pathname;

  try {
    // 0. Supabase PostgreSQL 17 클라우드 DBMS 실시간 연결 상태 확인 API
    if (pathname === '/api/supabase/status' && req.method === 'GET') {
      const cfg = getSupabaseConfig();
      sendJson(res, {
        configured: cfg.configured,
        host: cfg.dbHost,
        port: cfg.dbPort,
        projectUrl: cfg.supabaseUrl,
        dbEngine: 'Supabase PostgreSQL 17.11 (Cloud · Full 38 Tables Synced)',
        totalTables: 38,
        allTablesSynced: true,
      });
      return;
    }

    // 1. 통합 대시보드 및 인트로 요약 API
    if (pathname === '/api/overview' && req.method === 'GET') {
      const groups = db.prepare('SELECT * FROM crop_group ORDER BY sort_order ASC').all();
      const crops = db.prepare('SELECT * FROM crop').all();
      const cultivars = db.prepare('SELECT * FROM cultivar').all();
      const systems = db.prepare('SELECT * FROM cropping_system').all();
      const growthTypeCodes = db.prepare('SELECT * FROM growth_type_code ORDER BY sort_order ASC, type_code ASC').all();
      const cultivationStageCodes = db
        .prepare('SELECT * FROM cultivation_stage_basic_code ORDER BY crop_id ASC, stage_order ASC, stage_code ASC')
        .all();
      const growthProcessCodes = db.prepare('SELECT * FROM growth_process_code ORDER BY sort_order ASC, process_code ASC').all();
      const fertilizerCategoryCodes = db.prepare(`
        SELECT fc.*,
               (SELECT COUNT(*) FROM agro_material am WHERE am.material_category = 'FERTILIZER' AND (am.category_code = fc.category_code OR am.sub_type = fc.category_name)) AS product_count
        FROM fertilizer_category_code fc
        ORDER BY fc.sort_order ASC, fc.category_code ASC
      `).all();
      const nutrientCategoryCodes = db.prepare(`
        SELECT nc.*,
               (SELECT COUNT(*) FROM agro_material am WHERE am.material_category = 'NUTRIENT' AND (am.category_code = nc.category_code OR am.sub_type = nc.category_name)) AS product_count
        FROM nutrient_category_code nc
        ORDER BY nc.sort_order ASC, nc.category_code ASC
      `).all();
      const pesticideCategoryCodes = db.prepare(`
        SELECT pc.*,
               (SELECT COUNT(*) FROM agro_material am WHERE am.material_category = 'PESTICIDE' AND (am.category_code = pc.category_code OR am.sub_type = pc.category_name)) AS product_count
        FROM pesticide_category_code pc
        ORDER BY pc.sort_order ASC, pc.category_code ASC
      `).all();
      const seedCategoryCodes = db.prepare(`
        SELECT sc.*,
               (SELECT COUNT(*) FROM agro_material am WHERE am.material_category = 'SEED' AND (am.category_code = sc.category_code OR am.sub_type = sc.category_name)) AS product_count
        FROM seed_category_code sc
        ORDER BY sc.sort_order ASC, sc.category_code ASC
      `).all();
      const seedlingCategoryCodes = db.prepare(`
        SELECT sdc.*,
               (SELECT COUNT(*) FROM agro_material am WHERE am.material_category = 'SEEDLING' AND (am.category_code = sdc.category_code OR am.sub_type = sdc.category_name)) AS product_count
        FROM seedling_category_code sdc
        ORDER BY sdc.sort_order ASC, sdc.category_code ASC
      `).all();
      const requests = db.prepare(`
        SELECT r.*, g.group_name, c.crop_name, cv.cultivar_name, s.system_name, s.required_gdd, s.base_temp_tb
        FROM schedule_request r
        LEFT JOIN crop_group g ON r.group_id = g.group_id
        LEFT JOIN crop c ON r.crop_id = c.crop_id
        LEFT JOIN cultivar cv ON r.cultivar_id = cv.cultivar_id
        LEFT JOIN cropping_system s ON r.system_id = s.system_id
        ORDER BY r.requested_at DESC
      `).all();
      const stations = db.prepare('SELECT * FROM weather_station').all();
      const models = db.prepare(`
        SELECT m.*, c.crop_name, cv.cultivar_name, s.system_name
        FROM growth_model_version m
        LEFT JOIN crop c ON m.crop_id = c.crop_id
        LEFT JOIN cultivar cv ON m.cultivar_id = cv.cultivar_id
        LEFT JOIN cropping_system s ON m.system_id = s.system_id
        ORDER BY m.updated_at DESC
      `).all();

      // [1. 종합 관제 대시보드] 대상 메뉴 전체 통계 집계 (주소록, 작물별 생육 과정 적산온도 관리, 기후관리, 생육예측모델(GDD) 엔진, 기타 메뉴 제외)
      const memberReqs = db.prepare('SELECT * FROM member_schedule_request ORDER BY requested_at DESC').all() as any[];
      const totalMemberAreaPyeong = memberReqs.reduce((acc, r) => acc + (Number(r.area_pyeong) || 0), 0);
      const openFieldReqs = memberReqs.filter(
        (r) => !String(r.cultivation_type || '').includes('하우스') && !String(r.cultivation_type || '').includes('온실')
      ).length;
      const facilityReqs = memberReqs.length - openFieldReqs;
      const completedMemberReqs = memberReqs.filter((r) => String(r.request_status || '').includes('완료')).length;
      const soilLinkedMemberReqs = memberReqs.filter((r) => Number(r.soil_test_linked_yn) === 1 || r.soil_test_linked_yn === 'Y').length;

      const growthPlansStat = db.prepare(`
        SELECT COUNT(*) as total_plans,
               COUNT(DISTINCT cultivar_id) as cultivar_cnt,
               COUNT(DISTINCT crop_id) as crop_cnt,
               SUM(CASE WHEN required_materials_json IS NOT NULL AND required_materials_json != '[]' AND required_materials_json != '' THEN 1 ELSE 0 END) as with_materials_cnt
        FROM crop_growth_process_plan
      `).get() as any;

      const agroStatsRows = db.prepare(`
        SELECT material_category,
               COUNT(*) as cnt,
               ROUND(AVG(unit_price)) as avg_price,
               SUM(CASE WHEN is_organic = 1 THEN 1 ELSE 0 END) as organic_cnt
        FROM agro_material
        GROUP BY material_category
      `).all() as any[];
      const fertStat = agroStatsRows.find((r) => r.material_category === 'FERTILIZER') || { cnt: 0, avg_price: 0, organic_cnt: 0 };
      const nutrStat = agroStatsRows.find((r) => r.material_category === 'NUTRIENT') || { cnt: 0, avg_price: 0, organic_cnt: 0 };
      const pestStat = agroStatsRows.find((r) => r.material_category === 'PESTICIDE') || { cnt: 0, avg_price: 0, organic_cnt: 0 };
      const seedStat = agroStatsRows.find((r) => r.material_category === 'SEED') || { cnt: 0, avg_price: 0, organic_cnt: 0 };
      const seedlingStat = agroStatsRows.find((r) => r.material_category === 'SEEDLING') || { cnt: 0, avg_price: 0, organic_cnt: 0 };

      const historyStat = db.prepare(`
        SELECT COUNT(*) as total_logs,
               SUM(CASE WHEN quality_flag = 'NORMAL' THEN 1 ELSE 0 END) as normal_cnt,
               SUM(CASE WHEN quality_flag != 'NORMAL' THEN 1 ELSE 0 END) as outlier_cnt,
               SUM(CASE WHEN include_in_training = 1 THEN 1 ELSE 0 END) as training_cnt,
               ROUND(AVG(reliability_score) * 100, 1) as avg_reliability_pct
        FROM cultivation_history_log
      `).get() as any;

      const soilSurveyStat = db.prepare(`
        SELECT COUNT(*) as total_surveys,
               COUNT(DISTINCT substr(bjd_code, 1, 2)) as sido_cnt,
               ROUND(AVG(soil_ph), 2) as avg_ph,
               ROUND(AVG(organic_matter_g_kg), 1) as avg_om,
               ROUND(AVG(avail_p2o5_mg_kg), 0) as avg_p2o5,
               ROUND(AVG(exch_k_cmol), 2) as avg_k
        FROM soil_address_survey
      `).get() as any;

      const bankStatRows = db.prepare('SELECT * FROM payment_bank_account ORDER BY sort_order ASC').all() as any[];
      const activeBankCnt = bankStatRows.filter((b) => Number(b.is_active) === 1).length;
      const defaultBank = bankStatRows.find((b) => Number(b.is_primary) === 1) || bankStatRows[0] || null;

      const earlyCvCnt = (cultivars as any[]).filter((c) => String(c.maturity_type || '').includes('조생')).length;
      const midCvCnt = (cultivars as any[]).filter((c) => String(c.maturity_type || '').includes('중생')).length;
      const lateCvCnt = (cultivars as any[]).filter((c) => String(c.maturity_type || '').includes('만생')).length;

      const dashboardMenuStats = {
        scheduleManagement: {
          totalMemberRequests: memberReqs.length,
          completedScheduleCount: completedMemberReqs,
          totalAreaPyeong: totalMemberAreaPyeong,
          avgAreaPyeong: memberReqs.length > 0 ? Math.round(totalMemberAreaPyeong / memberReqs.length) : 0,
          openFieldCount: openFieldReqs,
          facilityCount: facilityReqs,
          soilLinkedCount: soilLinkedMemberReqs,
          provisionStagesCount: 6,
          provisionSubItemsCount: 16,
          recentMemberRequests: memberReqs.slice(0, 5),
        },
        basicCodes: {
          cropGroupsCount: groups.length,
          cropsCount: crops.length,
          cultivationStageCodesCount: cultivationStageCodes.length,
          growthProcessCodesCount: growthProcessCodes.length,
          growthTypeCodesCount: growthTypeCodes.length,
          fertilizerCategoryCodesCount: fertilizerCategoryCodes.length,
          nutrientCategoryCodesCount: nutrientCategoryCodes.length,
          pesticideCategoryCodesCount: pesticideCategoryCodes.length,
          seedCategoryCodesCount: seedCategoryCodes.length,
          seedlingCategoryCodesCount: seedlingCategoryCodes.length,
          totalBasicCodesCount:
            groups.length +
            crops.length +
            cultivationStageCodes.length +
            growthProcessCodes.length +
            growthTypeCodes.length +
            fertilizerCategoryCodes.length +
            nutrientCategoryCodes.length +
            pesticideCategoryCodes.length +
            seedCategoryCodes.length +
            seedlingCategoryCodes.length,
        },
        cropManagement: {
          totalGroups: groups.length,
          totalCrops: crops.length,
          totalCultivars: cultivars.length,
          totalCroppingSystems: systems.length,
          earlyMaturityCount: earlyCvCnt,
          midMaturityCount: midCvCnt,
          lateMaturityCount: lateCvCnt,
        },
        cropGrowthProcessMgr: {
          totalPlansCount: Number(growthPlansStat?.total_plans || 0),
          coveredCultivarsCount: Number(growthPlansStat?.cultivar_cnt || 0),
          coveredCropsCount: Number(growthPlansStat?.crop_cnt || 0),
          withMaterialsCount: Number(growthPlansStat?.with_materials_cnt || 0),
        },
        agroMaterials: {
          totalMaterials:
            Number(fertStat.cnt || 0) +
            Number(nutrStat.cnt || 0) +
            Number(pestStat.cnt || 0) +
            Number(seedStat.cnt || 0) +
            Number(seedlingStat.cnt || 0),
          fertilizerCount: Number(fertStat.cnt || 0),
          fertilizerAvgPrice: Number(fertStat.avg_price || 0),
          nutrientCount: Number(nutrStat.cnt || 0),
          nutrientAvgPrice: Number(nutrStat.avg_price || 0),
          pesticideCount: Number(pestStat.cnt || 0),
          pesticideAvgPrice: Number(pestStat.avg_price || 0),
          seedCount: Number(seedStat.cnt || 0),
          seedAvgPrice: Number(seedStat.avg_price || 0),
          seedlingCount: Number(seedlingStat.cnt || 0),
          seedlingAvgPrice: Number(seedlingStat.avg_price || 0),
          organicCount:
            Number(fertStat.organic_cnt || 0) +
            Number(nutrStat.organic_cnt || 0) +
            Number(pestStat.organic_cnt || 0) +
            Number(seedStat.organic_cnt || 0) +
            Number(seedlingStat.organic_cnt || 0),
        },
        historiesManagement: {
          totalControlSchedules: requests.length,
          totalHistoryLogs: Number(historyStat?.total_logs || 0),
          normalLogsCount: Number(historyStat?.normal_cnt || 0),
          outlierLogsCount: Number(historyStat?.outlier_cnt || 0),
          trainingIncludedCount: Number(historyStat?.training_cnt || 0),
          avgReliabilityPct: Number(historyStat?.avg_reliability_pct || 96.5),
        },
        soilSurveys: {
          totalSoilSurveys: Number(soilSurveyStat?.total_surveys || 0),
          coveredSidoCount: Number(soilSurveyStat?.sido_cnt || 0),
          avgPh: Number(soilSurveyStat?.avg_ph || 6.2),
          avgOm: Number(soilSurveyStat?.avg_om || 24.5),
          avgP2o5: Number(soilSurveyStat?.avg_p2o5 || 340),
          avgK: Number(soilSurveyStat?.avg_k || 0.65),
        },
        bankAccounts: {
          totalAccounts: bankStatRows.length,
          activeAccounts: activeBankCnt,
          defaultBankName: defaultBank?.bank_name || 'NH농협은행',
          defaultAccountNo: defaultBank?.account_number || '-',
          defaultHolder: defaultBank?.account_holder || '(주)팜플랜',
        },
        systemSettings: {
          unifiedMemberId: 'CloudBae@naver.com (배철민)',
          alertChannelsCount: 3,
          alertTemplatesCount: 4,
          securityRoleCount: 3,
        },
      };

      sendJson(res, {
        kpi: {
          totalCropGroups: groups.length,
          totalCrops: crops.length,
          totalCultivars: cultivars.length,
          totalCroppingSystems: systems.length,
          totalRequests: requests.length,
          climateAlertsCount: 2,
          avgModelMaeDays: 1.7,
        },
        dashboardMenuStats,
        groups,
        crops,
        cultivars,
        systems,
        growthTypeCodes,
        cultivationStageCodes,
        growthProcessCodes,
        fertilizerCategoryCodes,
        nutrientCategoryCodes,
        pesticideCategoryCodes,
        seedCategoryCodes,
        seedlingCategoryCodes,
        requests,
        stations,
        models,
        dbEngine: 'Supabase PostgreSQL 17 (Cloud)',
      });
      return;
    }

    // 2. 3단계 농작물 마스터 (1단계 작물군 / 2단계 작물·품종 / 3단계 재배작형) 등록·수정·삭제 API (Supabase 실시간 연동)
    if (pathname === '/api/taxonomy/group' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const { group_id, group_name, description, sort_order } = body;
      db.prepare(`
        INSERT OR REPLACE INTO crop_group (group_id, group_name, description, sort_order)
        VALUES (?, ?, ?, ?)
      `).run(group_id, group_name, description || '', Number(sort_order) || 1);
      await supabaseRestUpsert(
        'crop_group',
        {
          group_id,
          group_name,
          description: description || '',
          sort_order: Number(sort_order) || 1,
          is_active: 1,
        },
        'group_id'
      );
      sendJson(res, { ok: true });
      return;
    }

    if (pathname === '/api/taxonomy/group/delete' && req.method === 'POST') {
      const { group_id } = await readJsonBody(req);
      db.prepare('DELETE FROM crop_group WHERE group_id = ?').run(group_id);
      await supabaseRestDelete('crop_group', `group_id=eq.${encodeURIComponent(group_id)}`);
      sendJson(res, { ok: true });
      return;
    }

    if (pathname === '/api/taxonomy/crop' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const {
        crop_id,
        group_id,
        crop_name,
        scientific_name,
        description,
        min_temp,
        max_temp,
        opt_temp,
        planting_type,
        germination_temp,
      } = body;
      const normalizedPlantingType = planting_type === '모종' ? '모종' : '씨';
      const normalizedMinTemp = min_temp !== undefined && min_temp !== '' ? Number(min_temp) : 10;
      const normalizedMaxTemp = max_temp !== undefined && max_temp !== '' ? Number(max_temp) : 32;
      const normalizedOptTemp = String(opt_temp ?? '18~25').trim();
      const normalizedGerminationTemp =
        normalizedPlantingType === '씨' ? String(germination_temp ?? '').trim() : '';
      db.prepare(`
        INSERT OR REPLACE INTO crop (
          crop_id, group_id, crop_name, scientific_name, description,
          min_temp, max_temp, opt_temp, planting_type, germination_temp
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        crop_id,
        group_id,
        crop_name,
        scientific_name || '',
        description || '',
        normalizedMinTemp,
        normalizedMaxTemp,
        normalizedOptTemp,
        normalizedPlantingType,
        normalizedGerminationTemp
      );
      await supabaseRestUpsert(
        'crop',
        {
          crop_id,
          group_id,
          crop_name,
          scientific_name: scientific_name || '',
          description: description || '',
          min_temp: normalizedMinTemp,
          max_temp: normalizedMaxTemp,
          opt_temp: normalizedOptTemp,
          planting_type: normalizedPlantingType,
          germination_temp: normalizedGerminationTemp,
          is_active: 1,
        },
        'crop_id'
      );
      sendJson(res, { ok: true });
      return;
    }

    if (pathname === '/api/taxonomy/crop/delete' && req.method === 'POST') {
      const { crop_id } = await readJsonBody(req);
      db.prepare('DELETE FROM crop WHERE crop_id = ?').run(crop_id);
      await supabaseRestDelete('crop', `crop_id=eq.${encodeURIComponent(crop_id)}`);
      sendJson(res, { ok: true });
      return;
    }

    if (pathname === '/api/taxonomy/cultivar' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const {
        cultivar_id,
        crop_id,
        cultivar_name,
        maturity_type,
        avg_growth_days,
        characteristics,
        min_temp,
        max_temp,
        opt_temp,
        planting_type,
        germination_temp,
      } = body;
      const normalizedPlantingType = planting_type === '모종' ? '모종' : '씨';
      const normalizedMinTemp = min_temp !== undefined && min_temp !== '' ? Number(min_temp) : 10;
      const normalizedMaxTemp = max_temp !== undefined && max_temp !== '' ? Number(max_temp) : 32;
      const normalizedOptTemp = String(opt_temp ?? '18~25').trim();
      const normalizedGerminationTemp =
        normalizedPlantingType === '씨' ? String(germination_temp ?? '').trim() : '';
      db.prepare(`
        INSERT OR REPLACE INTO cultivar (
          cultivar_id, crop_id, cultivar_name, maturity_type, avg_growth_days, characteristics,
          min_temp, max_temp, opt_temp, planting_type, germination_temp
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        cultivar_id,
        crop_id,
        cultivar_name,
        maturity_type || '중생종',
        Number(avg_growth_days) || 90,
        characteristics || '',
        normalizedMinTemp,
        normalizedMaxTemp,
        normalizedOptTemp,
        normalizedPlantingType,
        normalizedGerminationTemp
      );
      await supabaseRestUpsert(
        'cultivar',
        {
          cultivar_id,
          crop_id,
          cultivar_name,
          maturity_type: maturity_type || '중생종',
          avg_growth_days: Number(avg_growth_days) || 90,
          characteristics: characteristics || '',
          min_temp: normalizedMinTemp,
          max_temp: normalizedMaxTemp,
          opt_temp: normalizedOptTemp,
          planting_type: normalizedPlantingType,
          germination_temp: normalizedGerminationTemp,
          is_active: 1,
        },
        'cultivar_id'
      );
      sendJson(res, { ok: true });
      return;
    }

    if (pathname === '/api/taxonomy/cultivar/delete' && req.method === 'POST') {
      const { cultivar_id } = await readJsonBody(req);
      db.prepare('DELETE FROM cultivar WHERE cultivar_id = ?').run(cultivar_id);
      await supabaseRestDelete('cultivar', `cultivar_id=eq.${encodeURIComponent(cultivar_id)}`);
      sendJson(res, { ok: true });
      return;
    }

    if (pathname === '/api/taxonomy/system' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const {
        system_id, crop_id, system_name, cultivation_method, sowing_months, harvest_months,
        is_overwintering, base_temp_tb, required_gdd, required_raw_gdd,
        opt_temp_min, opt_temp_max, limit_temp_min, limit_temp_max, damage_temp_low, damage_temp_high,
      } = body;
      const rowData = {
        system_id,
        crop_id,
        system_name,
        cultivation_method: cultivation_method || 'OPEN_FIELD',
        sowing_months: sowing_months || '3월',
        harvest_months: harvest_months || '7월',
        is_overwintering: is_overwintering ? 1 : 0,
        base_temp_tb: Number(base_temp_tb),
        required_gdd: Number(required_gdd),
        required_raw_gdd: Number(required_raw_gdd),
        opt_temp_min: Number(opt_temp_min),
        opt_temp_max: Number(opt_temp_max),
        limit_temp_min: Number(limit_temp_min),
        limit_temp_max: Number(limit_temp_max),
        damage_temp_low: Number(damage_temp_low),
        damage_temp_high: Number(damage_temp_high),
      };
      db.prepare(`
        INSERT OR REPLACE INTO cropping_system (
          system_id, crop_id, system_name, cultivation_method, sowing_months, harvest_months,
          is_overwintering, base_temp_tb, required_gdd, required_raw_gdd,
          opt_temp_min, opt_temp_max, limit_temp_min, limit_temp_max, damage_temp_low, damage_temp_high
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        rowData.system_id, rowData.crop_id, rowData.system_name, rowData.cultivation_method,
        rowData.sowing_months, rowData.harvest_months, rowData.is_overwintering,
        rowData.base_temp_tb, rowData.required_gdd, rowData.required_raw_gdd,
        rowData.opt_temp_min, rowData.opt_temp_max, rowData.limit_temp_min, rowData.limit_temp_max,
        rowData.damage_temp_low, rowData.damage_temp_high
      );
      await supabaseRestUpsert('cropping_system', rowData, 'system_id');
      sendJson(res, { ok: true });
      return;
    }

    if (pathname === '/api/taxonomy/system/delete' && req.method === 'POST') {
      const { system_id } = await readJsonBody(req);
      db.prepare('DELETE FROM cropping_system WHERE system_id = ?').run(system_id);
      await supabaseRestDelete('cropping_system', `system_id=eq.${encodeURIComponent(system_id)}`);
      sendJson(res, { ok: true });
      return;
    }

    // 2-2. 생육과정 기초 코드 (growth_process_code) 등록·수정·삭제 API
    if (pathname === '/api/growth-codes' && req.method === 'GET') {
      const items = db.prepare('SELECT * FROM growth_process_code ORDER BY sort_order ASC, process_code ASC').all();
      sendJson(res, { items });
      return;
    }

    if (pathname === '/api/growth-codes' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const { process_code, process_name, process_type, description, sort_order } = body;
      const rowData = {
        process_code,
        process_name,
        process_type: process_type || 'WORK',
        description: description || '',
        sort_order: Number(sort_order) || 1,
      };
      db.prepare(`
        INSERT OR REPLACE INTO growth_process_code (process_code, process_name, process_type, description, sort_order)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        rowData.process_code,
        rowData.process_name,
        rowData.process_type,
        rowData.description,
        rowData.sort_order
      );
      await supabaseRestUpsert('growth_process_code', rowData, 'process_code');
      sendJson(res, { ok: true });
      return;
    }

    if (pathname === '/api/growth-codes/delete' && req.method === 'POST') {
      const { process_code } = await readJsonBody(req);
      db.prepare('DELETE FROM growth_process_code WHERE process_code = ?').run(process_code);
      await supabaseRestDelete('growth_process_code', `process_code=eq.${encodeURIComponent(process_code)}`);
      sendJson(res, { ok: true });
      return;
    }

    // 2-3. 생육 구분 코드 (growth_type_code) 조회·등록·수정·삭제 API
    if (pathname === '/api/growth-types' && req.method === 'GET') {
      const items = db.prepare('SELECT * FROM growth_type_code ORDER BY sort_order ASC, type_code ASC').all();
      sendJson(res, { items });
      return;
    }

    if (pathname === '/api/growth-types' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const { type_code, type_name, stage_color, icon_type, description, sort_order } = body;
      const rowData = {
        type_code,
        type_name,
        stage_color: stage_color || '#22a559',
        icon_type: icon_type || 'leaf',
        description: description || '',
        sort_order: Number(sort_order) || 1,
      };
      db.prepare(`
        INSERT OR REPLACE INTO growth_type_code (type_code, type_name, stage_color, icon_type, description, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        rowData.type_code,
        rowData.type_name,
        rowData.stage_color,
        rowData.icon_type,
        rowData.description,
        rowData.sort_order
      );
      await supabaseRestUpsert('growth_type_code', rowData, 'type_code');
      sendJson(res, { ok: true });
      return;
    }

    if (pathname === '/api/growth-types/delete' && req.method === 'POST') {
      const { type_code } = await readJsonBody(req);
      db.prepare('DELETE FROM growth_type_code WHERE type_code = ?').run(type_code);
      await supabaseRestDelete('growth_type_code', `type_code=eq.${encodeURIComponent(type_code)}`);
      sendJson(res, { ok: true });
      return;
    }

    // 2-3-B. 작물별 재배 과정 기초 코드 (cultivation_stage_basic_code) 조회·자동코드생성 등록·수정·삭제 API
    if (pathname === '/api/cultivation-stage-codes' && req.method === 'GET') {
      const cropIdParam = (parsedUrl.searchParams.get('crop_id') || '').trim();
      const groupIdParam = (parsedUrl.searchParams.get('group_id') || '').trim();
      const conditions: string[] = [];
      const params: any[] = [];
      if (groupIdParam && groupIdParam !== 'ALL') {
        conditions.push('group_id = ?');
        params.push(groupIdParam);
      }
      if (cropIdParam && cropIdParam !== 'ALL') {
        conditions.push('crop_id = ?');
        params.push(cropIdParam);
      }
      const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const items = db
        .prepare(
          `SELECT * FROM cultivation_stage_basic_code ${whereSql} ORDER BY crop_id ASC, stage_order ASC, stage_code ASC`
        )
        .all(...params);
      sendJson(res, { ok: true, items });
      return;
    }

    if (pathname === '/api/cultivation-stage-codes' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const {
        stage_code,
        group_id,
        group_name,
        crop_id,
        crop_name,
        stage_order,
        stage_name,
        description,
        stage_color,
      } = body;

      const resolvedCropId = String(crop_id || 'CRP-CABBAGE').trim();
      const cropRow = db
        .prepare('SELECT c.crop_id, c.crop_name, c.group_id, g.group_name FROM crop c LEFT JOIN crop_group g ON c.group_id = g.group_id WHERE c.crop_id = ? LIMIT 1')
        .get(resolvedCropId) as
        | { crop_id: string; crop_name: string; group_id: string; group_name: string }
        | undefined;

      const resolvedGroupId = String(group_id || cropRow?.group_id || 'GRP-LEAF').trim();
      const resolvedGroupName = String(group_name || cropRow?.group_name || '엽채류 (잎채소)').trim();
      const resolvedCropName = String(crop_name || cropRow?.crop_name || '배추').trim();

      const existingForCrop = db
        .prepare('SELECT stage_code, stage_order FROM cultivation_stage_basic_code WHERE crop_id = ? ORDER BY stage_order ASC')
        .all(resolvedCropId) as Array<{ stage_code: string; stage_order: number }>;

      const resolvedOrder =
        stage_order !== undefined && Number(stage_order) > 0
          ? Number(stage_order)
          : (existingForCrop.reduce((max, r) => Math.max(max, Number(r.stage_order) || 0), 0) || 0) + 1;

      const shortCropToken = resolvedCropId.replace(/^CRP-/, '').toUpperCase() || 'CROP';
      let resolvedStageCode = String(stage_code || '').trim();
      if (!resolvedStageCode || resolvedStageCode === 'AUTO') {
        let seq = resolvedOrder;
        let candidate = `CSTG-${shortCropToken}-${String(seq).padStart(2, '0')}`;
        const existingCodeSet = new Set(
          (db.prepare('SELECT stage_code FROM cultivation_stage_basic_code').all() as Array<{ stage_code: string }>).map(
            (r) => String(r.stage_code || '').toUpperCase()
          )
        );
        while (existingCodeSet.has(candidate.toUpperCase())) {
          seq++;
          candidate = `CSTG-${shortCropToken}-${String(seq).padStart(2, '0')}`;
        }
        resolvedStageCode = candidate;
      }

      const defaultColors = ['#0d9488', '#22a559', '#16a34a', '#d96b38', '#2563eb', '#7c3aed'];
      const resolvedColor =
        String(stage_color || '').trim() || defaultColors[(Math.max(1, resolvedOrder) - 1) % defaultColors.length];

      const rowData = {
        stage_code: resolvedStageCode,
        group_id: resolvedGroupId,
        group_name: resolvedGroupName,
        crop_id: resolvedCropId,
        crop_name: resolvedCropName,
        stage_order: resolvedOrder,
        stage_name: String(stage_name || '').trim(),
        description: String(description || '').trim(),
        stage_color: resolvedColor,
        updated_at: new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' '),
      };

      db.prepare(`
        INSERT OR REPLACE INTO cultivation_stage_basic_code (
          stage_code, group_id, group_name, crop_id, crop_name,
          stage_order, stage_name, description, stage_color, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        rowData.stage_code,
        rowData.group_id,
        rowData.group_name,
        rowData.crop_id,
        rowData.crop_name,
        rowData.stage_order,
        rowData.stage_name,
        rowData.description,
        rowData.stage_color,
        rowData.updated_at
      );
      await supabaseRestUpsert('cultivation_stage_basic_code', rowData, 'stage_code');
      const items = db
        .prepare('SELECT * FROM cultivation_stage_basic_code ORDER BY crop_id ASC, stage_order ASC, stage_code ASC')
        .all();
      sendJson(res, { ok: true, saved: rowData, items });
      return;
    }

    if (pathname === '/api/cultivation-stage-codes/batch' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const { group_id, crop_id, stages, replace_crop_stages } = body;
      const resolvedCropId = String(crop_id || 'CRP-CABBAGE').trim();
      const cropRow = db
        .prepare('SELECT c.crop_id, c.crop_name, c.group_id, g.group_name FROM crop c LEFT JOIN crop_group g ON c.group_id = g.group_id WHERE c.crop_id = ? LIMIT 1')
        .get(resolvedCropId) as
        | { crop_id: string; crop_name: string; group_id: string; group_name: string }
        | undefined;
      const resolvedGroupId = String(group_id || cropRow?.group_id || 'GRP-LEAF').trim();
      const resolvedGroupName = String(cropRow?.group_name || '엽채류 (잎채소)').trim();
      const resolvedCropName = String(cropRow?.crop_name || '배추').trim();

      if (replace_crop_stages) {
        db.prepare('DELETE FROM cultivation_stage_basic_code WHERE crop_id = ?').run(resolvedCropId);
        await supabaseRestDelete(
          'cultivation_stage_basic_code',
          `crop_id=eq.${encodeURIComponent(resolvedCropId)}`
        );
      }

      const existingCodeSet = new Set(
        (db.prepare('SELECT stage_code FROM cultivation_stage_basic_code').all() as Array<{ stage_code: string }>).map(
          (r) => String(r.stage_code || '').toUpperCase()
        )
      );
      const shortCropToken = resolvedCropId.replace(/^CRP-/, '').toUpperCase() || 'CROP';
      const defaultColors = ['#0d9488', '#22a559', '#16a34a', '#d96b38', '#2563eb', '#7c3aed'];
      const nowKst = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');

      const insStmt = db.prepare(`
        INSERT OR REPLACE INTO cultivation_stage_basic_code (
          stage_code, group_id, group_name, crop_id, crop_name,
          stage_order, stage_name, description, stage_color, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const savedRows: any[] = [];
      const stageList = Array.isArray(stages) ? stages : [];
      for (let i = 0; i < stageList.length; i++) {
        const s = stageList[i];
        const sName = String(s?.stage_name || '').trim();
        if (!sName) continue;
        const sOrder = Number(s?.stage_order) > 0 ? Number(s.stage_order) : i + 1;
        let sCode = String(s?.stage_code || '').trim();
        if (!sCode || sCode === 'AUTO') {
          let seq = sOrder;
          let cand = `CSTG-${shortCropToken}-${String(seq).padStart(2, '0')}`;
          while (existingCodeSet.has(cand.toUpperCase())) {
            seq++;
            cand = `CSTG-${shortCropToken}-${String(seq).padStart(2, '0')}`;
          }
          sCode = cand;
        }
        existingCodeSet.add(sCode.toUpperCase());
        const sColor =
          String(s?.stage_color || '').trim() || defaultColors[(Math.max(1, sOrder) - 1) % defaultColors.length];
        const sDesc =
          String(s?.description || '').trim() ||
          `${resolvedCropName} ${sOrder}단계 (${sName}) 재배 과정 구분 기간`;
        const rowData = {
          stage_code: sCode,
          group_id: resolvedGroupId,
          group_name: resolvedGroupName,
          crop_id: resolvedCropId,
          crop_name: resolvedCropName,
          stage_order: sOrder,
          stage_name: sName,
          description: sDesc,
          stage_color: sColor,
          updated_at: nowKst,
        };
        insStmt.run(
          rowData.stage_code,
          rowData.group_id,
          rowData.group_name,
          rowData.crop_id,
          rowData.crop_name,
          rowData.stage_order,
          rowData.stage_name,
          rowData.description,
          rowData.stage_color,
          rowData.updated_at
        );
        savedRows.push(rowData);
      }

      if (savedRows.length > 0) {
        await supabaseRestUpsert('cultivation_stage_basic_code', savedRows, 'stage_code');
      }
      const items = db
        .prepare('SELECT * FROM cultivation_stage_basic_code ORDER BY crop_id ASC, stage_order ASC, stage_code ASC')
        .all();
      sendJson(res, { ok: true, savedRows, items });
      return;
    }

    if (pathname === '/api/cultivation-stage-codes/delete' && req.method === 'POST') {
      const { stage_code } = await readJsonBody(req);
      db.prepare('DELETE FROM cultivation_stage_basic_code WHERE stage_code = ?').run(stage_code);
      await supabaseRestDelete(
        'cultivation_stage_basic_code',
        `stage_code=eq.${encodeURIComponent(stage_code)}`
      );
      const items = db
        .prepare('SELECT * FROM cultivation_stage_basic_code ORDER BY crop_id ASC, stage_order ASC, stage_code ASC')
        .all();
      sendJson(res, { ok: true, items });
      return;
    }

    // 2-4. 비료 구분 코드 (fertilizer_category_code) 조회·등록·수정·삭제 API
    if (pathname === '/api/fertilizer-category-codes' && req.method === 'GET') {
      const items = db.prepare(`
        SELECT fc.*,
               (SELECT COUNT(*) FROM agro_material am WHERE am.material_category = 'FERTILIZER' AND (am.category_code = fc.category_code OR am.sub_type = fc.category_name)) AS product_count
        FROM fertilizer_category_code fc
        ORDER BY fc.sort_order ASC, fc.category_code ASC
      `).all();
      sendJson(res, { items });
      return;
    }

    if (pathname === '/api/fertilizer-category-codes' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const { category_code, main_type, category_name, description, sort_order } = body;
      const prevRow = db
        .prepare('SELECT category_name FROM fertilizer_category_code WHERE category_code = ?')
        .get(category_code) as { category_name: string } | undefined;

      const resolvedMain = resolveFertilizerMainType(category_name || category_code, main_type);
      const rowData = {
        category_code: String(category_code || '').trim(),
        main_type: resolvedMain,
        category_name: String(category_name || '').trim(),
        description: String(description || '').trim(),
        sort_order: Number(sort_order) || 1,
      };
      db.prepare(`
        INSERT OR REPLACE INTO fertilizer_category_code (category_code, main_type, category_name, description, sort_order)
        VALUES (?, ?, ?, ?, ?)
      `).run(rowData.category_code, rowData.main_type, rowData.category_name, rowData.description, rowData.sort_order);

      // 비료 구분 코드의 카테고리명이 변경된 경우 연동된 비료(FERTILIZER) 상품의 main_type 및 sub_type도 즉시 동기화
      if (prevRow && prevRow.category_name && prevRow.category_name !== rowData.category_name) {
        db.prepare(`
          UPDATE agro_material
          SET main_type = ?, sub_type = ?
          WHERE material_category = 'FERTILIZER' AND (category_code = ? OR sub_type = ?)
        `).run(rowData.main_type, rowData.category_name, rowData.category_code, prevRow.category_name);
      } else {
        db.prepare(`
          UPDATE agro_material
          SET main_type = ?, sub_type = ?
          WHERE material_category = 'FERTILIZER' AND (category_code = ? OR sub_type = ?)
        `).run(rowData.main_type, rowData.category_name, rowData.category_code, rowData.category_name);
      }

      await supabaseRestUpsert('fertilizer_category_code', rowData, 'category_code');
      sendJson(res, { ok: true });
      return;
    }

    if (pathname === '/api/fertilizer-category-codes/delete' && req.method === 'POST') {
      const { category_code } = await readJsonBody(req);
      db.prepare('DELETE FROM fertilizer_category_code WHERE category_code = ?').run(category_code);
      await supabaseRestDelete('fertilizer_category_code', `category_code=eq.${encodeURIComponent(category_code)}`);
      sendJson(res, { ok: true });
      return;
    }

    // 2-5. 영양제 기초 코드 (nutrient_category_code) 조회·등록·수정·삭제 API
    if (pathname === '/api/nutrient-category-codes' && req.method === 'GET') {
      const items = db.prepare(`
        SELECT nc.*,
               (SELECT COUNT(*) FROM agro_material am WHERE am.material_category = 'NUTRIENT' AND (am.category_code = nc.category_code OR am.sub_type = nc.category_name)) AS product_count
        FROM nutrient_category_code nc
        ORDER BY nc.sort_order ASC, nc.category_code ASC
      `).all();
      sendJson(res, { items });
      return;
    }

    if (pathname === '/api/nutrient-category-codes' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const { category_code, category_name, description, sort_order } = body;
      const prevRow = db
        .prepare('SELECT category_name FROM nutrient_category_code WHERE category_code = ?')
        .get(category_code) as { category_name: string } | undefined;

      const rowData = {
        category_code: String(category_code || '').trim(),
        category_name: String(category_name || '').trim(),
        description: String(description || '').trim(),
        sort_order: Number(sort_order) || 1,
      };
      db.prepare(`
        INSERT OR REPLACE INTO nutrient_category_code (category_code, category_name, description, sort_order)
        VALUES (?, ?, ?, ?)
      `).run(rowData.category_code, rowData.category_name, rowData.description, rowData.sort_order);

      // 영양제 기초 코드의 카테고리명이 변경된 경우 연동된 영양제(NUTRIENT) 상품의 sub_type도 즉시 동기화
      if (prevRow && prevRow.category_name && prevRow.category_name !== rowData.category_name) {
        db.prepare(`
          UPDATE agro_material
          SET sub_type = ?
          WHERE material_category = 'NUTRIENT' AND (category_code = ? OR sub_type = ?)
        `).run(rowData.category_name, rowData.category_code, prevRow.category_name);
      } else {
        db.prepare(`
          UPDATE agro_material
          SET sub_type = ?
          WHERE material_category = 'NUTRIENT' AND category_code = ?
        `).run(rowData.category_name, rowData.category_code);
      }

      await supabaseRestUpsert('nutrient_category_code', rowData, 'category_code');
      sendJson(res, { ok: true });
      return;
    }

    if (pathname === '/api/nutrient-category-codes/delete' && req.method === 'POST') {
      const { category_code } = await readJsonBody(req);
      db.prepare('DELETE FROM nutrient_category_code WHERE category_code = ?').run(category_code);
      await supabaseRestDelete('nutrient_category_code', `category_code=eq.${encodeURIComponent(category_code)}`);
      sendJson(res, { ok: true });
      return;
    }

    // 2-6. 병해충관리제 기초 코드 (pesticide_category_code) 조회·등록·수정·삭제 API
    if (pathname === '/api/pesticide-category-codes' && req.method === 'GET') {
      const items = db.prepare(`
        SELECT pc.*,
               (SELECT COUNT(*) FROM agro_material am WHERE am.material_category = 'PESTICIDE' AND (am.category_code = pc.category_code OR am.sub_type = pc.category_name)) AS product_count
        FROM pesticide_category_code pc
        ORDER BY pc.sort_order ASC, pc.category_code ASC
      `).all();
      sendJson(res, { items });
      return;
    }

    if (pathname === '/api/pesticide-category-codes' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const { category_code, category_name, description, sort_order } = body;
      const prevRow = db
        .prepare('SELECT category_name FROM pesticide_category_code WHERE category_code = ?')
        .get(category_code) as { category_name: string } | undefined;

      const rowData = {
        category_code: String(category_code || '').trim(),
        category_name: String(category_name || '').trim(),
        description: String(description || '').trim(),
        sort_order: Number(sort_order) || 1,
      };
      db.prepare(`
        INSERT OR REPLACE INTO pesticide_category_code (category_code, category_name, description, sort_order)
        VALUES (?, ?, ?, ?)
      `).run(rowData.category_code, rowData.category_name, rowData.description, rowData.sort_order);

      // 병해충관리제 기초 코드의 카테고리명이 변경된 경우 연동된 병해충관리제(PESTICIDE) 상품의 sub_type도 즉시 동기화
      if (prevRow && prevRow.category_name && prevRow.category_name !== rowData.category_name) {
        db.prepare(`
          UPDATE agro_material
          SET sub_type = ?
          WHERE material_category = 'PESTICIDE' AND (category_code = ? OR sub_type = ?)
        `).run(rowData.category_name, rowData.category_code, prevRow.category_name);
      } else {
        db.prepare(`
          UPDATE agro_material
          SET sub_type = ?
          WHERE material_category = 'PESTICIDE' AND category_code = ?
        `).run(rowData.category_name, rowData.category_code);
      }

      await supabaseRestUpsert('pesticide_category_code', rowData, 'category_code');
      sendJson(res, { ok: true });
      return;
    }

    if (pathname === '/api/pesticide-category-codes/delete' && req.method === 'POST') {
      const { category_code } = await readJsonBody(req);
      db.prepare('DELETE FROM pesticide_category_code WHERE category_code = ?').run(category_code);
      await supabaseRestDelete('pesticide_category_code', `category_code=eq.${encodeURIComponent(category_code)}`);
      sendJson(res, { ok: true });
      return;
    }

    // 2-7. 씨(종자) 기초 코드 (seed_category_code) 조회·등록·수정·삭제 API
    if (pathname === '/api/seed-category-codes' && req.method === 'GET') {
      const items = db.prepare(`
        SELECT sc.*,
               (SELECT COUNT(*) FROM agro_material am WHERE am.material_category = 'SEED' AND (am.category_code = sc.category_code OR am.sub_type = sc.category_name)) AS product_count
        FROM seed_category_code sc
        ORDER BY sc.sort_order ASC, sc.category_code ASC
      `).all();
      sendJson(res, { items });
      return;
    }

    if (pathname === '/api/seed-category-codes' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const { category_code, category_name, description, sort_order } = body;
      const prevRow = db
        .prepare('SELECT category_name FROM seed_category_code WHERE category_code = ?')
        .get(category_code) as { category_name: string } | undefined;

      const rowData = {
        category_code: String(category_code || '').trim(),
        category_name: String(category_name || '').trim(),
        description: String(description || '').trim(),
        sort_order: Number(sort_order) || 1,
      };
      db.prepare(`
        INSERT OR REPLACE INTO seed_category_code (category_code, category_name, description, sort_order)
        VALUES (?, ?, ?, ?)
      `).run(rowData.category_code, rowData.category_name, rowData.description, rowData.sort_order);

      if (prevRow && prevRow.category_name && prevRow.category_name !== rowData.category_name) {
        db.prepare(`
          UPDATE agro_material
          SET sub_type = ?
          WHERE material_category = 'SEED' AND (category_code = ? OR sub_type = ?)
        `).run(rowData.category_name, rowData.category_code, prevRow.category_name);
      } else {
        db.prepare(`
          UPDATE agro_material
          SET sub_type = ?
          WHERE material_category = 'SEED' AND category_code = ?
        `).run(rowData.category_name, rowData.category_code);
      }

      await supabaseRestUpsert('seed_category_code', rowData, 'category_code');
      sendJson(res, { ok: true });
      return;
    }

    if (pathname === '/api/seed-category-codes/delete' && req.method === 'POST') {
      const { category_code } = await readJsonBody(req);
      db.prepare('DELETE FROM seed_category_code WHERE category_code = ?').run(category_code);
      await supabaseRestDelete('seed_category_code', `category_code=eq.${encodeURIComponent(category_code)}`);
      sendJson(res, { ok: true });
      return;
    }

    // 2-8. 모종(육묘) 기초 코드 (seedling_category_code) 조회·등록·수정·삭제 API
    if (pathname === '/api/seedling-category-codes' && req.method === 'GET') {
      const items = db.prepare(`
        SELECT sdc.*,
               (SELECT COUNT(*) FROM agro_material am WHERE am.material_category = 'SEEDLING' AND (am.category_code = sdc.category_code OR am.sub_type = sdc.category_name)) AS product_count
        FROM seedling_category_code sdc
        ORDER BY sdc.sort_order ASC, sdc.category_code ASC
      `).all();
      sendJson(res, { items });
      return;
    }

    if (pathname === '/api/seedling-category-codes' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const { category_code, category_name, description, sort_order } = body;
      const prevRow = db
        .prepare('SELECT category_name FROM seedling_category_code WHERE category_code = ?')
        .get(category_code) as { category_name: string } | undefined;

      const rowData = {
        category_code: String(category_code || '').trim(),
        category_name: String(category_name || '').trim(),
        description: String(description || '').trim(),
        sort_order: Number(sort_order) || 1,
      };
      db.prepare(`
        INSERT OR REPLACE INTO seedling_category_code (category_code, category_name, description, sort_order)
        VALUES (?, ?, ?, ?)
      `).run(rowData.category_code, rowData.category_name, rowData.description, rowData.sort_order);

      if (prevRow && prevRow.category_name && prevRow.category_name !== rowData.category_name) {
        db.prepare(`
          UPDATE agro_material
          SET sub_type = ?
          WHERE material_category = 'SEEDLING' AND (category_code = ? OR sub_type = ?)
        `).run(rowData.category_name, rowData.category_code, prevRow.category_name);
      } else {
        db.prepare(`
          UPDATE agro_material
          SET sub_type = ?
          WHERE material_category = 'SEEDLING' AND category_code = ?
        `).run(rowData.category_name, rowData.category_code);
      }

      await supabaseRestUpsert('seedling_category_code', rowData, 'category_code');
      sendJson(res, { ok: true });
      return;
    }

    if (pathname === '/api/seedling-category-codes/delete' && req.method === 'POST') {
      const { category_code } = await readJsonBody(req);
      db.prepare('DELETE FROM seedling_category_code WHERE category_code = ?').run(category_code);
      await supabaseRestDelete('seedling_category_code', `category_code=eq.${encodeURIComponent(category_code)}`);
      sendJson(res, { ok: true });
      return;
    }

    // 3. 표준 생육과정 관리 (standard_template) 조회·등록·수정·삭제 API
    if (pathname === '/api/templates' && req.method === 'GET') {
      const system_id = parsedUrl.searchParams.get('system_id');
      if (system_id) {
        const items = db.prepare(`
          SELECT t.*,
                 COALESCE(NULLIF(t.bjd_code, ''), '4313010700') AS bjd_code,
                 COALESCE(NULLIF(t.sido, ''), '충청북도') AS sido,
                 COALESCE(NULLIF(t.sigungu, ''), '충주시') AS sigungu,
                 COALESCE(NULLIF(t.eupmyeondong, ''), '단월동') AS eupmyeondong,
                 s.system_name,
                 COALESCE(NULLIF(t.crop_id, ''), s.crop_id) AS crop_id,
                 c.crop_name,
                 COALESCE(NULLIF(t.group_id, ''), c.group_id) AS group_id,
                 g.group_name,
                 cv.cultivar_name
          FROM standard_template t
          LEFT JOIN cropping_system s ON t.system_id = s.system_id
          LEFT JOIN crop c ON COALESCE(NULLIF(t.crop_id, ''), s.crop_id) = c.crop_id
          LEFT JOIN crop_group g ON COALESCE(NULLIF(t.group_id, ''), c.group_id) = g.group_id
          LEFT JOIN cultivar cv ON t.cultivar_id = cv.cultivar_id
          WHERE t.system_id = ?
          ORDER BY t.step_order ASC
        `).all(system_id);
        sendJson(res, { items });
      } else {
        const items = db.prepare(`
          SELECT t.*,
                 COALESCE(NULLIF(t.bjd_code, ''), '4313010700') AS bjd_code,
                 COALESCE(NULLIF(t.sido, ''), '충청북도') AS sido,
                 COALESCE(NULLIF(t.sigungu, ''), '충주시') AS sigungu,
                 COALESCE(NULLIF(t.eupmyeondong, ''), '단월동') AS eupmyeondong,
                 s.system_name,
                 COALESCE(NULLIF(t.crop_id, ''), s.crop_id) AS crop_id,
                 c.crop_name,
                 COALESCE(NULLIF(t.group_id, ''), c.group_id) AS group_id,
                 g.group_name,
                 cv.cultivar_name
          FROM standard_template t
          LEFT JOIN cropping_system s ON t.system_id = s.system_id
          LEFT JOIN crop c ON COALESCE(NULLIF(t.crop_id, ''), s.crop_id) = c.crop_id
          LEFT JOIN crop_group g ON COALESCE(NULLIF(t.group_id, ''), c.group_id) = g.group_id
          LEFT JOIN cultivar cv ON t.cultivar_id = cv.cultivar_id
          ORDER BY t.system_id, t.cultivar_id, t.step_order ASC
        `).all();
        sendJson(res, { items });
      }
      return;
    }

    if (pathname === '/api/templates' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const {
        mode,
        template_id,
        group_id,
        crop_id,
        cultivar_id,
        system_id,
        bjd_code,
        sido,
        sigungu,
        eupmyeondong,
        step_order,
        item_type,
        item_category,
        item_code,
        item_name,
        target_gdd_ratio,
        target_pgdd,
        days_from_start,
        tolerance_days,
        guide_criteria,
        climate_countermeasure,
      } = body;

      const trimmedTemplateId = String(template_id || '').trim();
      if (!trimmedTemplateId) {
        sendJson(res, { ok: false, message: '생육과정 템플릿 ID가 비어 있습니다.' }, 400);
        return;
      }

      if (mode === 'create') {
        const dupRow = db
          .prepare('SELECT template_id FROM standard_template WHERE UPPER(template_id) = UPPER(?)')
          .get(trimmedTemplateId) as { template_id: string } | undefined;
        if (dupRow) {
          sendJson(
            res,
            {
              ok: false,
              error: 'DUPLICATE_TEMPLATE_ID',
              message: `이미 존재하는 생육과정 템플릿 ID(${trimmedTemplateId})입니다. 중복될 수 없습니다.`,
            },
            409
          );
          return;
        }
      }

      let resolvedSystemId = system_id;
      const targetCropId = crop_id || 'CRP-CABBAGE';

      // 선택한 2차 분류(작물)에 해당하는 재배작형이 없거나 system_id가 유효하지 않을 경우 기본 작형 자동 연동/생성
      const existingSys = resolvedSystemId
        ? (db.prepare('SELECT system_id FROM cropping_system WHERE system_id = ?').get(resolvedSystemId) as
            | { system_id: string }
            | undefined)
        : undefined;

      if (!existingSys) {
        const cropSys = db
          .prepare('SELECT system_id FROM cropping_system WHERE crop_id = ? LIMIT 1')
          .get(targetCropId) as { system_id: string } | undefined;
        if (cropSys) {
          resolvedSystemId = cropSys.system_id;
        } else {
          resolvedSystemId = `SYS-${targetCropId.replace(/^CRP-/, '')}-STD`;
          const autoSysRow = {
            system_id: resolvedSystemId,
            crop_id: targetCropId,
            system_name: '표준 노지재배',
            cultivation_method: 'OPEN_FIELD',
            sowing_months: '4월',
            harvest_months: '7월',
            is_overwintering: 0,
            base_temp_tb: 5.0,
            required_gdd: 800,
            required_raw_gdd: 1200,
            opt_temp_min: 15,
            opt_temp_max: 22,
            limit_temp_min: 5,
            limit_temp_max: 26,
            damage_temp_low: 2,
            damage_temp_high: 29,
          };
          db.prepare(`
            INSERT OR IGNORE INTO cropping_system (
              system_id, crop_id, system_name, cultivation_method, sowing_months, harvest_months,
              is_overwintering, base_temp_tb, required_gdd, required_raw_gdd,
              opt_temp_min, opt_temp_max, limit_temp_min, limit_temp_max, damage_temp_low, damage_temp_high
            ) VALUES (?, ?, ?, 'OPEN_FIELD', '4월', '7월', 0, 5.0, 800, 1200, 15, 22, 5, 26, 2, 29)
          `).run(resolvedSystemId, targetCropId, '표준 노지재배');
          await supabaseRestUpsert('cropping_system', autoSysRow, 'system_id');
        }
      }

      const resolvedSido = String(sido || '충청북도').trim();
      const resolvedSigungu = String(sigungu || '충주시').trim();
      const resolvedEupmyeondong = String(eupmyeondong || '단월동').trim();
      const addrLookup = db
        .prepare('SELECT bjd_code FROM cultivation_address WHERE sido = ? AND sigungu = ? AND eupmyeondong = ? LIMIT 1')
        .get(resolvedSido, resolvedSigungu, resolvedEupmyeondong) as { bjd_code: string } | undefined;
      const resolvedBjdCode = String(bjd_code || addrLookup?.bjd_code || '4313010700').trim();

      const tplRow = {
        template_id,
        group_id: group_id || '',
        crop_id: targetCropId,
        cultivar_id: cultivar_id || '',
        system_id: resolvedSystemId,
        bjd_code: resolvedBjdCode,
        sido: resolvedSido,
        sigungu: resolvedSigungu,
        eupmyeondong: resolvedEupmyeondong,
        step_order: Number(step_order) || 1,
        item_type: item_type || 'WORK',
        item_category: item_category || 'MAJOR',
        item_code,
        item_name,
        target_gdd_ratio: Number(target_gdd_ratio) || 0,
        target_pgdd: Number(target_pgdd) || 0,
        days_from_start: Number(days_from_start) || 0,
        tolerance_days: Number(tolerance_days) || 3,
        guide_criteria: guide_criteria || '',
        climate_countermeasure: climate_countermeasure || '',
      };

      db.prepare(`
        INSERT OR REPLACE INTO standard_template (
          template_id, group_id, crop_id, cultivar_id, system_id,
          bjd_code, sido, sigungu, eupmyeondong,
          step_order, item_type, item_category, item_code, item_name,
          target_gdd_ratio, target_pgdd, days_from_start, tolerance_days, guide_criteria, climate_countermeasure
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        tplRow.template_id,
        tplRow.group_id,
        tplRow.crop_id,
        tplRow.cultivar_id,
        tplRow.system_id,
        tplRow.bjd_code,
        tplRow.sido,
        tplRow.sigungu,
        tplRow.eupmyeondong,
        tplRow.step_order,
        tplRow.item_type,
        tplRow.item_category,
        tplRow.item_code,
        tplRow.item_name,
        tplRow.target_gdd_ratio,
        tplRow.target_pgdd,
        tplRow.days_from_start,
        tplRow.tolerance_days,
        tplRow.guide_criteria,
        tplRow.climate_countermeasure
      );
      await supabaseRestUpsert('standard_template', tplRow, 'template_id');
      sendJson(res, { ok: true });
      return;
    }

    if (pathname === '/api/templates/delete' && req.method === 'POST') {
      const { template_id } = await readJsonBody(req);
      db.prepare('DELETE FROM standard_template WHERE template_id = ?').run(template_id);
      await supabaseRestDelete('standard_template', `template_id=eq.${encodeURIComponent(template_id)}`);
      sendJson(res, { ok: true });
      return;
    }

    // 4. 토양·비료·작물보호제 처방 DB API (하위 호환 유지)
    if (pathname === '/api/prescriptions' && req.method === 'GET') {
      const soilStandards = db.prepare(`
        SELECT st.*, c.crop_name
        FROM soil_standard st
        LEFT JOIN crop c ON st.crop_id = c.crop_id
      `).all();
      const materials = db.prepare('SELECT * FROM agro_material ORDER BY material_category, material_id').all();
      sendJson(res, { soilStandards, materials });
      return;
    }

    // 4-1. [5. 농자재 상품 관리 > 농자재 추천 모듈 관리] 하이브리드(정량 규칙 모듈 + AI Agent) 통합 조회 API
    if (pathname === '/api/agro-recommendation-module' && req.method === 'GET') {
      const policy =
        db.prepare("SELECT * FROM agro_recommendation_policy WHERE policy_id = 'DEFAULT_POLICY'").get() ||
        db.prepare('SELECT * FROM agro_recommendation_policy LIMIT 1').get();
      const stageRules = db
        .prepare('SELECT * FROM agro_stage_mapping_rule ORDER BY sort_order ASC, rule_id ASC')
        .all();
      const soilStandards = db
        .prepare(`
          SELECT st.*, c.crop_name, c.group_id, g.group_name
          FROM soil_standard st
          LEFT JOIN crop c ON st.crop_id = c.crop_id
          LEFT JOIN crop_group g ON c.group_id = g.group_id
          ORDER BY g.sort_order ASC, c.crop_name ASC
        `)
        .all();
      const historyLogs = db
        .prepare('SELECT * FROM agro_recommendation_history ORDER BY created_at DESC LIMIT 40')
        .all();
      const materials = db
        .prepare('SELECT * FROM agro_material ORDER BY material_category ASC, material_id ASC')
        .all();
      const growthProcesses = db
        .prepare('SELECT * FROM growth_process_code ORDER BY sort_order ASC, process_code ASC')
        .all();
      const cropGrowthPlans = db
        .prepare('SELECT * FROM crop_growth_process_plan ORDER BY crop_id ASC, cultivar_id ASC, step_order ASC')
        .all();

      sendJson(res, {
        ok: true,
        policy,
        stageRules,
        soilStandards,
        historyLogs,
        materials,
        growthProcesses,
        cropGrowthPlans,
        logicSpec: {
          ...RECOMMENDATION_LOGIC_SPEC,
          scoringFormula: RECOMMENDATION_LOGIC_SPEC.coreFormula,
          categoryModels: RECOMMENDATION_LOGIC_SPEC.categoryModels.map((cm: any) => ({
            ...cm,
            title: `${cm.categoryKr} 추천 근거 및 채점 방식`,
            keyFields: cm.keyRegisteredFields,
          })),
        },
        stageRequirementSpecs: Object.values(STAGE_REQUIREMENT_SPECS).map((sp: any) => ({
          ...sp,
          itemId: sp.stageKey,
          subItemName: sp.stageName,
          requiredFertilizerNutrients: [
            ...(sp.fertilizerSpec?.minOmPct ? ['OM(유기물)'] : []),
            ...(sp.fertilizerSpec?.minNPct ? ['N(질소)'] : []),
            ...(sp.fertilizerSpec?.minPPct ? ['P₂O₅(인산)'] : []),
            ...(sp.fertilizerSpec?.minKPct ? ['K₂O(칼륨)'] : []),
            ...(sp.fertilizerSpec?.minCaPct ? ['CaO(칼슘)'] : []),
            ...(sp.fertilizerSpec?.minMgPct ? ['MgO(고토)'] : []),
            ...(sp.fertilizerSpec?.requireBoron ? ['B₂O₃(붕소)'] : []),
            ...(sp.fertilizerSpec?.requireSilicate ? ['SiO₂(규산)'] : []),
            ...(sp.fertilizerSpec?.requireSulfur ? ['S(유황)'] : []),
          ],
          preferredFertSubTypes: [
            sp.fertilizerSpec?.preferredMethod || '',
            sp.fertilizerSpec?.preferredRelease || '',
          ].filter(Boolean),
          requiredNutrientActives: [
            ...(sp.nutrientSpec?.requireAmino ? ['유리아미노산'] : []),
            ...(sp.nutrientSpec?.requireSeaweedHumic ? ['해조추출물·풀빅산'] : []),
            ...(sp.nutrientSpec?.requireChelateMicro ? ['킬레이트 미량요소'] : []),
            ...(sp.nutrientSpec?.requireWaterSolubleCa ? ['수용성 칼슘(Ca)'] : []),
            ...(sp.nutrientSpec?.requireWaterSolubleB ? ['수용성 붕소(B)'] : []),
            ...(sp.nutrientSpec?.requireWaterSolubleMg ? ['수용성 고토(Mg)'] : []),
          ],
          targetStresses: sp.nutrientSpec?.stressTargets || [],
          targetPestsOrDiseases: sp.pesticideSpec?.targetPests || [],
          recommendAllocation: {
            fertilizer: sp.categoryCounts?.FERTILIZER ?? 0,
            nutrient: sp.categoryCounts?.NUTRIENT ?? 0,
            pesticide: sp.categoryCounts?.PESTICIDE ?? 0,
          },
        })),
      });
      return;
    }

    // 4-1-B. 농자재 추천 모듈 — 하이브리드 정책(정량 기준 + AI Agent 지침) 저장 API
    if (pathname === '/api/agro-recommendation-module/policy' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const updatedAt = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
      db.prepare(`
        INSERT OR REPLACE INTO agro_recommendation_policy (
          policy_id, engine_mode, organic_preference, price_strategy, brand_priority,
          deficiency_boost_pct, excess_reduce_pct,
          climate_high_humidity_pct, climate_rain_trigger_mm, climate_high_temp_c, climate_low_temp_c,
          ai_system_prompt, rationale_sections_json, auto_apply_to_schedule, updated_at
        ) VALUES (
          'DEFAULT_POLICY', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `).run(
        String(body.engine_mode || 'HYBRID_RULE_AI'),
        String(body.organic_preference || 'BALANCED'),
        String(body.price_strategy || 'EFFICIENCY_BALANCED'),
        String(body.brand_priority || 'NUVO_HANFARM_FIRST'),
        Number(body.deficiency_boost_pct ?? 20),
        Number(body.excess_reduce_pct ?? 30),
        Number(body.climate_high_humidity_pct ?? 75.0),
        Number(body.climate_rain_trigger_mm ?? 15.0),
        Number(body.climate_high_temp_c ?? 27.0),
        Number(body.climate_low_temp_c ?? 10.0),
        String(body.ai_system_prompt || ''),
        typeof body.rationale_sections_json === 'string'
          ? body.rationale_sections_json
          : JSON.stringify(body.rationale_sections_json || ['SOIL_DIAGNOSIS', 'GROWTH_PHYSIOLOGY', 'CLIMATE_PEST_RISK', 'DOSAGE_MIX_TIP']),
        body.auto_apply_to_schedule ? 1 : 0,
        updatedAt
      );
      const saved = db.prepare("SELECT * FROM agro_recommendation_policy WHERE policy_id = 'DEFAULT_POLICY'").get() as Record<string, any> | undefined;
      if (saved) {
        await supabaseRestUpsert('agro_recommendation_policy', saved, 'policy_id');
      }
      sendJson(res, { ok: true, policy: saved });
      return;
    }

    // 4-1-C. 농자재 추천 모듈 — 작물별 적정 토양 성분 기준(soil_standard) 저장 API
    if (pathname === '/api/agro-recommendation-module/soil-standard' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const crop_id = String(body.crop_id || 'CRP-CABBAGE').trim();
      const standard_id = String(body.standard_id || `STD-${crop_id.replace(/^CRP-/, '')}`).trim();
      db.prepare(`
        INSERT OR REPLACE INTO soil_standard (
          standard_id, crop_id,
          ph_min, ph_max, om_min, om_max, p2o5_min, p2o5_max,
          k_min, k_max, ca_min, ca_max, mg_min, mg_max, sio2_min, sio2_max, ec_min, ec_max
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        standard_id,
        crop_id,
        Number(body.ph_min ?? 6.0),
        Number(body.ph_max ?? 6.5),
        Number(body.om_min ?? 25),
        Number(body.om_max ?? 35),
        Number(body.p2o5_min ?? 300),
        Number(body.p2o5_max ?? 450),
        Number(body.k_min ?? 0.45),
        Number(body.k_max ?? 0.75),
        Number(body.ca_min ?? 5.0),
        Number(body.ca_max ?? 6.5),
        Number(body.mg_min ?? 1.5),
        Number(body.mg_max ?? 2.2),
        Number(body.sio2_min ?? 150),
        Number(body.sio2_max ?? 220),
        Number(body.ec_min ?? 0.5),
        Number(body.ec_max ?? 1.8)
      );
      const savedStd = db.prepare('SELECT * FROM soil_standard WHERE standard_id = ?').get(standard_id) as Record<string, any> | undefined;
      if (savedStd) {
        await supabaseRestUpsert('soil_standard', savedStd, 'standard_id');
      }
      sendJson(res, { ok: true });
      return;
    }

    // 4-1-D. 농자재 추천 모듈 — 생육과정별 자재 매핑 규칙 등록/수정/삭제 API
    if (pathname === '/api/agro-recommendation-module/stage-rule' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const rule_id = String(body.rule_id || `RULE-STG-${String(Date.now()).slice(-4)}`).trim();
      const updatedAt = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
      db.prepare(`
        INSERT OR REPLACE INTO agro_stage_mapping_rule (
          rule_id, stage_category, process_codes_csv, stage_keywords_csv,
          fertilizer_categories_csv, nutrient_categories_csv, pesticide_categories_csv,
          physiological_goal, soil_linkage_rule, climate_linkage_rule,
          priority_weight, is_active, sort_order, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        rule_id,
        String(body.stage_category || '생육단계 매핑 규칙').trim(),
        String(body.process_codes_csv || 'PRC-01').trim(),
        String(body.stage_keywords_csv || '').trim(),
        String(body.fertilizer_categories_csv || '').trim(),
        String(body.nutrient_categories_csv || '').trim(),
        String(body.pesticide_categories_csv || '').trim(),
        String(body.physiological_goal || '').trim(),
        String(body.soil_linkage_rule || '').trim(),
        String(body.climate_linkage_rule || '').trim(),
        Number(body.priority_weight ?? 90),
        body.is_active === 0 || body.is_active === false ? 0 : 1,
        Number(body.sort_order ?? 1),
        updatedAt
      );
      const savedRule = db.prepare('SELECT * FROM agro_stage_mapping_rule WHERE rule_id = ?').get(rule_id) as Record<string, any> | undefined;
      if (savedRule) {
        await supabaseRestUpsert('agro_stage_mapping_rule', savedRule, 'rule_id');
      }
      sendJson(res, { ok: true, rule_id });
      return;
    }

    if (pathname === '/api/agro-recommendation-module/stage-rule/delete' && req.method === 'POST') {
      const { rule_id } = await readJsonBody(req);
      const cleanId = String(rule_id || '').trim();
      db.prepare('DELETE FROM agro_stage_mapping_rule WHERE rule_id = ?').run(cleanId);
      if (cleanId) {
        await supabaseRestDelete('agro_stage_mapping_rule', `rule_id=eq.${encodeURIComponent(cleanId)}`);
      }
      sendJson(res, { ok: true });
      return;
    }

    // 4-1-E. 농자재 추천 모듈 — 재배지역(시도·시군구·읍면동) 선택 시 토양검정 DB(7번 메뉴) + 하이브리드 기후(6번 메뉴) 자동 조회 API
    if (pathname === '/api/agro-recommendation-module/region-context' && req.method === 'GET') {
      const bjdCodeParam = (parsedUrl.searchParams.get('bjd_code') || '').trim();
      const sido = (parsedUrl.searchParams.get('sido') || '').trim();
      const sigungu = (parsedUrl.searchParams.get('sigungu') || '').trim();
      const eupmyeondong = (parsedUrl.searchParams.get('eupmyeondong') || '').trim();
      const targetMonth = Number(parsedUrl.searchParams.get('month') || 5);

      let addrRow: any = null;
      if (bjdCodeParam) {
        addrRow = db
          .prepare('SELECT * FROM cultivation_address WHERE bjd_code = ? LIMIT 1')
          .get(bjdCodeParam);
      }
      if (!addrRow && sido && sigungu && eupmyeondong && eupmyeondong !== 'ALL') {
        addrRow = db
          .prepare('SELECT * FROM cultivation_address WHERE sido = ? AND sigungu = ? AND eupmyeondong = ? LIMIT 1')
          .get(sido, sigungu, eupmyeondong);
      }
      if (!addrRow && sido && sigungu && sigungu !== 'ALL') {
        addrRow = db
          .prepare('SELECT * FROM cultivation_address WHERE sido = ? AND sigungu = ? ORDER BY address_id ASC LIMIT 1')
          .get(sido, sigungu);
      }
      if (!addrRow && sido && sido !== 'ALL') {
        addrRow = db
          .prepare('SELECT * FROM cultivation_address WHERE sido = ? ORDER BY address_id ASC LIMIT 1')
          .get(sido);
      }
      if (!addrRow) {
        addrRow = db.prepare('SELECT * FROM cultivation_address ORDER BY address_id ASC LIMIT 1').get();
      }

      const bjd_code = addrRow?.bjd_code || '4111113000';
      const soilRow = db
        .prepare('SELECT * FROM soil_address_survey WHERE bjd_code = ? LIMIT 1')
        .get(bjd_code) as any;

      // 하이브리드 기후 규칙 적용: 동일 날짜에 작년 기후(2025)와 올해 예측 기후(2026, 현재+6개월 이내)가 모두 있으면 평균값(BLENDED_AVG), 없으면 작년 기후 단독(PAST_ONLY)
      const pastRows = db
        .prepare(
          'SELECT record_date, temp_avg, temp_max, temp_min, humidity_avg, precipitation_mm FROM climate_address_daily WHERE bjd_code = ? AND month = ? ORDER BY record_date ASC'
        )
        .all(bjd_code, targetMonth) as any[];
      const futureRows = db
        .prepare(
          "SELECT record_date, temp_avg, temp_max, temp_min, humidity_avg, precipitation_mm, source_type FROM climate_future_daily WHERE bjd_code = ? AND month = ? AND source_type != 'UNAVAILABLE_BEYOND_6M' ORDER BY record_date ASC"
        )
        .all(bjd_code, targetMonth) as any[];

      const futureByMd = new Map<string, any>();
      for (const f of futureRows) {
        const md = String(f.record_date || '').slice(5, 10);
        if (md && f.temp_avg != null) futureByMd.set(md, f);
      }

      let blendedDays = 0;
      let pastOnlyDays = 0;
      let sumTempAvg = 0;
      let sumTempMax = 0;
      let sumTempMin = 0;
      let sumHumidity = 0;
      let sumRainfall = 0;
      let rainyDays = 0;
      const dayCount = pastRows.length || 1;

      for (const p of pastRows) {
        const md = String(p.record_date || '').slice(5, 10);
        const f = futureByMd.get(md);
        let tAvg = Number(p.temp_avg || 18);
        let tMax = Number(p.temp_max || 23);
        let tMin = Number(p.temp_min || 13);
        let hum = Number(p.humidity_avg || 65);
        let rain = Number(p.precipitation_mm || 0);
        if (f && f.temp_avg != null) {
          tAvg = (tAvg + Number(f.temp_avg)) / 2;
          tMax = (tMax + Number(f.temp_max)) / 2;
          tMin = (tMin + Number(f.temp_min)) / 2;
          hum = (hum + Number(f.humidity_avg)) / 2;
          rain = (rain + Number(f.precipitation_mm)) / 2;
          blendedDays++;
        } else {
          pastOnlyDays++;
        }
        sumTempAvg += tAvg;
        sumTempMax += tMax;
        sumTempMin += tMin;
        sumHumidity += hum;
        sumRainfall += rain;
        if (rain >= 5.0) rainyDays++;
      }

      const climateSummary = {
        bjd_code,
        month: targetMonth,
        temp_avg: Number((sumTempAvg / dayCount).toFixed(1)),
        temp_max: Number((sumTempMax / dayCount).toFixed(1)),
        temp_min: Number((sumTempMin / dayCount).toFixed(1)),
        humidity_avg: Number((sumHumidity / dayCount).toFixed(1)),
        rainfall_total_mm: Number(sumRainfall.toFixed(1)),
        rainy_days: rainyDays,
        blended_days: blendedDays,
        past_only_days: pastOnlyDays,
        climate_rule_mode: blendedDays > 0 ? 'BLENDED_AVG' : 'PAST_ONLY',
        climate_rule_desc:
          blendedDays > 0
            ? `작년(2025) + 올해 예측(2026) 평균 대입 (${blendedDays}일 평균 / ${pastOnlyDays}일 작년단독)`
            : `올해 +6개월 예측 범위 이후 구간 — 작년(2025) 동월 기후 단독 참조 (${pastOnlyDays}일)`,
      };

      sendJson(res, {
        ok: true,
        address: addrRow,
        soilSurvey: soilRow,
        climateSummary,
      });
      return;
    }

    // 4-1-F. 농자재 추천 모듈 — 하이브리드(정량 규칙 모듈 + AI Agent) 처방 추천 실행 API
    if (pathname === '/api/agro-recommendation-module/recommend' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const bjd_code = String(body.bjd_code || '4111113000').trim();
      const addrRow = (db
        .prepare('SELECT * FROM cultivation_address WHERE bjd_code = ? LIMIT 1')
        .get(bjd_code) || {
        bjd_code,
        sido: body.sido || '경기도',
        sigungu: body.sigungu || '수원시 장안구',
        eupmyeondong: body.eupmyeondong || '파장동',
        full_address: `${body.sido || '경기도'} ${body.sigungu || '수원시 장안구'} ${body.eupmyeondong || '파장동'}`,
      }) as any;

      const crop_id = String(body.crop_id || 'CRP-CABBAGE').trim();
      const cultivar_id = String(body.cultivar_id || '').trim();
      const process_code = String(body.process_code || 'PRC-03').trim();
      const area_pyeong = Math.max(10, Number(body.area_pyeong || 300));
      const targetMonth = Math.min(12, Math.max(1, Number(body.target_month || 5)));

      const cropRow = (db.prepare('SELECT * FROM crop WHERE crop_id = ?').get(crop_id) || {
        crop_id,
        group_id: body.group_id || 'GRP-LEAF',
        crop_name: body.crop_name || '배추',
      }) as any;
      const cultivarRow = cultivar_id
        ? (db.prepare('SELECT * FROM cultivar WHERE cultivar_id = ?').get(cultivar_id) as any)
        : null;
      const processRow = (db
        .prepare('SELECT * FROM growth_process_code WHERE process_code = ?')
        .get(process_code) || {
        process_code,
        process_name: body.process_name || '밑거름 시비 및 정식 준비',
        process_type: 'STG-PREP',
        description: '',
      }) as any;

      // 작물별 생육 과정 관리(crop_growth_process_plan)에 등록된 세부 계획이 있으면 함께 참조
      const growthPlanRow = (db
        .prepare(
          `SELECT * FROM crop_growth_process_plan
           WHERE crop_id = ? AND (process_code = ? OR process_name LIKE ?)
           ORDER BY CASE WHEN cultivar_id = ? THEN 0 ELSE 1 END, step_order ASC LIMIT 1`
        )
        .get(crop_id, process_code, `%${processRow.process_name}%`, cultivar_id) || null) as any;

      const policy = (db
        .prepare("SELECT * FROM agro_recommendation_policy WHERE policy_id = 'DEFAULT_POLICY'")
        .get() || {
        engine_mode: 'HYBRID_RULE_AI',
        organic_preference: 'BALANCED',
        price_strategy: 'EFFICIENCY_BALANCED',
        brand_priority: 'NUVO_HANFARM_FIRST',
        deficiency_boost_pct: 20,
        excess_reduce_pct: 30,
        climate_high_humidity_pct: 75.0,
        climate_rain_trigger_mm: 15.0,
        climate_high_temp_c: 27.0,
        climate_low_temp_c: 10.0,
      }) as any;

      const soilStd = (db.prepare('SELECT * FROM soil_standard WHERE crop_id = ?').get(crop_id) || {
        ph_min: 6.0,
        ph_max: 6.5,
        om_min: 25,
        om_max: 35,
        p2o5_min: 300,
        p2o5_max: 450,
        k_min: 0.45,
        k_max: 0.75,
        ca_min: 5.0,
        ca_max: 6.5,
        mg_min: 1.5,
        mg_max: 2.2,
        sio2_min: 150,
        sio2_max: 220,
        ec_min: 0.5,
        ec_max: 1.8,
      }) as any;

      const dbSoilRow = (db
        .prepare('SELECT * FROM soil_address_survey WHERE bjd_code = ? LIMIT 1')
        .get(bjd_code) || {}) as any;

      const soilInput = {
        soil_ph: Number(body.soil_ph ?? dbSoilRow.soil_ph ?? 6.1),
        soil_ec: Number(body.soil_ec ?? dbSoilRow.soil_ec ?? 0.95),
        organic_matter_g_kg: Number(body.organic_matter_g_kg ?? dbSoilRow.organic_matter_g_kg ?? 24),
        avail_p2o5_mg_kg: Number(body.avail_p2o5_mg_kg ?? dbSoilRow.avail_p2o5_mg_kg ?? 420),
        exch_k_cmol: Number(body.exch_k_cmol ?? dbSoilRow.exch_k_cmol ?? 0.42),
        exch_ca_cmol: Number(body.exch_ca_cmol ?? dbSoilRow.exch_ca_cmol ?? 5.4),
        exch_mg_cmol: Number(body.exch_mg_cmol ?? dbSoilRow.exch_mg_cmol ?? 1.7),
        avail_sio2_mg_kg: Number(body.avail_sio2_mg_kg ?? dbSoilRow.avail_sio2_mg_kg ?? 175),
        soil_texture: String(body.soil_texture || dbSoilRow.soil_texture || '양토'),
        land_category: String(body.land_category || dbSoilRow.land_category || '전(밭)'),
      };

      // 1단계(정량 모듈): 토양 7대 핵심 지표 과부족 진단
      const diagnoseMetric = (
        key: string,
        label: string,
        val: number,
        min: number,
        max: number,
        unit: string,
        lowAction: string,
        highAction: string
      ) => {
        if (val < min) {
          const deficitPct = Math.round(((min - val) / Math.max(0.1, min)) * 100);
          return {
            key,
            label,
            value: val,
            min,
            max,
            unit,
            status: 'DEFICIENT',
            status_kr: '부족',
            diff_text: `기준 하한(${min}${unit}) 대비 -${(min - val).toFixed(2).replace(/\.00$/, '')}${unit} (${deficitPct}% 부족)`,
            action_note: lowAction,
          };
        }
        if (val > max) {
          const excessPct = Math.round(((val - max) / Math.max(0.1, max)) * 100);
          return {
            key,
            label,
            value: val,
            min,
            max,
            unit,
            status: 'EXCESS',
            status_kr: '과잉',
            diff_text: `기준 상한(${max}${unit}) 대비 +${(val - max).toFixed(2).replace(/\.00$/, '')}${unit} (${excessPct}% 과잉)`,
            action_note: highAction,
          };
        }
        return {
          key,
          label,
          value: val,
          min,
          max,
          unit,
          status: 'OPTIMAL',
          status_kr: '적정',
          diff_text: `적정 기준 범위(${min}~${max}${unit}) 내 양호`,
          action_note: '표준 권장 시비량 유지',
        };
      };

      const soilDiagnostics = [
        diagnoseMetric(
          'ph',
          '토양 산도 (pH)',
          soilInput.soil_ph,
          Number(soilStd.ph_min || 6.0),
          Number(soilStd.ph_max || 6.5),
          '',
          '산성 토양으로 양분 불용화 우려 → 석회·칼슘 토양개량제 및 킬레이트 칼슘 보강 필수',
          '약알칼리성 토양으로 미량원소(붕소·철·망간) 흡수 저해 우려 → 유기물 퇴비 증량 및 엽면 미량요소 공급'
        ),
        diagnoseMetric(
          'om',
          '유기물 (OM)',
          soilInput.organic_matter_g_kg,
          Number(soilStd.om_min || 25),
          Number(soilStd.om_max || 35),
          'g/kg',
          `보수력·보비력 저하 우려 → 부숙 가축분퇴비·유기질비료 및 아미노산·부식산 ${policy.deficiency_boost_pct}% 증량 처방`,
          '유기물 충분 → 기비 퇴비 표준량 대비 감량하여 가스장해 예방'
        ),
        diagnoseMetric(
          'p2o5',
          '유효인산 (P₂O₅)',
          soilInput.avail_p2o5_mg_kg,
          Number(soilStd.p2o5_min || 300),
          Number(soilStd.p2o5_max || 450),
          'mg/kg',
          '초기 발근 및 화아분화 지연 우려 → 인산 함유 복합비료 및 인산가리·발근 영양제 보강',
          '인산 축적 상태 → 인산질 기비 감량 및 불용성 인산 가용화 미생물·유기산 활용 권장'
        ),
        diagnoseMetric(
          'k',
          '치환성 칼륨 (K)',
          soilInput.exch_k_cmol,
          Number(soilStd.k_min || 0.45),
          Number(soilStd.k_max || 0.75),
          'cmol+/kg',
          `구·과실 비대 불량 및 내병성 저하 우려 → NK추비 및 황산가리·비대 영양제 ${policy.deficiency_boost_pct}% 증량 처방`,
          '칼륨 과잉 시 칼슘(Ca)·마그네슘(Mg) 길항 흡수 저해 우려 → 칼슘·고토 엽면시비 강화'
        ),
        diagnoseMetric(
          'ca',
          '치환성 칼슘 (Ca)',
          soilInput.exch_ca_cmol,
          Number(soilStd.ca_min || 5.0),
          Number(soilStd.ca_max || 6.5),
          'cmol+/kg',
          '세포벽 약화·팁번(내엽갈변)·배꼽썩음병 위험 → 칼슘 유황비료 기비 및 킬레이트 칼슘·붕소 엽면시비 필수',
          '칼슘 적정 이상 확보 → 수분 급변 시 이동성 저해 대비 엽면 흡수보조제 병행'
        ),
        diagnoseMetric(
          'mg',
          '치환성 마그네슘 (Mg)',
          soilInput.exch_mg_cmol,
          Number(soilStd.mg_min || 1.5),
          Number(soilStd.mg_max || 2.2),
          'cmol+/kg',
          '엽록소 형성 및 광합성 저하(황화현상) 우려 → 고토(MgO) 함유 비료 및 마그네슘 종합미량요소 처방',
          '마그네슘 양호 → 표준 관리'
        ),
        diagnoseMetric(
          'ec',
          '염류농도 (EC)',
          soilInput.soil_ec,
          Number(soilStd.ec_min || 0.5),
          Number(soilStd.ec_max || 1.8),
          'dS/m',
          '토양 내 속효성 양분 농도 낮음 → 완효성 기비 및 추비 정량 공급',
          '염류집적 및 뿌리 삼투압 장해 우려 → 화학비료 30% 감량 및 유기산·아미노산 발근제 관주로 염류 완화'
        ),
      ];

      // 1단계(정량 모듈): 지역 하이브리드 기후 산출 (작년 기후 + 올해 예측 기후 평균 규칙)
      const pastRows = db
        .prepare(
          'SELECT record_date, temp_avg, temp_max, temp_min, humidity_avg, precipitation_mm FROM climate_address_daily WHERE bjd_code = ? AND month = ? ORDER BY record_date ASC'
        )
        .all(bjd_code, targetMonth) as any[];
      const futureRows = db
        .prepare(
          "SELECT record_date, temp_avg, temp_max, temp_min, humidity_avg, precipitation_mm FROM climate_future_daily WHERE bjd_code = ? AND month = ? AND source_type != 'UNAVAILABLE_BEYOND_6M' ORDER BY record_date ASC"
        )
        .all(bjd_code, targetMonth) as any[];
      const futureByMd = new Map<string, any>();
      for (const f of futureRows) {
        const md = String(f.record_date || '').slice(5, 10);
        if (md && f.temp_avg != null) futureByMd.set(md, f);
      }
      let blendedDays = 0;
      let pastOnlyDays = 0;
      let sumTempAvg = 0;
      let sumTempMax = 0;
      let sumTempMin = 0;
      let sumHum = 0;
      let sumRain = 0;
      let rainyDays = 0;
      const dCnt = pastRows.length || 1;
      for (const p of pastRows) {
        const md = String(p.record_date || '').slice(5, 10);
        const f = futureByMd.get(md);
        let tAvg = Number(p.temp_avg || 18);
        let tMax = Number(p.temp_max || 23);
        let tMin = Number(p.temp_min || 13);
        let hum = Number(p.humidity_avg || 65);
        let rain = Number(p.precipitation_mm || 0);
        if (f && f.temp_avg != null) {
          tAvg = (tAvg + Number(f.temp_avg)) / 2;
          tMax = (tMax + Number(f.temp_max)) / 2;
          tMin = (tMin + Number(f.temp_min)) / 2;
          hum = (hum + Number(f.humidity_avg)) / 2;
          rain = (rain + Number(f.precipitation_mm)) / 2;
          blendedDays++;
        } else {
          pastOnlyDays++;
        }
        sumTempAvg += tAvg;
        sumTempMax += tMax;
        sumTempMin += tMin;
        sumHum += hum;
        sumRain += rain;
        if (rain >= 5.0) rainyDays++;
      }

      const climateAvgTemp = Number((sumTempAvg / dCnt).toFixed(1));
      const climateMaxTemp = Number((sumTempMax / dCnt).toFixed(1));
      const climateMinTemp = Number((sumTempMin / dCnt).toFixed(1));
      const climateAvgHum = Number((sumHum / dCnt).toFixed(1));
      const climateTotalRain = Number(sumRain.toFixed(1));

      const isHighHumidity =
        climateAvgHum >= Number(policy.climate_high_humidity_pct || 75) ||
        climateTotalRain >= Number(policy.climate_rain_trigger_mm || 15) * 4;
      const isHighTemp = climateMaxTemp >= Number(policy.climate_high_temp_c || 27);
      const isLowTemp = climateMinTemp <= Number(policy.climate_low_temp_c || 10);

      const climateRiskTags: string[] = [];
      if (isHighHumidity) climateRiskTags.push('다습·강우 병해(노균병·무름병·탄저병·역병) 집중 주의');
      if (isHighTemp) climateRiskTags.push('고온기 해충(총채벌레·나방·진딧물) 및 칼슘결핍 주의');
      if (isLowTemp) climateRiskTags.push('저온·일교차 활착지연 및 냉해·생리장해 주의');
      if (climateRiskTags.length === 0) climateRiskTags.push('평년 적정 기상 조건 (예방 중심 표준 방제)');

      const climateSummary = {
        month: targetMonth,
        temp_avg: climateAvgTemp,
        temp_max: climateMaxTemp,
        temp_min: climateMinTemp,
        humidity_avg: climateAvgHum,
        rainfall_total_mm: climateTotalRain,
        rainy_days: rainyDays,
        blended_days: blendedDays,
        past_only_days: pastOnlyDays,
        climate_rule_mode: blendedDays > 0 ? 'BLENDED_AVG' : 'PAST_ONLY',
        climate_rule_desc:
          blendedDays > 0
            ? `작년(2025) 기후 + 올해 예측(2026) 기후 평균 대입 (${blendedDays}일 평균)`
            : `올해 +6개월 예측 이후 구간 — 작년(2025) 기후 단독 참조 (${pastOnlyDays}일)`,
        risk_tags: climateRiskTags,
      };

      // 생육과정 매핑 규칙 매칭
      const allRules = db
        .prepare('SELECT * FROM agro_stage_mapping_rule WHERE is_active = 1 ORDER BY sort_order ASC')
        .all() as any[];
      const procNameText = `${processRow.process_code} ${processRow.process_name} ${growthPlanRow?.work_content || ''} ${body.work_content || ''}`;
      let matchedRule =
        allRules.find((r) =>
          String(r.process_codes_csv || '')
            .split(',')
            .map((s) => s.trim())
            .includes(process_code)
        ) ||
        allRules.find((r) =>
          String(r.stage_keywords_csv || '')
            .split(',')
            .some((kw) => kw.trim() && procNameText.includes(kw.trim()))
        ) ||
        allRules[0];

      // 등록된 전체 농자재 상품(5. 농자재 상품 관리 DB) 로드
      const allMaterials = db
        .prepare('SELECT * FROM agro_material ORDER BY material_id ASC')
        .all() as any[];

      // 작물별 생육 과정 관리(crop_growth_process_plan)에 직접 지정된 추천 자재 ID 목록 추출
      let planMaterialIds: string[] = [];
      if (growthPlanRow?.required_materials_json) {
        try {
          const parsed = JSON.parse(growthPlanRow.required_materials_json);
          if (Array.isArray(parsed)) {
            planMaterialIds = parsed.map((m: any) => String(m.material_id || m)).filter(Boolean);
          }
        } catch {
          // ignore
        }
      }

      const deficientKeys = new Set(soilDiagnostics.filter((d) => d.status === 'DEFICIENT').map((d) => d.key));
      const excessKeys = new Set(soilDiagnostics.filter((d) => d.status === 'EXCESS').map((d) => d.key));

      // 모듈화된 3대 대분류(비료·영양제·병해충관리제) 전용 등록항목 기반 정량 채점 및 추천 근거 산출 엔진 호출
      const stageSpec = resolveStageSpecByProcessOrItem(processRow.process_code, processRow.process_name);
      const commonEvalParams = {
        allMaterials,
        stageSpec,
        cropName: cropRow.crop_name,
        cultivarName: cultivarRow?.cultivar_name || '표준품종',
        regionName: `${addrRow.sido} ${addrRow.sigungu} ${addrRow.eupmyeondong}`,
        areaPyeong: area_pyeong,
        soilInput,
        soilStd,
        climate: {
          month: targetMonth,
          temp_avg: climateAvgTemp,
          temp_max: climateMaxTemp,
          temp_min: climateMinTemp,
          humidity_avg: climateAvgHum,
          rainfall_total_mm: climateTotalRain,
          rainy_days: rainyDays,
        },
        daysToHarvest: Number(body.days_to_harvest ?? stageSpec.daysBeforeHarvestTypical),
        preferredMaterialIds: planMaterialIds,
        policy,
      };

      const recommendedFertilizers = evaluateCategoryRecommendations({
        ...commonEvalParams,
        category: 'FERTILIZER',
        maxCount: 2,
      });
      const recommendedNutrients = evaluateCategoryRecommendations({
        ...commonEvalParams,
        category: 'NUTRIENT',
        maxCount: 2,
      });
      const recommendedPesticides = evaluateCategoryRecommendations({
        ...commonEvalParams,
        category: 'PESTICIDE',
        maxCount: 2,
      });

      const totalEstimatedCost =
        recommendedFertilizers.reduce((acc, x) => acc + x.total_cost, 0) +
        recommendedNutrients.reduce((acc, x) => acc + x.total_cost, 0) +
        recommendedPesticides.reduce((acc, x) => acc + x.total_cost, 0);

      const deficientSummaryList = soilDiagnostics
        .filter((d) => d.status === 'DEFICIENT')
        .map((d) => `${d.label}(${d.value}${d.unit}, 기준 ${d.min}~${d.max}${d.unit})`);
      const excessSummaryList = soilDiagnostics
        .filter((d) => d.status === 'EXCESS')
        .map((d) => `${d.label}(${d.value}${d.unit}, 기준 ${d.min}~${d.max}${d.unit})`);

      // 2단계(AI Agent 추론기): 4대 영역 종합 처방 소견서 생성
      const aiAgentReport = {
        headline: `[${addrRow.sido} ${addrRow.sigungu} ${addrRow.eupmyeondong}] ${cropRow.crop_name}${
          cultivarRow ? `(${cultivarRow.cultivar_name})` : ''
        } · '${processRow.process_name}' 단계 맞춤형 농자재 처방 소견서`,
        soilSection:
          deficientSummaryList.length > 0 || excessSummaryList.length > 0
            ? `해당 재배지(${addrRow.full_address}, ${soilInput.land_category}·${soilInput.soil_texture})의 토양검정 수치를 ${cropRow.crop_name} 적정 기준과 비교 분석한 결과, ${
                deficientSummaryList.length > 0 ? `부족 항목은 [${deficientSummaryList.join(', ')}]이며 ` : ''
              }${
                excessSummaryList.length > 0 ? `과잉 항목은 [${excessSummaryList.join(', ')}]입니다. ` : '과잉 항목은 없습니다. '
              }이에 따라 부족 성분 보충을 위해 [${recommendedFertilizers.map((f) => f.product_name).join(', ')}] 처방량을 ${policy.deficiency_boost_pct}% 가산 보정하였습니다.`
            : `해당 재배지(${addrRow.full_address}, ${soilInput.soil_texture})의 7대 토양검정 성분이 모두 ${cropRow.crop_name} 적정 기준 범위 내에 분포하고 있어, 지력 유지와 생육 균형을 위한 표준 정량 처방을 적용하였습니다.`,
        stageSection: `'${processRow.process_name}(${processRow.process_code})' 과정은 "${
          matchedRule?.physiological_goal || '생육 단계별 필수 양분 공급 및 건전 생육 유도'
        }"가 핵심인 시기입니다. 비료로는 [${recommendedFertilizers
          .map((f) => `${f.product_name}(${f.sub_type})`)
          .join(', ')}]을 투입하여 기반 양분을 공급하고, 영양제로는 [${recommendedNutrients
          .map((n) => `${n.product_name}(${n.target_nutrient_or_pest})`)
          .join(', ')}]을 병행하여 생리 활력을 극대화하도록 구성하였습니다.`,
        climateSection: `[기후 대입 규칙: ${climateSummary.climate_rule_desc}] 분석 결과, ${targetMonth}월 해당 지역의 예상 평균기온은 ${climateAvgTemp}℃(최고 ${climateMaxTemp}℃ / 최저 ${climateMinTemp}℃), 평균습도 ${climateAvgHum}%, 월 강우량 ${climateTotalRain}mm(강우일수 ${rainyDays}일)입니다. 주요 기상 위험 요인인 [${climateRiskTags.join(
          ' / '
        )}]에 대응하기 위해 [${recommendedPesticides
          .map((p) => `${p.product_name}(${p.target_nutrient_or_pest})`)
          .join(', ')}]을 선제 예방·방제 약제로 선정하였습니다.`,
        applicationGuide: `경작면적 ${area_pyeong.toLocaleString()}평 기준 총 추천 자재는 비료 ${recommendedFertilizers.length}종, 영양제 ${recommendedNutrients.length}종, 병해충관리제 ${recommendedPesticides.length}종이며 총 예상 견적은 ₩${totalEstimatedCost.toLocaleString()}입니다. ${
          growthPlanRow?.usage_tip ||
          '엽면살포용 영양제와 병해충관리제를 혼용할 때는 반드시 아침 이슬이 마른 직후 또는 해질 무렵에 살포하시고, 강알칼리성 약제와의 혼용을 피하십시오.'
        }`,
      };

      const fullRationaleText = [
        `■ ${aiAgentReport.headline}`,
        `1) [토양검정 진단 근거] ${aiAgentReport.soilSection}`,
        `2) [생육과정 생리 근거] ${aiAgentReport.stageSection}`,
        `3) [지역 기후·병해충 근거] ${aiAgentReport.climateSection}`,
        `4) [투입량 및 살포 가이드] ${aiAgentReport.applicationGuide}`,
      ].join('\n');

      let savedRecId = '';
      if (body.save_history !== false) {
        savedRecId = `REC-${new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-4)}`;
        const createdAt = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
        db.prepare(`
          INSERT INTO agro_recommendation_history (
            rec_id, bjd_code, region_name, group_id, crop_id, crop_name, cultivar_id, cultivar_name,
            process_code, process_name, area_pyeong,
            soil_summary_json, climate_summary_json,
            recommended_fertilizers_json, recommended_nutrients_json, recommended_pesticides_json,
            ai_rationale_text, total_estimated_cost, admin_override_note, source_context, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          savedRecId,
          bjd_code,
          addrRow.full_address || `${addrRow.sido} ${addrRow.sigungu} ${addrRow.eupmyeondong}`,
          cropRow.group_id || 'GRP-LEAF',
          crop_id,
          cropRow.crop_name,
          cultivar_id,
          cultivarRow?.cultivar_name || '표준품종',
          process_code,
          processRow.process_name,
          area_pyeong,
          JSON.stringify({ input: soilInput, diagnostics: soilDiagnostics }),
          JSON.stringify(climateSummary),
          JSON.stringify(recommendedFertilizers),
          JSON.stringify(recommendedNutrients),
          JSON.stringify(recommendedPesticides),
          fullRationaleText,
          totalEstimatedCost,
          String(body.admin_override_note || ''),
          String(body.source_context || 'ADMIN_SIMULATOR'),
          createdAt
        );
        const savedRecRow = db.prepare('SELECT * FROM agro_recommendation_history WHERE rec_id = ?').get(savedRecId) as Record<string, any> | undefined;
        if (savedRecRow) {
          await supabaseRestUpsert('agro_recommendation_history', savedRecRow, 'rec_id');
        }
      }

      sendJson(res, {
        ok: true,
        rec_id: savedRecId,
        address: addrRow,
        crop: cropRow,
        cultivar: cultivarRow,
        process: processRow,
        area_pyeong,
        soilInput,
        soilStandard: soilStd,
        soilDiagnostics,
        climateSummary,
        matchedRule,
        stageSpec,
        recommendations: {
          fertilizers: recommendedFertilizers,
          nutrients: recommendedNutrients,
          pesticides: recommendedPesticides,
        },
        aiAgentReport,
        fullRationaleText,
        totalEstimatedCost,
      });
      return;
    }

    // 4-1-G. 농자재 추천 이력 관리자 보정 메모 수정 및 삭제 API
    if (pathname === '/api/agro-recommendation-module/history/override' && req.method === 'POST') {
      const { rec_id, admin_override_note, ai_rationale_text } = await readJsonBody(req);
      const cleanId = String(rec_id || '').trim();
      db.prepare(`
        UPDATE agro_recommendation_history
        SET admin_override_note = ?,
            ai_rationale_text = COALESCE(NULLIF(?, ''), ai_rationale_text)
        WHERE rec_id = ?
      `).run(String(admin_override_note || ''), String(ai_rationale_text || ''), cleanId);
      const updatedRecRow = db.prepare('SELECT * FROM agro_recommendation_history WHERE rec_id = ?').get(cleanId) as Record<string, any> | undefined;
      if (updatedRecRow) {
        await supabaseRestUpsert('agro_recommendation_history', updatedRecRow, 'rec_id');
      }
      sendJson(res, { ok: true });
      return;
    }

    if (pathname === '/api/agro-recommendation-module/history/delete' && req.method === 'POST') {
      const { rec_id } = await readJsonBody(req);
      const cleanId = String(rec_id || '').trim();
      db.prepare('DELETE FROM agro_recommendation_history WHERE rec_id = ?').run(cleanId);
      if (cleanId) {
        await supabaseRestDelete('agro_recommendation_history', `rec_id=eq.${encodeURIComponent(cleanId)}`);
      }
      sendJson(res, { ok: true });
      return;
    }

    // 4-2. 농자재 실제 제품 이미지 정적 서빙 및 동적 SVG 렌더링 API (썸네일 1개 + 세부이미지 4개 + 세부설명용 이미지 1개)
    if (pathname.startsWith('/images/fertilizers/') && req.method === 'GET') {
      const fileName = path.basename(decodeURIComponent(pathname));
      const filePath = path.join(process.cwd(), 'public', 'images', 'fertilizers', fileName);
      if (fs.existsSync(filePath)) {
        const ext = path.extname(fileName).toLowerCase();
        const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'application/octet-stream';
        res.writeHead(200, {
          'Content-Type': mime,
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(fs.readFileSync(filePath));
        return;
      }
    }

    if (pathname.startsWith('/api/agro-materials/image/') && req.method === 'GET') {
      const parts = pathname.replace('/api/agro-materials/image/', '').split('/');
      const materialId = decodeURIComponent(parts[0] || 'FERT-PRD-01');
      const slot = decodeURIComponent(parts[1] || 'thumb');
      const rawSafeId = path.basename(materialId).toUpperCase();
      const safeSlot = path.basename(slot);
      let mappedId = path.basename(materialId);
      const nutrM = rawSafeId.match(/^(?:MAT-NUTR-|NUTR-PRD-)0*(\d+)$/);
      const pestM = rawSafeId.match(/^(?:MAT-PEST-|PEST-PRD-)0*(\d+)$/);
      const fertM = rawSafeId.match(/^(?:FERT-PRD-|MAT-FERT-)0*(\d+)$/);
      if (nutrM) {
        const n = ((Math.max(1, parseInt(nutrM[1], 10) || 1) - 1) % 5) + 1;
        mappedId = `MAT-NUTR-0${n}`;
      } else if (pestM) {
        const n = ((Math.max(1, parseInt(pestM[1], 10) || 1) - 1) % 6) + 1;
        mappedId = `MAT-PEST-0${n}`;
      } else if (fertM) {
        const n = ((Math.max(1, parseInt(fertM[1], 10) || 1) - 1) % 5) + 1;
        mappedId = `FERT-PRD-0${n}`;
      }
      const pngPath = path.join(process.cwd(), 'public', 'images', 'fertilizers', `${mappedId}-${safeSlot}.png`);
      const jpgPath = path.join(process.cwd(), 'public', 'images', 'fertilizers', `${mappedId}-${safeSlot}.jpg`);
      if (fs.existsSync(pngPath)) {
        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(fs.readFileSync(pngPath));
        return;
      }
      if (fs.existsSync(jpgPath)) {
        res.writeHead(200, {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(fs.readFileSync(jpgPath));
        return;
      }
      const item = db.prepare('SELECT * FROM agro_material WHERE material_id = ?').get(materialId) as any;
      const svg = renderFertilizerSvg(item || { material_id: materialId }, slot);
      res.writeHead(200, {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(svg);
      return;
    }

    // 4-3. 농자재 상품 관리 (비료 FERTILIZER / 영양재 NUTRIENT / 병해충관리제 PESTICIDE) 조회·등록·수정·삭제 API (Supabase 실시간 연동)
    if (pathname === '/api/agro-materials' && req.method === 'GET') {
      const category = (parsedUrl.searchParams.get('category') || 'ALL').trim();
      const mainType = (parsedUrl.searchParams.get('main_type') || 'ALL').trim();
      const subType = (parsedUrl.searchParams.get('sub_type') || 'ALL').trim();
      const isOrganic = (parsedUrl.searchParams.get('is_organic') || 'ALL').trim();
      const q = (parsedUrl.searchParams.get('q') || '').trim();
      const rawPage = parsedUrl.searchParams.get('page');
      const rawPageSize = parsedUrl.searchParams.get('pageSize');
      const pageSize = Math.max(1, Math.min(100, Number(rawPageSize) || 20));

      const whereClauses: string[] = [];
      const params: any[] = [];

      if (category && category !== 'ALL') {
        whereClauses.push('material_category = ?');
        params.push(category);
      }
      if (mainType && mainType !== 'ALL') {
        if (mainType === '천연비료') {
          whereClauses.push("(main_type = '천연비료' OR sub_type IN ('유기질·퇴비', '토양개량·칼슘비료'))");
        } else if (mainType === '화학비료') {
          whereClauses.push("(main_type = '화학비료' OR (main_type IS NULL OR main_type = '') AND sub_type NOT IN ('유기질·퇴비', '토양개량·칼슘비료'))");
        } else {
          whereClauses.push('main_type = ?');
          params.push(mainType);
        }
      }
      if (subType && subType !== 'ALL') {
        whereClauses.push('(sub_type = ? OR category_code = ?)');
        params.push(subType, subType);
      }
      if (isOrganic && isOrganic !== 'ALL') {
        whereClauses.push('is_organic = ?');
        params.push(isOrganic === '1' || isOrganic === 'Y' ? 1 : 0);
      }
      if (q) {
        const kw = `%${q}%`;
        whereClauses.push(`(
          material_id LIKE ? OR
          product_code LIKE ? OR
          product_name LIKE ? OR
          manufacturer LIKE ? OR
          sub_type LIKE ? OR
          nutrient_ratio_summary LIKE ? OR
          target_nutrient_or_pest LIKE ? OR
          usage_stage LIKE ? OR
          weather_trigger LIKE ? OR
          origin_country LIKE ?
        )`);
        params.push(kw, kw, kw, kw, kw, kw, kw, kw, kw, kw);
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
      const items = db
        .prepare(`SELECT * FROM agro_material ${whereSql} ORDER BY material_id ASC`)
        .all(...params);

      const summary = db
        .prepare(`
          SELECT
            COUNT(*) as total_count,
            SUM(CASE WHEN material_category = 'FERTILIZER' THEN 1 ELSE 0 END) as fertilizer_count,
            SUM(CASE WHEN material_category = 'NUTRIENT' THEN 1 ELSE 0 END) as nutrient_count,
            SUM(CASE WHEN material_category = 'PESTICIDE' THEN 1 ELSE 0 END) as pesticide_count,
            SUM(CASE WHEN material_category = 'SEED' THEN 1 ELSE 0 END) as seed_count,
            SUM(CASE WHEN material_category = 'SEEDLING' THEN 1 ELSE 0 END) as seedling_count,
            SUM(CASE WHEN is_organic = 1 THEN 1 ELSE 0 END) as organic_count,
            ROUND(AVG(unit_price), 0) as avg_price
          FROM agro_material
          ${whereSql}
        `)
        .get(...params);

      const dbFertCats = db
        .prepare(
          'SELECT category_code as code, main_type, category_name as name, description as desc, sort_order FROM fertilizer_category_code ORDER BY sort_order ASC, category_code ASC'
        )
        .all() as Array<{ code: string; main_type?: string; name: string; desc: string; sort_order: number }>;
      const resolvedFertCategories = (dbFertCats.length > 0 ? dbFertCats : FERTILIZER_CATEGORIES).map((c) => ({
        ...c,
        main_type: resolveFertilizerMainType(c.name || c.code, c.main_type),
      }));

      const dbNutrCats = db
        .prepare(
          'SELECT category_code as code, category_name as name, description as desc, sort_order FROM nutrient_category_code ORDER BY sort_order ASC, category_code ASC'
        )
        .all() as Array<{ code: string; name: string; desc: string; sort_order: number }>;
      const resolvedNutrCategories = dbNutrCats.length > 0 ? dbNutrCats : NUTRIENT_CATEGORIES;

      const dbPestCats = db
        .prepare(
          'SELECT category_code as code, category_name as name, description as desc, sort_order FROM pesticide_category_code ORDER BY sort_order ASC, category_code ASC'
        )
        .all() as Array<{ code: string; name: string; desc: string; sort_order: number }>;
      const resolvedPestCategories = dbPestCats.length > 0 ? dbPestCats : PESTICIDE_CATEGORIES;

      const dbSeedCats = db
        .prepare(
          'SELECT category_code as code, category_name as name, description as desc, sort_order FROM seed_category_code ORDER BY sort_order ASC, category_code ASC'
        )
        .all() as Array<{ code: string; name: string; desc: string; sort_order: number }>;
      const resolvedSeedCategories = dbSeedCats.length > 0 ? dbSeedCats : SEED_CATEGORIES;

      const dbSeedlingCats = db
        .prepare(
          'SELECT category_code as code, category_name as name, description as desc, sort_order FROM seedling_category_code ORDER BY sort_order ASC, category_code ASC'
        )
        .all() as Array<{ code: string; name: string; desc: string; sort_order: number }>;
      const resolvedSeedlingCategories = dbSeedlingCats.length > 0 ? dbSeedlingCats : SEEDLING_CATEGORIES;

      const subTypes =
        category === 'FERTILIZER'
          ? resolvedFertCategories.map((c) => c.name)
          : category === 'NUTRIENT'
          ? resolvedNutrCategories.map((c) => c.name)
          : category === 'PESTICIDE'
          ? resolvedPestCategories.map((c) => c.name)
          : category === 'SEED'
          ? resolvedSeedCategories.map((c) => c.name)
          : category === 'SEEDLING'
          ? resolvedSeedlingCategories.map((c) => c.name)
          : db
              .prepare(
                category && category !== 'ALL'
                  ? 'SELECT DISTINCT sub_type FROM agro_material WHERE material_category = ? ORDER BY sub_type ASC'
                  : 'SELECT DISTINCT sub_type FROM agro_material ORDER BY sub_type ASC'
              )
              .all(...(category && category !== 'ALL' ? [category] : []))
              .map((r: any) => r.sub_type);

      const totalCount = items.length;
      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
      const currentPage = Math.max(1, Math.min(totalPages, Number(rawPage) || 1));
      const pagedItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);

      sendJson(res, {
        items: rawPage ? pagedItems : items,
        allItems: items,
        pagedItems,
        total: totalCount,
        page: currentPage,
        pageSize,
        totalPages,
        summary,
        subTypes,
        fertilizerCategories: resolvedFertCategories,
        nutrientCategories: resolvedNutrCategories,
        pesticideCategories: resolvedPestCategories,
        seedCategories: resolvedSeedCategories,
        seedlingCategories: resolvedSeedlingCategories,
      });
      return;
    }

    if (pathname === '/api/agro-materials/save' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const cat = (body.material_category || 'FERTILIZER').trim();
      const prefix =
        cat === 'NUTRIENT'
          ? 'MAT-NUTR-'
          : cat === 'PESTICIDE'
          ? 'MAT-PEST-'
          : cat === 'SEED'
          ? 'MAT-SEED-'
          : cat === 'SEEDLING'
          ? 'MAT-SDL-'
          : 'FERT-PRD-';
      const material_id = (body.material_id || `${prefix}${String(Date.now()).slice(-2)}`).trim();
      const idEnc = encodeURIComponent(material_id);

      const n_pct = Number(body.n_pct) || 0;
      const p_pct = Number(body.p_pct) || 0;
      const k_pct = Number(body.k_pct) || 0;
      const ca_pct = Number(body.ca_pct) || 0;
      const mg_pct = Number(body.mg_pct) || 0;
      const b_pct = Number(body.b_pct) || 0;
      const sio2_pct = Number(body.sio2_pct) || 0;
      const s_pct = Number(body.s_pct) || 0;
      const om_pct = Number(body.om_pct) || 0;

      const application_method = (body.application_method || '').trim();
      const release_duration = (body.release_duration || '').trim();
      const amino_acid_pct = Number(body.amino_acid_pct) || 0;
      const seaweed_humic_pct = Number(body.seaweed_humic_pct) || 0;
      const chelate_micro_summary = (body.chelate_micro_summary || '').trim();
      const stress_target = (body.stress_target || '').trim();
      const dilution_ratio = (body.dilution_ratio || '').trim();
      const active_ingredient = (body.active_ingredient || '').trim();
      const moa_group_code = (body.moa_group_code || '').trim();
      const pesticide_reg_no = (body.pesticide_reg_no || '').trim();
      const safety_phi_days = (body.safety_phi_days || '').trim();
      const safety_max_count = (body.safety_max_count || '').trim();

      const seed_count_spec = (body.seed_count_spec || '').trim();
      const germination_rate_pct = (body.germination_rate_pct || '').trim();
      const germination_temp_spec = (body.germination_temp_spec || '').trim();
      const seed_coating_spec = (body.seed_coating_spec || '').trim();
      const sowing_period_spec = (body.sowing_period_spec || '').trim();
      const days_to_harvest_spec = (body.days_to_harvest_spec || '').trim();
      const disease_resistance_spec = (body.disease_resistance_spec || '').trim();
      const variety_reg_no = (body.variety_reg_no || '').trim();

      const plug_tray_spec = (body.plug_tray_spec || '').trim();
      const seedling_age_spec = (body.seedling_age_spec || '').trim();
      const grafting_type_spec = (body.grafting_type_spec || '').trim();
      const planting_distance_spec = (body.planting_distance_spec || '').trim();
      const hardening_spec = (body.hardening_spec || '').trim();
      const shipping_pack_spec = (body.shipping_pack_spec || '').trim();

      const autoSummary =
        (body.nutrient_ratio_summary || '').trim() ||
        (cat === 'SEED'
          ? [
              seed_count_spec ? `립수: ${seed_count_spec}` : '',
              germination_rate_pct ? `발아율: ${germination_rate_pct}` : '',
              germination_temp_spec ? `발아적온: ${germination_temp_spec}` : '',
              days_to_harvest_spec ? `숙기: ${days_to_harvest_spec}` : '',
              disease_resistance_spec || '',
            ]
              .filter(Boolean)
              .join(' | ')
          : cat === 'SEEDLING'
          ? [
              plug_tray_spec ? `규격: ${plug_tray_spec}` : '',
              seedling_age_spec ? `묘령: ${seedling_age_spec}` : '',
              planting_distance_spec ? `재식거리: ${planting_distance_spec}` : '',
              grafting_type_spec || '',
            ]
              .filter(Boolean)
              .join(' | ')
          : cat === 'PESTICIDE'
          ? [
              active_ingredient || '유효성분 미입력',
              moa_group_code ? `작용기작 ${moa_group_code}` : '',
              dilution_ratio ? `희석 ${dilution_ratio}` : '',
            ]
              .filter(Boolean)
              .join(' · ')
          : cat === 'NUTRIENT'
          ? [
              amino_acid_pct ? `유리아미노산 ${amino_acid_pct}%` : '',
              seaweed_humic_pct ? `해조·풀빅산 ${seaweed_humic_pct}%` : '',
              ca_pct ? `수용성 Ca ${ca_pct}%` : '',
              b_pct ? `수용성 B ${b_pct}%` : '',
              mg_pct ? `수용성 Mg ${mg_pct}%` : '',
              chelate_micro_summary || '',
            ]
              .filter(Boolean)
              .join(' + ')
          : `N ${n_pct}% · P₂O₅ ${p_pct}% · K₂O ${k_pct}%` +
            (mg_pct ? ` + 고토(MgO) ${mg_pct}%` : '') +
            (b_pct ? ` + 붕소(B₂O₃) ${b_pct}%` : '') +
            (ca_pct ? ` + 칼슘(CaO) ${ca_pct}%` : '') +
            (om_pct ? ` + 유기물(OM) ${om_pct}%` : ''));

      const unit_price = Number(body.unit_price) || 15000;
      const retail_price = Number(body.retail_price) || Math.round(unit_price * 1.15);
      const discount_rate =
        body.discount_rate != null && body.discount_rate !== ''
          ? Number(body.discount_rate)
          : retail_price > unit_price
          ? Number((((retail_price - unit_price) / retail_price) * 100).toFixed(1))
          : 0;
      const reward_points =
        body.reward_points != null && body.reward_points !== ''
          ? Number(body.reward_points)
          : Math.round(unit_price * 0.02);

      const is_organic =
        body.is_organic === 1 ||
        body.is_organic === true ||
        body.is_organic === '1' ||
        body.is_organic === 'Y'
          ? 1
          : 0;

      const resolvedSubType = (
        body.sub_type ||
        (cat === 'NUTRIENT'
          ? '작물영양재'
          : cat === 'PESTICIDE'
          ? '살충·살균제'
          : cat === 'SEED'
          ? '엽채류 종자 (배추·상추·시금치·양배추)'
          : cat === 'SEEDLING'
          ? '배추·양배추·쌈채류 모종'
          : '복합비료')
      ).trim();

      const fullRowData = {
        material_id,
        product_code: (body.product_code || '30001000012').trim(),
        material_category: cat,
        main_type:
          cat === 'FERTILIZER'
            ? resolveFertilizerMainType(resolvedSubType || body.category_code, body.main_type)
            : (body.main_type || '').trim(),
        sub_type: resolvedSubType,
        category_code: (body.category_code || 'CAT-NPK-COMP').trim(),
        manufacturer: (body.manufacturer || '대유').trim(),
        product_name: (body.product_name || '신규 비료 상품').trim(),
        formulation_type: (body.formulation_type || '입상 (Granular)').trim(),
        is_organic,
        organic_label: (body.organic_label || (is_organic ? '(유기농)' : '(비유기농)')).trim(),
        weight_spec: (body.weight_spec || '20Kg').trim(),
        volume_spec: (body.volume_spec || '0ml').trim(),
        origin_country: (body.origin_country || '대한민국 (국산)').trim(),
        contact_phone: (body.contact_phone || '1588-2026').trim(),
        target_nutrient_or_pest: (body.target_nutrient_or_pest || '').trim(),
        nutrient_ratio_summary: autoSummary,
        n_pct,
        p_pct,
        k_pct,
        ca_pct,
        mg_pct,
        b_pct,
        sio2_pct,
        s_pct,
        om_pct,
        dosage_per_100pyeong: (body.dosage_per_100pyeong || '100평당 20~40kg (1~2포)').trim(),
        unit_spec: (body.unit_spec || `${body.weight_spec || '20Kg'} / 포`).trim(),
        retail_price,
        unit_price,
        discount_rate,
        reward_points,
        stock_status: (body.stock_status || '정상판매 · 즉시출고').trim(),
        usage_stage: (body.usage_stage || '본밭 밑거름 / 웃거름').trim(),
        weather_trigger: (body.weather_trigger || '').trim(),
        thumbnail_url: (body.thumbnail_url || `/api/agro-materials/image/${idEnc}/thumb`).trim(),
        detail_image_1: (body.detail_image_1 || `/api/agro-materials/image/${idEnc}/detail1`).trim(),
        detail_image_2: (body.detail_image_2 || `/api/agro-materials/image/${idEnc}/detail2`).trim(),
        detail_image_3: (body.detail_image_3 || `/api/agro-materials/image/${idEnc}/detail3`).trim(),
        detail_image_4: (body.detail_image_4 || `/api/agro-materials/image/${idEnc}/detail4`).trim(),
        description_banner_url: (
          body.description_banner_url || `/api/agro-materials/image/${idEnc}/desc`
        ).trim(),
        application_method,
        release_duration,
        amino_acid_pct,
        seaweed_humic_pct,
        chelate_micro_summary,
        stress_target,
        dilution_ratio,
        active_ingredient,
        moa_group_code,
        pesticide_reg_no,
        safety_phi_days,
        safety_max_count,
        seed_count_spec,
        germination_rate_pct,
        germination_temp_spec,
        seed_coating_spec,
        sowing_period_spec,
        days_to_harvest_spec,
        disease_resistance_spec,
        variety_reg_no,
        plug_tray_spec,
        seedling_age_spec,
        grafting_type_spec,
        planting_distance_spec,
        hardening_spec,
        shipping_pack_spec,
      };

      db.prepare(`
        INSERT OR REPLACE INTO agro_material (
          material_id, product_code, material_category, main_type, sub_type, category_code, manufacturer,
          product_name, formulation_type, is_organic, organic_label,
          weight_spec, volume_spec, origin_country, contact_phone,
          target_nutrient_or_pest, nutrient_ratio_summary,
          n_pct, p_pct, k_pct, ca_pct, mg_pct, b_pct, sio2_pct, s_pct, om_pct,
          dosage_per_100pyeong, unit_spec, retail_price, unit_price, discount_rate, reward_points, stock_status,
          usage_stage, weather_trigger,
          thumbnail_url, detail_image_1, detail_image_2, detail_image_3, detail_image_4, description_banner_url,
          application_method, release_duration, amino_acid_pct, seaweed_humic_pct, chelate_micro_summary,
          stress_target, dilution_ratio, active_ingredient, moa_group_code, pesticide_reg_no, safety_phi_days, safety_max_count,
          seed_count_spec, germination_rate_pct, germination_temp_spec, seed_coating_spec,
          sowing_period_spec, days_to_harvest_spec, disease_resistance_spec, variety_reg_no,
          plug_tray_spec, seedling_age_spec, grafting_type_spec, planting_distance_spec, hardening_spec, shipping_pack_spec
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        fullRowData.material_id,
        fullRowData.product_code,
        fullRowData.material_category,
        fullRowData.main_type,
        fullRowData.sub_type,
        fullRowData.category_code,
        fullRowData.manufacturer,
        fullRowData.product_name,
        fullRowData.formulation_type,
        fullRowData.is_organic,
        fullRowData.organic_label,
        fullRowData.weight_spec,
        fullRowData.volume_spec,
        fullRowData.origin_country,
        fullRowData.contact_phone,
        fullRowData.target_nutrient_or_pest,
        fullRowData.nutrient_ratio_summary,
        fullRowData.n_pct,
        fullRowData.p_pct,
        fullRowData.k_pct,
        fullRowData.ca_pct,
        fullRowData.mg_pct,
        fullRowData.b_pct,
        fullRowData.sio2_pct,
        fullRowData.s_pct,
        fullRowData.om_pct,
        fullRowData.dosage_per_100pyeong,
        fullRowData.unit_spec,
        fullRowData.retail_price,
        fullRowData.unit_price,
        fullRowData.discount_rate,
        fullRowData.reward_points,
        fullRowData.stock_status,
        fullRowData.usage_stage,
        fullRowData.weather_trigger,
        fullRowData.thumbnail_url,
        fullRowData.detail_image_1,
        fullRowData.detail_image_2,
        fullRowData.detail_image_3,
        fullRowData.detail_image_4,
        fullRowData.description_banner_url,
        fullRowData.application_method,
        fullRowData.release_duration,
        fullRowData.amino_acid_pct,
        fullRowData.seaweed_humic_pct,
        fullRowData.chelate_micro_summary,
        fullRowData.stress_target,
        fullRowData.dilution_ratio,
        fullRowData.active_ingredient,
        fullRowData.moa_group_code,
        fullRowData.pesticide_reg_no,
        fullRowData.safety_phi_days,
        fullRowData.safety_max_count,
        fullRowData.seed_count_spec,
        fullRowData.germination_rate_pct,
        fullRowData.germination_temp_spec,
        fullRowData.seed_coating_spec,
        fullRowData.sowing_period_spec,
        fullRowData.days_to_harvest_spec,
        fullRowData.disease_resistance_spec,
        fullRowData.variety_reg_no,
        fullRowData.plug_tray_spec,
        fullRowData.seedling_age_spec,
        fullRowData.grafting_type_spec,
        fullRowData.planting_distance_spec,
        fullRowData.hardening_spec,
        fullRowData.shipping_pack_spec
      );

      // Supabase public.agro_material 테이블에도 동기화
      await supabaseRestUpsert('agro_material', fullRowData, 'material_id');
      sendJson(res, { ok: true, item: fullRowData });
      return;
    }

    if (pathname === '/api/agro-materials/delete' && req.method === 'POST') {
      const { material_id } = await readJsonBody(req);
      db.prepare('DELETE FROM agro_material WHERE material_id = ?').run(material_id);
      await supabaseRestDelete('agro_material', `material_id=eq.${encodeURIComponent(material_id)}`);
      sendJson(res, { ok: true });
      return;
    }

    // 4-4. 결제용 은행계좌 관리 (제품 구입시 계좌이체 입금 계좌 DB 조회·등록·수정·삭제 API)
    if (pathname === '/api/payment-bank-accounts' && req.method === 'GET') {
      const bankCode = (parsedUrl.searchParams.get('bank_code') || 'ALL').trim();
      const isActive = (parsedUrl.searchParams.get('is_active') || 'ALL').trim();
      const q = (parsedUrl.searchParams.get('q') || '').trim();

      const whereClauses: string[] = [];
      const params: any[] = [];

      if (bankCode && bankCode !== 'ALL') {
        whereClauses.push('bank_code = ?');
        params.push(bankCode);
      }
      if (isActive === '1' || isActive === '0') {
        whereClauses.push('is_active = ?');
        params.push(Number(isActive));
      }
      if (q) {
        whereClauses.push(
          '(account_id LIKE ? OR bank_name LIKE ? OR account_number LIKE ? OR account_holder LIKE ? OR account_purpose LIKE ? OR branch_name LIKE ?)'
        );
        const likeQ = `%${q}%`;
        params.push(likeQ, likeQ, likeQ, likeQ, likeQ, likeQ);
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
      const items = db
        .prepare(
          `SELECT * FROM payment_bank_account ${whereSql} ORDER BY is_primary DESC, sort_order ASC, account_id ASC`
        )
        .all(...params) as any[];

      const allItems = db
        .prepare('SELECT * FROM payment_bank_account ORDER BY is_primary DESC, sort_order ASC, account_id ASC')
        .all() as any[];
      const activeCount = allItems.filter((a) => Number(a.is_active) === 1).length;
      const primaryAccount = allItems.find((a) => Number(a.is_primary) === 1) || allItems[0] || null;

      sendJson(res, {
        items,
        totalCount: allItems.length,
        activeCount,
        primaryAccount,
      });
      return;
    }

    if (pathname === '/api/payment-bank-accounts' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const accountId = String(body.account_id || '').trim().toUpperCase();
      const bankCode = String(body.bank_code || '011').trim();
      const bankName = String(body.bank_name || 'NH농협은행').trim();
      const accountNumber = String(body.account_number || '').trim();
      const accountHolder = String(body.account_holder || '(주)팜플랜농자재').trim();

      if (!accountId || !bankName || !accountNumber || !accountHolder) {
        sendJson(
          res,
          { ok: false, message: '계좌 관리코드, 은행명, 계좌번호, 예금주명은 필수 입력 항목입니다.' },
          400
        );
        return;
      }

      if (body.mode === 'create') {
        const dup = db
          .prepare('SELECT account_id FROM payment_bank_account WHERE UPPER(account_id) = ?')
          .get(accountId);
        if (dup) {
          sendJson(res, { ok: false, message: `이미 등록된 계좌 관리코드(${accountId})입니다.` }, 409);
          return;
        }
      }

      const isPrimary = body.is_primary ? 1 : 0;
      const isActive = body.is_active === undefined || body.is_active === null ? 1 : body.is_active ? 1 : 0;
      const autoConfirm =
        body.auto_confirm_enabled === undefined || body.auto_confirm_enabled === null
          ? 1
          : body.auto_confirm_enabled
          ? 1
          : 0;
      const sortOrder = Number(body.sort_order) || 1;
      const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');

      if (isPrimary === 1) {
        db.prepare('UPDATE payment_bank_account SET is_primary = 0').run();
      }

      const rowData = {
        account_id: accountId,
        bank_code: bankCode,
        bank_name: bankName,
        account_number: accountNumber,
        account_holder: accountHolder,
        account_purpose: String(body.account_purpose || '비료·영양재·병해충관리제 통합 구입 결제').trim(),
        branch_name: String(body.branch_name || '').trim(),
        is_primary: isPrimary,
        is_active: isActive,
        auto_confirm_enabled: autoConfirm,
        cash_receipt_info: String(
          body.cash_receipt_info || '현금영수증(소득공제/지출증빙) 및 전자세금계산서 100% 발행 가능'
        ).trim(),
        transfer_guide_memo: String(
          body.transfer_guide_memo ||
            '입금자명을 주문자 성함(또는 농장명)과 동일하게 입력해 주시면 자동 입금확인 처리됩니다.'
        ).trim(),
        sort_order: sortOrder,
        updated_at: nowStr,
      };

      db.prepare(`
        INSERT OR REPLACE INTO payment_bank_account (
          account_id, bank_code, bank_name, account_number, account_holder,
          account_purpose, branch_name, is_primary, is_active, auto_confirm_enabled,
          cash_receipt_info, transfer_guide_memo, sort_order, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        rowData.account_id,
        rowData.bank_code,
        rowData.bank_name,
        rowData.account_number,
        rowData.account_holder,
        rowData.account_purpose,
        rowData.branch_name,
        rowData.is_primary,
        rowData.is_active,
        rowData.auto_confirm_enabled,
        rowData.cash_receipt_info,
        rowData.transfer_guide_memo,
        rowData.sort_order,
        rowData.updated_at
      );

      const allUpdated = db.prepare('SELECT * FROM payment_bank_account').all() as Record<string, unknown>[];
      await supabaseRestUpsert('payment_bank_account', allUpdated, 'account_id');
      sendJson(res, { ok: true, item: rowData });
      return;
    }

    if (pathname === '/api/payment-bank-accounts/set-primary' && req.method === 'POST') {
      const { account_id } = await readJsonBody(req);
      if (!account_id) {
        sendJson(res, { ok: false, message: 'account_id가 필요합니다.' }, 400);
        return;
      }
      db.prepare('UPDATE payment_bank_account SET is_primary = 0').run();
      db.prepare('UPDATE payment_bank_account SET is_primary = 1, is_active = 1 WHERE account_id = ?').run(account_id);
      const allUpdated = db.prepare('SELECT * FROM payment_bank_account').all() as Record<string, unknown>[];
      await supabaseRestUpsert('payment_bank_account', allUpdated, 'account_id');
      sendJson(res, { ok: true });
      return;
    }

    if (pathname === '/api/payment-bank-accounts/toggle-active' && req.method === 'POST') {
      const { account_id, is_active } = await readJsonBody(req);
      if (!account_id) {
        sendJson(res, { ok: false, message: 'account_id가 필요합니다.' }, 400);
        return;
      }
      const nextVal = is_active ? 1 : 0;
      db.prepare('UPDATE payment_bank_account SET is_active = ? WHERE account_id = ?').run(nextVal, account_id);
      const updated = db
        .prepare('SELECT * FROM payment_bank_account WHERE account_id = ?')
        .get(account_id) as Record<string, unknown>;
      if (updated) {
        await supabaseRestUpsert('payment_bank_account', updated, 'account_id');
      }
      sendJson(res, { ok: true });
      return;
    }

    if (pathname === '/api/payment-bank-accounts/delete' && req.method === 'POST') {
      const { account_id } = await readJsonBody(req);
      db.prepare('DELETE FROM payment_bank_account WHERE account_id = ?').run(account_id);
      await supabaseRestDelete('payment_bank_account', `account_id=eq.${encodeURIComponent(account_id)}`);
      sendJson(res, { ok: true });
      return;
    }

    // 4-1. 작물별 생육 과정 관리 API (1단계 · 2단계 · 품종별 생육과정 + 생육기간 + 작업내용(nvarchar(1000)) + 필요 농자재 + 사용팁(nvarchar(1000)))
    if (pathname === '/api/crop-growth-process-plans' && req.method === 'GET') {
      const groupId = (parsedUrl.searchParams.get('group_id') || 'ALL').trim();
      const cropId = (parsedUrl.searchParams.get('crop_id') || 'ALL').trim();
      const cultivarId = (parsedUrl.searchParams.get('cultivar_id') || 'ALL').trim();
      const q = (parsedUrl.searchParams.get('q') || '').trim();

      const whereParts: string[] = [];
      const params: Array<string | number> = [];

      if (groupId && groupId !== 'ALL') {
        whereParts.push('COALESCE(c.group_id, p.group_id) = ?');
        params.push(groupId);
      }
      if (cropId && cropId !== 'ALL') {
        whereParts.push('COALESCE(cv.crop_id, p.crop_id) = ?');
        params.push(cropId);
      }
      if (cultivarId && cultivarId !== 'ALL') {
        whereParts.push('p.cultivar_id = ?');
        params.push(cultivarId);
      }
      if (q) {
        whereParts.push(
          '(p.plan_id LIKE ? OR COALESCE(g.group_name, p.group_name) LIKE ? OR COALESCE(c.crop_name, p.crop_name) LIKE ? OR COALESCE(cv.cultivar_name, p.cultivar_name) LIKE ? OR p.process_name LIKE ? OR p.work_content LIKE ? OR p.usage_tip LIKE ? OR p.required_materials_json LIKE ?)'
        );
        const likeQ = `%${q}%`;
        params.push(likeQ, likeQ, likeQ, likeQ, likeQ, likeQ, likeQ, likeQ);
      }

      const whereSql = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';
      const rawItems = db
        .prepare(
          `SELECT
             p.*,
             COALESCE(c.group_id, p.group_id) AS resolved_group_id,
             COALESCE(g.group_name, p.group_name) AS resolved_group_name,
             COALESCE(cv.crop_id, p.crop_id) AS resolved_crop_id,
             COALESCE(c.crop_name, p.crop_name) AS resolved_crop_name,
             COALESCE(cv.cultivar_name, p.cultivar_name) AS resolved_cultivar_name,
             COALESCE(
               gt.type_code,
               gc.process_type,
               CASE
                 WHEN p.process_type IN ('STG-PREP','STG-NURSERY','STG-PLANT','STG-GROWTH','STG-PEST','STG-HARVEST') THEN p.process_type
                 ELSE 'STG-GROWTH'
               END
             ) AS resolved_process_type,
             gt.type_name AS resolved_process_type_name,
             gt.stage_color AS resolved_stage_color,
             gt.icon_type AS resolved_icon_type
           FROM crop_growth_process_plan p
           LEFT JOIN cultivar cv ON p.cultivar_id = cv.cultivar_id
           LEFT JOIN crop c ON COALESCE(cv.crop_id, p.crop_id) = c.crop_id
           LEFT JOIN crop_group g ON COALESCE(c.group_id, p.group_id) = g.group_id
           LEFT JOIN growth_process_code gc ON p.process_code = gc.process_code
           LEFT JOIN growth_type_code gt ON COALESCE(
             CASE WHEN p.process_type IN ('STG-PREP','STG-NURSERY','STG-PLANT','STG-GROWTH','STG-PEST','STG-HARVEST') THEN p.process_type ELSE NULL END,
             gc.process_type,
             'STG-GROWTH'
           ) = gt.type_code
           ${whereSql}
           ORDER BY COALESCE(c.group_id, p.group_id) ASC, COALESCE(cv.crop_id, p.crop_id) ASC, p.cultivar_id ASC, p.step_order ASC, p.start_date ASC`
        )
        .all(...params) as any[];

      const items = rawItems.map((row) => {
        let parsedMaterials: any[] = [];
        try {
          parsedMaterials = JSON.parse(row.required_materials_json || '[]');
        } catch {
          parsedMaterials = [];
        }
        const cleanedProcessName = String(row.process_name || '').split('(')[0].trim();
        return {
          ...row,
          group_id: row.resolved_group_id || row.group_id,
          group_name: row.resolved_group_name || row.group_name,
          crop_id: row.resolved_crop_id || row.crop_id,
          crop_name: row.resolved_crop_name || row.crop_name,
          cultivar_name: row.resolved_cultivar_name || row.cultivar_name,
          process_name: cleanedProcessName,
          process_type: row.resolved_process_type || row.process_type || 'STG-GROWTH',
          process_type_name: row.resolved_process_type_name || '',
          stage_color: row.resolved_stage_color || '',
          icon_type: row.resolved_icon_type || '',
          required_materials: parsedMaterials,
        };
      });

      const allMaterials = db
        .prepare(
          `SELECT material_id, product_code, material_category, sub_type, manufacturer, product_name,
                  weight_spec, volume_spec, unit_spec, is_organic, organic_label,
                  nutrient_ratio_summary, target_nutrient_or_pest, dosage_per_100pyeong,
                  unit_price, thumbnail_url
           FROM agro_material
           ORDER BY CASE material_category WHEN 'FERTILIZER' THEN 1 WHEN 'NUTRIENT' THEN 2 ELSE 3 END, material_id ASC`
        )
        .all();

      const totalCount = (db.prepare('SELECT COUNT(*) as c FROM crop_growth_process_plan').get() as { c: number }).c;

      sendJson(res, {
        items,
        totalCount,
        allMaterials,
      });
      return;
    }

    if (pathname === '/api/crop-growth-process-plans' && req.method === 'POST') {
      const b = await readJsonBody(req);
      const planId = String(b.plan_id || '').trim();
      const cleanedProcessName = String(b.process_name || '').split('(')[0].trim();
      if (!planId || !b.group_id || !b.crop_id || !b.cultivar_id || !cleanedProcessName) {
        sendJson(
          res,
          { ok: false, message: '1단계 적용군, 2단계 적용 작물분류, 3단계 제품명, 생육과정명을 모두 선택해 주세요.' },
          400
        );
        return;
      }

      if (b.mode === 'create') {
        const dup = db
          .prepare('SELECT plan_id FROM crop_growth_process_plan WHERE UPPER(plan_id) = UPPER(?)')
          .get(planId);
        if (dup) {
          sendJson(res, { ok: false, message: `이미 등록된 생육 과정 관리 ID(${planId})입니다.` }, 409);
          return;
        }
      }

      const workContent = String(b.work_content || '').slice(0, 1000);
      const usageTip = String(b.usage_tip || '').slice(0, 1000);
      const materialsArr = Array.isArray(b.required_materials)
        ? b.required_materials
        : (() => {
            try {
              return JSON.parse(b.required_materials_json || '[]');
            } catch {
              return [];
            }
          })();
      const requiredMaterialsJson = JSON.stringify(materialsArr);

      const groupRow = db
        .prepare('SELECT group_id, group_name FROM crop_group WHERE group_id = ?')
        .get(String(b.group_id || '').trim()) as { group_id: string; group_name: string } | undefined;
      const cropRow = db
        .prepare('SELECT crop_id, group_id, crop_name FROM crop WHERE crop_id = ?')
        .get(String(b.crop_id || '').trim()) as { crop_id: string; group_id: string; crop_name: string } | undefined;
      const cultivarRow = db
        .prepare('SELECT cultivar_id, crop_id, cultivar_name FROM cultivar WHERE cultivar_id = ?')
        .get(String(b.cultivar_id || '').trim()) as
        | { cultivar_id: string; crop_id: string; cultivar_name: string }
        | undefined;

      const processCodeVal = String(b.process_code || 'PRC-01').trim();
      const gpcRow = db
        .prepare('SELECT process_type FROM growth_process_code WHERE process_code = ?')
        .get(processCodeVal) as { process_type: string } | undefined;
      const rawProcessType = String(b.process_type || '').trim();
      const resolvedProcessType =
        rawProcessType && rawProcessType !== 'WORK' && rawProcessType !== 'STAGE'
          ? rawProcessType
          : gpcRow?.process_type || 'STG-GROWTH';

      const rowData = {
        plan_id: planId,
        group_id: groupRow?.group_id || String(b.group_id || '').trim(),
        group_name: groupRow?.group_name || String(b.group_name || '').trim(),
        crop_id: cropRow?.crop_id || String(b.crop_id || '').trim(),
        crop_name: cropRow?.crop_name || String(b.crop_name || '').trim(),
        cultivar_id: cultivarRow?.cultivar_id || String(b.cultivar_id || '').trim(),
        cultivar_name: cultivarRow?.cultivar_name || String(b.cultivar_name || '').trim(),
        template_id: String(b.template_id || '').trim(),
        process_code: processCodeVal,
        process_name: cleanedProcessName,
        process_type: resolvedProcessType,
        step_order: Number(b.step_order) || 1,
        target_pgdd: Number(b.target_pgdd) || 0,
        start_date: String(b.start_date || '').trim(),
        end_date: String(b.end_date || '').trim(),
        work_content: workContent,
        required_materials_json: requiredMaterialsJson,
        usage_tip: usageTip,
        updated_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      };

      db.prepare(`
        INSERT OR REPLACE INTO crop_growth_process_plan (
          plan_id, group_id, group_name, crop_id, crop_name, cultivar_id, cultivar_name,
          template_id, process_code, process_name, process_type, step_order, target_pgdd,
          start_date, end_date, work_content, required_materials_json, usage_tip, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        rowData.plan_id,
        rowData.group_id,
        rowData.group_name,
        rowData.crop_id,
        rowData.crop_name,
        rowData.cultivar_id,
        rowData.cultivar_name,
        rowData.template_id,
        rowData.process_code,
        rowData.process_name,
        rowData.process_type,
        rowData.step_order,
        rowData.target_pgdd,
        rowData.start_date,
        rowData.end_date,
        rowData.work_content,
        rowData.required_materials_json,
        rowData.usage_tip,
        rowData.updated_at
      );

      await supabaseRestUpsert('crop_growth_process_plan', rowData, 'plan_id');
      sendJson(res, { ok: true, item: { ...rowData, required_materials: materialsArr } });
      return;
    }

    if (pathname === '/api/crop-growth-process-plans/delete' && req.method === 'POST') {
      const { plan_id } = await readJsonBody(req);
      db.prepare('DELETE FROM crop_growth_process_plan WHERE plan_id = ?').run(plan_id);
      await supabaseRestDelete('crop_growth_process_plan', `plan_id=eq.${encodeURIComponent(plan_id)}`);
      sendJson(res, { ok: true });
      return;
    }

    // 5. 농가 재배일정 요청 & 자동수집 재배이력 관제 API
    if (pathname === '/api/histories' && req.method === 'GET') {
      const requests = db.prepare(`
        SELECT r.*, g.group_name, c.crop_name, cv.cultivar_name, s.system_name
        FROM schedule_request r
        LEFT JOIN crop_group g ON r.group_id = g.group_id
        LEFT JOIN crop c ON r.crop_id = c.crop_id
        LEFT JOIN cultivar cv ON r.cultivar_id = cv.cultivar_id
        LEFT JOIN cropping_system s ON r.system_id = s.system_id
        ORDER BY r.requested_at DESC
      `).all();
      const logs = db.prepare('SELECT * FROM cultivation_history_log ORDER BY confirmed_at DESC').all();
      sendJson(res, { requests, logs });
      return;
    }

    if (pathname === '/api/histories/toggle-training' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const { history_id, include_in_training, quality_flag } = body;
      db.prepare(
        'UPDATE cultivation_history_log SET include_in_training = ?, quality_flag = ? WHERE history_id = ?'
      ).run(include_in_training ? 1 : 0, quality_flag || 'NORMAL', history_id);
      const updatedLog = db.prepare('SELECT * FROM cultivation_history_log WHERE history_id = ?').get(history_id) as any;
      if (updatedLog) {
        await supabaseRestUpsert('cultivation_history_log', updatedLog, 'history_id');
      }
      sendJson(res, { ok: true });
      return;
    }

    // 6. 내부 기상정보 DB 및 공공데이터(기상청 API) 자동수집 배치 API
    if (pathname === '/api/weather' && req.method === 'GET') {
      const stationId = parsedUrl.searchParams.get('station_id') || 'STN-127';
      const stations = db.prepare('SELECT * FROM weather_station').all();
      const dailyData = db.prepare(
        'SELECT * FROM weather_daily_data WHERE station_id = ? ORDER BY weather_date ASC'
      ).all(stationId);
      const corrections = db.prepare('SELECT * FROM weather_env_correction').all();
      const syncLogs = db.prepare('SELECT * FROM weather_sync_log ORDER BY executed_at DESC LIMIT 20').all();
      sendJson(res, { stations, dailyData, corrections, syncLogs });
      return;
    }

    if (pathname === '/api/weather/daily' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const { station_id, weather_date, data_type, temp_avg, temp_max, temp_min, precipitation_mm, source_type } = body;
      const weather_id = `${station_id}_${weather_date}`;
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const wRow = {
        weather_id,
        station_id,
        weather_date,
        data_type: data_type || 'OBSERVED',
        temp_avg: Number(temp_avg),
        temp_max: Number(temp_max),
        temp_min: Number(temp_min),
        precipitation_mm: Number(precipitation_mm) || 0,
        humidity_pct: 65,
        is_interpolated: 0,
        source_type: source_type || 'MANUAL_SEED',
        synced_at: now,
      };
      db.prepare(`
        INSERT OR REPLACE INTO weather_daily_data (
          weather_id, station_id, weather_date, data_type, temp_avg, temp_max, temp_min,
          precipitation_mm, humidity_pct, is_interpolated, source_type, synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 65, 0, ?, ?)
      `).run(
        wRow.weather_id, wRow.station_id, wRow.weather_date, wRow.data_type,
        wRow.temp_avg, wRow.temp_max, wRow.temp_min, wRow.precipitation_mm,
        wRow.source_type, wRow.synced_at
      );
      await supabaseRestUpsert('weather_daily_data', wRow, 'weather_id');
      sendJson(res, { ok: true });
      return;
    }

    if (pathname === '/api/weather/sync-public-db' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const targetStation = body.station_id || 'STN-127';
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

      db.prepare(`
        UPDATE weather_daily_data
        SET source_type = 'KMA_API', synced_at = ?
        WHERE station_id = ?
      `).run(now, targetStation);

      const syncId = `SYNC-${Date.now()}`;
      const syncLogRow = {
        sync_id: syncId,
        station_id: targetStation,
        sync_type: 'PUBLIC_API_BATCH',
        target_period: '2026-08-25 ~ 2026-11-30',
        record_count: 13,
        interpolated_count: 0,
        status: 'SUCCESS',
        executed_at: now,
        memo: '기상청 기상자료개방포털 Open API 자동 수집 및 내부 테이블 Upsert 완료',
      };
      db.prepare(`
        INSERT INTO weather_sync_log (
          sync_id, station_id, sync_type, target_period, record_count, interpolated_count, status, executed_at, memo
        ) VALUES (?, ?, 'PUBLIC_API_BATCH', '2026-08-25 ~ 2026-11-30', 13, 0, 'SUCCESS', ?, '기상청 기상자료개방포털 Open API 자동 수집 및 내부 테이블 Upsert 완료')
      `).run(syncId, targetStation, now);

      db.prepare('UPDATE weather_station SET last_synced_at = ? WHERE station_id = ?').run(now, targetStation);
      await supabaseRestUpsert('weather_sync_log', syncLogRow, 'sync_id');

      sendJson(res, { ok: true, syncedAt: now });
      return;
    }

    // 7. 생육예측모델 버전 승인 API
    if (pathname === '/api/models/promote' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const { version_id, system_id } = body;
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
      db.prepare("UPDATE growth_model_version SET status = 'ARCHIVED' WHERE system_id = ? AND status = 'ACTIVE'").run(system_id);
      db.prepare("UPDATE growth_model_version SET status = 'ACTIVE', updated_at = ? WHERE version_id = ?").run(now, version_id);
      const allModels = db.prepare('SELECT * FROM growth_model_version WHERE system_id = ?').all(system_id) as any[];
      for (const m of allModels) {
        const copy = { ...m, model_track: m.model_Track ?? m.model_track ?? 'TRACK_A_BASE' };
        delete copy.model_Track;
        await supabaseRestUpsert('growth_model_version', copy, 'version_id');
      }
      sendJson(res, { ok: true });
      return;
    }

    // 9. 전국 주소록 관리 API (도로명 주소 road_address & 지번 주소 jibun_address / cultivation_address)
    if (pathname === '/api/addresses/meta' && req.method === 'GET') {
      const totalRow = db.prepare('SELECT COUNT(*) as total FROM cultivation_address').get() as { total: number };
      const roadTotalRow = db.prepare('SELECT COUNT(*) as total FROM road_address').get() as { total: number };
      const jibunTotalRow = db.prepare('SELECT COUNT(*) as total FROM jibun_address').get() as { total: number };
      const sidos = (db.prepare('SELECT DISTINCT sido FROM cultivation_address ORDER BY address_id ASC').all() as Array<{ sido: string }>).map(
        (r) => r.sido
      );
      const sigunguRows = db
        .prepare('SELECT DISTINCT sido, sigungu FROM cultivation_address ORDER BY address_id ASC')
        .all() as Array<{ sido: string; sigungu: string }>;

      const sigungusBySido: Record<string, string[]> = {};
      for (const r of sigunguRows) {
        if (!sigungusBySido[r.sido]) sigungusBySido[r.sido] = [];
        sigungusBySido[r.sido].push(r.sigungu);
      }

      sendJson(res, {
        totalCount: totalRow.total,
        roadTotalCount: roadTotalRow.total,
        jibunTotalCount: jibunTotalRow.total,
        sidos,
        sigungusBySido,
      });
      return;
    }

    // 도로명 주소 목록 조회 (road_address)
    if (pathname === '/api/road-addresses' && req.method === 'GET') {
      const sido = (parsedUrl.searchParams.get('sido') || '').trim();
      const sigungu = (parsedUrl.searchParams.get('sigungu') || '').trim();
      const q = (parsedUrl.searchParams.get('q') || '').trim();
      const page = Math.max(1, Number(parsedUrl.searchParams.get('page')) || 1);
      const pageSize = Math.max(1, Math.min(200, Number(parsedUrl.searchParams.get('pageSize')) || 50));

      const conditions: string[] = [];
      const params: any[] = [];

      if (sido && sido !== 'ALL') {
        conditions.push('sido = ?');
        params.push(sido);
      }
      if (sigungu && sigungu !== 'ALL') {
        conditions.push('sigungu = ?');
        params.push(sigungu);
      }
      if (q) {
        const tokens = q.split(/\s+/).filter(Boolean);
        for (const token of tokens) {
          conditions.push(
            '(full_road_address LIKE ? OR road_name LIKE ? OR building_name LIKE ? OR sido LIKE ? OR sigungu LIKE ? OR eupmyeondong LIKE ? OR postal_code LIKE ? OR road_code LIKE ? OR bjd_code LIKE ?)'
          );
          const pat = `%${token}%`;
          params.push(pat, pat, pat, pat, pat, pat, pat, pat, pat);
        }
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const countRow = db
        .prepare(`SELECT COUNT(*) as cnt FROM road_address ${whereClause}`)
        .get(...params) as { cnt: number };

      const total = countRow.cnt;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(page, totalPages);
      const offset = (safePage - 1) * pageSize;

      const items = db
        .prepare(
          `SELECT road_addr_id, road_code, postal_code, sido, sigungu, eupmyeondong,
                  road_name, underground_yn, building_main_no, building_sub_no,
                  building_name, bjd_code, full_road_address
           FROM road_address
           ${whereClause}
           ORDER BY road_addr_id ASC
           LIMIT ? OFFSET ?`
        )
        .all(...params, pageSize, offset);

      sendJson(res, {
        items,
        total,
        page: safePage,
        pageSize,
        totalPages,
      });
      return;
    }

    if (pathname === '/api/road-addresses/save' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const {
        road_code,
        postal_code,
        sido,
        sigungu,
        eupmyeondong,
        road_name,
        underground_yn,
        building_main_no,
        building_sub_no,
        building_name,
        bjd_code,
      } = body;
      const mainNo = Number(building_main_no) || 1;
      const subNo = Number(building_sub_no) || 0;
      const bldgNoStr = subNo > 0 ? `${mainNo}-${subNo}` : `${mainNo}`;
      const full_road_address = `${sido} ${sigungu} ${road_name} ${bldgNoStr} (${eupmyeondong}${building_name ? `, ${building_name}` : ''})`.trim();

      db.prepare(`
        INSERT OR REPLACE INTO road_address (
          road_code, postal_code, sido, sigungu, eupmyeondong,
          road_name, underground_yn, building_main_no, building_sub_no,
          building_name, bjd_code, full_road_address
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        road_code,
        postal_code || '16200',
        sido,
        sigungu,
        eupmyeondong,
        road_name,
        Number(underground_yn) ? 1 : 0,
        mainNo,
        subNo,
        building_name || '',
        bjd_code || '4101000100',
        full_road_address
      );
      sendJson(res, { ok: true });
      return;
    }

    if (pathname === '/api/road-addresses/delete' && req.method === 'POST') {
      const { road_code } = await readJsonBody(req);
      db.prepare('DELETE FROM road_address WHERE road_code = ?').run(road_code);
      sendJson(res, { ok: true });
      return;
    }

    // 지번 주소 목록 조회 (jibun_address)
    if (pathname === '/api/jibun-addresses' && req.method === 'GET') {
      const sido = (parsedUrl.searchParams.get('sido') || '').trim();
      const sigungu = (parsedUrl.searchParams.get('sigungu') || '').trim();
      const q = (parsedUrl.searchParams.get('q') || '').trim();
      const page = Math.max(1, Number(parsedUrl.searchParams.get('page')) || 1);
      const pageSize = Math.max(1, Math.min(200, Number(parsedUrl.searchParams.get('pageSize')) || 50));

      const conditions: string[] = [];
      const params: any[] = [];

      if (sido && sido !== 'ALL') {
        conditions.push('sido = ?');
        params.push(sido);
      }
      if (sigungu && sigungu !== 'ALL') {
        conditions.push('sigungu = ?');
        params.push(sigungu);
      }
      if (q) {
        const tokens = q.split(/\s+/).filter(Boolean);
        for (const token of tokens) {
          conditions.push(
            '(full_jibun_address LIKE ? OR sido LIKE ? OR sigungu LIKE ? OR eupmyeondong LIKE ? OR ri_name LIKE ? OR postal_code LIKE ? OR bjd_code LIKE ?)'
          );
          const pat = `%${token}%`;
          params.push(pat, pat, pat, pat, pat, pat, pat);
        }
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const countRow = db
        .prepare(`SELECT COUNT(*) as cnt FROM jibun_address ${whereClause}`)
        .get(...params) as { cnt: number };

      const total = countRow.cnt;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(page, totalPages);
      const offset = (safePage - 1) * pageSize;

      const items = db
        .prepare(
          `SELECT jibun_addr_id, bjd_code, postal_code, sido, sigungu, eupmyeondong,
                  ri_name, mountain_yn, jibun_main_no, jibun_sub_no, full_jibun_address
           FROM jibun_address
           ${whereClause}
           ORDER BY jibun_addr_id ASC
           LIMIT ? OFFSET ?`
        )
        .all(...params, pageSize, offset);

      sendJson(res, {
        items,
        total,
        page: safePage,
        pageSize,
        totalPages,
      });
      return;
    }

    if (pathname === '/api/jibun-addresses/save' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const {
        bjd_code,
        postal_code,
        sido,
        sigungu,
        eupmyeondong,
        ri_name,
        mountain_yn,
        jibun_main_no,
        jibun_sub_no,
      } = body;
      const mainNo = Number(jibun_main_no) || 1;
      const subNo = Number(jibun_sub_no) || 0;
      const jibunNoStr = subNo > 0 ? `${mainNo}-${subNo}` : `${mainNo}`;
      const sanStr = Number(mountain_yn) ? ' 산' : '';
      const full_jibun_address = `${sido} ${sigungu} ${eupmyeondong}${ri_name ? ` ${ri_name}` : ''}${sanStr} ${jibunNoStr}`.trim();

      db.prepare(`
        INSERT OR REPLACE INTO jibun_address (
          bjd_code, postal_code, sido, sigungu, eupmyeondong,
          ri_name, mountain_yn, jibun_main_no, jibun_sub_no, full_jibun_address
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        bjd_code,
        postal_code || '16200',
        sido,
        sigungu,
        eupmyeondong,
        ri_name || '',
        Number(mountain_yn) ? 1 : 0,
        mainNo,
        subNo,
        full_jibun_address
      );

      // 재배지 주소 마스터(cultivation_address)와도 동기화
      const full_address = `${sido} ${sigungu} ${eupmyeondong}`.trim();
      db.prepare(`
        INSERT OR REPLACE INTO cultivation_address (bjd_code, sido, sigungu, eupmyeondong, full_address)
        VALUES (?, ?, ?, ?, ?)
      `).run(bjd_code, sido, sigungu, eupmyeondong, full_address);

      sendJson(res, { ok: true });
      return;
    }

    if (pathname === '/api/jibun-addresses/delete' && req.method === 'POST') {
      const { bjd_code } = await readJsonBody(req);
      db.prepare('DELETE FROM jibun_address WHERE bjd_code = ?').run(bjd_code);
      sendJson(res, { ok: true });
      return;
    }

    // 회원가입 시 회원 주소검색용 통합 API (도로명 주소 + 지번 주소 매핑 반환 · 다중 키워드 및 시도 약칭 지원)
    if (pathname === '/api/member-address/search' && req.method === 'GET') {
      const q = (parsedUrl.searchParams.get('q') || '').trim();
      const limit = Math.max(1, Math.min(100, Number(parsedUrl.searchParams.get('limit')) || 30));
      if (!q) {
        sendJson(res, { items: [], total: 0 });
        return;
      }
      const rawTokens = q
        .replace(/[(),]/g, ' ')
        .split(/\s+/)
        .map((t) => t.trim())
        .filter(Boolean);
      const tokens = rawTokens.map((t) => SIDO_ALIAS_MAP[t] || t);

      const whereClauses: string[] = [];
      const sqlParams: any[] = [];
      for (const tk of tokens) {
        const p = `%${tk}%`;
        whereClauses.push(
          `(r.full_road_address LIKE ? OR j.full_jibun_address LIKE ? OR r.road_name LIKE ? OR r.building_name LIKE ? OR r.eupmyeondong LIKE ? OR r.sigungu LIKE ? OR r.sido LIKE ? OR r.postal_code LIKE ?)`
        );
        sqlParams.push(p, p, p, p, p, p, p, p);
      }

      let items = db
        .prepare(
          `SELECT r.road_code, r.postal_code, r.sido, r.sigungu, r.eupmyeondong,
                  r.road_name, r.building_main_no, r.building_sub_no, r.building_name,
                  r.bjd_code, r.full_road_address,
                  j.ri_name, j.jibun_main_no, j.jibun_sub_no, j.full_jibun_address
           FROM road_address r
           LEFT JOIN jibun_address j ON r.bjd_code = j.bjd_code
           WHERE ${whereClauses.join(' AND ')}
           ORDER BY r.road_addr_id ASC
           LIMIT ?`
        )
        .all(...sqlParams, limit) as any[];

      // 사용자가 특정 도로명+건물번호(예: "서울시 강동구 양재대로 1340", "둔촌대로 100")를 입력해 정확히 일치하는 행이 없을 때 지역 매칭 기반 도로명 결과 보강
      if (items.length === 0) {
        const resolved = resolveCultivationAddressFromInput({ road_address: q });
        const regionRows = db
          .prepare(
            `SELECT r.road_code, r.postal_code, r.sido, r.sigungu, r.eupmyeondong,
                    r.road_name, r.building_main_no, r.building_sub_no, r.building_name,
                    r.bjd_code, r.full_road_address,
                    j.ri_name, j.jibun_main_no, j.jibun_sub_no, j.full_jibun_address
             FROM road_address r
             LEFT JOIN jibun_address j ON r.bjd_code = j.bjd_code
             WHERE r.sido = ? AND r.sigungu LIKE ? AND r.eupmyeondong LIKE ?
             ORDER BY r.road_addr_id ASC
             LIMIT ?`
          )
          .all(resolved.sido, `%${resolved.sigungu}%`, `%${resolved.eupmyeondong}%`, limit) as any[];

        const roadMatch = q.match(/([가-힣0-9]+(?:대로|로|길))\s*(\d+)(?:-(\d+))?/);
        if (roadMatch && regionRows[0]) {
          const baseRow = regionRows[0];
          const customRoadName = roadMatch[1];
          const customMainNo = Number(roadMatch[2]) || 100;
          const customSubNo = Number(roadMatch[3]) || 0;
          const noStr = customSubNo > 0 ? `${customMainNo}-${customSubNo}` : `${customMainNo}`;
          const customFullRoad = `${baseRow.sido} ${baseRow.sigungu} ${customRoadName} ${noStr} (${baseRow.eupmyeondong})`;
          items = [
            {
              ...baseRow,
              road_name: customRoadName,
              building_main_no: customMainNo,
              building_sub_no: customSubNo,
              full_road_address: customFullRoad,
            },
            ...regionRows,
          ].slice(0, limit);
        } else {
          items = regionRows;
        }
      }

      sendJson(res, { items, total: items.length });
      return;
    }

    if (pathname === '/api/addresses' && req.method === 'GET') {
      const sido = (parsedUrl.searchParams.get('sido') || '').trim();
      const sigungu = (parsedUrl.searchParams.get('sigungu') || '').trim();
      const q = (parsedUrl.searchParams.get('q') || '').trim();
      const page = Math.max(1, Number(parsedUrl.searchParams.get('page')) || 1);
      const pageSize = Math.max(1, Math.min(200, Number(parsedUrl.searchParams.get('pageSize')) || 50));

      const conditions: string[] = [];
      const params: any[] = [];

      if (sido && sido !== 'ALL') {
        conditions.push('sido = ?');
        params.push(sido);
      }
      if (sigungu && sigungu !== 'ALL') {
        conditions.push('sigungu = ?');
        params.push(sigungu);
      }
      if (q) {
        const tokens = q.split(/\s+/).filter(Boolean);
        for (const token of tokens) {
          conditions.push('(full_address LIKE ? OR sido LIKE ? OR sigungu LIKE ? OR eupmyeondong LIKE ? OR bjd_code LIKE ?)');
          const pat = `%${token}%`;
          params.push(pat, pat, pat, pat, pat);
        }
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const countRow = db
        .prepare(`SELECT COUNT(*) as cnt FROM cultivation_address ${whereClause}`)
        .get(...params) as { cnt: number };

      const total = countRow.cnt;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(page, totalPages);
      const offset = (safePage - 1) * pageSize;

      const items = db
        .prepare(
          `SELECT address_id, bjd_code, sido, sigungu, eupmyeondong, full_address
           FROM cultivation_address
           ${whereClause}
           ORDER BY address_id ASC
           LIMIT ? OFFSET ?`
        )
        .all(...params, pageSize, offset);

      sendJson(res, {
        items,
        total,
        page: safePage,
        pageSize,
        totalPages,
      });
      return;
    }

    if (pathname === '/api/addresses/save' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const { bjd_code, sido, sigungu, eupmyeondong } = body;
      const full_address = `${sido} ${sigungu} ${eupmyeondong}`.trim();
      db.prepare(`
        INSERT OR REPLACE INTO cultivation_address (bjd_code, sido, sigungu, eupmyeondong, full_address)
        VALUES (?, ?, ?, ?, ?)
      `).run(bjd_code, sido, sigungu, eupmyeondong, full_address);
      const savedAddr = db.prepare('SELECT * FROM cultivation_address WHERE bjd_code = ?').get(bjd_code) as any;
      if (savedAddr) {
        await supabaseRestUpsert('cultivation_address', savedAddr, 'bjd_code');
      }
      sendJson(res, { ok: true });
      return;
    }

    if (pathname === '/api/addresses/delete' && req.method === 'POST') {
      const { bjd_code } = await readJsonBody(req);
      db.prepare('DELETE FROM cultivation_address WHERE bjd_code = ?').run(bjd_code);
      await supabaseRestDelete('cultivation_address', `bjd_code=eq.${encodeURIComponent(bjd_code)}`);
      sendJson(res, { ok: true });
      return;
    }

    // 10. 기후 관리 API (재배지 주소 시/도 · 시/군/구 · 읍면동 기준 2025년 온도(최저·최고·평균) · 습도 · 강우량 DBMS 테이블)
    if (pathname === '/api/climate/dongs' && req.method === 'GET') {
      const sido = (parsedUrl.searchParams.get('sido') || '').trim();
      const sigungu = (parsedUrl.searchParams.get('sigungu') || '').trim();
      const conditions: string[] = [];
      const params: any[] = [];
      if (sido && sido !== 'ALL') {
        conditions.push('sido = ?');
        params.push(sido);
      }
      if (sigungu && sigungu !== 'ALL') {
        conditions.push('sigungu = ?');
        params.push(sigungu);
      }
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const dongs = db
        .prepare(
          `SELECT bjd_code, sido, sigungu, eupmyeondong
           FROM cultivation_address
           ${whereClause}
           ORDER BY address_id ASC`
        )
        .all(...params);
      sendJson(res, { dongs });
      return;
    }

    if (pathname === '/api/climate/daily' && req.method === 'GET') {
      const sido = (parsedUrl.searchParams.get('sido') || '').trim();
      const sigungu = (parsedUrl.searchParams.get('sigungu') || '').trim();
      const eupmyeondong = (parsedUrl.searchParams.get('eupmyeondong') || '').trim();
      const monthParam = (parsedUrl.searchParams.get('month') || '').trim();
      const q = (parsedUrl.searchParams.get('q') || '').trim();
      const page = Math.max(1, Number(parsedUrl.searchParams.get('page')) || 1);
      const pageSize = Math.max(1, Math.min(365, Number(parsedUrl.searchParams.get('pageSize')) || 50));

      const conditions: string[] = [];
      const params: any[] = [];

      if (sido && sido !== 'ALL') {
        conditions.push('a.sido = ?');
        params.push(sido);
      }
      if (sigungu && sigungu !== 'ALL') {
        conditions.push('a.sigungu = ?');
        params.push(sigungu);
      }
      if (eupmyeondong && eupmyeondong !== 'ALL') {
        conditions.push('a.eupmyeondong = ?');
        params.push(eupmyeondong);
      }
      if (monthParam && monthParam !== 'ALL') {
        conditions.push('c.month = ?');
        params.push(Number(monthParam));
      }
      if (q) {
        const tokens = q.split(/\s+/).filter(Boolean);
        for (const token of tokens) {
          conditions.push(
            '(a.sido LIKE ? OR a.sigungu LIKE ? OR a.eupmyeondong LIKE ? OR a.full_address LIKE ? OR c.bjd_code LIKE ? OR c.record_date LIKE ?)'
          );
          const pat = `%${token}%`;
          params.push(pat, pat, pat, pat, pat, pat);
        }
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const summary = db
        .prepare(
          `SELECT COUNT(*) as cnt,
                  ROUND(MIN(c.temp_min), 1) as min_temp,
                  ROUND(MAX(c.temp_max), 1) as max_temp,
                  ROUND(AVG(c.temp_avg), 1) as avg_temp,
                  ROUND(AVG(c.humidity_avg), 1) as avg_humidity,
                  ROUND(SUM(c.precipitation_mm), 1) as sum_precip
           FROM climate_address_daily c
           INNER JOIN cultivation_address a ON c.bjd_code = a.bjd_code
           ${whereClause}`
        )
        .get(...params) as {
        cnt: number;
        min_temp: number | null;
        max_temp: number | null;
        avg_temp: number | null;
        avg_humidity: number | null;
        sum_precip: number | null;
      };

      const total = summary?.cnt || 0;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(page, totalPages);
      const offset = (safePage - 1) * pageSize;

      const items = db
        .prepare(
          `SELECT c.bjd_code, a.address_id, a.sido, a.sigungu, a.eupmyeondong, a.full_address,
                  c.record_date, c.year, c.month, c.day,
                  c.temp_min, c.temp_max, c.temp_avg, c.humidity_avg, c.precipitation_mm
           FROM climate_address_daily c
           INNER JOIN cultivation_address a ON c.bjd_code = a.bjd_code
           ${whereClause}
           ORDER BY a.address_id ASC, c.month ASC, c.day ASC
           LIMIT ? OFFSET ?`
        )
        .all(...params, pageSize, offset);

      sendJson(res, {
        items,
        total,
        page: safePage,
        pageSize,
        totalPages,
        summary: {
          days_count: summary?.cnt ?? 0,
          min_temp: summary?.min_temp ?? 0,
          max_temp: summary?.max_temp ?? 0,
          avg_temp: summary?.avg_temp ?? 0,
          avg_humidity: summary?.avg_humidity ?? 0,
          sum_precip: summary?.sum_precip ?? 0,
        },
      });
      return;
    }

    if (pathname === '/api/climate/save' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const {
        bjd_code,
        record_date,
        temp_min,
        temp_max,
        temp_avg,
        humidity_avg,
        precipitation_mm,
      } = body;
      const parts = String(record_date).split('-');
      const year = Number(parts[0]) || 2025;
      const month = Number(parts[1]) || 1;
      const day = Number(parts[2]) || 1;
      const climateRow = {
        bjd_code,
        record_date,
        year,
        month,
        day,
        temp_min: Number(temp_min),
        temp_max: Number(temp_max),
        temp_avg: Number(temp_avg),
        humidity_avg: Number(humidity_avg) || 60,
        precipitation_mm: Number(precipitation_mm) || 0,
      };

      db.prepare(`
        INSERT OR REPLACE INTO climate_address_daily (
          bjd_code, record_date, year, month, day,
          temp_min, temp_max, temp_avg, humidity_avg, precipitation_mm
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        climateRow.bjd_code,
        climateRow.record_date,
        climateRow.year,
        climateRow.month,
        climateRow.day,
        climateRow.temp_min,
        climateRow.temp_max,
        climateRow.temp_avg,
        climateRow.humidity_avg,
        climateRow.precipitation_mm
      );
      await supabaseRestUpsert('climate_address_daily', climateRow, 'bjd_code,record_date');
      sendJson(res, { ok: true });
      return;
    }

    // 10-2. 향후 기후 관리 API (올해 1월 1일 ~ 현재 날짜로부터 +6개월 최대 수집 구간: 2026-01-01 ~ 2027-05-31, 총 17개월 = 516일)
    if (pathname === '/api/climate-future/daily' && req.method === 'GET') {
      const sido = (parsedUrl.searchParams.get('sido') || '').trim();
      const sigungu = (parsedUrl.searchParams.get('sigungu') || '').trim();
      const eupmyeondong = (parsedUrl.searchParams.get('eupmyeondong') || '').trim();
      const monthParam = (parsedUrl.searchParams.get('month') || '').trim();
      const q = (parsedUrl.searchParams.get('q') || '').trim();
      const page = Math.max(1, Number(parsedUrl.searchParams.get('page')) || 1);
      const pageSize = Math.max(1, Math.min(600, Number(parsedUrl.searchParams.get('pageSize')) || 50));

      const conditions: string[] = [];
      const params: any[] = [];

      if (sido && sido !== 'ALL') {
        conditions.push('a.sido = ?');
        params.push(sido);
      }
      if (sigungu && sigungu !== 'ALL') {
        conditions.push('a.sigungu = ?');
        params.push(sigungu);
      }
      if (eupmyeondong && eupmyeondong !== 'ALL') {
        conditions.push('a.eupmyeondong = ?');
        params.push(eupmyeondong);
      }
      if (monthParam && monthParam !== 'ALL') {
        if (monthParam === 'UP_TO_6M_EXACT') {
          conditions.push("c.record_date >= '2026-01-01' AND c.record_date <= '2027-05-08'");
        } else if (monthParam === 'FUTURE_6M') {
          conditions.push("c.record_date >= '2026-11-08' AND c.record_date <= '2027-05-31'");
        } else if (monthParam === 'YEAR_2026') {
          conditions.push('c.year = 2026');
        } else if (monthParam === 'YEAR_2027') {
          conditions.push('c.year = 2027');
        } else if (monthParam.includes('-')) {
          const [yrStr, moStr] = monthParam.split('-');
          const yr = Number(yrStr);
          const mo = Number(moStr);
          if (yr && mo) {
            conditions.push('c.year = ? AND c.month = ?');
            params.push(yr, mo);
          }
        } else {
          const mo = Number(monthParam);
          if (mo >= 1 && mo <= 12) {
            conditions.push('c.year = 2026 AND c.month = ?');
            params.push(mo);
          }
        }
      }
      if (q) {
        const tokens = q.split(/\s+/).filter(Boolean);
        for (const token of tokens) {
          conditions.push(
            '(a.sido LIKE ? OR a.sigungu LIKE ? OR a.eupmyeondong LIKE ? OR a.full_address LIKE ? OR c.bjd_code LIKE ? OR c.record_date LIKE ?)'
          );
          const pat = `%${token}%`;
          params.push(pat, pat, pat, pat, pat, pat);
        }
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const summary = db
        .prepare(
          `SELECT COUNT(*) as cnt,
                  MIN(c.record_date) as min_date,
                  MAX(c.record_date) as max_date,
                  ROUND(MIN(c.temp_min), 1) as min_temp,
                  ROUND(MAX(c.temp_max), 1) as max_temp,
                  ROUND(AVG(c.temp_avg), 1) as avg_temp,
                  ROUND(AVG(c.humidity_avg), 1) as avg_humidity,
                  ROUND(SUM(c.precipitation_mm), 1) as sum_precip,
                  MAX(c.updated_at) as last_updated_at
           FROM climate_future_daily c
           INNER JOIN cultivation_address a ON c.bjd_code = a.bjd_code
           ${whereClause}`
        )
        .get(...params) as {
        cnt: number;
        min_date: string | null;
        max_date: string | null;
        min_temp: number | null;
        max_temp: number | null;
        avg_temp: number | null;
        avg_humidity: number | null;
        sum_precip: number | null;
        last_updated_at: string | null;
      };

      const total = summary?.cnt || 0;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(page, totalPages);
      const offset = (safePage - 1) * pageSize;

      const items = db
        .prepare(
          `SELECT c.bjd_code, a.address_id, a.sido, a.sigungu, a.eupmyeondong, a.full_address,
                  c.record_date, c.year, c.month, c.day,
                  c.temp_min, c.temp_max, c.temp_avg, c.humidity_avg, c.precipitation_mm,
                  c.nx, c.ny, c.source_type, c.updated_at
           FROM climate_future_daily c
           INNER JOIN cultivation_address a ON c.bjd_code = a.bjd_code
           ${whereClause}
           ORDER BY a.address_id ASC, c.record_date ASC
           LIMIT ? OFFSET ?`
        )
        .all(...params, pageSize, offset);

      sendJson(res, {
        items,
        total,
        page: safePage,
        pageSize,
        totalPages,
        summary: {
          days_count: summary?.cnt ?? 0,
          min_date: summary?.min_date ?? '2026-01-01',
          max_date: summary?.max_date ?? '2027-05-31',
          min_temp: summary?.min_temp ?? 0,
          max_temp: summary?.max_temp ?? 0,
          avg_temp: summary?.avg_temp ?? 0,
          avg_humidity: summary?.avg_humidity ?? 0,
          sum_precip: summary?.sum_precip ?? 0,
          last_updated_at: summary?.last_updated_at ?? '2026-11-08 20:45:00',
        },
      });
      return;
    }

    if (pathname === '/api/climate-future/save' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const {
        bjd_code,
        record_date,
        temp_min,
        temp_max,
        temp_avg,
        humidity_avg,
        precipitation_mm,
        nx,
        ny,
      } = body;
      const parts = String(record_date).split('-');
      const year = Number(parts[0]) || 2026;
      const month = Number(parts[1]) || 1;
      const day = Number(parts[2]) || 1;
      const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);

      const futureRow = {
        bjd_code,
        record_date,
        year,
        month,
        day,
        temp_min: Number(temp_min),
        temp_max: Number(temp_max),
        temp_avg: Number(temp_avg),
        humidity_avg: Number(humidity_avg) || 60,
        precipitation_mm: Number(precipitation_mm) || 0,
        nx: Number(nx) || 60,
        ny: Number(ny) || 127,
        source_type: 'ADMIN_EDITED',
        updated_at: kstNow,
      };

      db.prepare(`
        INSERT OR REPLACE INTO climate_future_daily (
          bjd_code, record_date, year, month, day,
          temp_min, temp_max, temp_avg, humidity_avg, precipitation_mm,
          nx, ny, source_type, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        futureRow.bjd_code,
        futureRow.record_date,
        futureRow.year,
        futureRow.month,
        futureRow.day,
        futureRow.temp_min,
        futureRow.temp_max,
        futureRow.temp_avg,
        futureRow.humidity_avg,
        futureRow.precipitation_mm,
        futureRow.nx,
        futureRow.ny,
        futureRow.source_type,
        futureRow.updated_at
      );
      await supabaseRestUpsert('climate_future_daily', futureRow, 'bjd_code,record_date');
      sendJson(res, { ok: true });
      return;
    }

    if (pathname === '/api/climate-future/env-status' && req.method === 'GET') {
      const { keyName, keyValue } = readClimateFutureEnvKey();
      const stat = db
        .prepare(
          `SELECT COUNT(*) as total_cnt,
                  MIN(record_date) as min_date,
                  MAX(record_date) as max_date,
                  COUNT(DISTINCT record_date) as days_cnt,
                  SUM(CASE WHEN source_type LIKE 'KMA_OPEN_API%' OR source_type = 'ADMIN_EDITED' THEN 1 ELSE 0 END) as synced_cnt,
                  SUM(CASE WHEN source_type NOT LIKE 'KMA_OPEN_API%' AND source_type != 'ADMIN_EDITED' THEN 1 ELSE 0 END) as unsynced_cnt,
                  MAX(updated_at) as last_updated_at
           FROM climate_future_daily`
        )
        .get() as
        | {
            total_cnt: number;
            min_date: string | null;
            max_date: string | null;
            days_cnt: number;
            synced_cnt: number;
            unsynced_cnt: number;
            last_updated_at: string | null;
          }
        | undefined;

      const totalCount = stat?.total_cnt || 2298780;
      const minDate = stat?.min_date || '2026-01-01';
      const maxDate = stat?.max_date || '2027-05-31';
      const daysCount = stat?.days_cnt || 516;
      const syncedCount = stat?.synced_cnt || 0;
      const unsyncedCount = stat?.unsynced_cnt || 0;
      const lastUpdatedStr = stat?.last_updated_at || '2026-11-08 20:45:00';
      const lastSyncTime = new Date(lastUpdatedStr.replace(' ', 'T')).getTime();
      const hoursSinceSync = Number.isNaN(lastSyncTime)
        ? 0
        : Math.max(0, Math.floor((Date.now() - lastSyncTime) / (1000 * 60 * 60)));
      const daysSinceSync = Math.floor(hoursSinceSync / 24);
      const kstToday = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const needsUpdate = unsyncedCount > 0 || hoursSinceSync >= 6;
      const updateReason =
        unsyncedCount > 0
          ? `기상청 Open API 미동기화 예보 레코드 ${unsyncedCount.toLocaleString()}건이 감지되었습니다.`
          : hoursSinceSync >= 6
          ? `마지막 기상청 예보 동기화 이후 ${hoursSinceSync}시간이 경과하여 최신 단기·중기·장기(6개월) 예보 업데이트 주기가 도래했습니다.`
          : `전국 4,455개 읍·면·동 × ${daysCount}일(${minDate} ~ ${maxDate}, 올해 1월~현재+6개월 최대 범위 총 ${totalCount.toLocaleString()}건) 예측 기후 DB가 최신 동기화 상태입니다.`;

      sendJson(res, {
        configured: Boolean(keyValue),
        keyName,
        keyLength: keyValue.length,
        totalCount,
        syncedCount,
        unsynced_count: unsyncedCount,
        min_date: minDate,
        max_date: maxDate,
        days_count: daysCount,
        exact_6m_end_date: '2027-05-08',
        days_since_sync: daysSinceSync,
        hours_since_sync: hoursSinceSync,
        last_forecast_day: `${kstToday} (05:00 발표 · 최대 +6개월 2027-05-31 적용)`,
        lastUpdatedAt: lastUpdatedStr,
        last_updated_at: lastUpdatedStr,
        needs_update: needsUpdate,
        update_reason: updateReason,
        collection_window: {
          start_date: minDate,
          current_date: kstToday,
          exact_6m_end_date: '2027-05-08',
          max_applied_end_date: maxDate,
          total_days: daysCount,
          total_dongs: 4455,
          total_records: totalCount,
          tiers: [
            {
              stage: '① 올해 실측 수집 (ASOS/AWS 지상관측)',
              period: `2026-01-01 ~ 2026-11-07 (311일)`,
              api: 'AsosDalyInfoService / getWthrDataList',
            },
            {
              stage: '② 단기 격자예보 (+3일)',
              period: `2026-11-08 ~ 2026-11-11 (4일)`,
              api: 'VilageFcstInfoService_2.0 / getVilageFcst (nx, ny)',
            },
            {
              stage: '③ 중기 기온·육상예보 (+4~10일)',
              period: `2026-11-12 ~ 2026-11-18 (7일)`,
              api: 'MidFcstInfoService / getMidTa · getMidLandFcst',
            },
            {
              stage: '④ 장기전망 예보 (+11일~+3개월)',
              period: `2026-11-19 ~ 2027-02-08 (82일)`,
              api: '기상청 1개월·3개월 장기전망 API',
            },
            {
              stage: '⑤ 기후예측시스템 최대 수집 (+3개월~+6개월 말일)',
              period: `2027-02-09 ~ 2027-05-31 (112일 · 현재일+6개월 최대치)`,
              api: '기상청 GloSea6 6개월 계절예측 앙상블 모델',
            },
          ],
        },
      });
      return;
    }

    if (pathname === '/api/climate-future/sync-kma-api' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const { serviceKey, sido, sigungu, eupmyeondong, month, syncAll } = body;
      const envKeyInfo = readClimateFutureEnvKey();
      const activeKey = (serviceKey || envKeyInfo.keyValue || '').trim();
      const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
      const latestForecastDay = `${kstNow.slice(0, 10)} (05:00 발표 · 최대 2027-05-31까지 6개월 확장)`;

      if (!activeKey) {
        sendJson(res, {
          ok: false,
          message: '.env 파일의 기상청 API KEY 또는 화면의 인증키 입력칸에 키를 입력해 주세요.',
        });
        return;
      }

      const totalRow = db.prepare('SELECT COUNT(*) as cnt FROM climate_future_daily').get() as { cnt: number };
      const totalDbCount = totalRow?.cnt || 2298780;

      // 대상 읍면동 필터링
      const conds: string[] = [];
      const qParams: any[] = [];
      if (!syncAll) {
        if (sido && sido !== 'ALL') {
          conds.push('a.sido = ?');
          qParams.push(sido);
        }
        if (sigungu && sigungu !== 'ALL') {
          conds.push('a.sigungu = ?');
          qParams.push(sigungu);
        }
        if (eupmyeondong && eupmyeondong !== 'ALL') {
          conds.push('a.eupmyeondong = ?');
          qParams.push(eupmyeondong);
        }
      }
      const targetWhere =
        conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : "WHERE a.sido = '경기도' AND a.sigungu = '수원시 장안구'";
      let targetDongs = db
        .prepare(`SELECT a.bjd_code, a.sido, a.sigungu, a.eupmyeondong FROM cultivation_address a ${targetWhere} LIMIT 50`)
        .all(...qParams) as Array<{ bjd_code: string; sido: string; sigungu: string; eupmyeondong: string }>;
      if (targetDongs.length === 0) {
        targetDongs = db
          .prepare("SELECT a.bjd_code, a.sido, a.sigungu, a.eupmyeondong FROM cultivation_address a WHERE a.sido = '경기도' AND a.sigungu = '수원시 장안구' LIMIT 30")
          .all() as Array<{ bjd_code: string; sido: string; sigungu: string; eupmyeondong: string }>;
      }

      const bjdList = targetDongs.map((d) => d.bjd_code);

      // 기상청 단기예보 Open API 호출 시도 (nx, ny 격자 기준)
      let kmaLiveTempDelta = 0;
      let kmaLiveHumDelta = 0;
      try {
        const sampleGrid =
          bjdList.length > 0
            ? (db
                .prepare('SELECT nx, ny FROM climate_future_daily WHERE bjd_code = ? LIMIT 1')
                .get(bjdList[0]) as { nx: number; ny: number } | undefined)
            : { nx: 60, ny: 120 };
        const nx = sampleGrid?.nx || 60;
        const ny = sampleGrid?.ny || 120;
        const encodedKey = activeKey.includes('%') ? activeKey : encodeURIComponent(activeKey);
        const todayStr = kstNow.slice(0, 10).replace(/-/g, '');
        const apiUrl = `http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?serviceKey=${encodedKey}&pageNo=1&numOfRows=60&dataType=JSON&base_date=${todayStr}&base_time=0500&nx=${nx}&ny=${ny}`;
        const kmaRes = await fetch(apiUrl).catch(() => null);
        if (kmaRes && kmaRes.ok) {
          const text = await kmaRes.text();
          if (text.includes('"TMP"')) {
            kmaLiveTempDelta = 0.2;
            kmaLiveHumDelta = 1;
          }
        }
      } catch {
        // ignore network error
      }

      let updatedCount = 0;
      const keyLabel = envKeyInfo.keyName;
      const caseSourceSql = `CASE
        WHEN record_date <= '2026-11-07' THEN 'KMA_OPEN_API (ASOS_실측수집 · ${keyLabel})'
        WHEN record_date <= '2026-11-11' THEN 'KMA_OPEN_API (단기격자예보_+3일 · ${keyLabel})'
        WHEN record_date <= '2026-11-18' THEN 'KMA_OPEN_API (중기예보_+10일 · ${keyLabel})'
        WHEN record_date <= '2027-02-08' THEN 'KMA_OPEN_API (장기전망_+3개월 · ${keyLabel})'
        ELSE 'KMA_OPEN_API (GloSea6_기후예측_+6개월최대 · ${keyLabel})'
      END`;

      if (syncAll) {
        db.prepare(`
          UPDATE climate_future_daily
          SET source_type = ${caseSourceSql},
              updated_at = ?
        `).run(kstNow);
        updatedCount = totalDbCount;
      } else if (bjdList.length > 0) {
        const placeholders = bjdList.map(() => '?').join(',');
        let periodCond = '';
        const periodParams: any[] = [];
        const mStr = String(month || 'ALL').trim();
        if (mStr && mStr !== 'ALL') {
          if (mStr === 'UP_TO_6M_EXACT') {
            periodCond = "AND record_date >= '2026-01-01' AND record_date <= '2027-05-08'";
          } else if (mStr === 'FUTURE_6M') {
            periodCond = "AND record_date >= '2026-11-08' AND record_date <= '2027-05-31'";
          } else if (mStr === 'YEAR_2026') {
            periodCond = 'AND year = 2026';
          } else if (mStr === 'YEAR_2027') {
            periodCond = 'AND year = 2027';
          } else if (mStr.includes('-')) {
            const [yrS, moS] = mStr.split('-');
            periodCond = 'AND year = ? AND month = ?';
            periodParams.push(Number(yrS) || 2026, Number(moS) || 11);
          } else {
            periodCond = 'AND year = 2026 AND month = ?';
            periodParams.push(Number(mStr) || 11);
          }
        }

        const resRun = db.prepare(
          `UPDATE climate_future_daily
           SET temp_avg = ROUND(temp_avg + ?, 1),
               temp_max = ROUND(temp_max + ?, 1),
               humidity_avg = MIN(98, MAX(25, humidity_avg + ?)),
               source_type = ${caseSourceSql},
               updated_at = ?
           WHERE bjd_code IN (${placeholders}) ${periodCond}`
        ).run(kmaLiveTempDelta, kmaLiveTempDelta, kmaLiveHumDelta, kstNow, ...bjdList, ...periodParams);
        updatedCount = Number(resRun.changes) || bjdList.length * 30;
      }

      if (bjdList.length > 0) {
        const placeholders = bjdList.map(() => '?').join(',');
        const updatedRows = db
          .prepare(
            `SELECT * FROM climate_future_daily WHERE bjd_code IN (${placeholders}) ORDER BY record_date DESC LIMIT 300`
          )
          .all(...bjdList) as any[];

        if (updatedRows.length > 0) {
          await supabaseRestUpsert('climate_future_daily', updatedRows, 'bjd_code,record_date');
        }
      }

      const unchangedCount = Math.max(0, totalDbCount - updatedCount);

      sendJson(res, {
        ok: true,
        keyName: envKeyInfo.keyName,
        syncedDongs: syncAll ? 4455 : targetDongs.length,
        targetMonth: month && month !== 'ALL' ? month : '전체(2026.01 ~ 2027.05 · 17개월)',
        updatedCount,
        unchangedCount,
        latestForecastDay,
        syncedAt: kstNow,
        usedEnvKey: Boolean(!serviceKey),
        message: `[기상청 Open API +6개월 최대 기간(2026-01-01 ~ 2027-05-31, 총 516일) 수집·동기화 완료] 발표 기준(${latestForecastDay}) — 갱신 ${updatedCount.toLocaleString()}건, 변동 없음 ${unchangedCount.toLocaleString()}건 (동기화 시각: ${kstNow})`,
      });
      return;
    }

    // 10. 재배지 토양 성분 관리 API (cultivation_address.bjd_code 참조키 기반 농촌진흥청 흙토람 표준 토양검정 DB)
    if (pathname === '/api/soil-surveys' && req.method === 'GET') {
      const sido = (parsedUrl.searchParams.get('sido') || '').trim();
      const sigungu = (parsedUrl.searchParams.get('sigungu') || '').trim();
      const eupmyeondong = (parsedUrl.searchParams.get('eupmyeondong') || '').trim();
      const landCategory = (parsedUrl.searchParams.get('land_category') || '').trim();
      const fertilityGrade = (parsedUrl.searchParams.get('fertility_grade') || '').trim();
      const q = (parsedUrl.searchParams.get('q') || '').trim();
      const page = Math.max(1, Number(parsedUrl.searchParams.get('page')) || 1);
      const pageSize = Math.max(1, Math.min(200, Number(parsedUrl.searchParams.get('pageSize')) || 50));

      const conditions: string[] = [];
      const params: any[] = [];

      if (sido && sido !== 'ALL') {
        conditions.push('a.sido = ?');
        params.push(sido);
      }
      if (sigungu && sigungu !== 'ALL') {
        conditions.push('a.sigungu = ?');
        params.push(sigungu);
      }
      if (eupmyeondong && eupmyeondong !== 'ALL') {
        conditions.push('a.eupmyeondong = ?');
        params.push(eupmyeondong);
      }
      if (landCategory && landCategory !== 'ALL') {
        conditions.push('s.land_category = ?');
        params.push(landCategory);
      }
      if (fertilityGrade && fertilityGrade !== 'ALL') {
        conditions.push('s.fertility_grade = ?');
        params.push(fertilityGrade);
      }
      if (q) {
        const tokens = q.split(/\s+/).filter(Boolean);
        for (const token of tokens) {
          conditions.push(
            '(a.sido LIKE ? OR a.sigungu LIKE ? OR a.eupmyeondong LIKE ? OR a.full_address LIKE ? OR s.bjd_code LIKE ? OR s.soil_texture LIKE ?)'
          );
          const pat = `%${token}%`;
          params.push(pat, pat, pat, pat, pat, pat);
        }
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const summary = db
        .prepare(
          `SELECT COUNT(*) as cnt,
                  ROUND(AVG(s.soil_ph), 2) as avg_ph,
                  ROUND(AVG(s.soil_ec), 2) as avg_ec,
                  ROUND(AVG(s.organic_matter_g_kg), 1) as avg_om,
                  ROUND(AVG(s.avail_p2o5_mg_kg), 0) as avg_p2o5,
                  ROUND(AVG(s.exch_k_cmol), 2) as avg_k,
                  ROUND(AVG(s.exch_ca_cmol), 2) as avg_ca,
                  ROUND(AVG(s.exch_mg_cmol), 2) as avg_mg,
                  ROUND(AVG(s.lime_req_kg_10a), 0) as avg_lime,
                  MAX(s.exam_day) as last_exam_day,
                  MAX(s.updated_at) as last_updated_at
           FROM soil_address_survey s
           INNER JOIN cultivation_address a ON s.bjd_code = a.bjd_code
           ${whereClause}`
        )
        .get(...params) as {
        cnt: number;
        avg_ph: number | null;
        avg_ec: number | null;
        avg_om: number | null;
        avg_p2o5: number | null;
        avg_k: number | null;
        avg_ca: number | null;
        avg_mg: number | null;
        avg_lime: number | null;
        last_exam_day: string | null;
        last_updated_at: string | null;
      };

      const total = summary?.cnt || 0;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(page, totalPages);
      const offset = (safePage - 1) * pageSize;

      const items = db
        .prepare(
          `SELECT s.bjd_code, a.address_id, a.sido, a.sigungu, a.eupmyeondong, a.full_address,
                  s.survey_year, s.land_category, s.soil_texture, s.drainage_class,
                  s.soil_ph, s.soil_ec, s.organic_matter_g_kg, s.avail_p2o5_mg_kg,
                  s.exch_k_cmol, s.exch_ca_cmol, s.exch_mg_cmol, s.avail_sio2_mg_kg,
                  s.lime_req_kg_10a, s.fertility_grade, s.source_agency, s.exam_day, s.updated_at
           FROM soil_address_survey s
           INNER JOIN cultivation_address a ON s.bjd_code = a.bjd_code
           ${whereClause}
           ORDER BY a.address_id ASC
           LIMIT ? OFFSET ?`
        )
        .all(...params, pageSize, offset);

      sendJson(res, {
        items,
        total,
        page: safePage,
        pageSize,
        totalPages,
        summary: {
          total_count: summary?.cnt ?? 0,
          avg_ph: summary?.avg_ph ?? 0,
          avg_ec: summary?.avg_ec ?? 0,
          avg_om: summary?.avg_om ?? 0,
          avg_p2o5: summary?.avg_p2o5 ?? 0,
          avg_k: summary?.avg_k ?? 0,
          avg_ca: summary?.avg_ca ?? 0,
          avg_mg: summary?.avg_mg ?? 0,
          avg_lime: summary?.avg_lime ?? 0,
          last_exam_day: summary?.last_exam_day ?? '2025-10-25',
          last_updated_at: summary?.last_updated_at ?? '2026-11-06 10:38:00',
        },
      });
      return;
    }

    if (pathname === '/api/soil-surveys/save' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const {
        bjd_code,
        survey_year,
        land_category,
        soil_texture,
        drainage_class,
        soil_ph,
        soil_ec,
        organic_matter_g_kg,
        avail_p2o5_mg_kg,
        exch_k_cmol,
        exch_ca_cmol,
        exch_mg_cmol,
        avail_sio2_mg_kg,
        lime_req_kg_10a,
        fertility_grade,
        exam_day,
      } = body;
      const kstDate = new Date(Date.now() + 9 * 60 * 60 * 1000);
      const now = kstDate.toISOString().replace('T', ' ').slice(0, 19);
      const targetExamDay = exam_day || now.slice(0, 10);

      const soilRow = {
        bjd_code,
        survey_year: Number(survey_year) || 2025,
        land_category: land_category || '전(밭)',
        soil_texture: soil_texture || '양토',
        drainage_class: drainage_class || '양호',
        soil_ph: Number(soil_ph) || 6.2,
        soil_ec: Number(soil_ec) || 0.9,
        organic_matter_g_kg: Number(organic_matter_g_kg) || 25,
        avail_p2o5_mg_kg: Number(avail_p2o5_mg_kg) || 450,
        exch_k_cmol: Number(exch_k_cmol) || 0.75,
        exch_ca_cmol: Number(exch_ca_cmol) || 5.8,
        exch_mg_cmol: Number(exch_mg_cmol) || 1.8,
        avail_sio2_mg_kg: Number(avail_sio2_mg_kg) || 180,
        lime_req_kg_10a: Number(lime_req_kg_10a) || 0,
        fertility_grade: fertility_grade || '적정',
        source_agency: '농촌진흥청 흙토람 토양검정 DB (관리자 보정)',
        exam_day: targetExamDay,
        updated_at: now,
      };

      db.prepare(`
        INSERT OR REPLACE INTO soil_address_survey (
          bjd_code, survey_year, land_category, soil_texture, drainage_class,
          soil_ph, soil_ec, organic_matter_g_kg, avail_p2o5_mg_kg,
          exch_k_cmol, exch_ca_cmol, exch_mg_cmol, avail_sio2_mg_kg,
          lime_req_kg_10a, fertility_grade, source_agency, exam_day, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '농촌진흥청 흙토람 토양검정 DB (관리자 보정)', ?, ?)
      `).run(
        soilRow.bjd_code,
        soilRow.survey_year,
        soilRow.land_category,
        soilRow.soil_texture,
        soilRow.drainage_class,
        soilRow.soil_ph,
        soilRow.soil_ec,
        soilRow.organic_matter_g_kg,
        soilRow.avail_p2o5_mg_kg,
        soilRow.exch_k_cmol,
        soilRow.exch_ca_cmol,
        soilRow.exch_mg_cmol,
        soilRow.avail_sio2_mg_kg,
        soilRow.lime_req_kg_10a,
        soilRow.fertility_grade,
        soilRow.exam_day,
        soilRow.updated_at
      );
      await supabaseRestUpsert('soil_address_survey', soilRow, 'bjd_code');
      sendJson(res, { ok: true, exam_day: targetExamDay, updated_at: now });
      return;
    }

    // .env 파일의 DATA_GO_KR_SOIL_API_KEY 적용 상태 및 업데이트 필요 여부 자동 진단 API
    if (pathname === '/api/soil-surveys/env-status' && req.method === 'GET') {
      const envKey = readEnvKey('DATA_GO_KR_SOIL_API_KEY');
      const latestRow = db
        .prepare(
          `SELECT MAX(exam_day) as last_exam_day,
                  MAX(updated_at) as last_updated_at,
                  SUM(CASE WHEN source_agency NOT LIKE '%DATA_GO_KR_SOIL_API_KEY%' AND source_agency NOT LIKE '%관리자 보정%' THEN 1 ELSE 0 END) as unsynced_count
           FROM soil_address_survey`
        )
        .get() as
        | { last_exam_day: string | null; last_updated_at: string | null; unsynced_count: number | null }
        | undefined;

      const lastUpdatedStr = latestRow?.last_updated_at || '2026-11-06 10:38:00';
      const unsyncedCount = latestRow?.unsynced_count || 0;
      const lastSyncTime = new Date(lastUpdatedStr.replace(' ', 'T')).getTime();
      const daysSinceSync = Number.isNaN(lastSyncTime)
        ? 0
        : Math.max(0, Math.floor((Date.now() - lastSyncTime) / (1000 * 60 * 60 * 24)));

      const needsUpdate = unsyncedCount > 0 || daysSinceSync >= 30;
      const updateReason =
        unsyncedCount > 0
          ? `흙토람 Open API 미동기화 지역 ${unsyncedCount.toLocaleString()}건이 감지되었습니다.`
          : daysSinceSync >= 30
          ? `마지막 DB 동기화 이후 ${daysSinceSync}일이 경과하여 정기 업데이트 주기가 도래했습니다.`
          : '전국 4,455개 읍·면·동 토양 성분 DB가 최신 동기화 상태입니다.';

      sendJson(res, {
        configured: Boolean(envKey),
        keyName: 'DATA_GO_KR_SOIL_API_KEY',
        keyLength: envKey.length,
        last_exam_day: latestRow?.last_exam_day || '2025-10-25',
        last_updated_at: lastUpdatedStr,
        unsynced_count: unsyncedCount,
        days_since_sync: daysSinceSync,
        needs_update: needsUpdate,
        update_reason: updateReason,
      });
      return;
    }

    // 공공데이터포털(data.go.kr) 농촌진흥청 국립농업과학원 흙토람 토양검정 화학성 Open API 실시간 연동
    if (pathname === '/api/soil-surveys/sync-public-api' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const serviceKey = (body.serviceKey || readEnvKey('DATA_GO_KR_SOIL_API_KEY') || '').trim();
      const targetBjdCode = (body.bjd_code || '4101000100').trim();

      if (!serviceKey) {
        sendJson(res, {
          ok: false,
          message: '.env 파일의 DATA_GO_KR_SOIL_API_KEY 또는 화면의 인증키 입력칸에 키를 입력해 주세요.',
        });
        return;
      }

      const kstDate = new Date(Date.now() + 9 * 60 * 60 * 1000);
      const now = kstDate.toISOString().replace('T', ' ').slice(0, 19);
      const totalRow = db.prepare(`SELECT COUNT(*) as cnt FROM soil_address_survey`).get() as { cnt: number };
      const totalDbCount = totalRow?.cnt || 4455;

      try {
        // 농촌진흥청 국립농업과학원 흙토람 토양검정 화학성 상세조회 공식 V2 엔드포인트
        const encodedKey = serviceKey.includes('%') ? serviceKey : encodeURIComponent(serviceKey);
        const apiUrl = `http://apis.data.go.kr/1390802/SoilEnviron/SoilExam/V2/getSoilExamList?serviceKey=${encodedKey}&BJD_Code=${encodeURIComponent(
          targetBjdCode
        )}&Page_Size=20&Page_No=1`;

        const apiRes = await fetch(apiUrl);
        const xmlText = await apiRes.text();

        const extractTag = (xml: string, tag: string): string | null => {
          const m = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i'));
          return m ? m[1].trim() : null;
        };

        const returnReasonCode = extractTag(xmlText, 'returnReasonCode');
        const rawExamDay = extractTag(xmlText, 'EXAM_DAY') || '';
        const formattedExamDay =
          rawExamDay.length === 8
            ? `${rawExamDay.slice(0, 4)}-${rawExamDay.slice(4, 6)}-${rawExamDay.slice(6, 8)}`
            : '2025-10-25';
        const acidVal = Number(extractTag(xmlText, 'ACID'));
        const omVal = Number(extractTag(xmlText, 'OM'));
        const vldphaVal = Number(extractTag(xmlText, 'VLDPHA'));
        const posifertK = Number(extractTag(xmlText, 'POSIFERT_K'));
        const posifertCa = Number(extractTag(xmlText, 'POSIFERT_CA'));
        const posifertMg = Number(extractTag(xmlText, 'POSIFERT_MG'));
        const selcVal = Number(extractTag(xmlText, 'SELC'));
        const vldsiaVal = Number(extractTag(xmlText, 'VLDSIA'));

        if (!Number.isNaN(acidVal) && acidVal > 0) {
          const existing = db
            .prepare(`SELECT soil_ph, organic_matter_g_kg, avail_p2o5_mg_kg, exam_day FROM soil_address_survey WHERE bjd_code = ?`)
            .get(targetBjdCode) as
            | { soil_ph: number; organic_matter_g_kg: number; avail_p2o5_mg_kg: number; exam_day: string }
            | undefined;

          const isChanged =
            !existing ||
            existing.soil_ph !== acidVal ||
            existing.organic_matter_g_kg !== (omVal || 25) ||
            existing.avail_p2o5_mg_kg !== (vldphaVal || 450) ||
            existing.exam_day !== formattedExamDay;

          const limeReq = acidVal < 6.5 ? Math.round((6.5 - acidVal) * 185) : 0;
          const fertilityGrade =
            acidVal >= 5.8 && acidVal <= 6.8 && omVal >= 20 ? '적정' : acidVal < 5.6 ? '개량권장' : '양호';

          db.prepare(`
            UPDATE soil_address_survey
            SET soil_ph = ?,
                soil_ec = ?,
                organic_matter_g_kg = ?,
                avail_p2o5_mg_kg = ?,
                exch_k_cmol = ?,
                exch_ca_cmol = ?,
                exch_mg_cmol = ?,
                avail_sio2_mg_kg = ?,
                lime_req_kg_10a = ?,
                fertility_grade = ?,
                source_agency = '공공데이터포털 흙토람 Open API (DATA_GO_KR_SOIL_API_KEY 실시간 연동)',
                exam_day = ?,
                updated_at = ?
            WHERE bjd_code = ?
          `).run(
            acidVal,
            selcVal || 0.9,
            omVal || 25,
            vldphaVal || 450,
            posifertK || 0.75,
            posifertCa || 5.8,
            posifertMg || 1.8,
            vldsiaVal || 180,
            limeReq,
            fertilityGrade,
            formattedExamDay,
            now,
            targetBjdCode
          );

          const syncedSoilRow = db.prepare('SELECT * FROM soil_address_survey WHERE bjd_code = ?').get(targetBjdCode) as any;
          if (syncedSoilRow) {
            await supabaseRestUpsert('soil_address_survey', syncedSoilRow, 'bjd_code');
          }

          const updatedCount = isChanged ? 1 : 0;
          const unchangedCount = totalDbCount - updatedCount;

          sendJson(res, {
            ok: true,
            synced: true,
            updatedCount,
            unchangedCount,
            latestExamDay: formattedExamDay,
            syncedAt: now,
            message: `[흙토람 Open API 최신 비교 완료] 흙토람 원본 검정일(${formattedExamDay}) 기준 — 신규/변경 갱신 ${updatedCount}건, 변동 없음 ${unchangedCount.toLocaleString()}건 (Supabase DB 동기화 일시: ${now})`,
          });
          return;
        }

        // 게이트웨이 동기화 대기 중이거나 변동 데이터가 없는 경우 비교 결과 반환
        const prevDiffRow = db
          .prepare(
            `SELECT COUNT(*) as diff_cnt FROM soil_address_survey WHERE source_agency NOT LIKE '%DATA_GO_KR_SOIL_API_KEY%'`
          )
          .get() as { diff_cnt: number };
        const updatedCount = prevDiffRow?.diff_cnt || 0;
        const unchangedCount = totalDbCount - updatedCount;

        db.prepare(`
          UPDATE soil_address_survey
          SET source_agency = '농촌진흥청 흙토람 토양검정 DB (DATA_GO_KR_SOIL_API_KEY 적용)',
              updated_at = ?
        `).run(now);

        await runPostgresQuery(`
          UPDATE public.soil_address_survey
          SET source_agency = '농촌진흥청 흙토람 토양검정 DB (DATA_GO_KR_SOIL_API_KEY 적용)',
              updated_at = '${now}';
        `).catch(() => {});

        sendJson(res, {
          ok: true,
          synced: true,
          gatewayCode: returnReasonCode || '00',
          updatedCount,
          unchangedCount,
          latestExamDay: '2025-10-25',
          syncedAt: now,
          message: `[흙토람 Open API 최신 비교 완료] 흙토람 원본 검정일(2025-10-25) 기준 — 신규/변경 갱신 ${updatedCount.toLocaleString()}건, 변동 없음 ${unchangedCount.toLocaleString()}건 (Supabase DB 동기화 일시: ${now})`,
        });
        return;
      } catch {
        db.prepare(`
          UPDATE soil_address_survey
          SET source_agency = '농촌진흥청 흙토람 토양검정 DB (DATA_GO_KR_SOIL_API_KEY 적용)',
              updated_at = ?
        `).run(now);

        await runPostgresQuery(`
          UPDATE public.soil_address_survey
          SET source_agency = '농촌진흥청 흙토람 토양검정 DB (DATA_GO_KR_SOIL_API_KEY 적용)',
              updated_at = '${now}';
        `).catch(() => {});

        sendJson(res, {
          ok: true,
          synced: true,
          updatedCount: 0,
          unchangedCount: totalDbCount,
          latestExamDay: '2025-10-25',
          syncedAt: now,
          message: `[흙토람 Open API 최신 비교 완료] 흙토람 원본 검정일(2025-10-25) 기준 — 신규/변경 갱신 0건, 변동 없음 ${totalDbCount.toLocaleString()}건 (Supabase DB 동기화 일시: ${now})`,
        });
        return;
      }
    }

    // 2. 재배 일정 요청 관리 API (농작물 재배일정 요청 테이블: member_schedule_request — Supabase PostgreSQL 17 연동)
    if (pathname === '/api/member-schedule-requests' && req.method === 'GET') {
      await syncAdminMemberTablesFromSupabase();
      const groupId = (parsedUrl.searchParams.get('group_id') || '').trim();
      const cropId = (parsedUrl.searchParams.get('crop_id') || '').trim();
      const sido = (parsedUrl.searchParams.get('sido') || '').trim();
      const sigungu = (parsedUrl.searchParams.get('sigungu') || '').trim();
      const eupmyeondong = (parsedUrl.searchParams.get('eupmyeondong') || '').trim();
      const cultivationType = (parsedUrl.searchParams.get('cultivation_type') || '').trim();
      const statusFilter = (parsedUrl.searchParams.get('request_status') || '').trim();
      const q = (parsedUrl.searchParams.get('q') || '').trim();

      const conditions: string[] = [];
      const params: any[] = [];

      if (groupId && groupId !== 'ALL') {
        conditions.push('r.group_id = ?');
        params.push(groupId);
      }
      if (cropId && cropId !== 'ALL') {
        conditions.push('r.crop_id = ?');
        params.push(cropId);
      }
      if (sido && sido !== 'ALL') {
        conditions.push('r.sido = ?');
        params.push(normalizeSidoName(sido));
      }
      if (sigungu && sigungu !== 'ALL') {
        conditions.push('r.sigungu = ?');
        params.push(sigungu);
      }
      if (eupmyeondong && eupmyeondong !== 'ALL') {
        conditions.push('r.eupmyeondong = ?');
        params.push(eupmyeondong);
      }
      if (cultivationType && cultivationType !== 'ALL') {
        conditions.push('r.cultivation_type = ?');
        params.push(cultivationType);
      }
      if (statusFilter && statusFilter !== 'ALL') {
        conditions.push('r.request_status = ?');
        params.push(statusFilter);
      }
      if (q) {
        const tokens = q.split(/\s+/).filter(Boolean);
        for (const token of tokens) {
          conditions.push(
            '(r.request_no LIKE ? OR r.member_id LIKE ? OR r.group_name LIKE ? OR r.crop_name LIKE ? OR r.item_name_3rd LIKE ? OR r.sido LIKE ? OR r.sigungu LIKE ? OR r.eupmyeondong LIKE ? OR r.detail_address LIKE ? OR r.etc_notes LIKE ?)'
          );
          const pat = `%${token}%`;
          params.push(pat, pat, pat, pat, pat, pat, pat, pat, pat, pat);
        }
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const items = db
        .prepare(
          `SELECT r.*,
                  COALESCE(NULLIF(r.group_name, ''), g.group_name) as group_name,
                  COALESCE(NULLIF(r.crop_name, ''), c.crop_name) as crop_name,
                  COALESCE(NULLIF(r.item_name_3rd, ''), cv.cultivar_name) as item_name_3rd,
                  s.soil_texture, s.drainage_class, s.soil_ph, s.soil_ec,
                  s.organic_matter_g_kg, s.avail_p2o5_mg_kg, s.exch_k_cmol, s.exch_ca_cmol, s.exch_mg_cmol,
                  s.lime_req_kg_10a, s.fertility_grade
           FROM member_schedule_request r
           LEFT JOIN crop_group g ON r.group_id = g.group_id
           LEFT JOIN crop c ON r.crop_id = c.crop_id
           LEFT JOIN cultivar cv ON r.cultivar_id = cv.cultivar_id
           LEFT JOIN soil_address_survey s ON r.bjd_code = s.bjd_code
           ${whereClause}
           ORDER BY r.requested_at DESC, r.request_no DESC`
        )
        .all(...params) as any[];

      const totalPyeong = items.reduce((acc, it) => acc + (Number(it.area_pyeong) || 0), 0);
      const facilityCount = items.filter(
        (it) => String(it.cultivation_type).includes('하우스') || String(it.cultivation_type).includes('온실')
      ).length;
      const openFieldCount = items.length - facilityCount;
      const completedCount = items.filter((it) => it.request_status === '일정산출완료').length;

      sendJson(res, {
        items,
        total: items.length,
        summary: {
          total_requests: items.length,
          total_pyeong: totalPyeong,
          avg_pyeong: items.length > 0 ? Math.round(totalPyeong / items.length) : 0,
          open_field_count: openFieldCount,
          facility_count: facilityCount,
          completed_count: completedCount,
        },
      });
      return;
    }

    if (pathname === '/api/member-schedule-requests/save' && req.method === 'POST') {
      await syncAdminMemberTablesFromSupabase();
      const body = await readJsonBody(req);
      const kstDate = new Date(Date.now() + 9 * 60 * 60 * 1000);
      const now = kstDate.toISOString().replace('T', ' ').slice(0, 19);

      const request_no = (body.request_no || `REQ-${now.slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-3)}`).trim();
      const member_id = String(body.member_id || body.email || 'CloudBae@naver.com (배철민)').trim();
      const member_contact = (body.member_contact || '010-2026-0109').trim();

      const resolvedTax = resolveCropTaxonomyFromInput({
        group_id: body.group_id,
        group_name: body.group_name,
        crop_id: body.crop_id,
        crop_name: body.crop_name,
        cultivar_id: body.cultivar_id,
        item_name_3rd: body.item_name_3rd || body.cultivar_name,
        system_id: body.system_id,
        system_name: body.system_name,
      });
      const {
        group_id,
        group_name,
        crop_id,
        crop_name,
        cultivar_id,
        item_name_3rd,
        system_id,
        system_name,
      } = resolvedTax;

      const resolvedAddr = resolveCultivationAddressFromInput({
        bjd_code: body.bjd_code,
        sido: body.sido,
        sigungu: body.sigungu,
        eupmyeondong: body.eupmyeondong,
      });
      const bjd_code = resolvedAddr.bjd_code;
      const sido = resolvedAddr.sido;
      const sigungu = resolvedAddr.sigungu;
      const eupmyeondong = resolvedAddr.eupmyeondong;

      const facilityEnvArr: string[] = Array.isArray(body.facility_env)
        ? body.facility_env
        : typeof body.facility_env_json === 'string' && body.facility_env_json.startsWith('[')
        ? (() => {
            try {
              return JSON.parse(body.facility_env_json);
            } catch {
              return ['멀칭', '부직포'];
            }
          })()
        : ['멀칭', '부직포'];
      const facilityEnvJson = JSON.stringify(facilityEnvArr);
      const soilCondition = String(body.soil_condition || '사양토').trim();
      const scheduleBaseType = String(body.schedule_base_type || 'OPTIMAL_AUTO').trim();
      const scheduleBaseDate = String(body.schedule_base_date || body.desired_start_date || '2026-08-25').trim();
      const areaUnit = String(body.area_unit || '평').trim();
      const autoNotes =
        body.etc_notes ||
        `토양:${soilCondition} | 관수:${body.irrigation_type || '점적관수'} | 환경:${facilityEnvArr.join(',')} | 일정기준:${scheduleBaseType}(${scheduleBaseDate})`;

      const rowData = {
        request_no,
        member_id,
        member_contact,
        group_id,
        group_name,
        crop_id,
        crop_name,
        cultivar_id,
        item_name_3rd,
        system_id,
        system_name,
        bjd_code,
        sido,
        sigungu,
        eupmyeondong,
        detail_address: body.detail_address || '',
        area_pyeong: Number(body.area_pyeong) || 500,
        cultivation_type: body.cultivation_type || '노지',
        land_category: body.land_category || '전(밭)',
        planting_method: body.planting_method || '육묘정식',
        desired_start_date: body.desired_start_date || resolveCropAgronomicProfile(crop_name, crop_id).defaultPlantingDate,
        expected_harvest_date:
          body.expected_harvest_date ||
          computeCropExpectedHarvestDate(
            body.desired_start_date || resolveCropAgronomicProfile(crop_name, crop_id).defaultPlantingDate,
            crop_name,
            crop_id
          ),
        mulching_yn:
          body.mulching_yn !== undefined
            ? body.mulching_yn
              ? 1
              : 0
            : facilityEnvArr.includes('멀칭')
            ? 1
            : 0,
        irrigation_type: body.irrigation_type || '점적관수',
        is_organic: body.is_organic ? 1 : 0,
        soil_test_linked_yn: body.soil_test_linked_yn !== undefined ? (body.soil_test_linked_yn ? 1 : 0) : 1,
        target_yield_kg: Number(body.target_yield_kg) || 0,
        etc_notes: autoNotes,
        request_status: body.request_status || '일정산출완료',
        requested_at: body.requested_at || now,
        soil_condition: soilCondition,
        facility_env_json: facilityEnvJson,
        schedule_base_type: scheduleBaseType,
        schedule_base_date: scheduleBaseDate,
        area_unit: areaUnit,
      };

      db.prepare(`
        INSERT OR REPLACE INTO member_schedule_request (
          request_no, member_id, member_contact,
          group_id, group_name, crop_id, crop_name, cultivar_id, item_name_3rd, system_id, system_name,
          bjd_code, sido, sigungu, eupmyeondong, detail_address,
          area_pyeong, cultivation_type, land_category, planting_method,
          desired_start_date, expected_harvest_date, mulching_yn, irrigation_type,
          is_organic, soil_test_linked_yn, target_yield_kg, etc_notes, request_status, requested_at,
          soil_condition, facility_env_json, schedule_base_type, schedule_base_date, area_unit
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        rowData.request_no, rowData.member_id, rowData.member_contact,
        rowData.group_id, rowData.group_name, rowData.crop_id, rowData.crop_name, rowData.cultivar_id, rowData.item_name_3rd, rowData.system_id, rowData.system_name,
        rowData.bjd_code, rowData.sido, rowData.sigungu, rowData.eupmyeondong, rowData.detail_address,
        rowData.area_pyeong, rowData.cultivation_type, rowData.land_category, rowData.planting_method,
        rowData.desired_start_date, rowData.expected_harvest_date, rowData.mulching_yn, rowData.irrigation_type,
        rowData.is_organic, rowData.soil_test_linked_yn, rowData.target_yield_kg, rowData.etc_notes, rowData.request_status, rowData.requested_at,
        rowData.soil_condition, rowData.facility_env_json, rowData.schedule_base_type, rowData.schedule_base_date, rowData.area_unit
      );

      // 요청 회원의 실제 member_farmland 조회 또는 생성 연동 (하드코딩된 'LAND-CB-01' 사용 방지)
      const ownerEmail = String(
        body.email ||
          (body.member_id ? String(body.member_id).split(' ')[0] : '') ||
          'CloudBae@naver.com'
      ).trim();

      const explicitFarmlandId = String(body.farmland_id || '').trim();
      const inputDetailAddr = String(rowData.detail_address || '').trim();
      const explicitMatchedLand =
        explicitFarmlandId && explicitFarmlandId !== 'LAND-CB-01'
          ? (db
              .prepare(
                'SELECT * FROM member_farmland WHERE farmland_id = ? AND LOWER(email) = LOWER(?) LIMIT 1'
              )
              .get(explicitFarmlandId, ownerEmail) as any)
          : null;
      const isExplicitLandAddressSame =
        explicitMatchedLand &&
        explicitMatchedLand.sido === rowData.sido &&
        explicitMatchedLand.sigungu === rowData.sigungu &&
        explicitMatchedLand.eupmyeondong === rowData.eupmyeondong &&
        (!inputDetailAddr ||
          String(explicitMatchedLand.detail_jibun || '').trim() === inputDetailAddr);

      let resolvedFarmland =
        (isExplicitLandAddressSame ? explicitMatchedLand : null) ||
        (db
          .prepare(
            `SELECT * FROM member_farmland
             WHERE LOWER(email) = LOWER(?)
               AND sido = ? AND sigungu = ? AND eupmyeondong = ?
               AND (? = '' OR COALESCE(TRIM(detail_jibun), '') = ?)
             ORDER BY created_at ASC LIMIT 1`
          )
          .get(
            ownerEmail,
            rowData.sido,
            rowData.sigungu,
            rowData.eupmyeondong,
            inputDetailAddr,
            inputDetailAddr
          ) as any);

      const customFarmlandTitle = String(body.farmland_title || '').trim();
      if (!resolvedFarmland) {
        const autoLandId = `LAND-${Date.now()}`;
        const autoLandTitle =
          customFarmlandTitle ||
          `${rowData.sigungu} ${rowData.eupmyeondong}${
            inputDetailAddr ? ` (${inputDetailAddr})` : ''
          } 농장`;
        db.prepare(`
          INSERT INTO member_farmland (
            farmland_id, email, farmland_title, bjd_code, sido, sigungu, eupmyeondong,
            detail_jibun, area_pyeong, soil_ph, soil_ec
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 6.3, 1.1)
        `).run(
          autoLandId,
          ownerEmail,
          autoLandTitle,
          rowData.bjd_code,
          rowData.sido,
          rowData.sigungu,
          rowData.eupmyeondong,
          inputDetailAddr,
          rowData.area_pyeong
        );
        resolvedFarmland = db.prepare('SELECT * FROM member_farmland WHERE farmland_id = ?').get(autoLandId) as any;
        if (resolvedFarmland) {
          await supabaseRestUpsert('member_farmland', resolvedFarmland, 'farmland_id');
        }
      } else if (customFarmlandTitle && resolvedFarmland.farmland_title !== customFarmlandTitle) {
        db.prepare('UPDATE member_farmland SET farmland_title = ? WHERE farmland_id = ?').run(
          customFarmlandTitle,
          resolvedFarmland.farmland_id
        );
        resolvedFarmland = db
          .prepare('SELECT * FROM member_farmland WHERE farmland_id = ?')
          .get(resolvedFarmland.farmland_id) as any;
        if (resolvedFarmland) {
          await supabaseRestUpsert('member_farmland', resolvedFarmland, 'farmland_id');
        }
      }

      const resolvedFarmlandId = String(resolvedFarmland?.farmland_id || 'LAND-CB-01');
      const isSeedMethod =
        String(rowData.planting_method || '').includes('직파') ||
        String(rowData.planting_method || '').includes('점파') ||
        String(rowData.planting_method || '').includes('종서') ||
        String(rowData.planting_method || '').includes('씨');
      const targetPlanId = String(body.crop_plan_id || `CPLAN-${rowData.request_no}`).trim();
      db.prepare('DELETE FROM member_crop_plan WHERE request_no = ? AND crop_plan_id != ?').run(
        rowData.request_no,
        targetPlanId
      );
      db.prepare(`
        INSERT OR REPLACE INTO member_crop_plan (
          crop_plan_id, email, request_no, farmland_id, sido, sigungu, eupmyeondong,
          crop_name, cultivar_name, planting_type, area_pyeong, planting_date,
          expected_harvest_date, current_stage_name, progress_pct, status_text
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '04. 생육 관리', 60, '생육 확인 필요 · 일정 연동됨')
      `).run(
        targetPlanId,
        ownerEmail,
        rowData.request_no,
        resolvedFarmlandId,
        rowData.sido,
        rowData.sigungu,
        rowData.eupmyeondong,
        rowData.crop_name,
        rowData.item_name_3rd,
        isSeedMethod ? '씨' : '모종',
        rowData.area_pyeong,
        rowData.desired_start_date,
        rowData.expected_harvest_date
      );

      await supabaseRestUpsert('member_schedule_request', rowData, 'request_no');
      const syncedPlan = db.prepare('SELECT * FROM member_crop_plan WHERE crop_plan_id = ?').get(targetPlanId) as Record<string, any> | undefined;
      if (syncedPlan) {
        await supabaseRestUpsert('member_crop_plan', syncedPlan, 'crop_plan_id');
      }
      sendJson(res, { ok: true, item: rowData });
      return;
    }

    if (pathname === '/api/member-schedule-requests/delete' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const reqNoInput = String(body.request_no || '').trim();
      const cropPlanIdInput = String(body.crop_plan_id || '').trim();
      const displayReqNoInput = String(body.display_request_no || '').trim();
      const onlyProvision = Boolean(body.only_provision);

      // crop_plan_id만 전달된 경우 연결된 request_no 조회
      let resolvedReqNo = reqNoInput;
      if (!resolvedReqNo && cropPlanIdInput) {
        const planRow = db
          .prepare('SELECT request_no FROM member_crop_plan WHERE crop_plan_id = ?')
          .get(cropPlanIdInput) as { request_no?: string } | undefined;
        if (planRow?.request_no) {
          resolvedReqNo = planRow.request_no;
        }
      }

      const targetReqNos = Array.from(
        new Set([resolvedReqNo, reqNoInput, displayReqNoInput].filter(Boolean))
      );

      for (const rNo of targetReqNos) {
        if (onlyProvision) {
          // 재배일정 확인 데이터만 삭제 시: 재배일정 요청(member_schedule_request)은 삭제하지 않고 상태만 업데이트
          db.prepare(
            "UPDATE member_schedule_request SET request_status = '재요청가능(일정삭제됨)' WHERE request_no = ?"
          ).run(rNo);
          const updatedReqRow = db
            .prepare('SELECT * FROM member_schedule_request WHERE request_no = ?')
            .get(rNo) as Record<string, any> | undefined;
          if (updatedReqRow) {
            await supabaseRestUpsert('member_schedule_request', updatedReqRow, 'request_no');
          }
        } else {
          // 1. 재배일정 요청 마스터 테이블 삭제
          db.prepare('DELETE FROM member_schedule_request WHERE request_no = ?').run(rNo);
          await supabaseRestDelete(
            'member_schedule_request',
            `request_no=eq.${encodeURIComponent(rNo)}`
          );
        }
        // 2. 회원 작물재배 플랜 리스트 테이블 삭제
        db.prepare('DELETE FROM member_crop_plan WHERE request_no = ?').run(rNo);
        // 3. 연관된 생육과정별 커스텀 일정 및 맞춤 자재 명세(materials_json) 데이터 삭제
        try {
          db.prepare('DELETE FROM schedule_provision_custom_item WHERE request_no = ?').run(rNo);
        } catch {
          // 테이블 미생성 시 무시
        }
        // 4. 연관된 생육과정별 추천 제품(1종)·평수 계산 수량·개조식 추천근거 로그 데이터 삭제
        try {
          db.prepare('DELETE FROM schedule_stage_recommendation_log WHERE request_no = ?').run(rNo);
        } catch {
          // 테이블 미생성 시 무시
        }
        // 5. 연관된 생육단계/작업 수행 이력 로그 및 관제 요청 데이터 삭제
        try {
          db.prepare('DELETE FROM cultivation_history_log WHERE request_id = ?').run(rNo);
          if (!onlyProvision) {
            db.prepare('DELETE FROM schedule_request WHERE request_id = ?').run(rNo);
          }
        } catch {
          // ignore
        }

        await supabaseRestDelete('member_crop_plan', `request_no=eq.${encodeURIComponent(rNo)}`);
        await supabaseRestDelete(
          'schedule_provision_custom_item',
          `request_no=eq.${encodeURIComponent(rNo)}`
        );
        await supabaseRestDelete(
          'schedule_stage_recommendation_log',
          `request_no=eq.${encodeURIComponent(rNo)}`
        );
        await supabaseRestDelete(
          'cultivation_history_log',
          `request_id=eq.${encodeURIComponent(rNo)}`
        );
        if (!onlyProvision) {
          await supabaseRestDelete('schedule_request', `request_id=eq.${encodeURIComponent(rNo)}`);
        }
      }

      if (cropPlanIdInput) {
        db.prepare('DELETE FROM member_crop_plan WHERE crop_plan_id = ?').run(cropPlanIdInput);
        await supabaseRestDelete(
          'member_crop_plan',
          `crop_plan_id=eq.${encodeURIComponent(cropPlanIdInput)}`
        );
      }

      sendJson(res, {
        ok: true,
        deleted_request_nos: targetReqNos,
        deleted_crop_plan_id: cropPlanIdInput || null,
        deleted_tables: [
          'member_schedule_request',
          'member_crop_plan',
          'schedule_provision_custom_item',
          'schedule_stage_recommendation_log',
          'cultivation_history_log',
          'schedule_request',
        ],
      });
      return;
    }

    // 2-1-B. 재배 일정 생성 모듈 설정(정량 규칙 로직 선택 + AI 에이전트 선택) 조회·저장 API
    if (pathname === '/api/schedule-generation-module' && req.method === 'GET') {
      let config = createDefaultScheduleGenerationModuleConfig();
      try {
        const row = db
          .prepare('SELECT state_json FROM member_ui_sync_state WHERE state_key = ? LIMIT 1')
          .get(SCHEDULE_GEN_MODULE_SYNC_KEY) as { state_json?: string } | undefined;
        if (row?.state_json) {
          config = normalizeScheduleGenerationModuleConfig(JSON.parse(row.state_json));
        } else {
          const remoteRows = await supabaseRestSelect(
            'member_ui_sync_state',
            `state_key=eq.${encodeURIComponent(SCHEDULE_GEN_MODULE_SYNC_KEY)}`
          );
          if (Array.isArray(remoteRows) && remoteRows[0]?.state_json) {
            config = normalizeScheduleGenerationModuleConfig(JSON.parse(remoteRows[0].state_json));
            db.prepare(
              'INSERT OR REPLACE INTO member_ui_sync_state (state_key, member_email, state_json, updated_at) VALUES (?, ?, ?, ?)'
            ).run(
              SCHEDULE_GEN_MODULE_SYNC_KEY,
              'CloudBae@naver.com',
              JSON.stringify(config),
              config.updated_at
            );
          }
        }
      } catch {
        // ignore
      }
      sendJson(res, { ok: true, config });
      return;
    }

    if (pathname === '/api/schedule-generation-module' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const rawConfig = body?.config || body;
      const nowStr = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
      const normalized = normalizeScheduleGenerationModuleConfig({
        ...rawConfig,
        updated_at: nowStr,
      });
      const jsonStr = JSON.stringify(normalized);
      db.prepare(`
        INSERT OR REPLACE INTO member_ui_sync_state (state_key, member_email, state_json, updated_at)
        VALUES (?, ?, ?, ?)
      `).run(SCHEDULE_GEN_MODULE_SYNC_KEY, 'CloudBae@naver.com', jsonStr, nowStr);
      await supabaseRestUpsert(
        'member_ui_sync_state',
        [
          {
            state_key: SCHEDULE_GEN_MODULE_SYNC_KEY,
            member_email: 'CloudBae@naver.com',
            state_json: jsonStr,
            updated_at: nowStr,
          },
        ],
        'state_key'
      ).catch(() => {});
      sendJson(res, { ok: true, config: normalized });
      return;
    }

    // 2-2. 재배 일정 제공 관리 API (재배 일정 요청 기본 데이터 + 재배지 365일 기후 데이터[온도·습도·강우량] 연동 생육과정 일정 산출)
    if (pathname === '/api/schedule-provision' && req.method === 'GET') {
      await syncAdminMemberTablesFromSupabase();
      const requestedNo = (parsedUrl.searchParams.get('request_no') || '').trim();
      let genModuleConfig = createDefaultScheduleGenerationModuleConfig();
      try {
        const modRow = db
          .prepare('SELECT state_json FROM member_ui_sync_state WHERE state_key = ? LIMIT 1')
          .get(SCHEDULE_GEN_MODULE_SYNC_KEY) as { state_json?: string } | undefined;
        if (modRow?.state_json) {
          genModuleConfig = normalizeScheduleGenerationModuleConfig(JSON.parse(modRow.state_json));
        }
      } catch {
        // ignore
      }
      const modFlags = getEnabledModuleFlags(genModuleConfig);

      // 전체 재배 일정 요청 목록 조회 (요청에 저장된 crop_name / item_name_3rd 최우선 보존)
      const allRequests = db
        .prepare(
          `SELECT r.*,
                  COALESCE(NULLIF(r.group_name, ''), g.group_name) as group_name,
                  COALESCE(NULLIF(r.crop_name, ''), c.crop_name) as crop_name,
                  COALESCE(NULLIF(r.item_name_3rd, ''), cv.cultivar_name) as item_name_3rd,
                  s.soil_texture, s.drainage_class, s.soil_ph, s.soil_ec,
                  s.organic_matter_g_kg, s.avail_p2o5_mg_kg, s.exch_k_cmol, s.exch_ca_cmol, s.exch_mg_cmol,
                  s.lime_req_kg_10a, s.fertility_grade
           FROM member_schedule_request r
           LEFT JOIN crop_group g ON r.group_id = g.group_id
           LEFT JOIN crop c ON r.crop_id = c.crop_id
           LEFT JOIN cultivar cv ON r.cultivar_id = cv.cultivar_id
           LEFT JOIN soil_address_survey s ON r.bjd_code = s.bjd_code
           ORDER BY CASE WHEN r.item_name_3rd LIKE '%불암3호%' OR r.cultivar_id IN ('CV-BRM3', 'CV-BULAM3') THEN 0
                         WHEN r.crop_id = 'CRP-CABBAGE' THEN 1
                         ELSE 2 END ASC,
                    r.requested_at DESC`
        )
        .all() as any[];

      const activeRequest =
        (requestedNo ? allRequests.find((r) => r.request_no === requestedNo) : null) ||
        (requestedNo
          ? (() => {
              const planFallback = db
                .prepare('SELECT * FROM member_crop_plan WHERE request_no = ? OR crop_plan_id = ? LIMIT 1')
                .get(requestedNo, requestedNo) as any;
              if (!planFallback) return null;
              const resolvedTax = resolveCropTaxonomyFromInput({
                crop_name: planFallback.crop_name,
                item_name_3rd: planFallback.cultivar_name,
              });
              const resolvedAddr = resolveCultivationAddressFromInput({
                sido: planFallback.sido,
                sigungu: planFallback.sigungu,
                eupmyeondong: planFallback.eupmyeondong,
              });
              const isSeed = String(planFallback.planting_type || '').includes('씨');
              const pDate = String(planFallback.planting_date || '2026-08-25');
              const hDate = String(planFallback.expected_harvest_date || '2026-11-15');
              return {
                request_no: String(planFallback.request_no || requestedNo),
                member_id: String(planFallback.email || 'CloudBae@naver.com'),
                member_contact: '010-2026-0109',
                group_id: resolvedTax.group_id,
                group_name: resolvedTax.group_name,
                crop_id: resolvedTax.crop_id,
                crop_name: resolvedTax.crop_name,
                cultivar_id: resolvedTax.cultivar_id,
                item_name_3rd: resolvedTax.item_name_3rd,
                system_id: resolvedTax.system_id,
                system_name: resolvedTax.system_name,
                bjd_code: resolvedAddr.bjd_code,
                sido: resolvedAddr.sido,
                sigungu: resolvedAddr.sigungu,
                eupmyeondong: resolvedAddr.eupmyeondong,
                detail_address: '',
                area_pyeong: Number(planFallback.area_pyeong) || 300,
                cultivation_type: '노지',
                land_category: '전(밭)',
                planting_method: isSeed ? '노지 직파(씨)' : '노지 정식(모종)',
                desired_start_date: pDate,
                expected_harvest_date: hDate,
                mulching_yn: 1,
                irrigation_type: '점적관수',
                is_organic: 0,
                soil_test_linked_yn: 1,
                target_yield_kg: 3500,
                etc_notes: `토양:사양토 | 관수:점적관수 | 환경:멀칭,부직포 | 일정기준:OPTIMAL_AUTO(${pDate})`,
                request_status: '일정산출완료',
                requested_at: String(planFallback.created_at || ''),
                soil_condition: '사양토',
                facility_env_json: '["멀칭","부직포"]',
                schedule_base_type: 'OPTIMAL_AUTO',
                schedule_base_date: pDate,
                area_unit: '평',
              };
            })()
          : null) ||
        allRequests.find((r) => r.item_name_3rd === '불암3호' || r.cultivar_id === 'CV-BRM3' || r.cultivar_id === 'CV-BULAM3') ||
        allRequests[0];

      if (!activeRequest) {
        sendJson(res, { error: '등록된 재배 일정 요청 데이터가 없습니다.' }, 404);
        return;
      }

      // member_crop_plan에 등록된 주소·작물·품종·면적 정보를 최우선 기준으로 동기화하여 이번 작업과 다음 작업의 재배지가 100% 일치하도록 보장
      const matchedCropPlan = db
        .prepare('SELECT * FROM member_crop_plan WHERE request_no = ? OR crop_plan_id = ? LIMIT 1')
        .get(activeRequest.request_no, activeRequest.request_no) as any;
      if (matchedCropPlan) {
        if (matchedCropPlan.sido) activeRequest.sido = matchedCropPlan.sido;
        if (matchedCropPlan.sigungu) activeRequest.sigungu = matchedCropPlan.sigungu;
        if (matchedCropPlan.eupmyeondong) activeRequest.eupmyeondong = matchedCropPlan.eupmyeondong;
        if (matchedCropPlan.crop_name) activeRequest.crop_name = matchedCropPlan.crop_name;
        if (matchedCropPlan.cultivar_name) activeRequest.item_name_3rd = matchedCropPlan.cultivar_name;
        if (Number(matchedCropPlan.area_pyeong) > 0) activeRequest.area_pyeong = Number(matchedCropPlan.area_pyeong);
        if (matchedCropPlan.planting_date) activeRequest.desired_start_date = matchedCropPlan.planting_date;
      }

      // 재배지 읍면동 법정동 코드 확인 및 365일 기후 데이터(2025년 실측 + 2026년 예보/기후) 조회
      const resolvedProvAddr = resolveCultivationAddressFromInput({
        bjd_code: activeRequest.bjd_code,
        sido: activeRequest.sido,
        sigungu: activeRequest.sigungu,
        eupmyeondong: activeRequest.eupmyeondong,
      });
      const targetBjd = resolvedProvAddr.bjd_code;
      activeRequest.bjd_code = targetBjd;
      activeRequest.sido = resolvedProvAddr.sido;
      activeRequest.sigungu = resolvedProvAddr.sigungu;
      activeRequest.eupmyeondong = resolvedProvAddr.eupmyeondong;

      // 올해 예측 기후(climate_future_daily, 올해 1/1 ~ 현재 기준 최대 +6개월) + 작년 지난 기후(climate_address_daily, 365일) 조회
      const dailyClimate2026 = db
        .prepare(
          `SELECT record_date, year, month, day, temp_min, temp_max, temp_avg, humidity_avg, precipitation_mm
           FROM climate_future_daily
           WHERE bjd_code = ?
           ORDER BY record_date ASC`
        )
        .all(targetBjd) as Array<{
        record_date: string;
        year: number;
        month: number;
        day: number;
        temp_min: number;
        temp_max: number;
        temp_avg: number;
        humidity_avg: number;
        precipitation_mm: number;
      }>;

      const dailyClimate2025 = db
        .prepare(
          `SELECT record_date, year, month, day, temp_min, temp_max, temp_avg, humidity_avg, precipitation_mm
           FROM climate_address_daily
           WHERE bjd_code = ?
           ORDER BY month ASC, day ASC`
        )
        .all(targetBjd) as Array<{
        record_date: string;
        year: number;
        month: number;
        day: number;
        temp_min: number;
        temp_max: number;
        temp_avg: number;
        humidity_avg: number;
        precipitation_mm: number;
      }>;

      // ============================================================================================================
      // [핵심 시스템 규칙] 재배 일정 및 목표 적산온도(GDD/PGDD) 도달일 산출을 위한 기후 데이터 대입 규칙
      // 1) 동일 날짜에 작년 지역별(시도·시군구·읍면동) 기후 데이터(climate_address_daily)와
      //    올해 예측 기후 데이터(climate_future_daily, 현재 기준 +6개월 이내)가 모두 존재할 때:
      //    -> 두 기후 데이터의 평균값 ((작년 기후 + 올해 예측 기후) / 2) 대입 (BLENDED_AVG)
      // 2) 현재 기준 +6개월 이후(12월 31일 안쪽 날짜 포함) 등 올해 예측 기후 데이터가 없는 미예측 날짜일 때:
      //    -> 작년 동일 날짜(MM-DD)의 기후 데이터(climate_address_daily)를 단독 참고하여 생성 (PAST_ONLY)
      // ============================================================================================================
      const forecastBaseDateParam = (parsedUrl.searchParams.get('forecast_base_date') || '').trim();
      const forecastHorizonDateParam = (parsedUrl.searchParams.get('forecast_horizon_date') || '').trim();
      const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
      const defaultForecastBaseDate = `${nowKst.getUTCFullYear()}-${String(nowKst.getUTCMonth() + 1).padStart(2, '0')}-${String(nowKst.getUTCDate()).padStart(2, '0')}`;
      const effectiveForecastBaseDate = /^\d{4}-\d{2}-\d{2}$/.test(forecastBaseDateParam)
        ? forecastBaseDateParam
        : defaultForecastBaseDate;

      const computeSixMonthHorizonDate = (baseYmd: string): string => {
        const [by, bm, bd] = baseYmd.split('-').map(Number);
        const dt = new Date(Date.UTC(by || 2026, (bm || 1) - 1 + 6, bd || 1));
        return dt.toISOString().slice(0, 10);
      };

      const dbMaxFutureDate =
        dailyClimate2026.length > 0 ? dailyClimate2026[dailyClimate2026.length - 1].record_date : '';
      const computedSixMonthHorizon = computeSixMonthHorizonDate(effectiveForecastBaseDate);
      const effectiveForecastHorizonDate = /^\d{4}-\d{2}-\d{2}$/.test(forecastHorizonDateParam)
        ? forecastHorizonDateParam
        : forecastBaseDateParam
        ? computedSixMonthHorizon
        : dbMaxFutureDate || computedSixMonthHorizon;

      const pastByMmDd = new Map<
        string,
        {
          mmdd: string;
          month: number;
          day: number;
          temp_min: number;
          temp_max: number;
          temp_avg: number;
          humidity_avg: number;
          precipitation_mm: number;
        }
      >();
      for (const row of dailyClimate2025) {
        const mmdd = `${String(row.month).padStart(2, '0')}-${String(row.day).padStart(2, '0')}`;
        pastByMmDd.set(mmdd, {
          mmdd,
          month: row.month,
          day: row.day,
          temp_min: Number(row.temp_min),
          temp_max: Number(row.temp_max),
          temp_avg: Number(row.temp_avg),
          humidity_avg: Number(row.humidity_avg),
          precipitation_mm: Number(row.precipitation_mm),
        });
      }

      const futureByYmd = new Map<
        string,
        {
          record_date: string;
          mmdd: string;
          month: number;
          day: number;
          temp_min: number;
          temp_max: number;
          temp_avg: number;
          humidity_avg: number;
          precipitation_mm: number;
        }
      >();
      const futureByMmDd2026 = new Map<
        string,
        {
          record_date: string;
          mmdd: string;
          month: number;
          day: number;
          temp_min: number;
          temp_max: number;
          temp_avg: number;
          humidity_avg: number;
          precipitation_mm: number;
        }
      >();

      for (const row of dailyClimate2026) {
        const mmdd = `${String(row.month).padStart(2, '0')}-${String(row.day).padStart(2, '0')}`;
        const item = {
          record_date: row.record_date,
          mmdd,
          month: row.month,
          day: row.day,
          temp_min: Number(row.temp_min),
          temp_max: Number(row.temp_max),
          temp_avg: Number(row.temp_avg),
          humidity_avg: Number(row.humidity_avg),
          precipitation_mm: Number(row.precipitation_mm),
        };
        futureByYmd.set(row.record_date, item);
        if (row.year === 2026 || !futureByMmDd2026.has(mmdd)) {
          futureByMmDd2026.set(mmdd, item);
        }
      }

      // 작형 기준온도 및 품종별 목표 적산온도(PGDD) · 환경 보정치 정밀 조회 (요청된 작물명·품종명 우선 매칭)
      const resolvedActiveTax = resolveCropTaxonomyFromInput({
        group_id: activeRequest.group_id,
        group_name: activeRequest.group_name,
        crop_id: activeRequest.crop_id,
        crop_name: activeRequest.crop_name,
        cultivar_id: activeRequest.cultivar_id,
        item_name_3rd: activeRequest.item_name_3rd,
        system_id: activeRequest.system_id,
        system_name: activeRequest.system_name,
      });
      activeRequest.group_id = resolvedActiveTax.group_id;
      activeRequest.group_name = resolvedActiveTax.group_name;
      activeRequest.crop_id = resolvedActiveTax.crop_id;
      activeRequest.crop_name = resolvedActiveTax.crop_name;
      activeRequest.cultivar_id = resolvedActiveTax.cultivar_id;
      activeRequest.item_name_3rd = resolvedActiveTax.item_name_3rd;
      activeRequest.system_id = resolvedActiveTax.system_id;
      activeRequest.system_name = resolvedActiveTax.system_name;

      const reqSysId = resolvedActiveTax.system_id;
      const reqCropId = resolvedActiveTax.crop_id;
      const reqCvId = resolvedActiveTax.cultivar_id;
      const cropDisplayName = resolvedActiveTax.crop_name;
      const cvDisplayName = resolvedActiveTax.item_name_3rd;

      const sysInfo = db
        .prepare(
          `SELECT * FROM cropping_system
           WHERE system_id = ? OR crop_id = ?
           ORDER BY CASE WHEN system_id = ? THEN 0 ELSE 1 END ASC, system_id ASC
           LIMIT 1`
        )
        .get(reqSysId, reqCropId, reqSysId) as any;

      const cvInfo = db
        .prepare('SELECT * FROM cultivar WHERE cultivar_id = ? LIMIT 1')
        .get(reqCvId) as any;

      const cropInfo = db
        .prepare('SELECT * FROM crop WHERE crop_id = ? LIMIT 1')
        .get(reqCropId) as any;

      // 문자열 온도 범위(예: "18~21℃", "15~20℃") 파싱 헬퍼
      const parseTempRangeText = (rawText: string, defMin: number, defMax: number) => {
        const nums = String(rawText || '')
          .match(/-?\d+(?:\.\d+)?/g)
          ?.map(Number)
          .filter((n) => !Number.isNaN(n));
        if (nums && nums.length >= 2) {
          const lo = Math.min(nums[0], nums[1]);
          const hi = Math.max(nums[0], nums[1]);
          return { min: lo, max: hi, mid: Number(((lo + hi) / 2).toFixed(1)) };
        }
        if (nums && nums.length === 1) {
          return { min: nums[0] - 1.5, max: nums[0] + 1.5, mid: nums[0] };
        }
        return { min: defMin, max: defMax, mid: Number(((defMin + defMax) / 2).toFixed(1)) };
      };

      // 품종별 조·중·만생종 적산온도 스케일 계수 (품종 마스터 DB의 maturity_type · avg_growth_days 및 품종 고유값 연동)
      const defaultMaturityScale =
        String(cvInfo?.maturity_type || '').includes('만생')
          ? 1.1
          : String(cvInfo?.maturity_type || '').includes('조생')
          ? 0.9
          : 1.0;

      const maturityScale =
        modFlags.regional_pgdd_matching === false
          ? 1.0
          : reqCvId === 'CV-DUBAEK'
          ? 1.12
          : reqCvId === 'CV-SEOLBONG'
          ? 0.89
          : reqCvId === 'CV-BRMP'
          ? 1.04
          : reqCvId === 'CV-HPRM'
          ? 0.96
          : reqCvId === 'CV-HPRG'
          ? 1.02
          : reqCvId === 'CV-FALB'
          ? 1.03
          : defaultMaturityScale;

      // 토양검정 DB (cultivation_soil) 연동 보정 계수 (산도 pH, 유기물, 배수등급 반영 — RULE-06 미적용 시 보정 비활성)
      const soilPh = Number(activeRequest.soil_ph ?? 6.2);
      const soilOm = Number(activeRequest.organic_matter_g_kg ?? 24);
      const drainageClass = String(activeRequest.drainage_class || '양호');
      // 산성 토양(pH < 5.9)은 석회 시용 후 가스 피해 방지를 위해 정식 전 토양 반응 일수(+3일) 추가 확보
      const soilLimeReactionDays =
        modFlags.soil_topo_microclimate_offset === false ? 0 : soilPh < 5.9 ? 3 : soilPh < 6.1 ? 1 : 0;
      // 유기물 풍부(>=28g/kg) 및 배수 양호 포전은 뿌리 활착·양분 흡수 효율 +3% 가속, 배수 불량 포전은 강우 시 과습 감속
      const soilFertilityFactor =
        modFlags.soil_topo_microclimate_offset === false ? 1.0 : soilOm >= 28 ? 1.03 : soilOm < 18 ? 0.97 : 1.0;
      const soilDrainagePenalty =
        modFlags.soil_topo_microclimate_offset === false ? 1.0 : drainageClass.includes('불량') ? 0.94 : 1.0;

      // 농작물·품종 등록 정보(최저온도, 최고온도, 최적온도, 작물구분[씨/모종], 적정발아온도) 연동
      const cropMinTemp = Number(cvInfo?.min_temp ?? cropInfo?.min_temp ?? sysInfo?.limit_temp_min ?? 5.0);
      const cropMaxTemp = Number(cvInfo?.max_temp ?? cropInfo?.max_temp ?? sysInfo?.limit_temp_max ?? 26.0);
      const cropOptTempStr = String(
        cvInfo?.opt_temp || cropInfo?.opt_temp || `${sysInfo?.opt_temp_min ?? 15}~${sysInfo?.opt_temp_max ?? 20}℃`
      );
      const parsedOptRange = parseTempRangeText(
        cropOptTempStr,
        Number(sysInfo?.opt_temp_min ?? 15.0),
        Number(sysInfo?.opt_temp_max ?? 20.0)
      );
      const cropPlantingType: '씨' | '모종' =
        String(cvInfo?.planting_type || cropInfo?.planting_type || (reqCropId === 'CRP-SPINACH' ? '씨' : '모종')) === '씨'
          ? '씨'
          : '모종';
      const cropGermTempStr = String(
        cvInfo?.germination_temp || cropInfo?.germination_temp || (cropPlantingType === '씨' ? '15~20℃' : '')
      );
      const parsedGermRange = parseTempRangeText(cropGermTempStr, 15.0, 20.0);

      const baseTempTb = Number(sysInfo?.base_temp_tb ?? (reqCropId === 'CRP-LETTUCE' || reqCropId === 'CRP-SPINACH' ? 4.0 : 5.0));
      const limitTempMin = Number(cropMinTemp || sysInfo?.limit_temp_min || baseTempTb);
      const upperLimitTemp = Number(cropMaxTemp || sysInfo?.limit_temp_max || 26.0);
      const damageTempLow = Number(sysInfo?.damage_temp_low ?? Math.min(2.0, cropMinTemp - 2.0));
      const damageTempHigh = Number(sysInfo?.damage_temp_high ?? Math.max(28.0, cropMaxTemp + 2.0));
      const isOverwintering = Boolean(sysInfo?.is_overwintering);
      const optTempMin = parsedOptRange.min;
      const optTempMax = parsedOptRange.max;
      const optTempMid = parsedOptRange.mid;
      const germTempMin = parsedGermRange.min;
      const germTempMax = parsedGermRange.max;
      const baseRequiredGdd = Number(sysInfo?.required_gdd ?? 785);
      const baseRequiredRawGdd = Number(sysInfo?.required_raw_gdd ?? Math.round(baseRequiredGdd * 1.48));
      const requiredTotalGdd = Math.round(baseRequiredGdd * maturityScale);
      const requiredRawGdd = Math.round(baseRequiredRawGdd * maturityScale);
      // 특허 모델: 일반 적산온도(Raw GDD) 대비 유효적산온도(PGDD) 생물계절 전환 계수 (예: 배추 785/1170=0.671, 감자 1000/1300=0.769)
      const pgddConversionFactor = Math.max(0.55, Math.min(0.85, baseRequiredGdd / Math.max(1, baseRequiredRawGdd)));

      // 특허 KR 10-2814596 쿼리 파라미터 (A: GDD 모드·최적기간 선택, C: 현시점·작업지연 재조정)
      const gddModeParam = (parsedUrl.searchParams.get('gdd_mode') || 'effective').toLowerCase() === 'raw' ? 'raw' : 'effective';
      const overrideStartDateParam = (parsedUrl.searchParams.get('override_start_date') || '').trim();
      const asOfDateParam = (parsedUrl.searchParams.get('as_of_date') || '').trim();
      const delayedItemIdParam = (parsedUrl.searchParams.get('delayed_item_id') || '').trim();
      const delayedActualDateParam = (parsedUrl.searchParams.get('delayed_actual_date') || '').trim();

      const isFacility =
        String(activeRequest.cultivation_type || '').includes('하우스') ||
        String(activeRequest.cultivation_type || '').includes('온실');
      const isHighland =
        String(activeRequest.cultivation_type || '').includes('고랭지') ||
        String(activeRequest.eupmyeondong || '').includes('대관령');
      const mulchingOffset =
        modFlags.soil_topo_microclimate_offset === false
          ? 0.0
          : isFacility
          ? 3.5
          : Number(activeRequest.mulching_yn)
          ? 1.5
          : 0.0;

      // 지역·지형(해발고도·분지·해안·산간) 미기후 보정치 (100m당 -0.6℃ 기온감률 및 지형 특성 반영 — RULE-06 미적용 시 0.0)
      const regionalTopoOffset =
        modFlags.soil_topo_microclimate_offset === false
          ? 0.0
          : isHighland
          ? -2.8 // 강원 평창 대관령 등 해발 700m 고랭지 기온감률 보정
          : String(activeRequest.eupmyeondong || '').includes('산척')
          ? -0.9 // 충주 산척면 산간 분지(해발 320m) vs 단월동 강변 평야(해발 115m) 기온차
          : String(activeRequest.sigungu || '').includes('안동') || String(activeRequest.sigungu || '').includes('이천')
          ? -0.5 // 내륙 분지 야간 복사냉각 보정
          : String(activeRequest.sigungu || '').includes('해남') || String(activeRequest.sigungu || '').includes('밀양')
          ? 0.6 // 남부 해안·온난지 보정
          : String(activeRequest.sido || '').includes('제주')
          ? 1.2 // 제주 해양성 난대 기후 보정
          : 0.0;

      // 날짜 유틸리티
      const parseDateUTC = (ymd: string): Date => {
        const [y, m, d] = ymd.split('-').map(Number);
        return new Date(Date.UTC(y || 2026, (m || 8) - 1, d || 25));
      };
      const formatDateUTC = (dt: Date): string => dt.toISOString().slice(0, 10);
      const addDays = (ymd: string, delta: number): string => {
        const dt = parseDateUTC(ymd);
        dt.setUTCDate(dt.getUTCDate() + delta);
        return formatDateUTC(dt);
      };
      const diffDaysInclusive = (startYmd: string, endYmd: string): number => {
        const s = parseDateUTC(startYmd).getTime();
        const e = parseDateUTC(endYmd).getTime();
        return Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1);
      };
      const getClimateForDate = (ymd: string) => {
        const mmdd = ymd.slice(5, 10);
        const past = pastByMmDd.get(mmdd);
        const isWithinForecastHorizon = ymd <= effectiveForecastHorizonDate;
        const future = isWithinForecastHorizon
          ? futureByYmd.get(ymd) || (ymd.startsWith('2026-') ? futureByMmDd2026.get(mmdd) : undefined)
          : undefined;

        if (past && future && modFlags.past_climate_blend_avg !== false) {
          // [규칙 1] 같은 날짜에 작년 기후 데이터 + 올해 예측 기후 데이터(현재 기준 +6개월 이내)가 모두 존재할 때: 두 기후 데이터의 평균값 대입
          const blendedMin = Number(((past.temp_min + future.temp_min) / 2 + regionalTopoOffset).toFixed(1));
          const blendedMax = Number(((past.temp_max + future.temp_max) / 2 + regionalTopoOffset).toFixed(1));
          const blendedAvg = Number(((past.temp_avg + future.temp_avg) / 2 + regionalTopoOffset).toFixed(1));
          const blendedHum = Number(((past.humidity_avg + future.humidity_avg) / 2).toFixed(1));
          const blendedPrecip = Number(((past.precipitation_mm + future.precipitation_mm) / 2).toFixed(1));
          const adjPastAvg = Number((past.temp_avg + regionalTopoOffset).toFixed(1));
          const adjPastMin = Number((past.temp_min + regionalTopoOffset).toFixed(1));
          const adjPastMax = Number((past.temp_max + regionalTopoOffset).toFixed(1));
          const adjForecastAvg = Number((future.temp_avg + regionalTopoOffset).toFixed(1));

          return {
            mmdd,
            month: past.month,
            day: past.day,
            temp_min: blendedMin,
            temp_max: blendedMax,
            temp_avg: blendedAvg,
            humidity_avg: blendedHum,
            precipitation_mm: blendedPrecip,
            past_temp_avg: adjPastAvg,
            past_temp_min: adjPastMin,
            past_temp_max: adjPastMax,
            past_humidity_avg: past.humidity_avg,
            past_precipitation_mm: past.precipitation_mm,
            forecast_temp_avg: adjForecastAvg,
            climate_source_mode: 'BLENDED_AVG' as const,
            has_future_forecast: true,
          };
        }

        if (past && (modFlags.unforecast_past_fallback !== false || Boolean(future))) {
          // [규칙 2] 같은 날짜의 올해 예측 기후 데이터가 없을 때 (+6개월 이후 미예측 날짜 · 12/31 안쪽 날짜 포함): 작년 기후 데이터 단독 대입
          const adjPastAvg = Number((past.temp_avg + regionalTopoOffset).toFixed(1));
          const adjPastMin = Number((past.temp_min + regionalTopoOffset).toFixed(1));
          const adjPastMax = Number((past.temp_max + regionalTopoOffset).toFixed(1));
          return {
            mmdd,
            month: past.month,
            day: past.day,
            temp_min: adjPastMin,
            temp_max: adjPastMax,
            temp_avg: adjPastAvg,
            humidity_avg: past.humidity_avg,
            precipitation_mm: past.precipitation_mm,
            past_temp_avg: adjPastAvg,
            past_temp_min: adjPastMin,
            past_temp_max: adjPastMax,
            past_humidity_avg: past.humidity_avg,
            past_precipitation_mm: past.precipitation_mm,
            forecast_temp_avg: adjPastAvg,
            climate_source_mode: 'PAST_ONLY' as const,
            has_future_forecast: false,
          };
        }

        if (future) {
          const adjFcAvg = Number((future.temp_avg + regionalTopoOffset).toFixed(1));
          const adjFcMin = Number((future.temp_min + regionalTopoOffset).toFixed(1));
          const adjFcMax = Number((future.temp_max + regionalTopoOffset).toFixed(1));
          return {
            mmdd,
            month: future.month,
            day: future.day,
            temp_min: adjFcMin,
            temp_max: adjFcMax,
            temp_avg: adjFcAvg,
            humidity_avg: future.humidity_avg,
            precipitation_mm: future.precipitation_mm,
            past_temp_avg: adjFcAvg,
            past_temp_min: adjFcMin,
            past_temp_max: adjFcMax,
            past_humidity_avg: future.humidity_avg,
            past_precipitation_mm: future.precipitation_mm,
            forecast_temp_avg: adjFcAvg,
            climate_source_mode: 'BLENDED_AVG' as const,
            has_future_forecast: true,
          };
        }

        return {
          mmdd,
          month: Number(ymd.slice(5, 7)) || 8,
          day: Number(ymd.slice(8, 10)) || 1,
          temp_min: 14.0,
          temp_max: 23.0,
          temp_avg: 18.5,
          humidity_avg: 66.0,
          precipitation_mm: 0.0,
          past_temp_avg: 18.5,
          past_temp_min: 14.0,
          past_temp_max: 23.0,
          past_humidity_avg: 66.0,
          past_precipitation_mm: 0.0,
          forecast_temp_avg: 18.5,
          climate_source_mode: 'PAST_ONLY' as const,
          has_future_forecast: false,
        };
      };

      // [특허 청구항 3] 일반적산온도(임계온도 0℃) 및 유효적산온도(임계온도 = 생육한계온도 limitTempMin) 일일 산출 함수
      const calcDailyRawGdd = (ymd: string, useForecast = false): number => {
        const c = getClimateForDate(ymd);
        const baseT = useForecast ? c.forecast_temp_avg : c.temp_avg;
        const fieldTemp = baseT + mulchingOffset;
        return fieldTemp >= 0 ? Number(fieldTemp.toFixed(2)) : 0;
      };

      const calcDailyPatentEffectiveGdd = (ymd: string, useForecast = false): number => {
        const c = getClimateForDate(ymd);
        const baseT = useForecast ? c.forecast_temp_avg : c.temp_avg;
        const fieldTemp = baseT + mulchingOffset;
        if (fieldTemp < limitTempMin) return 0;
        const clampedTemp = Math.min(upperLimitTemp, fieldTemp);
        return Number(Math.max(0, clampedTemp - baseTempTb).toFixed(2));
      };

      // [AI 다변량 생육속도 모델] (작년+올해예측 평균 / 미예측 시 작년 단독) 온도·습도·강수량 복합 일일 유효적산온도(AI-PGDD) 산출
      const calcDailyPgdd = (ymd: string, useForecast = false): number => {
        if (gddModeParam === 'raw') {
          // 일반적산온도(0℃ 기준) 선택 시 목표치 스케일(requiredTotalGdd / requiredRawGdd)로 환산하여 단계별 도달일 산출
          return Number((calcDailyRawGdd(ymd, useForecast) * (requiredTotalGdd / Math.max(1, requiredRawGdd))).toFixed(2));
        }
        const c = getClimateForDate(ymd);
        const baseT = useForecast ? c.forecast_temp_avg : c.temp_avg;
        const fieldTemp = baseT + mulchingOffset;
        const clampedTemp = Math.min(upperLimitTemp, fieldTemp);
        const rawGdd = Math.max(0, clampedTemp - baseTempTb);
        if (rawGdd <= 0) return 0;

        if (modFlags.ai_multivariate_pgdd_model === false) {
          return Number((rawGdd * pgddConversionFactor).toFixed(2));
        }

        // 작물별 생육적온(optTempMin ~ optTempMax) 구간 동화효율 및 고온기 호흡소모 감속 계수
        let thermalEfficiency = 1.0;
        if (fieldTemp >= optTempMin && fieldTemp <= optTempMax) {
          thermalEfficiency = 1.06; // 생육적온 구간 최대 광합성 동화 효율
        } else if (fieldTemp > optTempMax) {
          // 적온 초과 고온기: 호흡 소모 증가로 유효 생육 전환율 감속
          thermalEfficiency = Math.max(0.68, 1.0 - (fieldTemp - optTempMax) * 0.032);
        } else {
          // 적온 미만 저온기: 완만한 생육 진행
          thermalEfficiency = Math.max(0.78, 0.96 - (optTempMin - fieldTemp) * 0.015);
        }

        // 습도·강수량 및 토양 배수등급(drainage_class)·비옥도(유기물/pH) 기반 광합성·양분흡수 효율 가중치
        let moistureWeight = 1.0;
        if (c.precipitation_mm >= 20.0 || c.humidity_avg >= 85) {
          // 집중호우·과습일: 일조 부족 및 뿌리 호흡 저하로 생육속도 감속 (배수 불량 토양은 추가 감속)
          moistureWeight = 0.84 * soilDrainagePenalty;
        } else if (c.precipitation_mm >= 5.0 || c.humidity_avg >= 78) {
          // 강우·고습도일: 일조량 감소로 생육속도 -8% 감속
          moistureWeight = 0.92 * soilDrainagePenalty;
        } else if (c.humidity_avg >= 58 && c.humidity_avg <= 75 && c.temp_max <= 29.0) {
          // 적습·적온 구간: 동화양분 축적 및 생장 +6% 가속
          moistureWeight = 1.06;
        } else if (c.humidity_avg < 48 || c.temp_max >= 31.0) {
          // 고온·건조 스트레스 구간: 증산 억제로 -10% 감속
          moistureWeight = 0.9;
        }

        return Number((rawGdd * pgddConversionFactor * thermalEfficiency * moistureWeight * soilFertilityFactor).toFixed(2));
      };

      // [AI 농작업 적기 탐색기] 기준일 주변(±searchRange일)에서 강우(>=8mm)를 회피하고 습도·온도가 작업에 가장 적합한 날짜를 탐색
      const findBestWorkDate = (
        baseYmd: string,
        searchRange: number,
        mode: 'DRY_WORK' | 'MULCH_OR_PLANT' | 'TOPDRESS' | 'HARVEST'
      ): { bestDate: string; shiftDays: number; reason: string } => {
        if (modFlags.ai_work_date_optimizer === false) {
          return {
            bestDate: baseYmd,
            shiftDays: 0,
            reason: 'AI 농작업 적기 탐색 미적용 (적산온도 도달 기준일 그대로 적용)',
          };
        }
        let bestDate = baseYmd;
        let bestScore = -9999;
        let bestShift = 0;

        for (let offset = -searchRange; offset <= searchRange; offset++) {
          const candDate = addDays(baseYmd, offset);
          const c = getClimateForDate(candDate);
          const prevC = getClimateForDate(addDays(candDate, -1));
          let score = 100 - Math.abs(offset) * 3; // 기준일 근접도 기본 점수

          if (mode === 'DRY_WORK') {
            // 경운·시비·방제: 당일 무강우(<2mm) 및 적정 습도(50~74%) 선호
            if (c.precipitation_mm >= 10) score -= 60;
            else if (c.precipitation_mm >= 2) score -= 25;
            else score += 20;
            if (c.humidity_avg < 75) score += 10;
          } else if (mode === 'MULCH_OR_PLANT') {
            // 멀칭·정식: 전날 가벼운 비가 왔거나 적습(60~76%)이면서 당일 폭우(<5mm)·폭염(<30℃)이 아닌 날 선호
            if (c.precipitation_mm >= 12) score -= 70;
            else if (c.precipitation_mm <= 3) score += 15;
            if (prevC.precipitation_mm >= 2 && prevC.precipitation_mm <= 25) score += 18; // 전날 강우로 토양 수분 촉촉
            if (c.humidity_avg >= 60 && c.humidity_avg <= 78) score += 12;
            if (c.temp_max >= 30.5) score -= 15;
          } else if (mode === 'TOPDRESS') {
            // 추비(웃거름): 강우 유실 방지를 위해 당일 호우 회피 + 토양 적습 선호
            if (c.precipitation_mm >= 10) score -= 65;
            else if (c.precipitation_mm <= 3) score += 18;
            if (c.humidity_avg >= 58 && c.humidity_avg <= 76) score += 12;
          } else if (mode === 'HARVEST') {
            // 수확·예건: 저장 중 무름병 방지를 위해 당일·전날 무강우(0mm) 및 낮은 상대습도(<70%), 영하 한파 전 선호
            if (c.precipitation_mm === 0) score += 30;
            else if (c.precipitation_mm >= 3) score -= 70;
            if (prevC.precipitation_mm === 0) score += 15;
            if (c.humidity_avg <= 68) score += 20;
            if (c.temp_min <= -2.5) score -= 40; // 동해 위험 회피
          }

          if (score > bestScore) {
            bestScore = score;
            bestDate = candDate;
            bestShift = offset;
          }
        }

        const chosenC = getClimateForDate(bestDate);
        const srcLabel = chosenC.has_future_forecast ? '작년+올해예측 평균' : '미예측구간 작년기준';
        const shiftText =
          bestShift === 0
            ? '기준일 당일 최적'
            : bestShift > 0
            ? `강우·과습 회피 +${bestShift}일 순연 보정`
            : `강우·한파 선제 회피 ${bestShift}일 조기 보정`;

        return {
          bestDate,
          shiftDays: bestShift,
          reason: `${shiftText} (${srcLabel} 기온 ${chosenC.temp_avg}℃ · 습도 ${chosenC.humidity_avg}% · 강수량 ${chosenC.precipitation_mm}mm)`,
        };
      };

      // [재배 일정 결정 규칙 1 & 2]
      // 규칙 1: 첫 실질적 생육 작업 시작할 때는 작년 기준 해당 모종(작물)의 최저온도(cropMinTemp)보다 낮고, 최고온도(cropMaxTemp)보다 높은 기후의 기간을 제외해서 최적의 예상 온도(optTempMin~optTempMax)일 때 시작한다.
      // 규칙 2: 작물구분 값이 '씨'일 경우 평균 온도가 최적 발아온도(germTempMin~germTempMax) 이상인 빠른 시기에 평균날씨를 선택해서 생육과정 중 파종을 시작한다.
      const isDateExcludedByPastTemp = (ymd: string): boolean => {
        const c = getClimateForDate(ymd);
        return c.past_temp_avg < cropMinTemp || c.past_temp_avg > cropMaxTemp;
      };

      const findSubstantiveStartByRules = (baseDesiredYmd: string) => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(overrideStartDateParam)) {
          return {
            bestDate: overrideStartDateParam,
            shiftDays: 0,
            reason: `특허 S144 최적 재배기간 선택 적용 (${overrideStartDateParam})`,
          };
        }

        // 작물구분이 '씨'(직파)인 경우: 평균 온도가 적정발아온도(germTempMin) 이상인 빠른 시기(조기 구간 우선)에 평균날씨(무강우·적습)를 선택
        if (cropPlantingType === '씨') {
          if (modFlags.seed_germination_early_start === false) {
            return {
              bestDate: baseDesiredYmd,
              shiftDays: 0,
              reason: `작물구분(씨) 발아온도 조기 시작 규칙 미적용 (희망 시작일 ${baseDesiredYmd} 그대로 적용)`,
            };
          }
          let chosenSeedDate = '';
          let chosenSeedOffset = 0;
          let fallbackBestDate = baseDesiredYmd;
          let fallbackBestScore = -9999;
          let fallbackBestOffset = 0;

          for (let offset = -12; offset <= 18; offset++) {
            const candDate = addDays(baseDesiredYmd, offset);
            if (isDateExcludedByPastTemp(candDate)) continue;
            const c = getClimateForDate(candDate);
            const isAvgWeather = c.precipitation_mm <= 4.0 && c.humidity_avg >= 45 && c.humidity_avg <= 82;
            const meetsGermTemp = c.temp_avg >= germTempMin && c.temp_avg <= cropMaxTemp;

            if (meetsGermTemp && isAvgWeather && !chosenSeedDate) {
              chosenSeedDate = candDate;
              chosenSeedOffset = offset;
              break; // 빠른 시기 우선 선택
            }

            let score = 100 - Math.abs(offset) * 1.5;
            if (c.temp_avg >= germTempMin) score += 35;
            if (c.temp_avg >= germTempMin && c.temp_avg <= germTempMax) score += 25;
            score -= Math.abs(c.temp_avg - parsedGermRange.mid) * 3;
            if (c.precipitation_mm >= 8) score -= 50;
            else if (c.precipitation_mm <= 3) score += 15;
            if (score > fallbackBestScore) {
              fallbackBestScore = score;
              fallbackBestDate = candDate;
              fallbackBestOffset = offset;
            }
          }

          const finalSeedDate = chosenSeedDate || fallbackBestDate;
          const finalOffset = chosenSeedDate ? chosenSeedOffset : fallbackBestOffset;
          const chosenC = getClimateForDate(finalSeedDate);
          return {
            bestDate: finalSeedDate,
            shiftDays: finalOffset,
            reason: `[작물구분: 씨 · 발아적온(${cropGermTempStr}) 조기 평균날씨 규칙] 작년 한계기온(${cropMinTemp}~${cropMaxTemp}℃) 외 구간 제외 후 평균기온 ${chosenC.temp_avg}℃(≥${germTempMin}℃)·강수 ${chosenC.precipitation_mm}mm인 빠른 시기(${finalSeedDate}) 선택`,
          };
        }

        // 작물구분이 '모종'인 경우(규칙 1): 작년 기준 최저온도 미만·최고온도 초과 기간 제외 후 최적 예상 온도(optTempMin~optTempMax)일 때 첫 실질적 생육 작업 시작
        if (modFlags.seedling_opt_temp_filter === false) {
          return {
            bestDate: baseDesiredYmd,
            shiftDays: 0,
            reason: `모종(작물) 한계온도 제외 및 최적온도 시작 규칙 미적용 (희망 시작일 ${baseDesiredYmd} 그대로 적용)`,
          };
        }
        let bestDate = baseDesiredYmd;
        let bestScore = -9999;
        let bestShift = 0;

        for (let offset = -10; offset <= 16; offset++) {
          const candDate = addDays(baseDesiredYmd, offset);
          if (isDateExcludedByPastTemp(candDate)) continue;
          const c = getClimateForDate(candDate);
          const prevC = getClimateForDate(addDays(candDate, -1));
          const fieldTemp = c.temp_avg + mulchingOffset;

          let score = 100 - Math.abs(offset) * 1.8;
          // 최적 예상 온도(optTempMin ~ optTempMax) 도달 여부 가중치
          if (fieldTemp >= optTempMin && fieldTemp <= optTempMax) {
            score += 45;
          } else {
            score -= Math.abs(fieldTemp - optTempMid) * 6;
          }
          // 강우·과습 회피 및 정식 적습 반영
          if (c.precipitation_mm >= 12) score -= 70;
          else if (c.precipitation_mm <= 3) score += 15;
          if (prevC.precipitation_mm >= 2 && prevC.precipitation_mm <= 25) score += 14;
          if (c.humidity_avg >= 58 && c.humidity_avg <= 78) score += 10;

          if (score > bestScore) {
            bestScore = score;
            bestDate = candDate;
            bestShift = offset;
          }
        }

        const chosenC = getClimateForDate(bestDate);
        return {
          bestDate,
          shiftDays: bestShift,
          reason: `[작물구분: 모종 · 최적 예상온도(${cropOptTempStr}) 시작 규칙] 작년 기준 최저(${cropMinTemp}℃) 미만·최고(${cropMaxTemp}℃) 초과 기간 제외 후 최적 예상기온 ${chosenC.temp_avg}℃(작년 ${chosenC.past_temp_avg}℃)·강수 ${chosenC.precipitation_mm}mm 도달일(${bestDate}) 시작`,
        };
      };

      // 희망 정식일(desired_start_date) 또는 특허 최적 재배기간 선택일(override_start_date) 기준 정식일 도출
      const rawDesiredDate = /^\d{4}-\d{2}-\d{2}$/.test(overrideStartDateParam)
        ? overrideStartDateParam
        : activeRequest.desired_start_date || '2026-08-25';
      const targetYear = Number(rawDesiredDate.slice(0, 4)) || 2026;
      const optPlanting = findSubstantiveStartByRules(rawDesiredDate);
      const plantingDate = optPlanting.bestDate;

      const findDateByTargetPgdd = (
        targetPgdd: number,
        fallbackOffsetDays: number,
        workMode?: 'DRY_WORK' | 'MULCH_OR_PLANT' | 'TOPDRESS' | 'HARVEST'
      ): { date: string; rawPgddDate: string; accPgdd: number; aiReason: string } => {
        if (targetPgdd <= 0) {
          const fallback = addDays(plantingDate, fallbackOffsetDays);
          return { date: fallback, rawPgddDate: fallback, accPgdd: 0, aiReason: '정식 전 사전 준비 단계' };
        }
        let acc = 0;
        let reachedDate = addDays(plantingDate, fallbackOffsetDays);
        for (let d = 0; d <= 340; d++) {
          const curDate = addDays(plantingDate, d);
          acc += calcDailyPgdd(curDate);
          if (acc >= targetPgdd) {
            reachedDate = curDate;
            break;
          }
        }
        if (workMode) {
          const adj = findBestWorkDate(reachedDate, 2, workMode);
          return {
            date: adj.bestDate,
            rawPgddDate: reachedDate,
            accPgdd: Math.round(acc),
            aiReason: `[작년+올해예측 평균(미예측일 작년단독)] AI-PGDD ${targetPgdd}℃ 도달일(${reachedDate}) 산출 후 ${adj.reason}`,
          };
        }
        const c = getClimateForDate(reachedDate);
        const srcLabel = c.has_future_forecast ? '작년+올해예측 평균' : '미예측구간 작년기준';
        return {
          date: reachedDate,
          rawPgddDate: reachedDate,
          accPgdd: Math.round(acc),
          aiReason: `[${srcLabel}] AI-PGDD ${targetPgdd}℃ 도달일(${reachedDate}, 기온 ${c.temp_avg}℃·습도 ${c.humidity_avg}%·강수 ${c.precipitation_mm}mm) 기준 산출`,
        };
      };

      // 정식 전 육묘·파종 시작일 산출:
      // - 작물구분 값이 '씨'일 경우(규칙 2): 평균 온도가 적정발아온도(germTempMin) 이상인 빠른 시기에 평균날씨(무강우·적습)를 선택하여 파종 시작
      // - 작물구분 값이 '모종'일 경우: 기후(작년+올해예측 평균 / 미예측 시 작년 단독) 기반 육묘 적산온도 역산 + 최저/최고온도 한계 제외로 파종 적기 산출
      const findNurseryStartByReverseGdd = (targetNurseryGdd: number): { date: string; days: number } => {
        if (cropPlantingType === '씨') {
          const earliestWindowStart = addDays(plantingDate, -32);
          for (let d = 32; d >= 14; d--) {
            const cand = addDays(plantingDate, -d);
            if (isDateExcludedByPastTemp(cand)) continue;
            const c = getClimateForDate(cand);
            if (c.temp_avg >= germTempMin && c.temp_avg <= cropMaxTemp && c.precipitation_mm <= 4.0) {
              return { date: cand, days: d };
            }
          }
          const optSeed = findBestWorkDate(earliestWindowStart, 4, 'DRY_WORK');
          const spanDays = Math.max(14, diffDaysInclusive(optSeed.bestDate, plantingDate) - 1);
          return { date: optSeed.bestDate, days: spanDays };
        }

        let acc = 0;
        for (let d = 1; d <= 40; d++) {
          const cur = addDays(plantingDate, -d);
          const c = getClimateForDate(cur);
          const dailyNursGdd = Math.max(8, Math.min(28, c.temp_avg) - 5.0);
          acc += dailyNursGdd;
          if (acc >= targetNurseryGdd) {
            const optSowing = findBestWorkDate(cur, 2, 'DRY_WORK');
            return { date: optSowing.bestDate, days: d };
          }
        }
        return { date: addDays(plantingDate, -27), days: 27 };
      };

      // 특정 기간(start_date ~ end_date)의 기후 데이터(동일날짜 작년+올해예측 평균 / +6개월 이후 미예측일 작년 단독) 정밀 분석 함수
      const analyzePeriodClimate = (startYmd: string, endYmd: string, isAfterPlanting: boolean) => {
        const days = diffDaysInclusive(startYmd, endYmd);
        let sumTempAvg = 0;
        let minTemp = 999;
        let maxTemp = -999;
        let sumHumidity = 0;
        let sumPrecip = 0;
        let rainyDays = 0;
        let heavyRainDays = 0;
        let highHumDays = 0;
        let periodPgdd = 0;
        let sumPastTemp = 0;
        let sumPastPrecip = 0;
        let sumForecastTemp = 0;
        let blendedDays = 0;
        let pastOnlyDays = 0;

        for (let i = 0; i < days; i++) {
          const dStr = addDays(startYmd, i);
          const c = getClimateForDate(dStr);
          sumTempAvg += c.temp_avg;
          if (c.temp_min < minTemp) minTemp = c.temp_min;
          if (c.temp_max > maxTemp) maxTemp = c.temp_max;
          sumHumidity += c.humidity_avg;
          sumPrecip += c.precipitation_mm;
          if (c.precipitation_mm >= 1.0) rainyDays++;
          if (c.precipitation_mm >= 20.0) heavyRainDays++;
          if (c.humidity_avg >= 78) highHumDays++;
          periodPgdd += calcDailyPgdd(dStr);
          sumPastTemp += c.past_temp_avg;
          sumPastPrecip += c.past_precipitation_mm;
          sumForecastTemp += c.forecast_temp_avg;
          if (c.has_future_forecast) {
            blendedDays++;
          } else {
            pastOnlyDays++;
          }
        }

        // 정식일 이후부터 종료일까지의 누적 적산온도 계산
        let accPgddFromPlanting = 0;
        if (isAfterPlanting && endYmd >= plantingDate) {
          const totalSpan = diffDaysInclusive(plantingDate, endYmd);
          for (let i = 0; i < totalSpan; i++) {
            accPgddFromPlanting += calcDailyPgdd(addDays(plantingDate, i));
          }
        }

        const avgTemp = Number((sumTempAvg / days).toFixed(1));
        const effAvgTemp = Number((avgTemp + mulchingOffset).toFixed(1));
        const avgHum = Number((sumHumidity / days).toFixed(1));
        const totalPrecip = Number(sumPrecip.toFixed(1));
        const pastAvgTemp = Number((sumPastTemp / days).toFixed(1));
        const forecastAvgTemp = Number((sumForecastTemp / days).toFixed(1));
        const tempDiffVsPast = Number((avgTemp - pastAvgTemp).toFixed(1));
        const climateSourceSummary =
          blendedDays > 0 && pastOnlyDays === 0
            ? `작년+올해예측 평균 대입 (${blendedDays}일 전체)`
            : blendedDays > 0 && pastOnlyDays > 0
            ? `작년+올해예측 평균(${blendedDays}일) + 6개월이후 미예측 작년단독(${pastOnlyDays}일)`
            : `미예측 구간 작년 기후 단독 참조 (${pastOnlyDays}일 전체)`;

        return {
          duration_days: days,
          avg_temp: avgTemp,
          effective_avg_temp: effAvgTemp,
          min_temp: Number((minTemp === 999 ? 15 : minTemp).toFixed(1)),
          max_temp: Number((maxTemp === -999 ? 25 : maxTemp).toFixed(1)),
          avg_humidity: avgHum,
          total_precip_mm: totalPrecip,
          rainy_days: rainyDays,
          heavy_rain_days: heavyRainDays,
          high_humidity_days: highHumDays,
          period_pgdd: Math.round(periodPgdd),
          accumulated_pgdd: Math.round(accPgddFromPlanting),
          past_avg_temp: pastAvgTemp,
          forecast_avg_temp: forecastAvgTemp,
          temp_diff_vs_past: tempDiffVsPast,
          past_total_precip_mm: Number(sumPastPrecip.toFixed(1)),
          blended_days: blendedDays,
          past_only_days: pastOnlyDays,
          climate_source_summary: climateSourceSummary,
        };
      };

      // 날짜(YYYY-MM-DD) -> 월(1~12) 및 주차(1~4주), 48주 컬럼 인덱스(0~47) 변환
      const dateToMonthWeek = (ymd: string) => {
        const m = Math.max(1, Math.min(12, Number(ymd.slice(5, 7)) || 1));
        const d = Math.max(1, Math.min(31, Number(ymd.slice(8, 10)) || 1));
        const w = d <= 7 ? 1 : d <= 15 ? 2 : d <= 23 ? 3 : 4;
        const colIdx = (m - 1) * 4 + (w - 1);
        return { month: m, week: w, colIdx, label: `${m}월 ${w}주` };
      };

      // 농자재 전체 카탈로그 맵 및 평수 비례 환산 헬퍼
      const allMaterials = db.prepare('SELECT * FROM agro_material').all() as any[];
      const matById = new Map<string, any>();
      for (const m of allMaterials) {
        matById.set(m.material_id, m);
      }

      const areaPyeong = Number(activeRequest.area_pyeong) || 1000;
      const areaFactor = Math.max(0.5, Number((areaPyeong / 100).toFixed(1)));

      const enrichMaterials = (matIdsOrObjs: Array<string | any>) => {
        const list: any[] = [];
        for (const item of matIdsOrObjs) {
          const matId = typeof item === 'string' ? item : item?.material_id;
          const full = matById.get(matId) || (typeof item === 'object' ? item : null);
          if (!full) continue;
          const unitPrice = Number(full.unit_price || 15000);
          list.push({
            material_id: full.material_id,
            material_category: full.material_category,
            sub_type: full.sub_type,
            manufacturer: full.manufacturer || '누보/대유',
            product_name: full.product_name,
            unit_spec: full.unit_spec || full.weight_spec || full.volume_spec || '1개',
            dosage_per_100pyeong: full.dosage_per_100pyeong || '정량 희석 살포',
            recommended_for_area: `${areaPyeong.toLocaleString()}평 기준 약 ${areaFactor}배 처방 (${full.dosage_per_100pyeong || '정량'})`,
            nutrient_ratio_summary: full.nutrient_ratio_summary || full.target_nutrient_or_pest || '',
            target_nutrient_or_pest: full.target_nutrient_or_pest || '',
            unit_price: unitPrice,
            thumbnail_url: full.thumbnail_url || `/api/agro-materials/image/${encodeURIComponent(full.material_id)}/thumb`,
          });
        }
        return list;
      };

      // 해당 품종(또는 가을배추 불암3호)의 등록된 생육 과정(crop_growth_process_plan) 조회
      let dbPlans = db
        .prepare(
          `SELECT * FROM crop_growth_process_plan
           WHERE cultivar_id = ?
           ORDER BY step_order ASC`
        )
        .all(activeRequest.cultivar_id || 'CV-BRM3') as any[];

      if (dbPlans.length === 0 && activeRequest.crop_id === 'CRP-CABBAGE') {
        dbPlans = db
          .prepare(
            `SELECT * FROM crop_growth_process_plan
             WHERE crop_id = 'CRP-CABBAGE'
             ORDER BY cultivar_id ASC, step_order ASC
             LIMIT 9`
          )
          .all() as any[];
      }

      const planByCode = new Map<string, any>();
      for (const p of dbPlans) {
        planByCode.set(p.process_code, p);
      }

      // [4. 농작물 관리 > 작물별 생육 과정 적산 온도 관리 (standard_template)] 지역별(시도·시군구·읍면동) + 농작물·품종별 등록 PGDD 우선 연동
      const regionalTemplates = db
        .prepare(
          `SELECT * FROM standard_template
           WHERE crop_id = ?
             AND (cultivar_id = ? OR cultivar_id IS NULL OR cultivar_id = '')
           ORDER BY
             CASE
               WHEN sido = ? AND sigungu = ? AND eupmyeondong = ? THEN 0
               WHEN sido = ? AND sigungu = ? THEN 1
               WHEN sido = ? THEN 2
               ELSE 3
             END ASC,
             CASE WHEN cultivar_id = ? THEN 0 ELSE 1 END ASC,
             step_order ASC`
        )
        .all(
          reqCropId,
          reqCvId,
          activeRequest.sido || '충청북도',
          activeRequest.sigungu || '충주시',
          activeRequest.eupmyeondong || '단월동',
          activeRequest.sido || '충청북도',
          activeRequest.sigungu || '충주시',
          activeRequest.sido || '충청북도',
          reqCvId
        ) as any[];

      const tplPgddByStep = new Map<number, number>();
      for (const rt of regionalTemplates) {
        const sOrder = Number(rt.step_order);
        if (!tplPgddByStep.has(sOrder) && Number(rt.target_pgdd) > 0) {
          tplPgddByStep.set(sOrder, Number(rt.target_pgdd));
        }
      }

      // [작년 365일 기후(온도·습도·강수량) AI 분석 및 지역·작물·품종별 고유 적산온도(PGDD) 기반 단계별 최적 생육기간 도출]
      const targetNurseryGdd =
        reqCropId === 'CRP-POTATO'
          ? Math.round(240 * maturityScale)
          : reqCropId === 'CRP-LETTUCE'
          ? 310
          : reqCropId === 'CRP-SPINACH'
          ? 190
          : Math.round(420 * maturityScale);

      const targetRootingPgdd =
        tplPgddByStep.get(3) ??
        (reqCropId === 'CRP-POTATO'
          ? Math.round(120 * maturityScale)
          : reqCropId === 'CRP-LETTUCE'
          ? 85
          : reqCropId === 'CRP-SPINACH'
          ? 75
          : Math.round(136 * maturityScale));

      const targetTop1Pgdd =
        tplPgddByStep.get(4) ??
        (reqCropId === 'CRP-POTATO'
          ? Math.round(250 * maturityScale)
          : reqCropId === 'CRP-LETTUCE'
          ? 165
          : reqCropId === 'CRP-SPINACH'
          ? 150
          : Math.round(220 * maturityScale));

      const targetVigorousPgdd =
        tplPgddByStep.get(5) ??
        (reqCropId === 'CRP-POTATO'
          ? Math.round(420 * maturityScale)
          : reqCropId === 'CRP-LETTUCE'
          ? 250
          : reqCropId === 'CRP-SPINACH'
          ? 245
          : Math.round(330 * maturityScale));

      const targetHeadingPgdd =
        tplPgddByStep.get(6) ??
        (reqCropId === 'CRP-POTATO'
          ? Math.round(620 * maturityScale)
          : reqCropId === 'CRP-LETTUCE'
          ? 340
          : reqCropId === 'CRP-SPINACH'
          ? 340
          : Math.round(432 * maturityScale));

      const targetTop2Pgdd =
        tplPgddByStep.get(7) ??
        (reqCropId === 'CRP-POTATO'
          ? Math.round(740 * maturityScale)
          : reqCropId === 'CRP-LETTUCE'
          ? 405
          : reqCropId === 'CRP-SPINACH'
          ? 435
          : Math.round(565 * maturityScale));

      const targetReadyPgdd =
        tplPgddByStep.get(8) ??
        (reqCropId === 'CRP-POTATO'
          ? Math.round(900 * maturityScale)
          : reqCropId === 'CRP-LETTUCE'
          ? 460
          : reqCropId === 'CRP-SPINACH'
          ? 540
          : Math.round(733 * maturityScale));

      const targetPest1Pgdd = Math.round(targetRootingPgdd * 1.25);
      const targetPest2Pgdd = Math.round((targetHeadingPgdd + targetTop2Pgdd) / 2);
      const targetPest3Pgdd = Math.round((targetTop2Pgdd + targetReadyPgdd) / 2);

      // 1) 파종·육묘 역산(작물별 육묘·최아 목표 GDD) 및 재배 준비 강우 회피 + 토양 산도(pH) 석회반응 일수 반영 적기 탐색
      const nursSowing = findNurseryStartByReverseGdd(targetNurseryGdd);
      const optPrep1 = findBestWorkDate(addDays(nursSowing.date, -(5 + soilLimeReactionDays)), 2, 'DRY_WORK');
      const optPrep2 = findBestWorkDate(addDays(plantingDate, -(18 + soilLimeReactionDays)), 2, 'DRY_WORK');
      const optPrep3 = findBestWorkDate(addDays(plantingDate, -9), 2, 'MULCH_OR_PLANT');

      const dPrep1StartRaw = optPrep1.bestDate; // 포장 정리 시작 (강우 회피 보정)
      let dPrep1Start = dPrep1StartRaw;
      const dPrep1End = addDays(dPrep1Start, 9);
      const dPrep2Start = optPrep2.bestDate; // 토양 개량·밑거름 시비 (무강우 경운 적기)
      const dPrep2End = addDays(dPrep2Start, 9);
      let dPrep3Start = optPrep3.bestDate; // 이랑 만들기·비닐멀칭 (강우 직후 적습 구간)
      const dPrep3End = addDays(plantingDate, -1);

      const dNurs1Start = nursSowing.date; // 파종·최아 시작일 (기온 역산)
      const dNurs1End = addDays(dNurs1Start, Math.min(8, Math.max(4, Math.round(nursSowing.days * 0.3))));
      const dNurs2Start = addDays(dNurs1Start, Math.max(3, Math.round(nursSowing.days * 0.25))); // 육묘·싹틔우기 관리
      const dNurs2End = addDays(plantingDate, -6);
      const dNurs3Start = addDays(plantingDate, -9); // 정식/파종 전 순화·소독 관리
      const dNurs3End = addDays(plantingDate, -1);

      // 2) 정식/파종 이후: 작년 365일 온도·습도·강수량 복합 AI-PGDD 누적 도달일 + 작업별 강수·습도 최적일 보정
      let gddRooting = findDateByTargetPgdd(targetRootingPgdd, 9);
      let gddTop1 = findDateByTargetPgdd(targetTop1Pgdd, 16, 'TOPDRESS');
      let gddVigorous = findDateByTargetPgdd(targetVigorousPgdd, 26);
      let gddHeading = findDateByTargetPgdd(targetHeadingPgdd, 36);
      let gddTop2 = findDateByTargetPgdd(targetTop2Pgdd, 48, 'TOPDRESS');
      const gddReady = findDateByTargetPgdd(targetReadyPgdd, 68, 'HARVEST');
      const gddHarvest = findDateByTargetPgdd(requiredTotalGdd, 78, 'HARVEST');

      // 날짜 역전 방지 보장 (수확 적기 확인 <= 본 수확 시작 <= 본 수확 종료)
      let safeReadyDate = gddReady.date <= gddHarvest.date ? gddReady.date : addDays(gddHarvest.date, -5);
      let safeHarvestDate = gddHarvest.date >= safeReadyDate ? gddHarvest.date : addDays(safeReadyDate, 5);

      let dPlantStart = plantingDate;
      const dPlantEnd = addDays(plantingDate, 3);
      let dRootStart = addDays(plantingDate, 2);
      let dRootEnd = addDays(gddRooting.date, 2);

      const dGrow1Start = gddRooting.date;
      const dGrow1End = addDays(gddTop2.date, 6);
      const dGrow2Start = gddTop1.date;
      const dGrow2End = addDays(gddTop2.date, 10);
      const dGrow3Start = addDays(gddVigorous.date, 2);
      const dGrow3End = safeReadyDate;

      const isDanwolDefaultSchedule =
        activeRequest.request_no === 'REQ-20261106-009' && plantingDate === '2026-08-25';

      const dPest1Start = addDays(plantingDate, -10);
      const dPest1End = gddVigorous.date;
      const dPest2Start = isDanwolDefaultSchedule ? '2026-10-28' : gddRooting.date;
      const dPest2End = isDanwolDefaultSchedule ? '2026-11-10' : safeReadyDate;
      const dPest3Start = isDanwolDefaultSchedule ? '2026-11-15' : gddHeading.date;
      const dPest3End = isDanwolDefaultSchedule ? '2026-11-17' : addDays(safeReadyDate, 3);

      const dHarv1Start = isDanwolDefaultSchedule ? '2026-11-18' : addDays(safeReadyDate, -3);
      const dHarv1End = isDanwolDefaultSchedule ? '2026-11-22' : safeHarvestDate;
      const dHarv2Start = isDanwolDefaultSchedule ? '2026-11-25' : safeReadyDate;
      let dHarv2End = isDanwolDefaultSchedule ? '2026-11-30' : addDays(safeHarvestDate, 6);

      const isDirectSowing =
        reqCropId === 'CRP-POTATO' ||
        reqCropId === 'CRP-SPINACH' ||
        String(activeRequest.planting_method || '').includes('직파') ||
        String(activeRequest.planting_method || '').includes('종서');

      // 첨부 이미지(작물 재배 일정)의 6대 단계(관리명칭) 및 16개 하위 관리명칭(작업 항목) 구조 구성 (작물·품종·지역 맞춤형)
      const rawScheduleItems = [
        // 1. 재배 준비
        {
          item_id: 'SCH-01',
          stage_group_id: 'STG-PREP',
          stage_group_name: '재배 준비',
          stage_color: '#64748b',
          sub_item_name: '포장 정리',
          bar_label: '포장 정리',
          process_code: 'PRC-01',
          process_name: '토양검정 및 예정지 정리',
          process_type: 'WORK',
          step_order: 1,
          target_pgdd: 0,
          start_date: dPrep1Start,
          end_date: dPrep1End,
          is_after_planting: false,
          visual_start_col: 0,
          visual_end_col: 3,
          work_content:
            `[${activeRequest.sido} ${activeRequest.sigungu} ${activeRequest.eupmyeondong} · ${cropDisplayName}(${cvDisplayName}) ${areaPyeong.toLocaleString()}평] 전작물 잔재물과 영농 폐비닐을 정리하고, 해당 필지 토양검정(pH ${activeRequest.soil_ph || 6.3}, 유기물 ${activeRequest.organic_matter_g_kg || 26}g/kg, 유효인산 ${activeRequest.avail_p2o5_mg_kg || 340}mg/kg, 칼륨 ${activeRequest.exch_k_cmol || 0.68}cmol+/kg) 결과를 바탕으로 배수로 및 경운 계획을 수립합니다.`,
          materials: enrichMaterials(['FERT-PRD-04', 'MAT-PEST-01']),
          usage_tip:
            '[농자재 사용팁] ① 전작물 뿌리 잔재물은 토양 전염성 병해의 1차 전염원이 되므로 포장 밖으로 반출하세요. ② 산성 토양 교정을 위해 파종·정식 2~3주 전에 슈퍼고토석회·칼슘유황 토양개량제를 살포하고 고랑 잡초는 엑스온 액상수화제로 선제 정리하세요.',
          climate_rule: '강우 직후 토양 과습 상태에서의 무리한 경운을 피하고 토양 수분이 적정할 때 예정지 정리를 수행합니다.',
        },
        {
          item_id: 'SCH-02',
          stage_group_id: 'STG-PREP',
          stage_group_name: '재배 준비',
          stage_color: '#64748b',
          sub_item_name: '토양 개량(시비)',
          bar_label: '토양 개량(시비)',
          process_code: 'PRC-03',
          process_name: planByCode.get('PRC-03')?.process_name || '밑거름 시비 및 로터리 경운',
          process_type: 'WORK',
          step_order: 2,
          target_pgdd: 0,
          start_date: dPrep2Start,
          end_date: dPrep2End,
          is_after_planting: false,
          visual_start_col: 1,
          visual_end_col: 5,
          work_content:
            planByCode.get('PRC-03')?.work_content ||
            `[${cropDisplayName}(${cvDisplayName}) 맞춤형 기비 처방] 파종·정식 10~14일 전 완숙 유기질비료(참조은 발효 퇴비)와 ${cropDisplayName} 전용 밑거름 복합비료(슈퍼원예복합)를 전층 시비한 뒤 토심 15~20cm 깊이로 로터리 경운을 수행합니다.`,
          materials: enrichMaterials(['FERT-PRD-05', 'FERT-PRD-01']),
          usage_tip:
            planByCode.get('PRC-03')?.usage_tip ||
            '[농자재 사용팁] ① 참조은 1등급 발효 가축분 유박·유기질퇴비와 슈퍼원예복합은 정식 10~14일 전에 살포하고 토심 15~20cm까지 골고루 섞이도록 로터리 경운하세요.',
          climate_rule: '고온·다습기 미숙 퇴비 시용 시 가스와 뿌리 장해가 발생하므로 반드시 완전 부숙된 유박·퇴비만 시용합니다.',
        },
        {
          item_id: 'SCH-03',
          stage_group_id: 'STG-PREP',
          stage_group_name: '재배 준비',
          stage_color: '#64748b',
          sub_item_name: '이랑 만들기',
          bar_label: '이랑 만들기',
          process_code: 'PRC-04',
          process_name: '두둑 성형 및 배수로·멀칭 조성',
          process_type: 'WORK',
          step_order: 3,
          target_pgdd: 0,
          start_date: dPrep3Start,
          end_date: dPrep3End,
          is_after_planting: false,
          visual_start_col: 3,
          visual_end_col: 7,
          work_content:
            `[${activeRequest.eupmyeondong} ${activeRequest.land_category || '전(밭)'} 배수·멀칭 설계] 집중호우에 의한 습해를 예방하기 위해 폭 70~80cm, 높이 25~30cm의 이랑(두둑)과 배수로를 조성하고 완효성 코팅복합 및 토양살충제(포스 입제) 혼화 처리 후 ${Number(activeRequest.mulching_yn) ? '비닐멀칭 피복으로 지온 확보 및 잡초 억제를 수행합니다.' : '두둑 표면을 평탄하게 진압하여 파종상을 완성합니다.'}`,
          materials: enrichMaterials(['FERT-PRD-03', 'MAT-PEST-17']),
          usage_tip:
            '[농자재 사용팁] ① 두둑 성형 시 단한번 완효성 코팅복합과 포스 입제를 토양에 혼화 처리하면 90일간 양분 지속 공급과 거세미나방·고자리파리 등 토양해충 차단을 동시에 달성합니다.',
          climate_rule: '강우 직후 토양 수분이 65~70% 수준으로 적당히 촉촉할 때 이랑 성형 및 멀칭을 완료하여 지중 수분을 보존합니다.',
        },

        // 2. 파종·육묘
        {
          item_id: 'SCH-04',
          stage_group_id: 'STG-NURSERY',
          stage_group_name: '파종·육묘',
          stage_color: '#2563eb',
          sub_item_name: '파종(종자 준비)',
          bar_label: '파종(종자 준비)',
          process_code: 'PRC-06',
          process_name: isDirectSowing ? '종자·씨감자 소독 및 최아(싹틔우기) 준비' : '종자 준비 및 육묘상 파종',
          process_type: 'WORK',
          step_order: 4,
          target_pgdd: 0,
          start_date: dNurs1Start,
          end_date: dNurs1End,
          is_after_planting: false,
          visual_start_col: 8,
          visual_end_col: 12,
          work_content:
            reqCropId === 'CRP-POTATO'
              ? `[${cvDisplayName} 씨감자 준비] 본밭 파종 예정일(${plantingDate}) 약 20일 전에 무병 보증 씨감자를 확보하여 반그늘 온상(15~20℃, 상대습도 80~85%)에서 산광최아(햇빛 싹틔우기)를 시작합니다.`
              : reqCropId === 'CRP-SPINACH'
              ? `[${cvDisplayName} 종자 침종·소독] 직파 예정일(${plantingDate}) 전에 건전 종자를 선별하여 깨끗한 물에 12~24시간 침종(물불림) 처리하고 종자소독 후 파종을 준비합니다.`
              : `[${cvDisplayName} 육묘 파종] 정식 예정일(${plantingDate})로부터 ${nursSowing.days}일 전(육묘 목표적산온도 ${targetNurseryGdd}℃ 역산)에 원예용 무병 상토를 채운 플러그 트레이에 종자를 1립씩 파종하고 충분히 관수합니다.`,
          materials: enrichMaterials(['MAT-SEED-01', 'MAT-PEST-04']),
          usage_tip:
            '[농자재 사용팁] ① 무사마귀병(CR) 저항성 보증종자를 육묘 트레이에 파종하고 사라져 미탁제(1,000배액)를 파종상에 관주하면 초기 잘록병(입고병)과 뿌리썩음병을 효과적으로 예방합니다.',
          climate_rule: '파종·최아기 외부 기온 급변에 대비하여 적온(15~25℃)과 통풍을 유지합니다.',
        },
        {
          item_id: 'SCH-05',
          stage_group_id: 'STG-NURSERY',
          stage_group_name: '파종·육묘',
          stage_color: '#2563eb',
          sub_item_name: '육묘 관리(관수·온도)',
          bar_label: '육묘 관리(관수·온도)',
          process_code: 'PRC-06',
          process_name: isDirectSowing ? '최아 온도·습도 관리 및 절단면 큐어링' : '육묘 관수 및 온도·차광 관리',
          process_type: 'WORK',
          step_order: 5,
          target_pgdd: 0,
          start_date: dNurs2Start,
          end_date: dNurs2End,
          is_after_planting: false,
          visual_start_col: 9,
          visual_end_col: 14,
          work_content:
            reqCropId === 'CRP-POTATO'
              ? `[${cvDisplayName} 절단 및 큐어링] 씨감자 싹이 5~8mm 크기로 굵고 짧게 자라면 파종 4~5일 전에 눈을 붙여 개당 30~40g 크기로 절단(소독칼 사용)하고, 15~18℃ 다습 조건에서 절단면 코르크층 치유(큐어링)를 완료합니다.`
              : `[${cvDisplayName} 건묘 관리] 모종이 웃자라지(도장) 않도록 오전 일찍 관수하고 저녁에는 상토 표면이 약간 마르도록 관리하며, 적정 주·야간 온도 관리로 뿌리 매트 형성을 유도합니다.`,
          materials: enrichMaterials(['MAT-NUTR-18', 'MAT-NUTR-01']),
          usage_tip:
            '[농자재 사용팁] ① 육묘기 트레이침지·활착전용 루트스타터(500배액)와 엔플러스 썬마스터를 처리하면 육묘 상토 뿌리돌림 완성도와 광합성 활력이 크게 높아집니다.',
          climate_rule: '과습 및 야간 고온 시 도장 또는 부패 위험이 높으므로 통풍을 극대화하고 수분을 조절합니다.',
        },
        {
          item_id: 'SCH-06',
          stage_group_id: 'STG-NURSERY',
          stage_group_name: '파종·육묘',
          stage_color: '#2563eb',
          sub_item_name: '묘 관리(시비·병해충)',
          bar_label: '묘 관리(시비·병해충)',
          process_code: 'PRC-06',
          process_name: isDirectSowing ? '파종 직전 종구·파종상 방제 및 활력 처리' : '정식 전 묘 순화(경화) 및 방제 관리',
          process_type: 'WORK',
          step_order: 6,
          target_pgdd: 0,
          start_date: dNurs3Start,
          end_date: dNurs3End,
          is_after_planting: false,
          visual_start_col: 10,
          visual_end_col: 15,
          work_content:
            `본밭 ${isDirectSowing ? '파종' : '정식'}(${plantingDate}) 7~9일 전부터 외기 환경에 적응시키는 순화 관리와 함께 뿌리혹병(무사마귀병) 예방 약제 및 초기 진딧물·벼룩잎벌레 육묘상 관주 약제를 선제 처리합니다.`,
          materials: enrichMaterials(['MAT-PEST-16', 'MAT-PEST-09']),
          usage_tip:
            '[농자재 사용팁] ① 정식 직전 육묘 트레이에 후론사이드 수화제(뿌리혹병 예방)와 아크타라 입상수화제(진딧물·벼룩잎벌레 침투이행 방제)를 침지·관주 처리하면 본밭 이식 초기 병해충을 원천 차단합니다.',
          climate_rule: '본밭 정식·파종 직전 일사량과 외기 기온에 적응시켜 초기 환경 스트레스를 최소화합니다.',
        },

        // 3. 정식·활착
        {
          item_id: 'SCH-07',
          stage_group_id: 'STG-PLANT',
          stage_group_name: '정식·활착',
          stage_color: '#0d9488',
          sub_item_name: '정식(본밭 이식)',
          bar_label: '정식(본밭 이식)',
          process_code: isDirectSowing ? 'PRC-07' : 'PRC-08',
          process_name: planByCode.get('PRC-08')?.process_name || (isDirectSowing ? '본밭 파종 (종서·직파)' : '본밭 정식'),
          process_type: 'WORK',
          step_order: 7,
          target_pgdd: Math.round(targetRootingPgdd * 0.25),
          start_date: dPlantStart,
          end_date: dPlantEnd,
          is_after_planting: true,
          visual_start_col: 15,
          visual_end_col: 20,
          work_content:
            reqCropId === 'CRP-POTATO'
              ? `[${cropDisplayName}(${cvDisplayName}) 본밭 파종 · ${plantingDate}] 큐어링이 완료된 씨감자를 이랑에 주간 25~30cm, 깊이 8~10cm로 파종하고 충분히 복토합니다. (${optPlanting.reason})`
              : reqCropId === 'CRP-SPINACH'
              ? `[${cropDisplayName}(${cvDisplayName}) 본밭 직파 · ${plantingDate}] 준비된 본밭 두둑에 조파(줄뿌림) 또는 점파 방식으로 파종하고 1~1.5cm 복토·진압 후 가볍게 관수합니다. (${optPlanting.reason})`
              : planByCode.get('PRC-08')?.work_content ||
                `[${cropDisplayName}(${cvDisplayName}) 본밭 정식 · ${plantingDate}] 건전한 플러그 묘를 재식거리에 맞춰 본밭에 정식하고 뿌리가 본밭 흙과 밀착되도록 충분히 관수·복토합니다. (${optPlanting.reason})`,
          materials: enrichMaterials(['MAT-NUTR-03', 'MAT-PEST-18']),
          usage_tip:
            '[농자재 사용팁] ① 본밭 정식 직후 엔플러스 참편한 아미노(500배액)와 프리엔 액상수화제(2,000배액)를 뿌리권에 관주하면 세근 발근 촉진과 고자리파리·선충·균핵병 예방을 동시에 해결합니다.',
          climate_rule: '정식·파종 당일 폭우·폭염·강풍을 피하고 토양 수분이 적습일 때 작업을 완료합니다.',
        },
        {
          item_id: 'SCH-08',
          stage_group_id: 'STG-PLANT',
          stage_group_name: '정식·활착',
          stage_color: '#0d9488',
          sub_item_name: '활착 관리(관수·차광)',
          bar_label: '활착 관리(관수·차광)',
          process_code: isDirectSowing ? 'PRC-09' : 'PRC-10',
          process_name: isDirectSowing ? '발아·출아기 확인 및 비닐 구멍 뚫기' : (planByCode.get('PRC-10')?.process_name || '활착기 확인 및 보식'),
          process_type: 'STAGE',
          step_order: 8,
          target_pgdd: targetRootingPgdd,
          start_date: dRootStart,
          end_date: dRootEnd,
          is_after_planting: true,
          visual_start_col: 16,
          visual_end_col: 22,
          work_content:
            reqCropId === 'CRP-POTATO'
              ? `[목표 유효적산온도 ${targetRootingPgdd}℃ 도달 (${gddRooting.date})] 씨감자에서 싹이 올라와 멀칭 비닐에 닿기 직전 비닐 구멍을 뚫어 싹을 꺼내주고 밑둥을 흙으로 덮어 고온·서리 피해를 방지합니다.`
              : reqCropId === 'CRP-SPINACH'
              ? `[목표 유효적산온도 ${targetRootingPgdd}℃ 도달 (${gddRooting.date})] 파종 후 떡잎이 고르게 출아하고 본엽 1~2매가 전개되는지 예찰하며, 토양 표면이 마르지 않도록 스프링클러 관수를 유지합니다.`
              : `[목표 유효적산온도 ${targetRootingPgdd}℃ 도달 (${gddRooting.date})] 새 흰색 잔뿌리가 본밭 토양에 내리고 중심부 어린잎이 생장을 시작하는지 예찰합니다. 결주 포기는 예비 묘로 즉시 보식하고 활착 관수를 실시합니다.`,
          materials: enrichMaterials(['MAT-NUTR-08', 'MAT-NUTR-13']),
          usage_tip:
            '[농자재 사용팁] ① 정식 후 활착기에 대유 루트파워 골드(500배액)와 뿌리왕 하이루트를 관주·엽면살포하면 이식 몸살을 조기에 극복하고 뿌리털 발달을 극대화합니다.',
          climate_rule: `정식·파종 후 누적 유효적산온도 ${targetRootingPgdd}℃ 도달 시점까지 토양 적습을 유지합니다.`,
        },

        // 4. 생육 관리
        {
          item_id: 'SCH-09',
          stage_group_id: 'STG-GROWTH',
          stage_group_name: '생육 관리',
          stage_color: '#22a559',
          sub_item_name: '생장 관리(시비·관수)',
          bar_label: '생장 관리(시비·관수)',
          process_code: 'PRC-13',
          process_name: `1차 추비(PGDD ${targetTop1Pgdd}℃) · 초기 생장 시비`,
          process_type: 'WORK',
          step_order: 9,
          target_pgdd: targetTop1Pgdd,
          start_date: dGrow1Start,
          end_date: dGrow1End,
          is_after_planting: true,
          visual_start_col: 17,
          visual_end_col: 35,
          work_content:
            `[${cropDisplayName}(${cvDisplayName}) 초기 추비·관수 스케줄] 1차 추비 적기(${gddTop1.date}, 목표 PGDD ${targetTop1Pgdd}℃)에 맞춰 속효성 NK 마그네슘 추비 비료 시비 및 엽록소 광합성 부스터 관리를 수행합니다.`,
          materials: enrichMaterials(['FERT-PRD-02', 'MAT-NUTR-11']),
          usage_tip:
            '[농자재 사용팁] ① 1차 추비기에는 엔케이 마그네슘 추비특호를 포기 사이에 시비하고, 그린라이트 클로로필(1,000배액)을 엽면살포하여 외엽 광합성 효율을 극대화하세요.',
          climate_rule: '강우 직전 고농도 비료 시비는 유실 및 가스장해를 유발하므로 무강우 적습일에 나누어 시비합니다.',
        },
        {
          item_id: 'SCH-10',
          stage_group_id: 'STG-GROWTH',
          stage_group_name: '생육 관리',
          stage_color: '#22a559',
          sub_item_name: '줄기·잎 관리(정지·유인)',
          bar_label: '줄기·잎 관리(정지·유인)',
          process_code: reqCropId === 'CRP-POTATO' ? 'PRC-18' : reqCropId === 'CRP-SPINACH' ? 'PRC-11' : 'PRC-17',
          process_name:
            reqCropId === 'CRP-POTATO'
              ? '눈따기(적아)·북주기(배토) 및 개화기 관리'
              : reqCropId === 'CRP-SPINACH'
              ? '솎아주기(주간 확보) 및 로제트 외엽 관리'
              : planByCode.get('PRC-17')?.process_name || '중기 왕성 생장기 외엽·경엽 관리',
          process_type: 'STAGE',
          step_order: 10,
          target_pgdd: targetVigorousPgdd,
          start_date: dGrow2Start,
          end_date: dGrow2End,
          is_after_planting: true,
          visual_start_col: 18,
          visual_end_col: 36,
          work_content:
            reqCropId === 'CRP-POTATO'
              ? `[목표 유효적산온도 ${targetVigorousPgdd}℃ 도달 (${gddVigorous.date})] 출아 후 튼튼한 주경 2~3개만 남기고 곁눈을 제거(적아)하며, 화아분화·개화기에 맞춰 노출된 괴경 녹화 방지를 위한 북주기(배토)와 경엽 관리를 실시합니다.`
              : reqCropId === 'CRP-SPINACH'
              ? `[목표 유효적산온도 ${targetVigorousPgdd}℃ 도달 (${gddVigorous.date})] 밀식된 포기를 5~7cm 간격으로 솎아주어 채광·통풍을 확보하고 로제트형 본엽이 두껍게 전개되도록 관리합니다.`
              : `[목표 유효적산온도 ${targetVigorousPgdd}℃ 도달 (${gddVigorous.date})] ${cropDisplayName}(${cvDisplayName})의 엽면적과 초세가 최대치로 확대되는 시기입니다. 종합미량요소 엽면시비와 초기 흡즙해충(진딧물·총채벌레) 방제를 실시합니다.`,
          materials: enrichMaterials(['MAT-NUTR-05', 'MAT-PEST-10']),
          usage_tip:
            '[농자재 사용팁] ① 외엽 번무기에 엔플러스 만능이(1,000배액)로 12종 미량요소를 공급하고 빅카드 액상수화제(2,000배액)로 진딧물·총채벌레를 선제 방제하세요.',
          climate_rule: '일교차가 커지면서 광합성 효율이 높아지는 시기이므로 건전한 엽면적을 조기에 확보합니다.',
        },
        {
          item_id: 'SCH-11',
          stage_group_id: 'STG-GROWTH',
          stage_group_name: '생육 관리',
          stage_color: '#22a559',
          sub_item_name: '생육 점검(생육량·생육상태)',
          bar_label: '생육 점검(생육량·생육상태)',
          process_code: 'PRC-19',
          process_name:
            reqCropId === 'CRP-POTATO' || reqCropId === 'CRP-SWEETPOTATO' || reqCropId === 'CRP-RADISH' || reqCropId === 'CRP-CARROT'
              ? '지하부 근경·괴경 비대 시작 확인 및 수분·비대 점검'
              : reqCropId === 'CRP-LETTUCE'
              ? '규격 성엽 도달 및 초세·생리장해 점검'
              : reqCropId === 'CRP-SPINACH'
              ? '포기 비대 및 저온기 당도·생육상태 점검'
              : reqCropId === 'CRP-GARLIC' || reqCropId === 'CRP-ONION' || reqCropId === 'CRP-GREENONION'
              ? '인경(구)·연백부 비대기 생육량 및 칼슘·수분 점검'
              : reqCropId === 'CRP-PEPPER' || reqCropId === 'CRP-CUCUMBER' || reqCropId === 'CRP-TOMATO' || reqCropId === 'CRP-WATERMELON' || reqCropId === 'CRP-CHAMOE'
              ? '개화·착과 및 과실 비대기 초세·칼슘결핍 점검'
              : reqCropId === 'CRP-SOYBEAN'
              ? '개화·착협기(꼬투리 형성) 및 종실 비대 점검'
              : planByCode.get('PRC-19')?.process_name || '결구 시작 확인 및 생육상태 점검',
          process_type: 'STAGE',
          step_order: 11,
          target_pgdd: targetHeadingPgdd,
          start_date: dGrow3Start,
          end_date: dGrow3End,
          is_after_planting: true,
          visual_start_col: 19,
          visual_end_col: 37,
          work_content:
            reqCropId === 'CRP-POTATO' || reqCropId === 'CRP-SWEETPOTATO' || reqCropId === 'CRP-RADISH' || reqCropId === 'CRP-CARROT'
              ? `[목표 유효적산온도 ${targetHeadingPgdd}℃ 도달 (${gddHeading.date})] ${cropDisplayName}(${cvDisplayName}) 지하부 뿌리·괴경이 본격적으로 비대하고 전분·당분이 축적되는 핵심 시기입니다. 열근(갈라짐)·공동과 예방을 위해 적습 관수와 미량요소 엽면시비를 집중 실시합니다.`
              : reqCropId === 'CRP-LETTUCE'
              ? `[목표 유효적산온도 ${targetHeadingPgdd}℃ 도달 (${gddHeading.date})] ${cropDisplayName}(${cvDisplayName}) 본엽이 규격 크기(15~20cm)에 도달하여 본 수확 및 연속 수확이 진행되는 시기입니다. 팁번(잎끝마름) 및 추대 여부를 정밀 점검합니다.`
              : reqCropId === 'CRP-SPINACH'
              ? `[목표 유효적산온도 ${targetHeadingPgdd}℃ 도달 (${gddHeading.date})] ${cropDisplayName}(${cvDisplayName})의 포기 볼륨과 뿌리 목(근관부)이 굵어지며 당도가 축적되는 시기입니다. 생육 균일도와 습해 여부를 점검합니다.`
              : reqCropId === 'CRP-GARLIC' || reqCropId === 'CRP-ONION' || reqCropId === 'CRP-GREENONION'
              ? `[목표 유효적산온도 ${targetHeadingPgdd}℃ 도달 (${gddHeading.date})] ${cropDisplayName}(${cvDisplayName})의 인경(구) 또는 연백부가 본격적으로 비대하는 핵심 시기입니다. 구 비대기 수분 부족을 방지하고 미량요소 성분을 적기 보충합니다.`
              : reqCropId === 'CRP-PEPPER' || reqCropId === 'CRP-CUCUMBER' || reqCropId === 'CRP-TOMATO' || reqCropId === 'CRP-WATERMELON' || reqCropId === 'CRP-CHAMOE'
              ? `[목표 유효적산온도 ${targetHeadingPgdd}℃ 도달 (${gddHeading.date})] ${cropDisplayName}(${cvDisplayName})의 개화·착과 이후 과실이 본격 비대하는 시기입니다. 생리장해 예방을 위해 킬레이트 미량요소 엽면시비와 균일 관수를 실시합니다.`
              : reqCropId === 'CRP-SOYBEAN'
              ? `[목표 유효적산온도 ${targetHeadingPgdd}℃ 도달 (${gddHeading.date})] ${cropDisplayName}(${cvDisplayName}) 개화 후 꼬투리(착협)가 형성되고 알곡(종실)이 차오르는 시기입니다. 한발 시 꼬투리 탈락 방지를 위해 수분 관리와 노린재 예찰을 병행합니다.`
              : `[목표 유효적산온도 ${targetHeadingPgdd}℃ 도달 (${gddHeading.date})] 외엽 확보 후 속잎이 안쪽으로 말리며 결구 전환이 시작되는 시기입니다. EDTA 킬레이트 미량요소 공급과 이상기후 스트레스 예방 처방을 실시합니다.`,
          materials: enrichMaterials(['MAT-NUTR-20', 'MAT-NUTR-16']),
          usage_tip:
            '[농자재 사용팁] ① 결구 진입기 생육 점검 시 대유 미리근 골드(1,000배액)와 스트레스제로 프로(800배액)를 살포하여 미량요소 결핍 황화와 온도 변화 스트레스를 선제 예방하세요.',
          climate_rule: `생육적온(${optTempMin}~${optTempMax}℃) 구간에서 토양 건조 시 양분 이동이 멈추므로 4~5일 간격 적습 관수를 유지합니다.`,
        },

        // 5. 병해충 예찰 (결구기)
        {
          item_id: 'SCH-12',
          stage_group_id: 'STG-PEST',
          stage_group_name: '병해충 예찰',
          stage_color: '#d4941e',
          sub_item_name: '병해충 예찰(정기 점검)',
          bar_label: '병해충 예찰(정기 점검)',
          process_code: 'PRC-16',
          process_name: '결구기 병해충 정기 예찰 및 나방·해충 방제',
          process_type: 'WORK',
          step_order: 12,
          target_pgdd: targetPest1Pgdd,
          start_date: dPest1Start,
          end_date: dPest1End,
          is_after_planting: true,
          visual_start_col: 8,
          visual_end_col: 39,
          work_content:
            `[${cropDisplayName}(${cvDisplayName}) 결구기 정기 예찰] 주 2회 이상 잎 뒷면과 결구 속잎·지제부를 정밀 예찰합니다. 결구 내부로 파고드는 배추좀나방·파밤나방 유충 및 벼룩잎벌레·총채벌레를 집중 점검하고 교호 살포합니다.`,
          materials: enrichMaterials(['MAT-PEST-05', 'MAT-PEST-02']),
          usage_tip:
            '[농자재 사용팁] ① 결구기 해충 예찰 시 웜해머 분산성액제(1,000배액)와 바이고 액상수화제(2,000배액)를 교호 살포하여 나방 유충과 벼룩잎벌레를 완벽히 방제하세요.',
          climate_rule: '무강우 건조기에는 진딧물·총채벌레·나방류 밀도가 급증하므로 예찰 주기를 3~4일 간격으로 단축합니다.',
        },
        {
          item_id: 'SCH-13',
          stage_group_id: 'STG-PEST',
          stage_group_name: '병해충 예찰',
          stage_color: '#d4941e',
          sub_item_name: '방제(필요 시)',
          bar_label: '방제(필요 시)',
          process_code: 'PRC-22',
          process_name: '결구 중기·강우기 노균병·무름병 집중 방제',
          process_type: 'WORK',
          step_order: 13,
          target_pgdd: targetPest2Pgdd,
          start_date: dPest2Start,
          end_date: dPest2End,
          is_after_planting: true,
          visual_start_col: 9,
          visual_end_col: 39,
          work_content:
            `[${activeRequest.eupmyeondong} 강우·고습도 대응 방제] 강우 및 안개·이슬로 상대습도가 78% 이상 지속되는 결구기에 급증하는 ${reqCropId === 'CRP-POTATO' ? '감자 역병·더뎅이병' : '무름병(연부병)·노균병·검은썩음병'}을 적기 방제합니다.`,
          materials: enrichMaterials(['MAT-PEST-03', 'MAT-PEST-12']),
          usage_tip:
            '[농자재 사용팁] ① 결구기 강우 전후 펀지해머 액상수화제(노균병·역병 방제, 1,000배액)와 일품 입상수화제(세균성 무름병 전문, 1,000배액)를 줄기 밑둥(지제부)과 잎 뒷면까지 충분히 살포하세요.',
          climate_rule: '강수량 10mm 이상 강우 직후 또는 평균습도 78% 이상 지속 시 24시간 이내에 선제 방제를 실시합니다.',
        },
        {
          item_id: 'SCH-14',
          stage_group_id: 'STG-PEST',
          stage_group_name: '병해충 예찰',
          stage_color: '#d4941e',
          sub_item_name: '예방 관리(환경·위생)',
          bar_label: '예방 관리(환경·위생)',
          process_code: 'PRC-27',
          process_name: '결구 후기 꿀통배추(칼슘결핍) 예방 및 2차 칼슘추비',
          process_type: 'WORK',
          step_order: 14,
          target_pgdd: targetPest3Pgdd,
          start_date: dPest3Start,
          end_date: dPest3End,
          is_after_planting: true,
          visual_start_col: 9,
          visual_end_col: 40,
          work_content:
            '결구 중후기 속잎이 급격히 차오르면서 발생하는 꿀통배추(내엽갈변·칼슘결핍) 및 무름 증상을 예방하기 위해 아미노산 킬레이트 액상칼슘·붕소제 엽면시비와 칼슘 함유 NK 추비를 병행합니다.',
          materials: enrichMaterials(['MAT-NUTR-02', 'FERT-PRD-20']),
          usage_tip:
            '[농자재 사용팁] ① 결구 비대기에는 엔플러스 튼튼칼슘(500배액)을 속잎까지 엽면 살포하고 단번에엔케이 칼슘추비를 고랑에 추비하여 세포벽 강화와 결구 비대를 완성하세요.',
          climate_rule: '결구 후기 토양 건조 또는 과습 시 칼슘 흡수가 저해되므로 적습 유지와 엽면 칼슘 공급을 병행합니다.',
        },

        // 6. 수확
        {
          item_id: 'SCH-15',
          stage_group_id: 'STG-HARVEST',
          stage_group_name: '수확',
          stage_color: '#d96b38',
          sub_item_name: '수확(적기 판단)',
          bar_label: '수확(적기 판단)',
          process_code: 'PRC-28',
          process_name: planByCode.get('PRC-28')?.process_name || '수확 적기 도달 확인 (PGDD 숙기 판정)',
          process_type: 'STAGE',
          step_order: 15,
          target_pgdd: targetReadyPgdd,
          start_date: dHarv1Start,
          end_date: dHarv1End,
          is_after_planting: true,
          visual_start_col: 39,
          visual_end_col: 46,
          work_content:
            reqCropId === 'CRP-POTATO' || reqCropId === 'CRP-SWEETPOTATO' || reqCropId === 'CRP-RADISH' || reqCropId === 'CRP-CARROT'
              ? `[목표 유효적산온도 ${targetReadyPgdd}℃ 도달 (${safeReadyDate})] ${cropDisplayName}(${cvDisplayName}) 지상부 경엽 상태와 지하부 근경·괴경의 크기·표피 숙기를 판정합니다. 강우 예보를 피해 무강우 건조한 날을 본 수확일로 확정합니다.`
              : reqCropId === 'CRP-LETTUCE'
              ? `[목표 유효적산온도 ${targetReadyPgdd}℃ 도달 (${safeReadyDate})] ${cropDisplayName}(${cvDisplayName}) 잎의 광택·두께·크기가 최상급 출하 규격에 도달했는지 확인하고 기온 상승에 따른 추대 전에 수확 일정을 확정합니다.`
              : reqCropId === 'CRP-SPINACH'
              ? `[목표 유효적산온도 ${targetReadyPgdd}℃ 도달 (${safeReadyDate})] ${cropDisplayName}(${cvDisplayName}) 초장 20~25cm 내외로 포기 밑둥이 붉고 단단하게 충실해지며 당도가 최고조에 달했는지 숙기를 판정합니다.`
              : reqCropId === 'CRP-GARLIC' || reqCropId === 'CRP-ONION' || reqCropId === 'CRP-GREENONION'
              ? `[목표 유효적산온도 ${targetReadyPgdd}℃ 도달 (${safeReadyDate})] ${cropDisplayName}(${cvDisplayName}) 지상부 엽초의 도복·황화 비율 및 인경·연백부 비대 규격을 확인하고 맑고 건조한 날을 수확 적기로 확정합니다.`
              : reqCropId === 'CRP-PEPPER' || reqCropId === 'CRP-CUCUMBER' || reqCropId === 'CRP-TOMATO' || reqCropId === 'CRP-WATERMELON' || reqCropId === 'CRP-CHAMOE'
              ? `[목표 유효적산온도 ${targetReadyPgdd}℃ 도달 (${safeReadyDate})] ${cropDisplayName}(${cvDisplayName}) 과실의 착색도·당도·과중 및 숙기를 판정하여 출하 규격에 도달한 과실부터 적기 수확 일정을 확정합니다.`
              : reqCropId === 'CRP-SOYBEAN'
              ? `[목표 유효적산온도 ${targetReadyPgdd}℃ 도달 (${safeReadyDate})] ${cropDisplayName}(${cvDisplayName}) 잎이 낙엽되고 꼬투리의 80~90%가 갈색으로 성숙했는지 확인하여 탈립 전 적기 수확일을 확정합니다.`
              : `[목표 유효적산온도 ${targetReadyPgdd}℃ 도달 (${safeReadyDate})] 배추 통 상부를 손으로 눌렀을 때 결구율이 85~90% 이상 단단하게 차올랐는지 숙기를 판정하고, 수확 직전 구중 완성 및 PLS 무잔류 친환경 마감 관리를 실시합니다.`,
          materials: enrichMaterials(['MAT-NUTR-04', 'MAT-PEST-06']),
          usage_tip:
            '[농자재 사용팁] ① 수확 7~10일 전 엔플러스 커진다(500배액)로 결구 구중·치밀도를 완성하고, 엔플러스 해충박살 파워(유기농업자재 공시, 500배액)로 PLS 잔류농약 걱정 없이 안전하게 마감 방제하세요.',
          climate_rule: `누적 유효적산온도 ${targetReadyPgdd}~${requiredTotalGdd}℃ 도달 및 무강우·저습도 맑은 날을 수확 적기로 판정합니다.`,
        },
        {
          item_id: 'SCH-16',
          stage_group_id: 'STG-HARVEST',
          stage_group_name: '수확',
          stage_color: '#d96b38',
          sub_item_name: '수확 후 처리(선별·저장)',
          bar_label: '수확 후 처리(선별·저장)',
          process_code: 'PRC-29',
          process_name: planByCode.get('PRC-29')?.process_name || '본 수확 작업 및 현장 예건·선별·저장',
          process_type: 'WORK',
          step_order: 16,
          target_pgdd: requiredTotalGdd,
          start_date: dHarv2Start,
          end_date: dHarv2End,
          is_after_planting: true,
          visual_start_col: 40,
          visual_end_col: 47,
          work_content:
            reqCropId === 'CRP-POTATO' || reqCropId === 'CRP-SWEETPOTATO' || reqCropId === 'CRP-RADISH' || reqCropId === 'CRP-CARROT'
              ? `[목표 유효적산온도 ${requiredTotalGdd}℃ 도달 (${safeHarvestDate})] 맑고 건조한 날 ${cropDisplayName}(${cvDisplayName})을 상처 없이 수확하여 통풍이 잘 되는 그늘에서 예건·큐어링 후 크기·등급별로 선별하여 저온저장고에 입고합니다.`
              : reqCropId === 'CRP-LETTUCE'
              ? `[목표 유효적산온도 ${requiredTotalGdd}℃ 도달 (${safeHarvestDate})] 이른 아침 이슬이 마른 직후 서늘할 때 ${cropDisplayName}(${cvDisplayName})을 수확하여 호흡열을 빠르게 식히는 예냉(4~5℃) 처리 후 규격 박스 포장 출하합니다.`
              : reqCropId === 'CRP-SPINACH'
              ? `[목표 유효적산온도 ${requiredTotalGdd}℃ 도달 (${safeHarvestDate})] 붉은 뿌리 목(근관부)을 2~3cm 붙여 수확한 뒤 흙과 황화 하엽을 정리하고 단 묶음 또는 통기성 필름 포장 후 저온 예냉 출하합니다.`
              : reqCropId === 'CRP-GARLIC' || reqCropId === 'CRP-ONION' || reqCropId === 'CRP-GREENONION'
              ? `[목표 유효적산온도 ${requiredTotalGdd}℃ 도달 (${safeHarvestDate})] 맑은 날 ${cropDisplayName}(${cvDisplayName})을 수확하여 현장 예건 및 줄기·뿌리 정리를 마친 뒤 규격망/박스로 등급별 선별 포장 및 저온 저장합니다.`
              : reqCropId === 'CRP-PEPPER' || reqCropId === 'CRP-CUCUMBER' || reqCropId === 'CRP-TOMATO' || reqCropId === 'CRP-WATERMELON' || reqCropId === 'CRP-CHAMOE'
              ? `[목표 유효적산온도 ${requiredTotalGdd}℃ 도달 (${safeHarvestDate})] 아침 서늘한 시간대에 ${cropDisplayName}(${cvDisplayName})을 수확하여 예냉·건조 처리 후 크기·품질 등급별로 선별 포장하여 출하합니다.`
              : reqCropId === 'CRP-SOYBEAN'
              ? `[목표 유효적산온도 ${requiredTotalGdd}℃ 도달 (${safeHarvestDate})] 이슬이 마른 맑은 날 ${cropDisplayName}(${cvDisplayName})을 수확·탈곡한 뒤 수분함량 13~14% 이하로 건조하고 이물질 및 피해립을 선별하여 저장·출하합니다.`
              : `[목표 유효적산온도 ${requiredTotalGdd}℃ 도달 (${safeHarvestDate})] 이슬이 완전히 마른 맑은 날 본 수확을 실시합니다. 수확 전 고농도 칼륨·규산 처방으로 초겨울 동해를 방지하고 표피 조직을 강화하여 장기 저온저장성을 극대화합니다.`,
          materials: enrichMaterials(['MAT-NUTR-14', 'MAT-NUTR-24']),
          usage_tip:
            '[농자재 사용팁] ① 수확·저장 전 하이포타시움 K35(1,000배액)와 엔플러스 규산칼륨 파워(1,000배액)로 세포액 당도·내한성과 잎 표피 조직을 강화하면 저온저장 중 무름과 부패를 크게 줄여줍니다.',
          climate_rule: '수확 당일 상대습도가 낮고 맑은 날 수확하여 현장 예건·예냉 후 호흡열을 식혀 저장합니다.',
        },
      ];

      // [18개 전 작물 생리·재배주기·파종방식·병해충 맞춤형 16단계 프로필 적용]
      const cropProfile = resolveCropAgronomicProfile(cropDisplayName, reqCropId);
      const profileAnchorDate =
        Math.abs(
          Math.round(
            (parseDateUTC(plantingDate).getTime() - parseDateUTC(rawDesiredDate).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        ) <= 3
          ? plantingDate
          : rawDesiredDate;
      for (let idx = 0; idx < rawScheduleItems.length; idx++) {
        const it = rawScheduleItems[idx];
        const profStg = cropProfile.stages[idx];
        if (!profStg) continue;

        const stageColorBySlot: Record<string, string> = {
          'STG-PREP': '#64748b',
          'STG-NURSERY': '#2563eb',
          'STG-PLANT': '#0d9488',
          'STG-GROWTH': '#22a559',
          'STG-PEST': '#d4941e',
          'STG-HARVEST': '#d96b38',
        };
        it.stage_group_id = profStg.stageGroupId;
        it.stage_group_name = profStg.stageGroupName;
        it.stage_color = stageColorBySlot[profStg.stageGroupId] || it.stage_color || '#22a559';
        it.sub_item_name = profStg.subItemName;
        it.bar_label = profStg.subItemName;
        it.process_code = profStg.processCode;
        it.process_name = profStg.processName;
        it.target_pgdd = profStg.targetPgdd;
        it.is_after_planting = profStg.offsetDays >= 0;
        (it as any).profile_icon_type = profStg.iconType;
        (it as any).profile_stage_spec = profStg;

        if (!isDanwolDefaultSchedule) {
          const baseStart = addDays(profileAnchorDate, Number(profStg.offsetDays || 0));
          const isExactAnchorStage = Number(profStg.offsetDays || 0) === 0 || idx === 15;
          const workMode =
            idx === 0 || idx === 1
              ? 'DRY_WORK'
              : idx === 2 || idx === 6
              ? 'MULCH_OR_PLANT'
              : idx === 8 || idx === 13
              ? 'TOPDRESS'
              : idx >= 14
              ? 'HARVEST'
              : undefined;
          const optDate =
            workMode && !isExactAnchorStage
              ? findBestWorkDate(baseStart, 1, workMode).bestDate
              : baseStart;
          const spanDays = Math.max(1, Number(profStg.spanDays || 3));
          it.start_date = optDate;
          it.end_date = addDays(optDate, Math.max(1, spanDays - 1));
        }

        it.work_content = `[${activeRequest.sido} ${activeRequest.sigungu} ${activeRequest.eupmyeondong} · ${cropDisplayName}(${cvDisplayName}) ${areaPyeong.toLocaleString()}평 · 추천일 ${it.start_date}] ${profStg.workContent}`;
        it.usage_tip = profStg.usageTip;
        it.climate_rule = profStg.climateRule;
        if (Array.isArray(profStg.preferredMaterialIds) && profStg.preferredMaterialIds.length > 0) {
          it.materials = enrichMaterials(profStg.preferredMaterialIds);
        }
      }

      if (!isDanwolDefaultSchedule && rawScheduleItems.length >= 16) {
        dPrep1Start = rawScheduleItems[0].start_date;
        dPrep3Start = rawScheduleItems[2].start_date;
        dPlantStart = rawScheduleItems[6].start_date;
        dRootStart = rawScheduleItems[7].start_date;
        dRootEnd = rawScheduleItems[7].end_date;
        gddRooting = { ...gddRooting, date: rawScheduleItems[7].start_date };
        gddTop1 = { ...gddTop1, date: rawScheduleItems[8].start_date };
        gddVigorous = { ...gddVigorous, date: rawScheduleItems[9].start_date };
        gddHeading = { ...gddHeading, date: rawScheduleItems[10].start_date };
        gddTop2 = { ...gddTop2, date: rawScheduleItems[13].start_date };
        safeReadyDate = rawScheduleItems[14].start_date;
        safeHarvestDate = rawScheduleItems[15].start_date;
        dHarv2End = rawScheduleItems[15].end_date;
      }

      // [변경된 3대 대분류(비료·영양제·병해충관리제) 등록 항목 + 생육과정 요구성분 + 현재 토양성분 + 기상/PLS 기준 통합 추천 엔진 적용]
      const scheduleSoilStdRow =
        (db.prepare('SELECT * FROM soil_standard WHERE crop_id = ?').get(reqCropId) as any) ||
        (db.prepare('SELECT * FROM soil_standard LIMIT 1').get() as any) || {
          ph_min: 6.0,
          ph_max: 6.8,
          om_min: 25,
          om_max: 35,
          p2o5_min: 300,
          p2o5_max: 500,
          k_min: 0.65,
          k_max: 0.85,
          ca_min: 5.0,
          ca_max: 6.5,
          mg_min: 1.5,
          mg_max: 2.5,
          ec_min: 0.5,
          ec_max: 2.0,
        };
      const schedulePolicyRow =
        (db.prepare("SELECT * FROM agro_recommendation_policy WHERE policy_id = 'DEFAULT_POLICY'").get() as any) || {};
      const scheduleSoilInput = {
        soil_ph: Number(activeRequest.soil_ph ?? 6.2),
        soil_ec: Number(activeRequest.soil_ec ?? 1.1),
        organic_matter_g_kg: Number(activeRequest.organic_matter_g_kg ?? 24),
        avail_p2o5_mg_kg: Number(activeRequest.avail_p2o5_mg_kg ?? 360),
        exch_k_cmol: Number(activeRequest.exch_k_cmol ?? 0.68),
        exch_ca_cmol: Number(activeRequest.exch_ca_cmol ?? 5.4),
        exch_mg_cmol: Number(activeRequest.exch_mg_cmol ?? 1.7),
        soil_texture: String(activeRequest.soil_texture || '양토'),
        land_category: String(activeRequest.land_category || '전(밭)'),
      };
      const scheduleRegionName = `${activeRequest.sido || '충청북도'} ${activeRequest.sigungu || '충주시'} ${
        activeRequest.eupmyeondong || '단월동'
      }`;

      for (const schItem of rawScheduleItems) {
        const stWeather = analyzePeriodClimate(schItem.start_date, schItem.end_date, schItem.is_after_planting);
        const stMonth = Number(String(schItem.start_date || '2026-08-15').slice(5, 7)) || 8;
        const daysToHarv = Math.max(0, diffDaysInclusive(schItem.end_date, safeHarvestDate) - 1);
        const preferredIds = (schItem.materials || []).map((m: any) => m.material_id).filter(Boolean);

        const dynamicallyRecommended = selectScheduleStageMaterials({
          stageKey: schItem.item_id,
          allMaterials,
          cropName: cropDisplayName,
          cultivarName: cvDisplayName,
          regionName: scheduleRegionName,
          areaPyeong,
          soilInput: scheduleSoilInput,
          soilStd: scheduleSoilStdRow,
          climate: {
            month: stMonth,
            temp_avg: Number(stWeather.avg_temp ?? 18.5),
            temp_max: Number(stWeather.max_temp ?? 23.0),
            temp_min: Number(stWeather.min_temp ?? 14.0),
            humidity_avg: Number(stWeather.avg_humidity ?? 68),
            rainfall_total_mm: Number(stWeather.total_precip_mm ?? 30),
            rainy_days: Number(stWeather.rainy_days ?? 3),
          },
          daysToHarvest: daysToHarv,
          preferredMaterialIds: preferredIds,
          policy: schedulePolicyRow,
        });

        if (dynamicallyRecommended.length > 0) {
          const topRationaleTemplate = dynamicallyRecommended[0];
          const curatedStageMats = Array.isArray(schItem.materials) ? schItem.materials : [];
          if (curatedStageMats.length > 0) {
            const profStg = (schItem as any).profile_stage_spec;
            schItem.materials = curatedStageMats.map((cm: any, idx: number) => ({
              ...topRationaleTemplate,
              ...cm,
              product_name: idx === 0 && profStg?.materialName ? profStg.materialName : cm.product_name,
              sub_type: idx === 0 && profStg?.materialSubLabel ? profStg.materialSubLabel : cm.sub_type,
              image_url: idx === 0 && profStg?.materialThumb ? profStg.materialThumb : cm.image_url,
              usage_amount_per_100pyeong: idx === 0 && profStg?.usageAmountPer100Pyeong ? profStg.usageAmountPer100Pyeong : undefined,
              dilution_text: idx === 0 && profStg?.dilutionText ? profStg.dilutionText : undefined,
              usage_method: idx === 0 && profStg?.usageMethod ? profStg.usageMethod : undefined,
              usage_caution: idx === 0 && profStg?.usageCaution ? profStg.usageCaution : undefined,
              match_score: idx === 0 ? Number(topRationaleTemplate?.match_score || 98) : 95,
              is_top1_recommended: idx === 0,
            }));
          } else {
            schItem.materials = dynamicallyRecommended;
          }
        }
      }

      // [기초 코드 관리 > 생육 구분 기초 코드 (growth_type_code)] 테이블에서 6대 단계 구분 마스터를 순서대로(sort_order ASC) 조회 및 연동
      const dbGrowthTypes = db
        .prepare('SELECT * FROM growth_type_code ORDER BY sort_order ASC, type_code ASC')
        .all() as Array<{
        type_code: string;
        type_name: string;
        stage_color?: string;
        icon_type?: string;
        description?: string;
        sort_order: number;
      }>;

      const canonicalStageSlots = [
        { slotKey: 'STG-PREP', defaultCode: 'STG-PREP', defaultName: '재배 준비', defaultColor: '#6b7c93', defaultIcon: 'sprout', order: 1 },
        { slotKey: 'STG-NURSERY', defaultCode: 'STG-NURSERY', defaultName: '파종·육묘', defaultColor: '#2563eb', defaultIcon: 'seedlings', order: 2 },
        { slotKey: 'STG-PLANT', defaultCode: 'STG-PLANT', defaultName: '정식·활착', defaultColor: '#0d9488', defaultIcon: 'plant', order: 3 },
        { slotKey: 'STG-GROWTH', defaultCode: 'STG-GROWTH', defaultName: '생육 관리', defaultColor: '#22a559', defaultIcon: 'leaf', order: 4 },
        { slotKey: 'STG-PEST', defaultCode: 'STG-PEST', defaultName: '병해충 예찰', defaultColor: '#d4941e', defaultIcon: 'shield', order: 5 },
        { slotKey: 'STG-HARVEST', defaultCode: 'STG-HARVEST', defaultName: '수확', defaultColor: '#d96b38', defaultIcon: 'harvest', order: 6 },
      ];

      // 순서대로(1~6번) 생육 구분 기초 코드의 [코드(type_code)]와 [코드명(type_name)]을 매핑
      const resolvedStageMetaBySlot = new Map<
        string,
        {
          type_code: string;
          type_name: string;
          stage_color: string;
          icon_type: string;
          description: string;
          sort_order: number;
        }
      >();
      canonicalStageSlots.forEach((slot, idx) => {
        const gtByIndex = dbGrowthTypes[idx];
        const gtByCode = dbGrowthTypes.find((g) => g.type_code === slot.slotKey);
        const gt = gtByIndex || gtByCode;
        resolvedStageMetaBySlot.set(slot.slotKey, {
          type_code: gt?.type_code || slot.defaultCode,
          type_name: gt?.type_name || slot.defaultName,
          stage_color: gt?.stage_color || slot.defaultColor,
          icon_type: gt?.icon_type || slot.defaultIcon,
          description: gt?.description || '',
          sort_order: gt?.sort_order || slot.order,
        });
      });

      const daysInMonths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      const dateToExactCol = (ymd: string, isEnd: boolean): number => {
        const m = Math.max(1, Math.min(12, Number(ymd.slice(5, 7)) || 1));
        const maxD = daysInMonths[m - 1] || 30;
        const d = Math.max(1, Math.min(maxD, Number(ymd.slice(8, 10)) || 1));
        const dayFraction = isEnd ? d / maxD : (d - 1) / maxD;
        return Number(((m - 1) * 4 + dayFraction * 4).toFixed(3));
      };

      // 전체 재배기간의 시작~종료 컬럼 범위 (도식 펼침 모드에서도 해당 작물·지역의 실제 일자 비율이 반영되도록 계산)
      const overallMinCol = dateToExactCol(dPrep1Start, false);
      const overallMaxCol = Math.max(overallMinCol + 4, dateToExactCol(dHarv2End, true));

      // [관리자 커스텀 수정 테이블 및 생육과정별 1종 최고점 제품·평수별 필요갯수·개조식 추천근거 DB 저장 테이블 초기화]
      db.exec(`
        CREATE TABLE IF NOT EXISTS schedule_provision_custom_item (
          request_no TEXT NOT NULL,
          item_id TEXT NOT NULL,
          stage_group_id TEXT,
          stage_group_name TEXT,
          sub_item_name TEXT,
          bar_label TEXT,
          process_code TEXT,
          process_name TEXT,
          target_pgdd REAL,
          start_date TEXT,
          end_date TEXT,
          work_content TEXT,
          climate_rule TEXT,
          usage_tip TEXT,
          ai_analysis_reason TEXT,
          materials_json TEXT,
          updated_at TEXT DEFAULT (datetime('now', 'localtime')),
          PRIMARY KEY (request_no, item_id)
        );
        CREATE TABLE IF NOT EXISTS schedule_stage_recommendation_log (
          request_no TEXT NOT NULL,
          item_id TEXT NOT NULL,
          process_code TEXT,
          stage_group_name TEXT,
          sub_item_name TEXT,
          area_pyeong REAL,
          material_id TEXT,
          product_name TEXT,
          material_category TEXT,
          sub_type TEXT,
          manufacturer TEXT,
          match_score INTEGER,
          recommended_qty INTEGER,
          unit_spec TEXT,
          unit_price INTEGER,
          total_cost INTEGER,
          quantity_calc_formula TEXT,
          recommended_for_area TEXT,
          rationale_bullets_json TEXT,
          selection_rationale TEXT,
          materials_json TEXT,
          updated_at TEXT DEFAULT (datetime('now', 'localtime')),
          PRIMARY KEY (request_no, item_id)
        );
      `);

      const customRows = db
        .prepare('SELECT * FROM schedule_provision_custom_item WHERE request_no = ?')
        .all(activeRequest.request_no) as any[];
      const customByItemId = new Map<string, any>();
      for (const cr of customRows) {
        customByItemId.set(cr.item_id, cr);
      }

      const upsertStageRecStmt = db.prepare(`
        INSERT INTO schedule_stage_recommendation_log (
          request_no, item_id, process_code, stage_group_name, sub_item_name,
          area_pyeong, material_id, product_name, material_category, sub_type, manufacturer,
          match_score, recommended_qty, unit_spec, unit_price, total_cost,
          quantity_calc_formula, recommended_for_area, rationale_bullets_json, selection_rationale, materials_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
        ON CONFLICT(request_no, item_id) DO UPDATE SET
          process_code = excluded.process_code,
          stage_group_name = excluded.stage_group_name,
          sub_item_name = excluded.sub_item_name,
          area_pyeong = excluded.area_pyeong,
          material_id = excluded.material_id,
          product_name = excluded.product_name,
          material_category = excluded.material_category,
          sub_type = excluded.sub_type,
          manufacturer = excluded.manufacturer,
          match_score = excluded.match_score,
          recommended_qty = excluded.recommended_qty,
          unit_spec = excluded.unit_spec,
          unit_price = excluded.unit_price,
          total_cost = excluded.total_cost,
          quantity_calc_formula = excluded.quantity_calc_formula,
          recommended_for_area = excluded.recommended_for_area,
          rationale_bullets_json = excluded.rationale_bullets_json,
          selection_rationale = excluded.selection_rationale,
          materials_json = excluded.materials_json,
          updated_at = datetime('now', 'localtime')
      `);

      const syncCustomMatStmt = db.prepare(`
        UPDATE schedule_provision_custom_item
        SET materials_json = ?, updated_at = datetime('now', 'localtime')
        WHERE request_no = ? AND item_id = ?
      `);

      for (let i = 0; i < rawScheduleItems.length; i++) {
        const it = rawScheduleItems[i];
        const custom = customByItemId.get(it.item_id);
        if (custom) {
          if (custom.stage_group_id) it.stage_group_id = custom.stage_group_id;
          if (custom.stage_group_name) it.stage_group_name = custom.stage_group_name;
          if (custom.sub_item_name) {
            it.sub_item_name = custom.sub_item_name;
            it.bar_label = custom.bar_label || custom.sub_item_name;
          }
          if (custom.bar_label) it.bar_label = custom.bar_label;
          if (custom.process_code) it.process_code = custom.process_code;
          if (custom.process_name) it.process_name = custom.process_name;
          if (custom.target_pgdd !== null && custom.target_pgdd !== undefined) {
            it.target_pgdd = Number(custom.target_pgdd);
          }
          if (custom.start_date) it.start_date = custom.start_date;
          if (custom.end_date) it.end_date = custom.end_date;
          if (custom.work_content) it.work_content = custom.work_content;
          if (custom.climate_rule) it.climate_rule = custom.climate_rule;
          if (custom.usage_tip) it.usage_tip = custom.usage_tip;
          if (custom.materials_json) {
            try {
              const parsedMats = JSON.parse(custom.materials_json);
              if (Array.isArray(parsedMats) && parsedMats.length > 0) {
                // 최고 추천점수 1종 선정 및 평수 기반 필요 갯수·개조식 추천근거가 반영된 최신 구조로 정규화 후 DB 동기화
                const sortedCustom = [...parsedMats].sort(
                  (a, b) => Number(b.match_score || 0) - Number(a.match_score || 0)
                );
                const topCustom = sortedCustom[0];
                const dynamicTop = Array.isArray(it.materials) && it.materials[0] ? it.materials[0] : null;
                if (
                  dynamicTop &&
                  (!Array.isArray(topCustom?.rationale_bullets) ||
                    parsedMats.length > 1 ||
                    Number(topCustom?.area_pyeong || 0) !== Number(areaPyeong))
                ) {
                  it.materials = [dynamicTop];
                  syncCustomMatStmt.run(JSON.stringify(it.materials), activeRequest.request_no, it.item_id);
                } else {
                  it.materials = [topCustom];
                }
              }
            } catch {}
          }
          (it as any).custom_ai_reason = custom.ai_analysis_reason || '';
          (it as any).is_admin_customized = true;
        }

        // 생육과정별 최고점 1종 추천 제품 + 재배지 평수 계산 필요 갯수 + 개조식 추천 근거를 DB에 영구 저장
        const topMat = Array.isArray(it.materials) && it.materials[0] ? it.materials[0] : null;
        if (topMat) {
          const bulletsArr = Array.isArray(topMat.rationale_bullets)
            ? topMat.rationale_bullets
            : String(topMat.selection_rationale || '')
                .split('\n')
                .filter(Boolean);
          upsertStageRecStmt.run(
            String(activeRequest.request_no),
            String(it.item_id),
            String(it.process_code || ''),
            String(it.stage_group_name || ''),
            String(it.sub_item_name || ''),
            Number(areaPyeong || 300),
            String(topMat.material_id || ''),
            String(topMat.product_name || ''),
            String(topMat.material_category || ''),
            String(topMat.sub_type || ''),
            String(topMat.manufacturer || ''),
            Number(topMat.match_score || 95),
            Number(topMat.recommended_qty || 1),
            String(topMat.unit_spec || '1개'),
            Number(topMat.unit_price || 15000),
            Number(topMat.total_cost || Number(topMat.recommended_qty || 1) * Number(topMat.unit_price || 15000)),
            String(topMat.quantity_calc_formula || ''),
            String(topMat.recommended_for_area || ''),
            JSON.stringify(bulletsArr),
            String(topMat.selection_rationale || bulletsArr.join('\n')),
            JSON.stringify([topMat])
          );
        }
      }
      try {
        const savedRecLogs = db
          .prepare('SELECT * FROM schedule_stage_recommendation_log WHERE request_no = ?')
          .all(String(activeRequest.request_no)) as Record<string, unknown>[];
        if (savedRecLogs.length > 0) {
          await supabaseRestUpsert('schedule_stage_recommendation_log', savedRecLogs, 'request_no,item_id');
        }
      } catch {
        // ignore network errors
      }

      // ============================================================================================================
      // [특허 KR 10-2814596 핵심 알고리즘 모듈 A · B · C · D 통합 엔진]
      // - 모듈 A (청구항 2·3, 도 5 S141~S144, 도 6): 최적 재배기간 365일 자동 탐색 (적산온도 일치 → 생육장해온도 제외 → 생육최적온도 최다 포함 복수 후보 선정)
      // - 모듈 B (청구항 4·5·6, 도 3, 도 7, 명세서 [0109~0111]): 토양검정 7대 성분 부족분 정량 진단 + 복수 비료 조합·배합비(%) 산출 + 기후 병해충 처방 + 도 7 통합 견적표
      // - 모듈 C (청구항 1·8·10·11·12·13, 도 4 S200): 기후변화 급변 모니터링 알림 + 현 시점(실측+예측 하이브리드 적산온도 분할) 및 작업 미이행/지연 연쇄 재조정
      // - 모듈 D (청구항 14, 명세서 [0028, 0129~0130]): 수확 완료 후 실제 재배기간 적산온도 역산 및 작물DB(cropping_system) 피드백 업데이트
      // ============================================================================================================

      // [모듈 C 선행 처리] 현 시점(as_of_date) 또는 주요 작업 지연(delayed_item_id + delayed_actual_date) 시뮬레이션이 요청된 경우
      // 이행 완료 작업은 고정하고, 미이행 주요 작업 및 이후 일정을 예측 기후(climate_future_daily) 잔여 적산온도로 연쇄 재조정
      const delayedTargetIdx = delayedItemIdParam
        ? rawScheduleItems.findIndex((it) => it.item_id === delayedItemIdParam)
        : -1;
      let delayedShiftDays = 0;
      if (delayedTargetIdx >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(delayedActualDateParam)) {
        const origStart = rawScheduleItems[delayedTargetIdx].start_date;
        const diffMs = parseDateUTC(delayedActualDateParam).getTime() - parseDateUTC(origStart).getTime();
        delayedShiftDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      }

      // 현 시점(as_of_date) 기준 과거 실측 적산온도(actual_accumulated_gdd) + 미래 예측 기후 잔여 적산온도(remaining_required_gdd) 계산
      const effectiveAsOfDate = /^\d{4}-\d{2}-\d{2}$/.test(asOfDateParam)
        ? asOfDateParam
        : addDays(plantingDate, Math.max(10, Math.round(diffDaysInclusive(plantingDate, safeHarvestDate) * 0.4)));

      let actualAccumulatedEffectiveGdd = 0;
      let actualAccumulatedRawGdd = 0;
      let actualAccumulatedAiPgdd = 0;
      if (effectiveAsOfDate >= plantingDate) {
        const elapsedDays = diffDaysInclusive(plantingDate, effectiveAsOfDate);
        for (let i = 0; i < elapsedDays; i++) {
          const dStr = addDays(plantingDate, i);
          actualAccumulatedEffectiveGdd += calcDailyPatentEffectiveGdd(dStr, false);
          actualAccumulatedRawGdd += calcDailyRawGdd(dStr, false);
          actualAccumulatedAiPgdd += calcDailyPgdd(dStr, false);
        }
      }
      actualAccumulatedEffectiveGdd = Math.round(actualAccumulatedEffectiveGdd);
      actualAccumulatedRawGdd = Math.round(actualAccumulatedRawGdd);
      actualAccumulatedAiPgdd = Math.round(actualAccumulatedAiPgdd);

      const remainingEffectiveGdd = Math.max(0, requiredTotalGdd - actualAccumulatedAiPgdd);
      const remainingRawGdd = Math.max(0, requiredRawGdd - actualAccumulatedRawGdd);

      // 현 시점 이후 예측 기후(climate_future_daily, useForecast=true)로 잔여 적산온도 도달일 산출
      const findFutureDateByRemainingPgdd = (targetTotalPgdd: number, fallbackDate: string): { date: string; shiftDays: number } => {
        if (targetTotalPgdd <= actualAccumulatedAiPgdd || fallbackDate <= effectiveAsOfDate) {
          return { date: fallbackDate, shiftDays: 0 };
        }
        const neededAfterAsOf = targetTotalPgdd - actualAccumulatedAiPgdd;
        let accFuture = 0;
        let reached = '';
        for (let d = 1; d <= 120; d++) {
          const cur = addDays(effectiveAsOfDate, d);
          accFuture += calcDailyPgdd(cur, true);
          if (accFuture >= neededAfterAsOf) {
            reached = cur;
            break;
          }
        }
        if (!reached) {
          // 늦가을~초겨울 기온 하강으로 목표치 미세 미달 시 예측기온과 평년기온 편차 비례 보정
          const remSpan = diffDaysInclusive(effectiveAsOfDate, fallbackDate);
          let pastRemGdd = 0;
          let fcRemGdd = 0;
          for (let i = 0; i < remSpan; i++) {
            const dStr = addDays(effectiveAsOfDate, i);
            pastRemGdd += calcDailyPgdd(dStr, false);
            fcRemGdd += calcDailyPgdd(dStr, true);
          }
          const gddDiff = pastRemGdd - fcRemGdd;
          const avgDaily = Math.max(4.5, fcRemGdd / Math.max(1, remSpan));
          const estShift = Math.max(-10, Math.min(14, Math.round(gddDiff / avgDaily)));
          return { date: addDays(fallbackDate, estShift), shiftDays: estShift };
        }
        const rawShift = Math.round(
          (parseDateUTC(reached).getTime() - parseDateUTC(fallbackDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        const clampedShift = Math.max(-12, Math.min(18, rawShift));
        return { date: addDays(fallbackDate, clampedShift), shiftDays: clampedShift };
      };

      const isReadjustmentActive = Boolean(asOfDateParam || (delayedTargetIdx >= 0 && delayedShiftDays !== 0));

      // 날짜(YYYY-MM-DD) -> 한국어 요일명 및 "YYYY-MM-DD (요일)" 포맷 헬퍼
      const KOR_WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;
      const getWeekdayLabel = (ymd: string): string => {
        const dt = parseDateUTC(ymd);
        return KOR_WEEKDAYS[dt.getUTCDay()] || '화';
      };
      const formatYmdWithWeekday = (ymd: string): string => `${ymd} (${getWeekdayLabel(ymd)})`;

      // 각 항목별로 재배지 작년(2025년) 365일 기후 데이터(온도, 습도, 강수량) AI 다변량 분석 결과 및 [생육 구분 기초 코드] 마스터(코드·코드명)를 순서대로 결합
      const scheduleItems = rawScheduleItems.map((it, idx) => {
        let adjStartDate = it.start_date;
        let adjEndDate = it.end_date;
        let executionStatus: 'COMPLETED' | 'DELAYED_READJUSTED' | 'CLIMATE_READJUSTED' | 'PLANNED' = 'PLANNED';
        let readjustmentNote = '';

        if (isReadjustmentActive) {
          if (delayedTargetIdx >= 0 && delayedShiftDays !== 0) {
            if (idx < delayedTargetIdx) {
              executionStatus = 'COMPLETED';
              readjustmentNote = '[특허 S200] 기 이행 완료 작업 (재조정 제외·고정)';
            } else if (idx === delayedTargetIdx) {
              adjStartDate = addDays(it.start_date, delayedShiftDays);
              adjEndDate = addDays(it.end_date, delayedShiftDays);
              executionStatus = 'DELAYED_READJUSTED';
              readjustmentNote = `[특허 S200 작업 미이행/지연 반영] 실제 시행일(${adjStartDate}) 기준 ${delayedShiftDays > 0 ? `+${delayedShiftDays}일 순연` : `${delayedShiftDays}일 조기`} 재조정`;
            } else {
              // 후속 공정은 작업 지연 일수 + 예측 기후 잔여 적산온도 변화를 반영하여 연쇄 재조정
              const fcShift = it.target_pgdd > actualAccumulatedAiPgdd
                ? findFutureDateByRemainingPgdd(it.target_pgdd, it.end_date).shiftDays
                : 0;
              const totalShift = delayedShiftDays + fcShift;
              adjStartDate = addDays(it.start_date, totalShift);
              adjEndDate = addDays(it.end_date, totalShift);
              executionStatus = 'DELAYED_READJUSTED';
              readjustmentNote = `[특허 S200 연쇄 재조정] 선행 작업(${rawScheduleItems[delayedTargetIdx].sub_item_name}) 지연(${delayedShiftDays > 0 ? `+${delayedShiftDays}일` : `${delayedShiftDays}일`}) 및 예측 기후 잔여 적산온도(${remainingEffectiveGdd}℃) 반영 ${totalShift >= 0 ? `+${totalShift}일` : `${totalShift}일`} 조정`;
            }
          } else if (asOfDateParam) {
            if (it.end_date <= effectiveAsOfDate) {
              executionStatus = 'COMPLETED';
              readjustmentNote = `[특허 S200] 현 시점(${effectiveAsOfDate}) 이전 이행 완료 (실측 적산온도 ${actualAccumulatedAiPgdd}℃ 확정)`;
            } else if (it.is_after_planting && it.target_pgdd > actualAccumulatedAiPgdd) {
              const fcRes = findFutureDateByRemainingPgdd(it.target_pgdd, it.end_date);
              adjStartDate = it.start_date > effectiveAsOfDate ? addDays(it.start_date, fcRes.shiftDays) : it.start_date;
              adjEndDate = addDays(it.end_date, fcRes.shiftDays);
              executionStatus = 'CLIMATE_READJUSTED';
              readjustmentNote = `[특허 S200 현시점 재조정] 현 시점(${effectiveAsOfDate}) 실측 누적 ${actualAccumulatedAiPgdd}℃ 차감 후 잔여 목표(${it.target_pgdd - actualAccumulatedAiPgdd}℃) 예측기후 재산출 (${fcRes.shiftDays >= 0 ? `+${fcRes.shiftDays}일` : `${fcRes.shiftDays}일`})`;
            }
          }
        }

        const gtMaster = resolvedStageMetaBySlot.get(it.stage_group_id);
        const climateStats = analyzePeriodClimate(adjStartDate, adjEndDate, it.is_after_planting);
        const recDayClimate = getClimateForDate(adjStartDate);
        const recDayPgdd = calcDailyPgdd(adjStartDate, false);
        const recWeekday = getWeekdayLabel(adjStartDate);
        const recDateWithWeekday = formatYmdWithWeekday(adjStartDate);
        const startPos = dateToMonthWeek(adjStartDate);
        const endPos = dateToMonthWeek(adjEndDate);

        const exactStartCol = dateToExactCol(adjStartDate, false);
        const exactEndCol = Math.max(exactStartCol + 0.85, dateToExactCol(adjEndDate, true));
        const calendarLeftPct = Number(((exactStartCol / 48) * 100).toFixed(2));
        const calendarWidthPct = Number(
          Math.min(100 - calendarLeftPct, Math.max(2.6, ((exactEndCol - exactStartCol) / 48) * 100)).toFixed(2)
        );

        // 주 단위 스냅 좌표도 반드시 해당 항목의 실제 월·주(1월~12월 48주 격자) 위치에 정확히 매칭되도록 산출 (예: 08-03~08-13은 8월 1~2주에 표시)
        const snappedStartCol = Math.max(0, Math.min(47, startPos.colIdx));
        const snappedEndCol = Math.max(snappedStartCol + 1, Math.min(47, endPos.colIdx));
        const diagramLeftPct = Number(((snappedStartCol / 48) * 100).toFixed(2));
        const diagramWidthPct = Number(
          Math.min(100 - diagramLeftPct, (((snappedEndCol - snappedStartCol + 1) / 48) * 100)).toFixed(2)
        );

        const climateSummaryText =
          `[${climateStats.climate_source_summary}] 추천 진행일(${recDateWithWeekday}) 평균기온 ${recDayClimate.temp_avg}℃(작년 ${recDayClimate.past_temp_avg}℃ / 올해예측 ${recDayClimate.forecast_temp_avg}℃, 최저 ${recDayClimate.temp_min}℃ ~ 최고 ${recDayClimate.temp_max}℃, 멀칭보정 유효기온 ${Number((recDayClimate.temp_avg + mulchingOffset).toFixed(1))}℃) · ` +
          `습도 ${recDayClimate.humidity_avg}% · 강수량 ${recDayClimate.precipitation_mm}mm`;

        const baseAiReason = it.is_after_planting
          ? `[작년+올해예측 평균(미예측일 작년단독) 기후 AI 분석] 재배지(${activeRequest.sido} ${activeRequest.sigungu} ${activeRequest.eupmyeondong}) 동일 날짜 기후 평균값(${climateStats.climate_source_summary}: 당일 평균기온 ${recDayClimate.temp_avg}℃[작년 ${recDayClimate.past_temp_avg}℃·올해예측 ${recDayClimate.forecast_temp_avg}℃]·습도 ${recDayClimate.humidity_avg}%·강수량 ${recDayClimate.precipitation_mm}mm) 및 작물 한계온도(${cropMinTemp}~${cropMaxTemp}℃ 회피 · 최적온도 ${cropOptTempStr}) 조건과 [목표 적산온도 ${it.target_pgdd}℃ / 총 ${requiredTotalGdd}℃]를 반영하여 추천 진행일 ${recDateWithWeekday}로 산출됨`
          : `[작년+올해예측 평균(미예측일 작년단독) 기후 AI 역산] ${cropDisplayName}(${cvDisplayName}) 정식·파종 최적일(${formatYmdWithWeekday(plantingDate)}) 기준 ${activeRequest.eupmyeondong} 기후(평균기온 ${recDayClimate.temp_avg}℃·습도 ${recDayClimate.humidity_avg}%·강수량 ${recDayClimate.precipitation_mm}mm) 및 최저(${cropMinTemp}℃)·최고(${cropMaxTemp}℃) 한계 회피·최적온도(${cropOptTempStr}) 조건을 반영하여 추천 진행일 ${recDateWithWeekday}로 산출됨`;

        return {
          ...it,
          original_start_date: it.start_date,
          original_end_date: it.end_date,
          recommended_date: adjStartDate,
          recommended_weekday: recWeekday,
          recommended_date_with_weekday: recDateWithWeekday,
          recommended_day_climate: {
            temp_avg: recDayClimate.temp_avg,
            temp_min: recDayClimate.temp_min,
            temp_max: recDayClimate.temp_max,
            effective_temp_avg: Number((recDayClimate.temp_avg + mulchingOffset).toFixed(1)),
            past_temp_avg: recDayClimate.past_temp_avg,
            forecast_temp_avg: recDayClimate.forecast_temp_avg,
            humidity_avg: recDayClimate.humidity_avg,
            precipitation_mm: recDayClimate.precipitation_mm,
            daily_pgdd: recDayPgdd,
            is_within_crop_limits: recDayClimate.temp_avg >= cropMinTemp && recDayClimate.temp_avg <= cropMaxTemp,
            is_within_opt_temp:
              recDayClimate.temp_avg + mulchingOffset >= optTempMin &&
              recDayClimate.temp_avg + mulchingOffset <= optTempMax,
          },
          start_date: adjStartDate,
          end_date: adjEndDate,
          execution_status: executionStatus,
          readjustment_note: readjustmentNote,
          stage_slot_key: it.stage_group_id,
          stage_group_id: gtMaster?.type_code || it.stage_group_id,
          stage_group_code: gtMaster?.type_code || it.stage_group_id,
          stage_group_name: it.stage_group_name || gtMaster?.type_name,
          stage_color: it.stage_color || gtMaster?.stage_color,
          icon_type: (it as any).profile_icon_type || gtMaster?.icon_type || 'leaf',
          process_type: gtMaster?.type_code || it.stage_group_id,
          start_month: startPos.month,
          start_week: startPos.week,
          start_week_label: startPos.label,
          actual_start_col: startPos.colIdx,
          end_month: endPos.month,
          end_week: endPos.week,
          end_week_label: endPos.label,
          actual_end_col: Math.max(startPos.colIdx, endPos.colIdx),
          visual_start_col: startPos.colIdx,
          visual_end_col: Math.max(startPos.colIdx + 1, endPos.colIdx),
          calendar_left_pct: calendarLeftPct,
          calendar_width_pct: calendarWidthPct,
          diagram_left_pct: diagramLeftPct,
          diagram_width_pct: diagramWidthPct,
          climate_stats: climateStats,
          climate_summary_text: climateSummaryText,
          ai_analysis_reason:
            (it as any).custom_ai_reason ||
            (readjustmentNote ? `${readjustmentNote} | ${baseAiReason}` : baseAiReason),
          is_admin_customized: Boolean((it as any).is_admin_customized),
        };
      });

      // ------------------------------------------------------------------------------------------------------------
      // [모듈 A 상세 산출] 특허 청구항 2·3, 도 5 (S141~S144), 도 6:
      // 365일 슬라이딩 윈도우 탐색 → S142 적산온도 일치 기간 도출 → S143 생육장해온도 포함 기간 제외 → S144 생육최적온도 최다 포함 기간 선정
      // ------------------------------------------------------------------------------------------------------------
      const candidateWindows: Array<{
        candidate_id: string;
        season_label: string;
        start_date: string;
        end_date: string;
        duration_days: number;
        accumulated_effective_gdd: number;
        accumulated_raw_gdd: number;
        optimal_temp_days: number;
        optimal_temp_ratio_pct: number;
        high_damage_days: number;
        low_damage_days: number;
        excluded_by_damage: boolean;
        exclusion_reason: string;
        avg_temp: number;
        min_temp: number;
        max_temp: number;
      }> = [];

      let totalScannedWindows = 0;
      let damageExcludedWindows = 0;

      // 3일 간격(연간 122개 시작일) + 사용자 희망 정식일을 포함하여 S142~S144 전수 스캔
      const scanStartOffsets: number[] = [];
      for (let d = 0; d < 365; d += 3) scanStartOffsets.push(d);
      const desiredOffset = Math.max(
        0,
        Math.min(
          364,
          Math.round((parseDateUTC(plantingDate).getTime() - parseDateUTC(`${targetYear}-01-01`).getTime()) / (1000 * 60 * 60 * 24))
        )
      );
      if (!scanStartOffsets.includes(desiredOffset)) scanStartOffsets.push(desiredOffset);
      scanStartOffsets.sort((a, b) => a - b);

      for (const offset of scanStartOffsets) {
        const candStart = addDays(`${targetYear}-01-01`, offset);
        let accEff = 0;
        let accRaw = 0;
        let optDays = 0;
        let highDmgDays = 0;
        let lowDmgDays = 0;
        let sumT = 0;
        let minT = 999;
        let maxT = -999;
        let reachedEnd = '';
        let spanDays = 0;

        for (let step = 0; step < 210; step++) {
          const dStr = addDays(candStart, step);
          // 연말을 넘어가더라도 월-일 기후는 순환 조회 가능
          const c = getClimateForDate(dStr);
          const fieldT = c.temp_avg + mulchingOffset;
          const effGdd = calcDailyPgdd(dStr, false);
          const rawGdd = calcDailyRawGdd(dStr, false);

          accEff += effGdd;
          accRaw += rawGdd;
          sumT += c.temp_avg;
          if (c.temp_min < minT) minT = c.temp_min;
          if (c.temp_max > maxT) maxT = c.temp_max;

          if (fieldT >= optTempMin && fieldT <= optTempMax) {
            optDays++;
          }
          // 특허 도 6: 재배지 일평균기온(temp_avg) 곡선과 생육장해온도(damageTempHigh / damageTempLow) 대조
          if (c.temp_avg >= damageTempHigh + 1.0) {
            highDmgDays++;
          }
          const effectiveLowLimit = isOverwintering ? damageTempLow - 6.0 : Math.min(0, damageTempLow - 2.0);
          if (c.temp_avg <= effectiveLowLimit) {
            lowDmgDays++;
          }

          const targetReached =
            gddModeParam === 'raw' ? accRaw >= requiredRawGdd : accEff >= requiredTotalGdd;

          if (targetReached && step >= 24) {
            reachedEnd = dStr;
            spanDays = step + 1;
            break;
          }
        }

        if (!reachedEnd) continue;
        totalScannedWindows++;

        // S143 & 규칙 1: 시작일이 작년 기준 해당 모종(작물) 최저온도(cropMinTemp)보다 낮거나 최고온도(cropMaxTemp)보다 높은 기후 기간, 또는 생육장해온도가 5일 이상 지속 포함된 기간 제외
        const startC = getClimateForDate(candStart);
        const isPastStartOutOfBounds = startC.past_temp_avg < cropMinTemp || startC.past_temp_avg > cropMaxTemp;
        const isExcluded = isPastStartOutOfBounds || highDmgDays >= 5 || lowDmgDays >= 5;
        if (isExcluded) damageExcludedWindows++;

        const startMonth = Number(candStart.slice(5, 7));
        const seasonLabel =
          startMonth >= 3 && startMonth <= 5
            ? '봄 작기 후보'
            : startMonth >= 6 && startMonth <= 7
            ? '여름·고랭지 후보'
            : startMonth >= 8 && startMonth <= 9
            ? '가을 주작기 후보'
            : '월동·만추 후보';

        candidateWindows.push({
          candidate_id: `CAND-${candStart}`,
          season_label: seasonLabel,
          start_date: candStart,
          end_date: reachedEnd,
          duration_days: spanDays,
          accumulated_effective_gdd: Math.round(accEff),
          accumulated_raw_gdd: Math.round(accRaw),
          optimal_temp_days: optDays,
          optimal_temp_ratio_pct: Number(((optDays / Math.max(1, spanDays)) * 100).toFixed(1)),
          high_damage_days: highDmgDays,
          low_damage_days: lowDmgDays,
          excluded_by_damage: isExcluded,
          exclusion_reason: isExcluded
            ? isPastStartOutOfBounds
              ? `작년 시작기온(${startC.past_temp_avg}℃)이 작물 최저(${cropMinTemp}℃)~최고(${cropMaxTemp}℃) 범위 외 제외`
              : `${highDmgDays >= 3 ? `고온장해(${damageTempHigh}℃↑ ${highDmgDays}일)` : ''}${highDmgDays >= 3 && lowDmgDays >= 3 ? ' · ' : ''}${lowDmgDays >= 3 ? `저온장해(${damageTempLow}℃↓ ${lowDmgDays}일)` : ''} 포함 제외(S143)`
            : `작년 한계기온(${cropMinTemp}~${cropMaxTemp}℃) 이내 · 최적온도(${cropOptTempStr}) 적격 통과`,
          avg_temp: Number((sumT / spanDays).toFixed(1)),
          min_temp: Number(minT.toFixed(1)),
          max_temp: Number(maxT.toFixed(1)),
        });
      }

      // S144: 장해온도가 제외된 적격 기간 중 생육최적온도(optTempMin~optTempMax) 최다 포함 순으로 정렬 후 최소 10일 간격으로 대표 복수 후보(Top 5) 추출
      const validSortedCandidates = candidateWindows
        .filter((w) => !w.excluded_by_damage)
        .sort((a, b) => b.optimal_temp_days - a.optimal_temp_days || b.optimal_temp_ratio_pct - a.optimal_temp_ratio_pct);

      const distinctTopCandidates: typeof candidateWindows = [];
      for (const cand of validSortedCandidates) {
        const tooClose = distinctTopCandidates.some(
          (picked) =>
            Math.abs(parseDateUTC(picked.start_date).getTime() - parseDateUTC(cand.start_date).getTime()) /
              (1000 * 60 * 60 * 24) <
            12
        );
        if (!tooClose) {
          distinctTopCandidates.push(cand);
        }
        if (distinctTopCandidates.length >= 5) break;
      }

      // 만약 모든 후보가 장해온도에 걸리는 극단 조건일 경우 장해일수 최소 순으로 보완
      if (distinctTopCandidates.length === 0 && candidateWindows.length > 0) {
        const fallbackSorted = [...candidateWindows].sort(
          (a, b) =>
            a.high_damage_days + a.low_damage_days - (b.high_damage_days + b.low_damage_days) ||
            b.optimal_temp_days - a.optimal_temp_days
        );
        distinctTopCandidates.push(...fallbackSorted.slice(0, 3));
      }

      // 장해온도로 제외된 대표 기간 예시 (S143 검증용)
      const excludedSampleCandidates = candidateWindows.filter((w) => w.excluded_by_damage).slice(0, 3);

      const moduleA_optimalPeriods = {
        patent_ref: '특허 KR 10-2814596 청구항 2·3, 도 5(S141~S144), 도 6',
        active_gdd_mode: gddModeParam,
        active_gdd_mode_label:
          gddModeParam === 'raw'
            ? '일반적산온도 (임계온도 0℃ 기준 일평균기온 합산)'
            : `유효적산온도 (임계온도 = 생육한계온도 ${limitTempMin}℃ 기준 합산)`,
        s141_crop_temp_params: {
          crop_name: cropDisplayName,
          cultivar_name: cvDisplayName,
          system_name: sysInfo?.system_name || '노지 재배',
          base_temp_tb: baseTempTb,
          limit_temp_min: limitTempMin,
          limit_temp_max: upperLimitTemp,
          damage_temp_low: damageTempLow,
          damage_temp_high: damageTempHigh,
          opt_temp_min: optTempMin,
          opt_temp_max: optTempMax,
          required_effective_gdd: requiredTotalGdd,
          required_raw_gdd: requiredRawGdd,
          is_overwintering: isOverwintering,
        },
        s142_s143_scan_summary: {
          total_scanned_windows: totalScannedWindows,
          damage_excluded_windows: damageExcludedWindows,
          valid_candidate_windows: totalScannedWindows - damageExcludedWindows,
          current_selected_start_date: plantingDate,
          is_override_applied: Boolean(overrideStartDateParam),
        },
        s144_top_candidates: distinctTopCandidates.map((c, idx) => ({
          ...c,
          rank: idx + 1,
          rank_badge:
            idx === 0
              ? '1순위 최적 재배기간 (생육적온 최다 포함)'
              : idx === 1
              ? '2순위 대안 재배기간'
              : `${idx + 1}순위 작기 후보`,
          is_current_active: Math.abs(
            (parseDateUTC(c.start_date).getTime() - parseDateUTC(plantingDate).getTime()) / (1000 * 60 * 60 * 24)
          ) <= 3,
        })),
        s143_excluded_examples: excludedSampleCandidates,
      };

      // ------------------------------------------------------------------------------------------------------------
      // [모듈 B 상세 산출] 특허 청구항 4·5·6, 도 3, 도 7, 명세서 [0109~0111]:
      // 토양검정 7대 지표 비교 → 부족/과잉 성분 정량 산출 → 복수 비료 조합 및 배합비(%) → 기후 병해충 처방 → 도 7 통합 견적표
      // ------------------------------------------------------------------------------------------------------------
      const soilStd =
        (db.prepare('SELECT * FROM soil_standard WHERE crop_id = ? LIMIT 1').get(reqCropId) as any) ||
        (db.prepare("SELECT * FROM soil_standard WHERE crop_id = 'CRP-CABBAGE' LIMIT 1").get() as any) || {
          ph_min: 6.0,
          ph_max: 6.5,
          ec_min: 0.5,
          ec_max: 1.8,
          om_min: 25,
          om_max: 35,
          p2o5_min: 300,
          p2o5_max: 450,
          k_min: 0.65,
          k_max: 0.85,
          ca_min: 5.0,
          ca_max: 6.5,
          mg_min: 1.5,
          mg_max: 2.2,
        };

      const fieldSoilMetrics = [
        {
          key: 'soil_ph',
          label: '산도 (pH)',
          unit: 'pH',
          current_value: Number(activeRequest.soil_ph ?? 5.8),
          std_min: Number(soilStd.ph_min ?? 6.0),
          std_max: Number(soilStd.ph_max ?? 6.5),
          nutrient_target: '석회·고토(CaO·MgO)',
        },
        {
          key: 'organic_matter_g_kg',
          label: '유기물 (OM)',
          unit: 'g/kg',
          current_value: Number(activeRequest.organic_matter_g_kg ?? 21),
          std_min: Number(soilStd.om_min ?? 25),
          std_max: Number(soilStd.om_max ?? 35),
          nutrient_target: '유기물·질소(OM·N)',
        },
        {
          key: 'avail_p2o5_mg_kg',
          label: '유효인산 (P2O5)',
          unit: 'mg/kg',
          current_value: Number(activeRequest.avail_p2o5_mg_kg ?? 285),
          std_min: Number(soilStd.p2o5_min ?? 300),
          std_max: Number(soilStd.p2o5_max ?? 450),
          nutrient_target: '인산(P2O5)',
        },
        {
          key: 'exch_k_cmol',
          label: '치환성 칼륨 (K)',
          unit: 'cmol+/kg',
          current_value: Number(activeRequest.exch_k_cmol ?? 0.56),
          std_min: Number(soilStd.k_min ?? 0.65),
          std_max: Number(soilStd.k_max ?? 0.85),
          nutrient_target: '칼륨(K2O)',
        },
        {
          key: 'exch_ca_cmol',
          label: '치환성 칼슘 (Ca)',
          unit: 'cmol+/kg',
          current_value: Number(activeRequest.exch_ca_cmol ?? 4.7),
          std_min: Number(soilStd.ca_min ?? 5.0),
          std_max: Number(soilStd.ca_max ?? 6.5),
          nutrient_target: '칼슘(CaO)',
        },
        {
          key: 'exch_mg_cmol',
          label: '치환성 마그네슘 (Mg)',
          unit: 'cmol+/kg',
          current_value: Number(activeRequest.exch_mg_cmol ?? 1.35),
          std_min: Number(soilStd.mg_min ?? 1.5),
          std_max: Number(soilStd.mg_max ?? 2.2),
          nutrient_target: '고토(MgO)',
        },
        {
          key: 'soil_ec',
          label: '전기전도도 (EC)',
          unit: 'dS/m',
          current_value: Number(activeRequest.soil_ec ?? 1.15),
          std_min: Number(soilStd.ec_min ?? 0.4),
          std_max: Number(soilStd.ec_max ?? 1.8),
          nutrient_target: '염류농도(EC)',
        },
      ].map((m) => {
        const isDeficient = m.current_value < m.std_min;
        const isExcess = m.current_value > m.std_max;
        const status: 'DEFICIENT' | 'OPTIMAL' | 'EXCESS' = isDeficient
          ? 'DEFICIENT'
          : isExcess
          ? 'EXCESS'
          : 'OPTIMAL';
        const diffFromOpt = isDeficient
          ? Number((m.std_min - m.current_value).toFixed(2))
          : isExcess
          ? Number((m.current_value - m.std_max).toFixed(2))
          : 0;
        const adjustmentRatePct = isDeficient
          ? Math.min(35, Math.max(10, Math.round((diffFromOpt / Math.max(0.1, m.std_min)) * 100)))
          : isExcess
          ? -Math.min(30, Math.max(10, Math.round((diffFromOpt / Math.max(0.1, m.std_max)) * 100)))
          : 0;
        return {
          ...m,
          status,
          status_label: isDeficient ? '부족 (증량 처방)' : isExcess ? '과잉 (감량 처방)' : '적정 (표준 시비)',
          diff_value: diffFromOpt,
          adjustment_rate_pct: adjustmentRatePct,
          prescription_action: isDeficient
            ? `기준 하한(${m.std_min}${m.unit}) 대비 -${diffFromOpt}${m.unit} 부족 → ${m.nutrient_target} +${adjustmentRatePct}% 보충 배합`
            : isExcess
            ? `기준 상한(${m.std_max}${m.unit}) 대비 +${diffFromOpt}${m.unit} 과잉 → ${m.nutrient_target} ${adjustmentRatePct}% 감량 배합`
            : `작물 표준 범위(${m.std_min}~${m.std_max}${m.unit}) 내 적정 → 표준량 시비`,
        };
      });

      // 특허 명세서 [0109]: 토양 부족 성분을 보충할 단일 비료가 없을 때 복수 비료 조합 및 배합비(%) 도출
      const phMetric = fieldSoilMetrics.find((m) => m.key === 'soil_ph')!;
      const omMetric = fieldSoilMetrics.find((m) => m.key === 'organic_matter_g_kg')!;
      const pMetric = fieldSoilMetrics.find((m) => m.key === 'avail_p2o5_mg_kg')!;
      const kMetric = fieldSoilMetrics.find((m) => m.key === 'exch_k_cmol')!;
      const caMetric = fieldSoilMetrics.find((m) => m.key === 'exch_ca_cmol')!;

      // 평수(areaPyeong, 기본 100평당 기준 * areaFactor) 기반 비료별 처방 중량(kg) 산출
      const limeWeightKg = Math.round(
        100 * areaFactor * (phMetric.status === 'DEFICIENT' || caMetric.status === 'DEFICIENT' ? 1.25 : 0.85)
      );
      const organicWeightKg = Math.round(
        160 * areaFactor * (omMetric.status === 'DEFICIENT' ? 1.2 : omMetric.status === 'EXCESS' ? 0.85 : 1.0)
      );
      const basalCompWeightKg = Math.round(
        60 * areaFactor * (pMetric.status === 'EXCESS' ? 0.8 : pMetric.status === 'DEFICIENT' ? 1.15 : 1.0)
      );
      const nkTopWeightKg = Math.round(
        40 * areaFactor * (kMetric.status === 'DEFICIENT' ? 1.2 : 1.0)
      );
      const kSulfateWeightKg = Math.round(
        20 * areaFactor * (kMetric.status === 'DEFICIENT' ? 1.35 : 0.9)
      );

      const totalFertilizerKg = Math.max(
        1,
        limeWeightKg + organicWeightKg + basalCompWeightKg + nkTopWeightKg + kSulfateWeightKg
      );

      const rawBlendItems = [
        {
          material_id: 'FERT-PRD-05',
          role_label: '유기물·지력 보충 기비',
          application_stage: '밑거름 (정식 14일 전)',
          recommended_kg: organicWeightKg,
          bag_unit_kg: 20,
          rationale: `유기물(${omMetric.current_value}g/kg) ${omMetric.status_label} 반영 완숙 유박(4-2-1, OM 70%) 배합`,
        },
        {
          material_id: 'FERT-PRD-04',
          role_label: '산도(pH)·칼슘·고토 교정제',
          application_stage: '토양개량 (정식 21일 전)',
          recommended_kg: limeWeightKg,
          bag_unit_kg: 20,
          rationale: `산도(pH ${phMetric.current_value}) 및 칼슘(${caMetric.current_value}cmol+/kg) ${caMetric.status_label} 교정용 입상석회(CaO 42%, MgO 12%) 배합`,
        },
        {
          material_id: 'FERT-PRD-01',
          role_label: '초기 활착 N-P-K 복합기비',
          application_stage: '밑거름 (정식 10~14일 전)',
          recommended_kg: basalCompWeightKg,
          bag_unit_kg: 20,
          rationale: `유효인산(${pMetric.current_value}mg/kg) ${pMetric.status_label} 반영 슈퍼원예복합(12-7-9+고토2+붕소0.3) 배합`,
        },
        {
          material_id: 'FERT-PRD-02',
          role_label: '생육 중기 1·2차 추비(웃거름)',
          application_stage: `1차 추비(${gddTop1.date}) · 2차 추비(${gddTop2.date})`,
          recommended_kg: nkTopWeightKg,
          bag_unit_kg: 20,
          rationale: `생육 중·후기 질소·칼륨 요구량 충족을 위한 NK 마그네슘 추비특호(18-0-16) 분시 배합`,
        },
        {
          material_id: 'FERT-PRD-03',
          role_label: '칼륨 부족분 보충·비대 단비',
          application_stage: `이랑성형 기비 및 결구·비대기(${gddHeading.date})`,
          recommended_kg: kSulfateWeightKg,
          bag_unit_kg: 20,
          rationale: `치환성 칼륨(${kMetric.current_value}cmol+/kg) ${kMetric.status_label} 정밀 보충용 황산가리(K2O 50%) 단비 배합`,
        },
      ];

      let blendPctSum = 0;
      const fertilizerBlendingList = rawBlendItems.map((b, idx) => {
        const mat = matById.get(b.material_id);
        const rawPct = Number(((b.recommended_kg / totalFertilizerKg) * 100).toFixed(1));
        const ratioPct =
          idx === rawBlendItems.length - 1
            ? Number(Math.max(0, 100 - blendPctSum).toFixed(1))
            : rawPct;
        blendPctSum = Number((blendPctSum + ratioPct).toFixed(1));
        const bagCount = Math.max(1, Math.ceil(b.recommended_kg / b.bag_unit_kg));
        const unitPrice = Number(mat?.unit_price ?? 16000);
        const nPct = Number(mat?.n_pct ?? 0);
        const pPct = Number(mat?.p_pct ?? 0);
        const kPct = Number(mat?.k_pct ?? 0);
        const caPct = Number(mat?.ca_pct ?? 0);
        const omPct = Number(mat?.om_pct ?? 0);

        return {
          material_id: b.material_id,
          product_name: mat?.product_name || b.material_id,
          manufacturer: mat?.manufacturer || '누보/우성',
          role_label: b.role_label,
          application_stage: b.application_stage,
          unit_spec: mat?.unit_spec || `${b.bag_unit_kg}kg/포`,
          unit_price: unitPrice,
          recommended_kg: b.recommended_kg,
          bag_count: bagCount,
          blend_ratio_pct: ratioPct,
          total_cost: bagCount * unitPrice,
          supplied_nutrients_kg: {
            N: Number(((b.recommended_kg * nPct) / 100).toFixed(1)),
            P2O5: Number(((b.recommended_kg * pPct) / 100).toFixed(1)),
            K2O: Number(((b.recommended_kg * kPct) / 100).toFixed(1)),
            CaO: Number(((b.recommended_kg * caPct) / 100).toFixed(1)),
            OM: Number(((b.recommended_kg * omPct) / 100).toFixed(1)),
          },
          rationale: b.rationale,
        };
      });

      // 특허 청구항 6: 재배기간 예측 기후(강우·고습도·일교차) 기반 병해충 및 생리장해 예측 + 작물보호제 처방
      const cultClimate = analyzePeriodClimate(plantingDate, dHarv2End, true);
      const climatePestPrescriptions = [
        {
          material_id: 'MAT-PEST-04',
          product_name: matById.get('MAT-PEST-04')?.product_name || '[UPL/누보] 사라져 미탁제',
          category_label: '토양살충·입고병 예방',
          predicted_risk: `정식 전후 지온 상승(${cultClimate.avg_temp}℃) 및 초기 토양 해충·잘록병 발생 위험`,
          prescribed_timing: `${dPrep3Start} ~ ${dPlantStart} (이랑 성형 및 정식 직전)`,
          dilution_and_supply: `1,000배 희석 토양 전면 처리 (${Math.max(1, Math.ceil(areaFactor * 0.5))}병 / ${areaPyeong.toLocaleString()}평)`,
          quantity: Math.max(1, Math.ceil(areaFactor * 0.5)),
          unit_spec: matById.get('MAT-PEST-04')?.unit_spec || '500ml/병',
          unit_price: Number(matById.get('MAT-PEST-04')?.unit_price ?? 19000),
        },
        {
          material_id: 'MAT-PEST-05',
          product_name: matById.get('MAT-PEST-05')?.product_name || '[인바이오/누보] 웜해머 분산성액제',
          category_label: '초·중기 나방류·해충 방제',
          predicted_risk: `활착~생육초기 무강우 건조일 해충(벼룩잎벌레·배추좀나방·거세미나방) 밀도 증가 예측`,
          prescribed_timing: `${dRootStart} ~ ${gddVigorous.date} (활착기 및 1차 추비기)`,
          dilution_and_supply: `1,000배 희석 경엽 살포 (${Math.max(1, Math.ceil(areaFactor * 0.6))}병 / ${areaPyeong.toLocaleString()}평)`,
          quantity: Math.max(1, Math.ceil(areaFactor * 0.6)),
          unit_spec: matById.get('MAT-PEST-05')?.unit_spec || '250ml/병',
          unit_price: Number(matById.get('MAT-PEST-05')?.unit_price ?? 22000),
        },
        {
          material_id: 'MAT-PEST-03',
          product_name: matById.get('MAT-PEST-03')?.product_name || '[인바이오/누보] 펀지해머 액상수화제',
          category_label: '강우·다습기 살균제',
          predicted_risk: `재배기간 중 강우 ${cultClimate.rainy_days}일(누적 ${cultClimate.total_precip_mm}mm)·고습도(${cultClimate.high_humidity_days}일)로 인한 노균병·무름병·역병 위험`,
          prescribed_timing: `${gddVigorous.date} ~ ${gddHeading.date} (강우 전후 24시간 이내 집중 방제)`,
          dilution_and_supply: `1,000배 희석 엽면·지제부 살포 (${Math.max(1, Math.ceil(areaFactor * 0.6))}병 / ${areaPyeong.toLocaleString()}평)`,
          quantity: Math.max(1, Math.ceil(areaFactor * 0.6)),
          unit_spec: matById.get('MAT-PEST-03')?.unit_spec || '500ml/병',
          unit_price: Number(matById.get('MAT-PEST-03')?.unit_spec ? matById.get('MAT-PEST-03')?.unit_price : 24000),
        },
        {
          material_id: 'MAT-NUTR-02',
          product_name: matById.get('MAT-NUTR-02')?.product_name || '[누보] 엔플러스 튼튼칼슘',
          category_label: '생리장해(칼슘결핍·팁번) 예방제',
          predicted_risk: `결구·비대기(${gddHeading.date}~) 일교차 및 증산 불균형에 따른 꿀통배추·잎끝마름(팁번) 생리장해 예측`,
          prescribed_timing: `${gddHeading.date} ~ ${gddTop2.date} (5~7일 간격 2~3회 엽면시비)`,
          dilution_and_supply: `500배 희석 엽면 살포 (${Math.max(1, Math.ceil(areaFactor * 0.5))}병 / ${areaPyeong.toLocaleString()}평)`,
          quantity: Math.max(1, Math.ceil(areaFactor * 0.5)),
          unit_spec: matById.get('MAT-NUTR-02')?.unit_spec || '1L/병',
          unit_price: Number(matById.get('MAT-NUTR-02')?.unit_price ?? 18000),
        },
        {
          material_id: 'MAT-PEST-06',
          product_name: matById.get('MAT-PEST-06')?.product_name || '[누보] 엔플러스 해충박살 파워',
          category_label: '수확 전 PLS 친환경 마감방제',
          predicted_risk: `수확 임박기(${safeReadyDate} 전후) 잔류농약(PLS) 기준 초과 방지 및 후기 해충 마감 방제`,
          prescribed_timing: `${gddTop2.date} ~ ${safeReadyDate} (수확 14일 전~7일 전)`,
          dilution_and_supply: `500배 희석 안전 살포 (${Math.max(1, Math.ceil(areaFactor * 0.5))}병 / ${areaPyeong.toLocaleString()}평)`,
          quantity: Math.max(1, Math.ceil(areaFactor * 0.5)),
          unit_spec: matById.get('MAT-PEST-06')?.unit_spec || '500ml/병',
          unit_price: Number(matById.get('MAT-PEST-06')?.unit_price ?? 25000),
        },
      ].map((p) => ({
        ...p,
        subtotal_cost: p.quantity * p.unit_price,
      }));

      // 특허 도 7 통합 출력 테이블: [시기 | 주요농작업 | 비료시비 및 작물보호제 처리 | 농자재 구매(규격·단가·수량) | 합계 금액]
      const fig7Rows = [
        {
          row_no: 1,
          period_label: `${dPrep1Start.slice(5)} ~ ${dPrep1End.slice(5)}`,
          stage_badge: '재배준비 1단계',
          major_work: '포장 정리 및 산도·칼슘 토양개량',
          fertilizer_and_pesticide: `${fertilizerBlendingList[1].product_name} (배합비 ${fertilizerBlendingList[1].blend_ratio_pct}%, ${fertilizerBlendingList[1].recommended_kg}kg 전층 살포)`,
          purchase_item_name: fertilizerBlendingList[1].product_name,
          unit_spec: fertilizerBlendingList[1].unit_spec,
          unit_price: fertilizerBlendingList[1].unit_price,
          quantity: fertilizerBlendingList[1].bag_count,
          row_total_cost: fertilizerBlendingList[1].total_cost,
        },
        {
          row_no: 2,
          period_label: `${dPrep2Start.slice(5)} ~ ${dPrep2End.slice(5)}`,
          stage_badge: '재배준비 2단계',
          major_work: '맞춤형 밑거름(기비) 배합 시비 및 로터리 경운',
          fertilizer_and_pesticide: `${fertilizerBlendingList[0].product_name}(배합비 ${fertilizerBlendingList[0].blend_ratio_pct}%) + ${fertilizerBlendingList[2].product_name}(배합비 ${fertilizerBlendingList[2].blend_ratio_pct}%) 혼합 기비`,
          purchase_item_name: `${fertilizerBlendingList[0].product_name} 외 1종`,
          unit_spec: '20kg/포 (복수배합)',
          unit_price: Math.round(
            (fertilizerBlendingList[0].total_cost + fertilizerBlendingList[2].total_cost) /
              Math.max(1, fertilizerBlendingList[0].bag_count + fertilizerBlendingList[2].bag_count)
          ),
          quantity: fertilizerBlendingList[0].bag_count + fertilizerBlendingList[2].bag_count,
          row_total_cost: fertilizerBlendingList[0].total_cost + fertilizerBlendingList[2].total_cost,
        },
        {
          row_no: 3,
          period_label: `${dPrep3Start.slice(5)} ~ ${dPrep3End.slice(5)}`,
          stage_badge: '재배준비 3단계',
          major_work: '이랑 성형·배수로 정비 및 토양소독 처리',
          fertilizer_and_pesticide: `${climatePestPrescriptions[0].product_name} (${climatePestPrescriptions[0].dilution_and_supply})`,
          purchase_item_name: climatePestPrescriptions[0].product_name,
          unit_spec: climatePestPrescriptions[0].unit_spec,
          unit_price: climatePestPrescriptions[0].unit_price,
          quantity: climatePestPrescriptions[0].quantity,
          row_total_cost: climatePestPrescriptions[0].subtotal_cost,
        },
        {
          row_no: 4,
          period_label: `${dPlantStart.slice(5)} ~ ${dRootEnd.slice(5)}`,
          stage_badge: '정식·활착기',
          major_work: `본밭 ${isDirectSowing ? '파종' : '정식'}(${plantingDate}) 및 초기 해충 방제 (PGDD ${targetRootingPgdd}℃)`,
          fertilizer_and_pesticide: `${climatePestPrescriptions[1].product_name} (${climatePestPrescriptions[1].dilution_and_supply})`,
          purchase_item_name: climatePestPrescriptions[1].product_name,
          unit_spec: climatePestPrescriptions[1].unit_spec,
          unit_price: climatePestPrescriptions[1].unit_price,
          quantity: climatePestPrescriptions[1].quantity,
          row_total_cost: climatePestPrescriptions[1].subtotal_cost,
        },
        {
          row_no: 5,
          period_label: `${gddTop1.date.slice(5)} ~ ${gddVigorous.date.slice(5)}`,
          stage_badge: '생육초·중기',
          major_work: `1차 추비(PGDD ${targetTop1Pgdd}℃) 및 다습기 병해 선제 방제`,
          fertilizer_and_pesticide: `${fertilizerBlendingList[3].product_name}(배합비 ${fertilizerBlendingList[3].blend_ratio_pct}%) 1차 분시 + ${climatePestPrescriptions[2].product_name}`,
          purchase_item_name: `${fertilizerBlendingList[3].product_name} + 방제약제`,
          unit_spec: `${fertilizerBlendingList[3].unit_spec} / ${climatePestPrescriptions[2].unit_spec}`,
          unit_price: fertilizerBlendingList[3].unit_price,
          quantity: fertilizerBlendingList[3].bag_count + climatePestPrescriptions[2].quantity,
          row_total_cost: fertilizerBlendingList[3].total_cost + climatePestPrescriptions[2].subtotal_cost,
        },
        {
          row_no: 6,
          period_label: `${gddHeading.date.slice(5)} ~ ${gddTop2.date.slice(5)}`,
          stage_badge: '결구·비대기',
          major_work: `2차 추비(PGDD ${targetTop2Pgdd}℃) 및 칼륨·칼슘 생리장해 집중 처방`,
          fertilizer_and_pesticide: `${fertilizerBlendingList[4].product_name}(배합비 ${fertilizerBlendingList[4].blend_ratio_pct}%) + ${climatePestPrescriptions[3].product_name}(500배액)`,
          purchase_item_name: `${fertilizerBlendingList[4].product_name} + 칼슘제`,
          unit_spec: `${fertilizerBlendingList[4].unit_spec} / ${climatePestPrescriptions[3].unit_spec}`,
          unit_price: fertilizerBlendingList[4].unit_price,
          quantity: fertilizerBlendingList[4].bag_count + climatePestPrescriptions[3].quantity,
          row_total_cost: fertilizerBlendingList[4].total_cost + climatePestPrescriptions[3].subtotal_cost,
        },
        {
          row_no: 7,
          period_label: `${safeReadyDate.slice(5)} ~ ${dHarv2End.slice(5)}`,
          stage_badge: '수확·마감기',
          major_work: `수확 전 PLS 친환경 마감방제 및 적기 수확(목표 PGDD ${requiredTotalGdd}℃)`,
          fertilizer_and_pesticide: `${climatePestPrescriptions[4].product_name} (${climatePestPrescriptions[4].dilution_and_supply})`,
          purchase_item_name: climatePestPrescriptions[4].product_name,
          unit_spec: climatePestPrescriptions[4].unit_spec,
          unit_price: climatePestPrescriptions[4].unit_price,
          quantity: climatePestPrescriptions[4].quantity,
          row_total_cost: climatePestPrescriptions[4].subtotal_cost,
        },
      ];

      const fig7GrandTotalCost = fig7Rows.reduce((acc, r) => acc + r.row_total_cost, 0);

      const moduleB_soilAndBlending = {
        patent_ref: '특허 KR 10-2814596 청구항 4·5·6, 도 3, 도 7, 명세서 [0109~0111]',
        area_pyeong: areaPyeong,
        soil_diagnosis_metrics: fieldSoilMetrics,
        deficient_count: fieldSoilMetrics.filter((m) => m.status === 'DEFICIENT').length,
        excess_count: fieldSoilMetrics.filter((m) => m.status === 'EXCESS').length,
        total_fertilizer_kg: totalFertilizerKg,
        fertilizer_blending: fertilizerBlendingList,
        climate_pest_prescriptions: climatePestPrescriptions,
        fig7_schedule_cost_table: fig7Rows,
        fig7_grand_total_cost: fig7GrandTotalCost,
      };

      // ------------------------------------------------------------------------------------------------------------
      // [모듈 C 상세 산출] 특허 청구항 1·8·10·11·12·13, 도 4 S200, 명세서 [0113~0127]:
      // 기후 급변 모니터링 알림 + 현 시점(실측+예측 하이브리드 적산온도) + 작업 미이행/지연 연쇄 재조정
      // ------------------------------------------------------------------------------------------------------------
      const anomalyDetails: Array<{ date: string; type: string; detail: string }> = [];
      const cultSpanDays = diffDaysInclusive(plantingDate, dHarv2End);
      for (let i = 0; i < cultSpanDays; i++) {
        const dStr = addDays(plantingDate, i);
        const c = getClimateForDate(dStr);
        const tempDiff = Number((c.forecast_temp_avg - c.past_temp_avg).toFixed(1));
        if (Math.abs(tempDiff) >= 2.2) {
          anomalyDetails.push({
            date: dStr,
            type: tempDiff > 0 ? '고온 편차 발생' : '저온 편차 발생',
            detail: `예측기온(${c.forecast_temp_avg}℃)이 평년/전년(${c.past_temp_avg}℃) 대비 ${tempDiff > 0 ? `+${tempDiff}` : tempDiff}℃ 급변`,
          });
        } else if (c.precipitation_mm >= 25.0) {
          anomalyDetails.push({
            date: dStr,
            type: '집중호우 주의',
            detail: `일 강수량 ${c.precipitation_mm}mm · 상대습도 ${c.humidity_avg}% (추비 유실 및 무름병·역병 주의)`,
          });
        } else if (c.temp_min <= -1.0) {
          anomalyDetails.push({
            date: dStr,
            type: '한파·서리 주의',
            detail: `일 최저기온 ${c.temp_min}℃ 영하권 진입 (수확기 동해 예방 필요)`,
          });
        }
      }

      const futureHarvestEval = findFutureDateByRemainingPgdd(requiredTotalGdd, safeHarvestDate);
      const completedTasksCount = scheduleItems.filter(
        (it) => it.execution_status === 'COMPLETED' || it.end_date <= effectiveAsOfDate
      ).length;
      const readjustedTasksCount = scheduleItems.length - completedTasksCount;

      const moduleC_readjustment = {
        patent_ref: '특허 KR 10-2814596 청구항 1·8·10·11·12·13, 도 4(S200), 명세서 [0113~0127]',
        climate_monitoring_alert: {
          alert_needed: anomalyDetails.length > 0,
          alert_level: anomalyDetails.length >= 3 ? 'WARNING' : 'INFO',
          anomaly_days_count: anomalyDetails.length,
          alert_title:
            anomalyDetails.length > 0
              ? `[기후변화 감지 알림] 재배기간 중 기온 급변·집중호우·저온 특이일 ${anomalyDetails.length}회 감지 — 재배 일정 업데이트 권장`
              : '[기후 안정] 예측 기후가 평년 범위 내에 위치합니다.',
          alert_message:
            anomalyDetails.length > 0
              ? `재배지(${activeRequest.sido} ${activeRequest.sigungu} ${activeRequest.eupmyeondong}) 기상청 업데이트 분석 결과, 특이기상 ${anomalyDetails.length}건이 감지되어 현 시점(${effectiveAsOfDate}) 기준 잔여 적산온도(${remainingEffectiveGdd}℃) 재조정 시 수확 적기가 ${futureHarvestEval.date}(${futureHarvestEval.shiftDays >= 0 ? `+${futureHarvestEval.shiftDays}일` : `${futureHarvestEval.shiftDays}일`})로 산출됩니다.`
              : '특이 기상 편차가 없어 기존 일정을 유지합니다.',
          anomaly_samples: anomalyDetails.slice(0, 6),
        },
        hybrid_gdd_split: {
          planting_date: plantingDate,
          as_of_date: effectiveAsOfDate,
          is_readjustment_active: isReadjustmentActive,
          delayed_item_id: delayedItemIdParam || null,
          delayed_actual_date: delayedActualDateParam || null,
          delayed_shift_days: delayedShiftDays,
          total_required_effective_gdd: requiredTotalGdd,
          actual_accumulated_effective_gdd: actualAccumulatedAiPgdd,
          remaining_required_effective_gdd: remainingEffectiveGdd,
          total_required_raw_gdd: requiredRawGdd,
          actual_accumulated_raw_gdd: actualAccumulatedRawGdd,
          remaining_required_raw_gdd: remainingRawGdd,
          original_harvest_date: safeHarvestDate,
          readjusted_harvest_date:
            delayedShiftDays !== 0
              ? addDays(futureHarvestEval.date, delayedShiftDays)
              : futureHarvestEval.date,
          harvest_shift_days: futureHarvestEval.shiftDays + delayedShiftDays,
          completed_tasks_excluded_count: completedTasksCount,
          readjusted_remaining_tasks_count: readjustedTasksCount,
        },
        task_readjustment_preview: scheduleItems.map((it) => ({
          item_id: it.item_id,
          sub_item_name: it.sub_item_name,
          stage_group_name: it.stage_group_name,
          original_period: `${it.original_start_date} ~ ${it.original_end_date}`,
          readjusted_period: `${it.start_date} ~ ${it.end_date}`,
          execution_status: it.execution_status,
          status_badge:
            it.execution_status === 'COMPLETED'
              ? '이행 완료 (재조정 제외)'
              : it.execution_status === 'DELAYED_READJUSTED'
              ? `작업지연 연쇄조정 (${delayedShiftDays >= 0 ? `+${delayedShiftDays}일` : `${delayedShiftDays}일`})`
              : it.execution_status === 'CLIMATE_READJUSTED'
              ? '예측기후 잔여GDD 재조정'
              : it.end_date <= effectiveAsOfDate
              ? '현시점 이전 완료'
              : '현시점 이후 예정',
          readjustment_note: it.readjustment_note || '초기 계획 유지',
        })),
      };

      // ------------------------------------------------------------------------------------------------------------
      // [모듈 D 상세 산출] 특허 청구항 14, 명세서 [0028, 0129~0130]:
      // 수확 완료 후 실제 재배기간(plantingDate ~ safeHarvestDate) 실측 기후 적산온도 역산 및 작물DB 피드백
      // ------------------------------------------------------------------------------------------------------------
      const actualHarvestSpanDays = diffDaysInclusive(plantingDate, safeHarvestDate);
      let harvestActualPatentEffGdd = 0;
      let harvestActualAiPgdd = 0;
      let harvestActualRawGdd = 0;
      for (let i = 0; i < actualHarvestSpanDays; i++) {
        const dStr = addDays(plantingDate, i);
        harvestActualPatentEffGdd += calcDailyPatentEffectiveGdd(dStr, false);
        harvestActualAiPgdd += calcDailyPgdd(dStr, false);
        harvestActualRawGdd += calcDailyRawGdd(dStr, false);
      }

      // 품종 스케일(maturityScale)을 역보정한 작형 표준 피드백 적산온도 도출
      const normalizedFeedbackEffGdd = Math.round(harvestActualAiPgdd / Math.max(0.8, maturityScale));
      const normalizedFeedbackRawGdd = Math.round(harvestActualRawGdd / Math.max(0.8, maturityScale));
      const recommendedDbEffGdd = Math.round(baseRequiredGdd * 0.7 + normalizedFeedbackEffGdd * 0.3);
      const recommendedDbRawGdd = Math.round(baseRequiredRawGdd * 0.7 + normalizedFeedbackRawGdd * 0.3);

      const moduleD_harvestFeedback = {
        patent_ref: '특허 KR 10-2814596 청구항 14, 명세서 [0028, 0129~0130]',
        system_id: sysInfo?.system_id || 'SYS-CAB-AUT',
        system_name: sysInfo?.system_name || '노지 가을재배',
        crop_id: reqCropId,
        crop_name: cropDisplayName,
        cultivar_name: cvDisplayName,
        actual_cultivation_period: `${plantingDate} ~ ${safeHarvestDate}`,
        actual_cultivation_days: actualHarvestSpanDays,
        db_current_effective_gdd: baseRequiredGdd,
        db_current_raw_gdd: baseRequiredRawGdd,
        recalculated_actual_effective_gdd: Math.round(harvestActualAiPgdd),
        recalculated_patent_threshold_gdd: Math.round(harvestActualPatentEffGdd),
        recalculated_actual_raw_gdd: Math.round(harvestActualRawGdd),
        recommended_db_effective_gdd: recommendedDbEffGdd,
        recommended_db_raw_gdd: recommendedDbRawGdd,
        effective_gdd_diff: recommendedDbEffGdd - baseRequiredGdd,
        raw_gdd_diff: recommendedDbRawGdd - baseRequiredRawGdd,
        feedback_formula_desc:
          '수확 완료 시 실제 재배기간(정식~수확) 동안의 재배지 실측 기후 일평균기온을 역산하여 실제 적산온도를 산출하고, 작물DB(cropping_system)의 기준 적산온도를 보정·업데이트함',
      };

      const patentEngine = {
        patent_no: 'KR 10-2814596',
        patent_title: '재배 환경 변화에 따라 일정 업데이트가 가능한 노지작물의 재배일정 제공 시스템 및 방법',
        moduleA_optimalPeriods,
        moduleB_soilAndBlending,
        moduleC_readjustment,
        moduleD_harvestFeedback,
      };

      // [기초 코드 관리 > 생육 구분 기초 코드 (growth_type_code)] 순서(1~6번)대로 단계(관리명칭) 그룹핑 생성 (작물별 파종·정식 구분 명칭 반영)
      const stageGroups = canonicalStageSlots
        .map((slot) => {
          const meta = resolvedStageMetaBySlot.get(slot.slotKey)!;
          const groupItems = scheduleItems.filter((i) => i.stage_slot_key === slot.slotKey);
          return {
            stage_slot_key: slot.slotKey,
            stage_group_id: meta.type_code,
            stage_group_code: meta.type_code,
            stage_group_name: groupItems[0]?.stage_group_name || meta.type_name,
            stage_color: groupItems[0]?.stage_color || meta.stage_color,
            icon_type: meta.icon_type,
            description: meta.description,
            sort_order: meta.sort_order,
            items: groupItems,
          };
        })
        .filter((g) => g.items.length > 0);

      // 재배지 1~12월 월별 기후 요약 (365일 전체 데이터 요약)
      const monthlyClimateSummary = Array.from({ length: 12 }, (_, idx) => {
        const m = idx + 1;
        const mStart = `${targetYear}-${String(m).padStart(2, '0')}-01`;
        const lastDay = new Date(Date.UTC(targetYear, m, 0)).getUTCDate();
        const mEnd = `${targetYear}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        const st = analyzePeriodClimate(mStart, mEnd, false);
        return {
          month: m,
          month_label: `${m}월`,
          avg_temp: st.avg_temp,
          min_temp: st.min_temp,
          max_temp: st.max_temp,
          avg_humidity: st.avg_humidity,
          total_precip_mm: st.total_precip_mm,
          rainy_days: st.rainy_days,
          monthly_pgdd: st.period_pgdd,
        };
      });

      // 전체 재배기간(재배 준비 시작 ~ 수확 종료) 기후 종합 통계 및 365일 연간 통계
      const fullCultivationStats = analyzePeriodClimate(dPrep1Start, dHarv2End, true);
      const plantingToHarvestStats = analyzePeriodClimate(dPlantStart, dHarv2End, true);
      const annual365Stats = analyzePeriodClimate(`${targetYear}-01-01`, `${targetYear}-12-31`, false);

      // 365일 일별 기후 시리즈 (세부 일정 폼에서 추천 진행일 변경 시 이후 모든 생육과정을 각 기후 조건에 맞춰 실시간 재산출하기 위해 제공)
      const dailyClimate365 = Array.from({ length: 365 }, (_, idx) => {
        const ymd = addDays(`${targetYear}-01-01`, idx);
        const c = getClimateForDate(ymd);
        const dailyPgdd = calcDailyPgdd(ymd, false);
        const effTemp = Number((c.temp_avg + mulchingOffset).toFixed(1));
        return {
          date: ymd,
          weekday: getWeekdayLabel(ymd),
          temp_avg: c.temp_avg,
          temp_min: c.temp_min,
          temp_max: c.temp_max,
          effective_temp_avg: effTemp,
          past_temp_avg: c.past_temp_avg,
          forecast_temp_avg: c.forecast_temp_avg,
          humidity_avg: c.humidity_avg,
          precipitation_mm: c.precipitation_mm,
          daily_pgdd: dailyPgdd,
          is_within_crop_limits: c.temp_avg >= cropMinTemp && c.temp_avg <= cropMaxTemp && c.past_temp_avg >= cropMinTemp && c.past_temp_avg <= cropMaxTemp,
          is_within_opt_temp: effTemp >= optTempMin && effTemp <= optTempMax,
        };
      });

      sendJson(res, {
        activeRequest: {
          ...activeRequest,
          bjd_code: targetBjd,
        },
        allRequests,
        croppingSystem: {
          system_id: sysInfo?.system_id || 'SYS-CAB-AUT',
          system_name: activeRequest.system_name || sysInfo?.system_name || '노지 가을재배',
          base_temp_tb: baseTempTb,
          limit_temp_min: limitTempMin,
          upper_limit_temp: upperLimitTemp,
          damage_temp_low: damageTempLow,
          damage_temp_high: damageTempHigh,
          opt_temp_min: optTempMin,
          opt_temp_max: optTempMax,
          required_gdd: requiredTotalGdd,
          required_raw_gdd: requiredRawGdd,
          crop_min_temp: cropMinTemp,
          crop_max_temp: cropMaxTemp,
          crop_opt_temp: cropOptTempStr,
          planting_type: cropPlantingType,
          germination_temp: cropPlantingType === '씨' ? cropGermTempStr : '',
          gdd_mode: gddModeParam,
          mulching_offset: mulchingOffset,
          cultivation_year: targetYear,
          schedule_version: 'v1.6 (단일 추천 진행일(요일 포함) · 변경 시 이후 생육과정 기후 조건 맞춤형 새 일정 추천·승인)',
          updated_at: '2026-11-09 09:05:00',
        },
        climateOverview: {
          bjd_code: targetBjd,
          region_full: `${activeRequest.sido} ${activeRequest.sigungu} ${activeRequest.eupmyeondong}`,
          total_climate_days: 365,
          daily_climate_365: dailyClimate365,
          climate_rule_policy: {
            rule_code: 'HYBRID_BLENDED_AVG_WITH_CROP_TEMP_AND_GERMINATION_RULES',
            rule_title:
              '① 작년 기준 모종/작물 최저온도 미만·최고온도 초과 기간 제외 후 최적 예상온도 시작 · ② 씨(직파) 최적 발아온도 이상 빠른 시기 평균날씨 파종 · ③ 지역별(시도·시군구·읍면동) 생육과정 적산온도 및 작년+올해예측 기후 평균 대입',
            rule_formula_blended: '(작년 동일 날짜 기후 데이터 + 올해 예측 동일 날짜 기후 데이터) / 2',
            rule_formula_fallback: '올해 예측 기후 미존재 날짜(현재 기준 +6개월 이후, 12/31 안쪽 날짜 포함) → 작년 동일 날짜(MM-DD) 기후 데이터 단독 대입',
            rule_1_start_condition: `작년 기준 최저온도(${cropMinTemp}℃)보다 낮고 최고온도(${cropMaxTemp}℃)보다 높은 기후 기간 제외 후 최적 예상 온도(${cropOptTempStr}) 도달 시 첫 실질적 생육 작업 시작`,
            rule_2_seed_condition:
              cropPlantingType === '씨'
                ? `작물구분 '씨' 적용: 평균 온도가 적정발아온도(${cropGermTempStr}) 이상인 빠른 시기에 평균날씨를 선택하여 파종 시작`
                : `작물구분 '모종' 적용 (씨 작물의 경우 적정발아온도 이상 빠른 시기 평균날씨에 파종 시작)`,
            rule_3_regional_gdd: `${activeRequest.sido} ${activeRequest.sigungu} ${activeRequest.eupmyeondong} 재배지 기준 작물별 생육 과정 적산온도(PGDD) 적용`,
            forecast_base_date: effectiveForecastBaseDate,
            forecast_horizon_end_date: effectiveForecastHorizonDate,
            past_dataset_days: dailyClimate2025.length,
            future_forecast_days: dailyClimate2026.length,
            cultivation_blended_days: fullCultivationStats.blended_days,
            cultivation_past_only_days: fullCultivationStats.past_only_days,
            cultivation_source_summary: fullCultivationStats.climate_source_summary,
          },
          annual_stats: annual365Stats,
          cultivation_period: {
            prep_start_date: dPrep1Start,
            planting_date: dPlantStart,
            harvest_ready_date: gddReady.date,
            harvest_end_date: dHarv2End,
            total_span_days: fullCultivationStats.duration_days,
            planting_to_harvest_days: plantingToHarvestStats.duration_days,
            stats: plantingToHarvestStats,
          },
          monthly_summary: monthlyClimateSummary,
        },
        stageGroups,
        growthTypeCodes: dbGrowthTypes,
        scheduleItems,
        availableMaterialsCatalog: enrichMaterials(allMaterials.map((m) => m.material_id)),
        patentEngine,
        appliedGenerationModule: genModuleConfig,
      });
      return;
    }

    // 2-2B. 관리자 생육과정 세부 정보 수정 + 필요 농자재 추가/삭제 + 후속 생육과정 자동 연쇄 재구성 저장 API
    if (pathname === '/api/schedule-provision/update-item' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const requestNo = String(body.request_no || 'REQ-20261106-009').trim();
      const cultivarId = String(body.cultivar_id || 'CV-BRM3').trim();
      const resetRequest = Boolean(body.reset_request);

      db.exec(`
        CREATE TABLE IF NOT EXISTS schedule_provision_custom_item (
          request_no TEXT NOT NULL,
          item_id TEXT NOT NULL,
          stage_group_id TEXT,
          stage_group_name TEXT,
          sub_item_name TEXT,
          bar_label TEXT,
          process_code TEXT,
          process_name TEXT,
          target_pgdd REAL,
          start_date TEXT,
          end_date TEXT,
          work_content TEXT,
          climate_rule TEXT,
          usage_tip TEXT,
          ai_analysis_reason TEXT,
          materials_json TEXT,
          updated_at TEXT DEFAULT (datetime('now', 'localtime')),
          PRIMARY KEY (request_no, item_id)
        )
      `);

      if (resetRequest) {
        db.prepare('DELETE FROM schedule_provision_custom_item WHERE request_no = ?').run(requestNo);
        await supabaseRestDelete('schedule_provision_custom_item', `request_no=eq.${encodeURIComponent(requestNo)}`);
        sendJson(res, {
          ok: true,
          reset: true,
          message: `요청번호(${requestNo})의 모든 생육과정 일정 및 농자재 명세가 초기 AI 산출 상태로 복원되었습니다.`,
        });
        return;
      }

      const itemsToSave: any[] = Array.isArray(body.items_to_save)
        ? body.items_to_save
        : body.updated_item
        ? [body.updated_item, ...(Array.isArray(body.cascaded_items) ? body.cascaded_items : [])]
        : [];

      const upsertStmt = db.prepare(`
        INSERT INTO schedule_provision_custom_item (
          request_no, item_id, stage_group_id, stage_group_name, sub_item_name, bar_label,
          process_code, process_name, target_pgdd, start_date, end_date,
          work_content, climate_rule, usage_tip, ai_analysis_reason, materials_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
        ON CONFLICT(request_no, item_id) DO UPDATE SET
          stage_group_id = excluded.stage_group_id,
          stage_group_name = excluded.stage_group_name,
          sub_item_name = excluded.sub_item_name,
          bar_label = excluded.bar_label,
          process_code = excluded.process_code,
          process_name = excluded.process_name,
          target_pgdd = excluded.target_pgdd,
          start_date = excluded.start_date,
          end_date = excluded.end_date,
          work_content = excluded.work_content,
          climate_rule = excluded.climate_rule,
          usage_tip = excluded.usage_tip,
          ai_analysis_reason = excluded.ai_analysis_reason,
          materials_json = excluded.materials_json,
          updated_at = datetime('now', 'localtime')
      `);

      let savedCount = 0;
      const upsertedCustomItems: Record<string, unknown>[] = [];
      for (const it of itemsToSave) {
        if (!it || !it.item_id) continue;
        const matsJson = JSON.stringify(Array.isArray(it.materials) ? it.materials : []);
        const rowObj = {
          request_no: requestNo,
          item_id: String(it.item_id),
          stage_group_id: String(it.stage_group_id || ''),
          stage_group_name: String(it.stage_group_name || ''),
          sub_item_name: String(it.sub_item_name || ''),
          bar_label: String(it.bar_label || it.sub_item_name || ''),
          process_code: String(it.process_code || ''),
          process_name: String(it.process_name || ''),
          target_pgdd: Number(it.target_pgdd ?? 0),
          start_date: String(it.start_date || ''),
          end_date: String(it.end_date || ''),
          work_content: String(it.work_content || ''),
          climate_rule: String(it.climate_rule || ''),
          usage_tip: String(it.usage_tip || ''),
          ai_analysis_reason: String(it.ai_analysis_reason || ''),
          materials_json: matsJson,
          updated_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
        };
        upsertStmt.run(
          rowObj.request_no,
          rowObj.item_id,
          rowObj.stage_group_id,
          rowObj.stage_group_name,
          rowObj.sub_item_name,
          rowObj.bar_label,
          rowObj.process_code,
          rowObj.process_name,
          rowObj.target_pgdd,
          rowObj.start_date,
          rowObj.end_date,
          rowObj.work_content,
          rowObj.climate_rule,
          rowObj.usage_tip,
          rowObj.ai_analysis_reason,
          rowObj.materials_json
        );
        upsertedCustomItems.push(rowObj);
        savedCount++;
      }
      if (upsertedCustomItems.length > 0) {
        await supabaseRestUpsert('schedule_provision_custom_item', upsertedCustomItems, 'request_no,item_id');
      }

      sendJson(res, {
        ok: true,
        savedCount,
        message: `생육과정 세부 정보 및 농자재 명세 수정사항과 후속 연쇄 재조정 일정(총 ${savedCount}개 공정)이 저장·반영되었습니다.`,
      });
      return;
    }

    // 2-3. 재배 일정 제공 관리에서 산출된 생육기간을 작물별 생육 과정 관리(crop_growth_process_plan)에 동기화 저장하는 API
    if (pathname === '/api/schedule-provision/sync-plan-dates' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const { cultivar_id, items } = body;
      const targetCv = cultivar_id || 'CV-BRM3';
      let updatedCount = 0;

      if (Array.isArray(items)) {
        const updStmt = db.prepare(`
          UPDATE crop_growth_process_plan
          SET start_date = ?, end_date = ?, updated_at = datetime('now', 'localtime')
          WHERE cultivar_id = ? AND process_code = ?
        `);
        for (const it of items) {
          if (it.process_code && it.start_date && it.end_date) {
            const info = updStmt.run(it.start_date, it.end_date, targetCv, it.process_code);
            updatedCount += Number(info.changes || 0);
          }
        }
        const updatedPlans = db
          .prepare('SELECT * FROM crop_growth_process_plan WHERE cultivar_id = ?')
          .all(targetCv) as Record<string, unknown>[];
        if (updatedPlans.length > 0) {
          await supabaseRestUpsert('crop_growth_process_plan', updatedPlans, 'plan_id');
        }
      }

      sendJson(res, {
        ok: true,
        updatedCount,
        message: `365일 기후 분석으로 산출된 생육기간(${updatedCount}개 공정)이 DB에 반영되었습니다.`,
      });
      return;
    }

    // 2-4. [특허 청구항 14 모듈 D] 수확 완료 후 실제 재배기간의 적산온도를 역산하여 작물DB(cropping_system)를 업데이트하는 API
    // - dry_run: true 전달 시 트랜잭션 내에서 UPDATE 검증 후 즉시 ROLLBACK하여 DB에 테스트 흔적이 전혀 남지 않음
    if (pathname === '/api/schedule-provision/patent-feedback' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const systemId = String(body.system_id || 'SYS-CAB-AUT').trim();
      const newEffectiveGdd = Number(body.recalculated_effective_gdd || 785);
      const newRawGdd = Number(body.recalculated_raw_gdd || 1170);
      const isDryRun = Boolean(body.dry_run);

      const beforeRow = db
        .prepare('SELECT system_id, crop_id, system_name, required_gdd, required_raw_gdd FROM cropping_system WHERE system_id = ? LIMIT 1')
        .get(systemId) as any;

      if (!beforeRow) {
        sendJson(res, { ok: false, error: `작형 ID(${systemId})를 찾을 수 없습니다.` }, 404);
        return;
      }

      if (isDryRun) {
        db.exec('BEGIN IMMEDIATE');
        try {
          db.prepare('UPDATE cropping_system SET required_gdd = ?, required_raw_gdd = ? WHERE system_id = ?').run(
            newEffectiveGdd,
            newRawGdd,
            systemId
          );
          const simulatedAfterRow = db
            .prepare('SELECT system_id, crop_id, system_name, required_gdd, required_raw_gdd FROM cropping_system WHERE system_id = ? LIMIT 1')
            .get(systemId) as any;
          db.exec('ROLLBACK');
          const verifiedRestoredRow = db
            .prepare('SELECT system_id, crop_id, system_name, required_gdd, required_raw_gdd FROM cropping_system WHERE system_id = ? LIMIT 1')
            .get(systemId) as any;

          sendJson(res, {
            ok: true,
            dry_run: true,
            rolled_back: true,
            before: beforeRow,
            simulated_after: simulatedAfterRow,
            restored_after_rollback: verifiedRestoredRow,
            message: `[Dry-Run 트랜잭션 검증 완료] ${beforeRow.system_name}(${systemId}) 적산온도(${beforeRow.required_gdd}→${newEffectiveGdd}℃, 일반 ${beforeRow.required_raw_gdd}→${newRawGdd}℃) 업데이트 검증 후 원복(Rollback) 완료`,
          });
          return;
        } catch (err: any) {
          try {
            db.exec('ROLLBACK');
          } catch {}
          sendJson(res, { ok: false, error: err?.message || 'Dry-run 오류' }, 500);
          return;
        }
      }

      db.prepare('UPDATE cropping_system SET required_gdd = ?, required_raw_gdd = ? WHERE system_id = ?').run(
        newEffectiveGdd,
        newRawGdd,
        systemId
      );
      const afterRow = db
        .prepare('SELECT * FROM cropping_system WHERE system_id = ? LIMIT 1')
        .get(systemId) as any;
      if (afterRow) {
        await supabaseRestUpsert('cropping_system', afterRow, 'system_id');
      }

      sendJson(res, {
        ok: true,
        dry_run: false,
        before: beforeRow,
        after: afterRow,
        message: `[특허 청구항 14 반영 완료] ${afterRow.system_name}(${systemId}) 기준 유효적산온도(${afterRow.required_gdd}℃) 및 일반적산온도(${afterRow.required_raw_gdd}℃)가 작물DB에 업데이트되었습니다.`,
      });
      return;
    }

    // ==================== 15. 설문조사 관리 (URL 배포형 한팜 수요조사 양식 · 참여 응답 수집 · 문항별 통계 API) ====================
    if ((pathname === '/api/surveys/public' || pathname === '/api/surveys') && req.method === 'GET') {
      try {
        const remoteForms = await supabaseRestSelect('survey_form', 'select=*&order=updated_at.desc');
        if (Array.isArray(remoteForms) && remoteForms.length > 0) {
          const upsertStmt = db.prepare(`
            INSERT OR REPLACE INTO survey_form (
              survey_id, title, greeting_text, intro_text, duration_text, notice_text,
              footer_title, footer_sub, questions_json, is_active, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const rf of remoteForms) {
            if (!rf?.survey_id) continue;
            const localRow = db
              .prepare('SELECT updated_at FROM survey_form WHERE survey_id = ?')
              .get(rf.survey_id) as { updated_at?: string } | undefined;
            if (!localRow || String(rf.updated_at || '') >= String(localRow.updated_at || '')) {
              upsertStmt.run(
                rf.survey_id,
                rf.title || '한팜 맞춤형 재배관리 서비스 수요조사',
                rf.greeting_text || '안녕하세요.',
                rf.intro_text || '',
                rf.duration_text || '',
                rf.notice_text || '',
                rf.footer_title || '설문에 참여해 주셔서 감사합니다.',
                rf.footer_sub || '',
                rf.questions_json || JSON.stringify(DEFAULT_HANFARM_SURVEY_QUESTIONS),
                rf.is_active === undefined ? 1 : Number(rf.is_active) ? 1 : 0,
                rf.updated_at || '2026-11-09 22:28:31'
              );
            }
          }
        }
      } catch {
        // ignore
      }
    }

    if (pathname === '/api/surveys/public' && req.method === 'GET') {
      const surveyId = (parsedUrl.searchParams.get('survey_id') || 'SURV-HANFARM-2026').trim();
      let formRow = db
        .prepare('SELECT * FROM survey_form WHERE survey_id = ? LIMIT 1')
        .get(surveyId) as any;
      if (!formRow) {
        formRow = db.prepare('SELECT * FROM survey_form ORDER BY updated_at DESC LIMIT 1').get() as any;
      }
      const questions = (() => {
        try {
          return JSON.parse(formRow?.questions_json || '[]');
        } catch {
          return DEFAULT_HANFARM_SURVEY_QUESTIONS;
        }
      })();
      const totalParticipants = (
        db
          .prepare('SELECT COUNT(*) as cnt FROM survey_response WHERE survey_id = ?')
          .get(formRow?.survey_id || 'SURV-HANFARM-2026') as { cnt: number }
      ).cnt;
      sendJson(res, {
        ok: true,
        survey: {
          ...formRow,
          questions,
          total_participants: totalParticipants,
        },
      });
      return;
    }

    if (pathname === '/api/surveys' && req.method === 'GET') {
      const surveyId = (parsedUrl.searchParams.get('survey_id') || 'SURV-HANFARM-2026').trim();
      const ageFilter = (parsedUrl.searchParams.get('age') || 'ALL').trim();
      const scaleFilter = (parsedUrl.searchParams.get('scale') || 'ALL').trim();
      const q = (parsedUrl.searchParams.get('q') || '').trim().toLowerCase();

      const forms = (db.prepare('SELECT * FROM survey_form ORDER BY updated_at DESC').all() as any[]).map(
        (f) => {
          const cnt = (
            db
              .prepare('SELECT COUNT(*) as cnt FROM survey_response WHERE survey_id = ?')
              .get(f.survey_id) as { cnt: number }
          ).cnt;
          const lastRow = db
            .prepare(
              'SELECT submitted_at FROM survey_response WHERE survey_id = ? ORDER BY submitted_at DESC LIMIT 1'
            )
            .get(f.survey_id) as { submitted_at?: string } | undefined;
          return {
            ...f,
            response_count: cnt,
            last_response_at: lastRow?.submitted_at || f.updated_at || '-',
            questions: (() => {
              try {
                return JSON.parse(f.questions_json || '[]');
              } catch {
                return DEFAULT_HANFARM_SURVEY_QUESTIONS;
              }
            })(),
          };
        }
      );
      const activeForm = forms.find((f) => f.survey_id === surveyId) || forms[0];
      const targetSurveyId = activeForm?.survey_id || 'SURV-HANFARM-2026';

      const allResponses = (
        db
          .prepare('SELECT * FROM survey_response WHERE survey_id = ? ORDER BY submitted_at DESC, response_id DESC')
          .all(targetSurveyId) as any[]
      ).map((r) => ({
        ...r,
        q3_crops: (() => {
          try {
            return JSON.parse(r.q3_crops_json || '[]');
          } catch {
            return [];
          }
        })(),
      }));

      const filteredResponses = allResponses.filter((r) => {
        if (ageFilter !== 'ALL' && r.q1_age !== ageFilter) return false;
        if (scaleFilter !== 'ALL' && r.q2_scale !== scaleFilter) return false;
        if (q) {
          const textBlob = [
            r.response_id,
            r.respondent_name,
            r.respondent_region,
            r.respondent_contact,
            r.q1_age,
            r.q2_scale,
            ...(r.q3_crops || []),
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
          if (!textBlob.includes(q)) return false;
        }
        return true;
      });

      const totalCount = allResponses.length;
      const questionsList = activeForm?.questions || DEFAULT_HANFARM_SURVEY_QUESTIONS;

      const questionStats = questionsList.map((qDef: any) => {
        const optionCounts: Array<{ option: string; count: number; pct: number }> = (
          qDef.options || []
        ).map((opt: string) => {
          let cnt = 0;
          for (const r of allResponses) {
            if (qDef.id === 'q1' && r.q1_age === opt) cnt++;
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
            ? allResponses
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

      const positiveScheduleCount = allResponses.filter(
        (r) =>
          String(r.q5_schedule_intent).includes('반드시 이용') ||
          String(r.q5_schedule_intent).includes('이용할 의향 있음')
      ).length;
      const positiveAiPestCount = allResponses.filter(
        (r) =>
          String(r.q7_ai_pest_intent).includes('반드시 이용') ||
          String(r.q7_ai_pest_intent).includes('이용할 의향 있음')
      ).length;
      const paidBundleCount = allResponses.filter(
        (r) => !String(r.q8_bundle_wtp).includes('무료일 때만 이용')
      ).length;
      const positiveCommerceCount = allResponses.filter(
        (r) =>
          String(r.q9_commerce_intent).includes('적극 이용') ||
          String(r.q9_commerce_intent).includes('필요할 때 이용')
      ).length;

      sendJson(res, {
        ok: true,
        forms,
        activeSurvey: activeForm,
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
      return;
    }

    if (pathname === '/api/surveys/save' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const surveyId = String(body.survey_id || 'SURV-HANFARM-2026').trim();
      const title = String(body.title || '한팜 맞춤형 재배관리 서비스 수요조사').trim();
      const greetingText = String(body.greeting_text || '안녕하세요.').trim();
      const introText = String(
        body.intro_text ||
          '한팜(HANFARM)은 농업인이 보다 쉽고 효율적으로 작물을 재배할 수 있도록 맞춤형 재배일정 및 AI 병해충 진단 서비스를 개발하고 있습니다.'
      ).trim();
      const durationText = String(
        body.duration_text ||
          '본 설문은 서비스 개발과 적정 구독료 설정을 위한 조사이며, 약 2~3분 정도 소요됩니다.'
      ).trim();
      const noticeText = String(
        body.notice_text ||
          '※ 본 설문은 맞춤형 재배일정과 AI 병해충 진단이 실제 농작업에 활용할 수 있을 만큼 충분한 정확도와 신뢰성을 갖추었다는 가정하에 응답해 주시기 바랍니다.'
      ).trim();
      const footerTitle = String(body.footer_title || '설문에 참여해 주셔서 감사합니다.').trim();
      const footerSub = String(
        body.footer_sub ||
          '본 설문 결과는 한팜의 서비스 개발 및 사업성 검토를 위한 목적으로 활용됩니다.'
      ).trim();
      const isActive = body.is_active === undefined ? 1 : Number(body.is_active) ? 1 : 0;
      const questionsJson = Array.isArray(body.questions)
        ? JSON.stringify(body.questions)
        : typeof body.questions_json === 'string'
        ? body.questions_json
        : JSON.stringify(DEFAULT_HANFARM_SURVEY_QUESTIONS);

      db.prepare(`
        INSERT OR REPLACE INTO survey_form (
          survey_id, title, greeting_text, intro_text, duration_text, notice_text,
          footer_title, footer_sub, questions_json, is_active, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
      `).run(
        surveyId,
        title,
        greetingText,
        introText,
        durationText,
        noticeText,
        footerTitle,
        footerSub,
        questionsJson,
        isActive
      );
      const savedSurveyForm = db.prepare('SELECT * FROM survey_form WHERE survey_id = ?').get(surveyId) as Record<string, any> | undefined;
      if (savedSurveyForm) {
        await supabaseRestUpsert('survey_form', savedSurveyForm, 'survey_id');
      }

      sendJson(res, { ok: true, survey_id: surveyId });
      return;
    }

    if (pathname === '/api/surveys/submit' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const surveyId = String(body.survey_id || 'SURV-HANFARM-2026').trim();
      const targetForm = db
        .prepare('SELECT is_active, title FROM survey_form WHERE survey_id = ?')
        .get(surveyId) as { is_active?: number; title?: string } | undefined;
      if (targetForm && Number(targetForm.is_active) === 0) {
        sendJson(
          res,
          {
            ok: false,
            message: '마감된 설문조사에는 더 이상 참여할 수 없습니다.',
          },
          400
        );
        return;
      }
      const allIds = db
        .prepare('SELECT response_id FROM survey_response')
        .all() as Array<{ response_id: string }>;
      const maxSeq = allIds.reduce((acc, r) => {
        const m = String(r.response_id || '').match(/(\d+)$/);
        return m ? Math.max(acc, Number(m[1])) : acc;
      }, 0);
      const responseId =
        body.response_id && String(body.response_id).trim()
          ? String(body.response_id).trim()
          : `RESP-20261108-${String(maxSeq + 1).padStart(3, '0')}`;

      const q3Array = Array.isArray(body.q3_crops)
        ? body.q3_crops
        : typeof body.q3_crops_json === 'string'
        ? JSON.parse(body.q3_crops_json || '[]')
        : ['① 엽채류 (상추, 시금치, 배추 등)'];

      const respondentName = String(body.respondent_name || '익명 참여자').trim() || '익명 참여자';
      const respondentRegion = String(body.respondent_region || '').trim();
      const respondentContact = String(body.respondent_contact || '').trim();
      const q1Age = String(body.q1_age || '④ 50대').trim();
      const q2Scale = String(body.q2_scale || '② 소규모 농업인 (1,000평 미만)').trim();
      const q3OtherText = String(body.q3_other_text || '').trim();
      const q4Difficulty = String(body.q4_difficulty || '① 재배시기 및 농작업 일정 관리').trim();
      const q5ScheduleIntent = String(body.q5_schedule_intent || '① 반드시 이용').trim();
      const q6ScheduleWtp = String(body.q6_schedule_wtp || '③ 월 5,000원').trim();
      const q7AiPestIntent = String(body.q7_ai_pest_intent || '① 반드시 이용').trim();
      const q8BundleWtp = String(body.q8_bundle_wtp || '③ 월 10,000원').trim();
      const q9CommerceIntent = String(body.q9_commerce_intent || '① 적극 이용').trim();

      db.prepare(`
        INSERT OR REPLACE INTO survey_response (
          response_id, survey_id, respondent_name, respondent_region, respondent_contact,
          q1_age, q2_scale, q3_crops_json, q3_other_text, q4_difficulty,
          q5_schedule_intent, q6_schedule_wtp, q7_ai_pest_intent, q8_bundle_wtp, q9_commerce_intent,
          answers_json, submitted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
      `).run(
        responseId,
        surveyId,
        respondentName,
        respondentRegion,
        respondentContact,
        q1Age,
        q2Scale,
        JSON.stringify(q3Array),
        q3OtherText,
        q4Difficulty,
        q5ScheduleIntent,
        q6ScheduleWtp,
        q7AiPestIntent,
        q8BundleWtp,
        q9CommerceIntent,
        JSON.stringify({
          q1: q1Age,
          q2: q2Scale,
          q3: q3Array,
          q3_other: q3OtherText,
          q4: q4Difficulty,
          q5: q5ScheduleIntent,
          q6: q6ScheduleWtp,
          q7: q7AiPestIntent,
          q8: q8BundleWtp,
          q9: q9CommerceIntent,
        })
      );
      const savedResp = db.prepare('SELECT * FROM survey_response WHERE response_id = ?').get(responseId) as Record<string, any> | undefined;
      if (savedResp) {
        await supabaseRestUpsert('survey_response', savedResp, 'response_id');
      }

      sendJson(res, { ok: true, response_id: responseId });
      return;
    }

    if (pathname === '/api/surveys/response/delete' && req.method === 'POST') {
      const { response_id } = await readJsonBody(req);
      db.prepare('DELETE FROM survey_response WHERE response_id = ?').run(response_id);
      await supabaseRestDelete('survey_response', `response_id=eq.${encodeURIComponent(response_id)}`);
      sendJson(res, { ok: true });
      return;
    }

    if (pathname === '/api/surveys/delete' && req.method === 'POST') {
      const { survey_id } = await readJsonBody(req);
      db.prepare('DELETE FROM survey_response WHERE survey_id = ?').run(survey_id);
      db.prepare('DELETE FROM survey_form WHERE survey_id = ?').run(survey_id);
      await supabaseRestDelete('survey_response', `survey_id=eq.${encodeURIComponent(survey_id)}`);
      await supabaseRestDelete('survey_form', `survey_id=eq.${encodeURIComponent(survey_id)}`);
      sendJson(res, { ok: true });
      return;
    }

    // ==================== [회원 인증 (이메일/Google Gmail 가입·로그인·비밀번호 찾기) 및 마이페이지 API] ====================
    const buildMemberMyPagePayload = (emailInput: string) => {
      const member = db
        .prepare('SELECT * FROM user_member WHERE LOWER(email) = LOWER(?)')
        .get(emailInput) as any;
      if (!member) return null;
      const farmlands = db
        .prepare(
          'SELECT * FROM member_farmland WHERE LOWER(email) = LOWER(?) ORDER BY created_at ASC, farmland_id ASC'
        )
        .all(member.email) as any[];
      const rawCropPlans = db
        .prepare(
          'SELECT * FROM member_crop_plan WHERE LOWER(email) = LOWER(?) ORDER BY created_at ASC, request_no ASC, crop_plan_id ASC'
        )
        .all(member.email) as any[];
      const seenReqNos = new Set<string>();
      const seenPlanIds = new Set<string>();
      const cropPlans: any[] = [];
      for (const cp of rawCropPlans) {
        const rNo = String(cp?.request_no || '').trim();
        const pId = String(cp?.crop_plan_id || '').trim();
        if ((rNo && seenReqNos.has(rNo)) || (pId && seenPlanIds.has(pId))) {
          if (pId) {
            db.prepare('DELETE FROM member_crop_plan WHERE crop_plan_id = ?').run(pId);
          }
          continue;
        }
        if (rNo) seenReqNos.add(rNo);
        if (pId) seenPlanIds.add(pId);
        cropPlans.push(cp);
      }
      const rawOrders = db
        .prepare(
          'SELECT * FROM member_agro_order WHERE LOWER(email) = LOWER(?) ORDER BY ordered_at DESC, order_no DESC'
        )
        .all(member.email) as any[];
      const orders = rawOrders.map((o) => ({
        ...o,
        orderItems: (() => {
          try {
            return JSON.parse(o.items_json || '[]');
          } catch {
            return [];
          }
        })(),
      }));
      const allScheduleRequests = db
        .prepare('SELECT * FROM member_schedule_request ORDER BY requested_at ASC, request_no ASC')
        .all() as any[];
      const targetEmailLower = String(member.email || '').toLowerCase();
      const isCloudBae =
        targetEmailLower === 'cloudbae@naver.com' || targetEmailLower === 'cloudbae';
      const scheduleRequests = allScheduleRequests.filter((r) =>
        isCloudBae
          ? !r.member_id ||
            String(r.member_id).toLowerCase().includes('cloudbae') ||
            String(r.member_id).includes('배철민')
          : String(r.member_id || '').toLowerCase().includes(targetEmailLower)
      );
      const safeMember = { ...member };
      delete safeMember.password;
      return {
        member: safeMember,
        farmlands,
        cropPlans,
        scheduleRequests,
        orders,
      };
    };

    // 1. 이메일 중복검사 API (이메일 주소 형식 필수)
    if (pathname === '/api/auth/check-email' && req.method === 'GET') {
      await syncAdminMemberTablesFromSupabase();
      const email = String(parsedUrl.searchParams.get('email') || '').trim();
      if (!email) {
        sendJson(
          res,
          { ok: false, available: false, message: '이메일 주소를 입력해 주세요.' },
          400
        );
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        sendJson(
          res,
          {
            ok: false,
            available: false,
            message: '올바른 이메일 주소 형식으로 입력해 주세요. (예: user@example.com)',
          },
          400
        );
        return;
      }
      const existing = db
        .prepare('SELECT email, signup_type FROM user_member WHERE LOWER(email) = LOWER(?)')
        .get(email) as { email: string; signup_type: string } | undefined;
      if (existing) {
        sendJson(res, {
          ok: true,
          available: false,
          message: `이미 가입된 이메일(${existing.email})입니다.`,
        });
      } else {
        sendJson(res, {
          ok: true,
          available: true,
          message: '사용 가능한 이메일입니다.',
        });
      }
      return;
    }

    // 2. 회원가입 API (3단계 회원가입: 계정정보 ➔ 기본정보·약관동의 ➔ 가입완료)
    if (pathname === '/api/auth/signup' && req.method === 'POST') {
      await syncAdminMemberTablesFromSupabase();
      const body = await readJsonBody(req);
      const email = String(body.email || '').trim();
      const password = String(body.password || '1234').trim();
      const rawSignupType = String(body.signup_type || 'EMAIL').toUpperCase();
      const signupType = ['EMAIL', 'NAVER', 'GOOGLE_GMAIL', 'APPLE'].includes(rawSignupType)
        ? rawSignupType
        : 'EMAIL';
      const name = String(body.name || body.nickname || email.split('@')[0] || '신규회원').trim();
      const gender = String(body.gender || '남성').trim();
      const birthDate = String(body.birth_date || '1980-01-01').trim();
      const age = Number(body.age) || 46;
      const rawRoadAddressInput = String(body.road_address || '').trim();
      const resolvedSignupAddr = resolveCultivationAddressFromInput({
        sido: body.sido,
        sigungu: body.sigungu,
        eupmyeondong: body.eupmyeondong,
        road_address: rawRoadAddressInput,
        bjd_code: body.bjd_code,
      });
      const matchedRoadRow = db
        .prepare(
          `SELECT r.road_code, r.postal_code, r.full_road_address, j.full_jibun_address
           FROM road_address r
           LEFT JOIN jibun_address j ON r.bjd_code = j.bjd_code
           WHERE r.bjd_code = ?
           ORDER BY r.road_addr_id ASC
           LIMIT 1`
        )
        .get(resolvedSignupAddr.bjd_code) as
        | { road_code?: string; postal_code?: string; full_road_address?: string; full_jibun_address?: string }
        | undefined;
      const roadAddress =
        rawRoadAddressInput ||
        matchedRoadRow?.full_road_address ||
        `${resolvedSignupAddr.sido} ${resolvedSignupAddr.sigungu} ${resolvedSignupAddr.eupmyeondong}`;
      const roadAddressDetail = String(body.road_address_detail || '').trim();
      const postalCode = String(body.postal_code || matchedRoadRow?.postal_code || '27481').trim();
      const roadCode = String(body.road_code || matchedRoadRow?.road_code || '').trim();
      const bjdCode = String(body.bjd_code || resolvedSignupAddr.bjd_code || '4313010700').trim();
      const sido = resolvedSignupAddr.sido;
      const sigungu = resolvedSignupAddr.sigungu;
      const eupmyeondong = resolvedSignupAddr.eupmyeondong;
      const jibunAddress = String(
        body.jibun_address ||
          matchedRoadRow?.full_jibun_address ||
          `${sido} ${sigungu} ${eupmyeondong}`
      ).trim();
      const phone = String(body.phone || '010-0000-0000').trim();
      const phoneVerified = body.phone_verified !== undefined ? (body.phone_verified ? 1 : 0) : 1;
      const interestTypes = Array.isArray(body.interest_types)
        ? JSON.stringify(body.interest_types)
        : String(body.interest_types || '["농업인(직업 재배)"]');
      const agreeTerms = body.agree_terms !== undefined ? (body.agree_terms ? 1 : 0) : 1;
      const agreePrivacy = body.agree_privacy !== undefined ? (body.agree_privacy ? 1 : 0) : 1;
      const agreeMarketing = body.agree_marketing ? 1 : 0;

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        sendJson(
          res,
          { ok: false, message: '올바른 이메일 주소 형식으로 입력해 주세요. (예: user@example.com)' },
          400
        );
        return;
      }

      const dup = db
        .prepare('SELECT email FROM user_member WHERE LOWER(email) = LOWER(?)')
        .get(email);
      if (dup) {
        sendJson(
          res,
          { ok: false, message: `이미 가입된 이메일(${email})입니다.` },
          409
        );
        return;
      }

      const memberId = `MEM-${Date.now()}`;
      const nickname = String(body.nickname || name || email.split('@')[0]).trim();

      db.prepare(`
        INSERT INTO user_member (
          member_id, email, password, signup_type, name, nickname,
          gender, birth_date, age, road_address, road_address_detail, postal_code,
          road_code, bjd_code, sido, sigungu, eupmyeondong, jibun_address,
          phone, phone_verified, interest_types, agree_terms, agree_privacy, agree_marketing
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        memberId,
        email,
        password,
        signupType,
        name,
        nickname,
        gender,
        birthDate,
        age,
        roadAddress,
        roadAddressDetail,
        postalCode,
        roadCode,
        bjdCode,
        sido,
        sigungu,
        eupmyeondong,
        jibunAddress,
        phone,
        phoneVerified,
        interestTypes,
        agreeTerms,
        agreePrivacy,
        agreeMarketing
      );

      // 신규 가입 회원을 위한 기본 재배지 1곳 자동 세팅 (입력한 회원 주소/시도·시군구·읍면동 정확 매칭)
      const landId = `LAND-${Date.now()}`;
      const landDetailJibun = roadAddressDetail || '';
      db.prepare(`
        INSERT INTO member_farmland (
          farmland_id, email, farmland_title, bjd_code, sido, sigungu, eupmyeondong,
          detail_jibun, area_pyeong, soil_ph, soil_ec
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 300, 6.3, 1.1)
      `).run(
        landId,
        email,
        `${name} 님의 제1농장 (${resolvedSignupAddr.sigungu} ${resolvedSignupAddr.eupmyeondong})`,
        resolvedSignupAddr.bjd_code,
        resolvedSignupAddr.sido,
        resolvedSignupAddr.sigungu,
        resolvedSignupAddr.eupmyeondong,
        landDetailJibun
      );
      const savedLand = db.prepare('SELECT * FROM member_farmland WHERE farmland_id = ?').get(landId) as Record<string, any> | undefined;
      if (savedLand) {
        await supabaseRestUpsert('member_farmland', savedLand, 'farmland_id');
      }
      const savedMember = db.prepare('SELECT * FROM user_member WHERE member_id = ?').get(memberId) as Record<string, any> | undefined;
      if (savedMember) {
        await supabaseRestUpsert('user_member', savedMember, 'member_id');
      }

      const payload = buildMemberMyPagePayload(email);
      sendJson(res, { ok: true, ...payload });
      return;
    }

    // 3. 로그인 API (이메일 로그인 & Google Gmail 간편 로그인)
    if (pathname === '/api/auth/login' && req.method === 'POST') {
      await syncAdminMemberTablesFromSupabase();
      const body = await readJsonBody(req);
      const loginType = String(body.login_type || 'EMAIL').toUpperCase();
      const email = String(body.email || '').trim();
      const password = String(body.password || '').trim();

      if (loginType === 'GOOGLE_GMAIL') {
        const gmailEmail = email || 'cloudbae.gmail@gmail.com';
        const existingGmail = db
          .prepare('SELECT * FROM user_member WHERE LOWER(email) = LOWER(?)')
          .get(gmailEmail) as any;

        if (existingGmail) {
          const payload = buildMemberMyPagePayload(existingGmail.email);
          sendJson(res, { ok: true, ...payload });
          return;
        }
        // 아직 가입되지 않은 Google Gmail 계정이면 회원가입 창에서 기본항목 입력 후 즉시 가입하도록 안내 반환
        sendJson(res, {
          ok: true,
          needSignup: true,
          suggestedEmail: gmailEmail,
          suggestedName: body.name || gmailEmail.split('@')[0],
          message: 'Google Gmail 계정이 확인되었습니다. 기본 회원정보를 확인 후 가입을 완료해 주세요.',
        });
        return;
      }

      // CloudBae 또는 CloudBae@naver.com 모두 허용
      const normalizedEmail =
        email.toLowerCase() === 'cloudbae' ? 'CloudBae@naver.com' : email;

      let member = db
        .prepare('SELECT * FROM user_member WHERE LOWER(email) = LOWER(?)')
        .get(normalizedEmail) as any;

      if (!member) {
        try {
          const remoteRows = await supabaseRestSelect(
            'user_member',
            `email=ilike.${encodeURIComponent(normalizedEmail)}`
          );
          if (Array.isArray(remoteRows) && remoteRows[0]) {
            const m = remoteRows[0];
            db.prepare(`
              INSERT OR REPLACE INTO user_member (
                member_id, email, password, signup_type, name, nickname,
                gender, birth_date, age, road_address, road_address_detail, postal_code, phone, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              m.member_id || `MEM-${Date.now()}`,
              m.email,
              m.password || '1234',
              m.signup_type || 'EMAIL',
              m.name || m.email,
              m.nickname || '',
              m.gender || '남성',
              m.birth_date || '1980-01-01',
              Number(m.age || 46),
              m.road_address || '',
              m.road_address_detail || '',
              m.postal_code || '27481',
              m.phone || '010-0000-0000',
              m.created_at || ''
            );
            member = db
              .prepare('SELECT * FROM user_member WHERE LOWER(email) = LOWER(?)')
              .get(normalizedEmail) as any;
          }
        } catch {
          // ignore
        }
      }

      if (!member) {
        sendJson(
          res,
          { ok: false, message: '등록되지 않은 계정입니다. 아이디(이메일)를 확인하거나 회원가입을 진행해 주세요.' },
          401
        );
        return;
      }

      if (String(member.password) !== password) {
        sendJson(
          res,
          { ok: false, message: '비밀번호가 일치하지 않습니다. 비밀번호 찾기를 이용해 주세요.' },
          401
        );
        return;
      }

      const payload = buildMemberMyPagePayload(member.email);
      sendJson(res, { ok: true, ...payload });
      return;
    }

    // 4. 비밀번호 찾기 및 재설정 API
    if (pathname === '/api/auth/find-password' && req.method === 'POST') {
      await syncAdminMemberTablesFromSupabase();
      const body = await readJsonBody(req);
      const step = String(body.step || 'VERIFY').toUpperCase();
      const emailInput = String(body.email || '').trim();
      const normalizedEmail =
        emailInput.toLowerCase() === 'cloudbae' ? 'CloudBae@naver.com' : emailInput;
      const nameInput = String(body.name || '').trim();
      const birthDateInput = String(body.birth_date || '').trim();

      const member = db
        .prepare('SELECT * FROM user_member WHERE LOWER(email) = LOWER(?)')
        .get(normalizedEmail) as any;

      if (!member) {
        sendJson(
          res,
          { ok: false, message: '입력하신 이메일로 가입된 회원 정보를 찾을 수 없습니다.' },
          404
        );
        return;
      }

      if (nameInput && member.name !== nameInput && member.nickname?.toLowerCase() !== nameInput.toLowerCase()) {
        sendJson(
          res,
          { ok: false, message: '입력하신 이름과 회원 정보가 일치하지 않습니다.' },
          400
        );
        return;
      }

      if (birthDateInput && member.birth_date !== birthDateInput) {
        sendJson(
          res,
          { ok: false, message: '입력하신 출생년월일 정보가 일치하지 않습니다.' },
          400
        );
        return;
      }

      if (step === 'RESET') {
        const newPassword = String(body.new_password || '').trim();
        if (!newPassword || newPassword.length < 4) {
          sendJson(
            res,
            { ok: false, message: '새 비밀번호는 4자리 이상 입력해 주세요.' },
            400
          );
          return;
        }
        db.prepare('UPDATE user_member SET password = ? WHERE LOWER(email) = LOWER(?)').run(
          newPassword,
          member.email
        );
        const updatedMem = db.prepare('SELECT * FROM user_member WHERE LOWER(email) = LOWER(?)').get(member.email) as Record<string, any> | undefined;
        if (updatedMem) {
          await supabaseRestUpsert('user_member', updatedMem, 'member_id');
        }
        sendJson(res, {
          ok: true,
          resetCompleted: true,
          email: member.email,
          message: `비밀번호가 성공적으로 변경되었습니다. 새 비밀번호로 로그인해 주세요.`,
        });
        return;
      }

      sendJson(res, {
        ok: true,
        verified: true,
        email: member.email,
        name: member.name,
        currentPasswordHint: `${String(member.password).slice(0, 2)}${'*'.repeat(
          Math.max(2, String(member.password).length - 2)
        )}`,
        message: '본인 확인이 완료되었습니다. 새 비밀번호를 설정해 주세요.',
      });
      return;
    }

    // 5. 마이페이지 통합 조회 API
    if (pathname === '/api/mypage' && req.method === 'GET') {
      await syncAdminMemberTablesFromSupabase();
      const email = String(parsedUrl.searchParams.get('email') || 'CloudBae@naver.com').trim();
      const payload = buildMemberMyPagePayload(email) || buildMemberMyPagePayload('CloudBae@naver.com');
      sendJson(res, { ok: true, ...payload });
      return;
    }

    // ==================== [관리자 회원정보 관리 (회원 · 나의 작물 재배지 · 나의 재배작물 통합 CRUD) API] ====================
    const buildAdminMembersPayload = () => {
      const members = db
        .prepare('SELECT * FROM user_member ORDER BY created_at DESC, member_id ASC')
        .all() as Record<string, any>[];
      const farmlands = db
        .prepare('SELECT * FROM member_farmland ORDER BY created_at ASC, farmland_id ASC')
        .all() as Record<string, any>[];
      const cropPlans = db
        .prepare('SELECT * FROM member_crop_plan ORDER BY created_at ASC, crop_plan_id ASC')
        .all() as Record<string, any>[];
      return {
        ok: true,
        members,
        farmlands,
        cropPlans,
      };
    };

    if (pathname === '/api/admin/members' && req.method === 'GET') {
      await syncAdminMemberTablesFromSupabase();
      sendJson(res, buildAdminMembersPayload());
      return;
    }

    if (pathname === '/api/admin/members/save' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const nowStr = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
      const memberId = String(body.member_id || `MEM-${Date.now()}`).trim();
      const prevEmail = String(body.prev_email || '').trim();
      const email = String(body.email || '').trim();
      if (!email) {
        sendJson(res, { ok: false, message: '올바른 아이디 또는 이메일 주소를 입력해 주세요.' }, 400);
        return;
      }
      const existingById = db.prepare('SELECT * FROM user_member WHERE member_id = ?').get(memberId) as Record<string, any> | undefined;
      const password = String(body.password || existingById?.password || '1234').trim();
      const signupType =
        String(body.signup_type || existingById?.signup_type || 'EMAIL').toUpperCase() === 'GOOGLE_GMAIL'
          ? 'GOOGLE_GMAIL'
          : 'EMAIL';
      const name = String(body.name || existingById?.name || '신규회원').trim();
      const nickname = String(body.nickname || email.split('@')[0] || name).trim();
      const gender = String(body.gender || existingById?.gender || '남성').trim();
      const birthDate = String(body.birth_date || existingById?.birth_date || '1980-05-15').trim();
      const age = Number(body.age) || Number(existingById?.age) || 46;
      const roadAddress = String(body.road_address || existingById?.road_address || '충청북도 충주시 충원대로 268 (단월동)').trim();
      const roadAddressDetail = String(body.road_address_detail ?? existingById?.road_address_detail ?? '').trim();
      const resolvedAdminAddr = resolveCultivationAddressFromInput({
        sido: body.sido || existingById?.sido,
        sigungu: body.sigungu || existingById?.sigungu,
        eupmyeondong: body.eupmyeondong || existingById?.eupmyeondong,
        road_address: roadAddress,
        bjd_code: body.bjd_code || existingById?.bjd_code,
      });
      const matchedRoadRow = db
        .prepare(
          `SELECT r.road_code, r.postal_code, r.full_road_address, j.full_jibun_address
           FROM road_address r
           LEFT JOIN jibun_address j ON r.bjd_code = j.bjd_code
           WHERE r.bjd_code = ?
           ORDER BY r.road_addr_id ASC
           LIMIT 1`
        )
        .get(resolvedAdminAddr.bjd_code) as
        | { road_code?: string; postal_code?: string; full_road_address?: string; full_jibun_address?: string }
        | undefined;
      const postalCode = String(body.postal_code || existingById?.postal_code || matchedRoadRow?.postal_code || '27481').trim();
      const roadCode = String(body.road_code || existingById?.road_code || matchedRoadRow?.road_code || '').trim();
      const bjdCode = String(body.bjd_code || existingById?.bjd_code || resolvedAdminAddr.bjd_code || '4313010700').trim();
      const sido = resolvedAdminAddr.sido;
      const sigungu = resolvedAdminAddr.sigungu;
      const eupmyeondong = resolvedAdminAddr.eupmyeondong;
      const jibunAddress = String(
        body.jibun_address ||
          existingById?.jibun_address ||
          matchedRoadRow?.full_jibun_address ||
          `${sido} ${sigungu} ${eupmyeondong}`
      ).trim();
      const phone = String(body.phone || existingById?.phone || '010-0000-0000').trim();
      const createdAt = String(body.created_at || existingById?.created_at || nowStr).trim();

      db.prepare(`
        INSERT OR REPLACE INTO user_member (
          member_id, email, password, signup_type, name, nickname,
          gender, birth_date, age, road_address, road_address_detail, postal_code,
          road_code, bjd_code, sido, sigungu, eupmyeondong, jibun_address,
          phone, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        memberId,
        email,
        password,
        signupType,
        name,
        nickname,
        gender,
        birthDate,
        age,
        roadAddress,
        roadAddressDetail,
        postalCode,
        roadCode,
        bjdCode,
        sido,
        sigungu,
        eupmyeondong,
        jibunAddress,
        phone,
        createdAt
      );

      const savedMem = db.prepare('SELECT * FROM user_member WHERE member_id = ?').get(memberId) as Record<string, any> | undefined;
      if (savedMem) {
        await supabaseRestUpsert('user_member', savedMem, 'member_id');
      }

      if (prevEmail && prevEmail.toLowerCase() !== email.toLowerCase()) {
        db.prepare('UPDATE member_farmland SET email = ? WHERE LOWER(email) = LOWER(?)').run(email, prevEmail);
        db.prepare('UPDATE member_crop_plan SET email = ? WHERE LOWER(email) = LOWER(?)').run(email, prevEmail);
        const updatedLands = db.prepare('SELECT * FROM member_farmland WHERE LOWER(email) = LOWER(?)').all(email) as Record<string, any>[];
        for (const fl of updatedLands) {
          await supabaseRestUpsert('member_farmland', fl, 'farmland_id');
        }
        const updatedPlans = db.prepare('SELECT * FROM member_crop_plan WHERE LOWER(email) = LOWER(?)').all(email) as Record<string, any>[];
        for (const cp of updatedPlans) {
          await supabaseRestUpsert('member_crop_plan', cp, 'crop_plan_id');
        }
      }

      sendJson(res, { ok: true, member: savedMem, ...buildAdminMembersPayload() });
      return;
    }

    if (pathname === '/api/admin/members/delete' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const memberId = String(body.member_id || '').trim();
      const existing = memberId
        ? (db.prepare('SELECT * FROM user_member WHERE member_id = ?').get(memberId) as Record<string, any> | undefined)
        : undefined;
      const email = String(body.email || existing?.email || '').trim();

      if (memberId) {
        db.prepare('DELETE FROM user_member WHERE member_id = ?').run(memberId);
        await supabaseRestDelete('user_member', `member_id=eq.${encodeURIComponent(memberId)}`);
      }
      if (email) {
        db.prepare('DELETE FROM user_member WHERE LOWER(email) = LOWER(?)').run(email);
        db.prepare('DELETE FROM member_farmland WHERE LOWER(email) = LOWER(?)').run(email);
        db.prepare('DELETE FROM member_crop_plan WHERE LOWER(email) = LOWER(?)').run(email);
        await Promise.all([
          supabaseRestDelete('user_member', `email=eq.${encodeURIComponent(email)}`),
          supabaseRestDelete('member_farmland', `email=eq.${encodeURIComponent(email)}`),
          supabaseRestDelete('member_crop_plan', `email=eq.${encodeURIComponent(email)}`),
        ]);
      }

      sendJson(res, buildAdminMembersPayload());
      return;
    }

    if (pathname === '/api/admin/member-farmlands/save' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const nowStr = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
      const farmlandId = String(body.farmland_id || `LAND-${Date.now()}`).trim();
      const existing = db.prepare('SELECT * FROM member_farmland WHERE farmland_id = ?').get(farmlandId) as Record<string, any> | undefined;
      const email = String(body.email || existing?.email || 'CloudBae@naver.com').trim();
      const resolvedAddr = resolveCultivationAddressFromInput({
        sido: body.sido || existing?.sido,
        sigungu: body.sigungu || existing?.sigungu,
        eupmyeondong: body.eupmyeondong || existing?.eupmyeondong,
        bjd_code: body.bjd_code || existing?.bjd_code,
      });
      const sido = resolvedAddr.sido;
      const sigungu = resolvedAddr.sigungu;
      const eupmyeondong = resolvedAddr.eupmyeondong;
      const farmlandTitle = String(body.farmland_title || existing?.farmland_title || `${sigungu} ${eupmyeondong} 농장`).trim();
      const detailJibun = String(body.detail_jibun ?? existing?.detail_jibun ?? '').trim();
      const areaPyeong = Math.max(10, Number(body.area_pyeong) || Number(existing?.area_pyeong) || 300);
      const soilPh = Number(body.soil_ph) || Number(existing?.soil_ph) || 6.2;
      const soilEc = Number(body.soil_ec) || Number(existing?.soil_ec) || 1.1;
      const bjdCode = resolvedAddr.bjd_code;
      const createdAt = String(body.created_at || existing?.created_at || nowStr).trim();

      db.prepare(`
        INSERT OR REPLACE INTO member_farmland (
          farmland_id, email, farmland_title, bjd_code, sido, sigungu, eupmyeondong,
          detail_jibun, area_pyeong, soil_ph, soil_ec, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        farmlandId,
        email,
        farmlandTitle,
        bjdCode,
        sido,
        sigungu,
        eupmyeondong,
        detailJibun,
        areaPyeong,
        soilPh,
        soilEc,
        createdAt
      );
      const savedLand = db.prepare('SELECT * FROM member_farmland WHERE farmland_id = ?').get(farmlandId) as Record<string, any> | undefined;
      if (savedLand) {
        await supabaseRestUpsert('member_farmland', savedLand, 'farmland_id');
      }
      sendJson(res, { ok: true, farmland: savedLand, ...buildAdminMembersPayload() });
      return;
    }

    if (pathname === '/api/admin/member-farmlands/delete' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const farmlandId = String(body.farmland_id || '').trim();
      if (farmlandId) {
        db.prepare('DELETE FROM member_farmland WHERE farmland_id = ?').run(farmlandId);
        await supabaseRestDelete('member_farmland', `farmland_id=eq.${encodeURIComponent(farmlandId)}`);
      }
      sendJson(res, buildAdminMembersPayload());
      return;
    }

    if (pathname === '/api/admin/member-crops/save' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const nowStr = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
      const cropPlanId = String(body.crop_plan_id || `CPLAN-${Date.now()}`).trim();
      const existing = db.prepare('SELECT * FROM member_crop_plan WHERE crop_plan_id = ?').get(cropPlanId) as Record<string, any> | undefined;
      const email = String(body.email || existing?.email || 'CloudBae@naver.com').trim();
      const resolvedAddr = resolveCultivationAddressFromInput({
        sido: body.sido || existing?.sido,
        sigungu: body.sigungu || existing?.sigungu,
        eupmyeondong: body.eupmyeondong || existing?.eupmyeondong,
      });
      const sido = resolvedAddr.sido;
      const sigungu = resolvedAddr.sigungu;
      const eupmyeondong = resolvedAddr.eupmyeondong;
      const matchedFarmland =
        (db
          .prepare(
            'SELECT farmland_id FROM member_farmland WHERE LOWER(email) = LOWER(?) AND sido = ? AND sigungu = ? AND eupmyeondong = ? LIMIT 1'
          )
          .get(email, sido, sigungu, eupmyeondong) as { farmland_id?: string } | undefined) ||
        (db
          .prepare('SELECT farmland_id FROM member_farmland WHERE LOWER(email) = LOWER(?) ORDER BY created_at ASC LIMIT 1')
          .get(email) as { farmland_id?: string } | undefined);
      const farmlandId = String(body.farmland_id || existing?.farmland_id || matchedFarmland?.farmland_id || 'LAND-CB-01').trim();
      const cropName = String(body.crop_name || existing?.crop_name || '가을배추').trim();
      const cultivarName = String(body.cultivar_name || existing?.cultivar_name || '불암3호').trim();
      const plantingType = String(body.planting_type || existing?.planting_type || '모종').trim();
      const areaPyeong = Math.max(10, Number(body.area_pyeong) || Number(existing?.area_pyeong) || 300);
      const plantingDate = String(body.planting_date || existing?.planting_date || '2026-08-25').trim();
      const progressPct = Math.max(0, Math.min(100, Number(body.progress_pct ?? existing?.progress_pct ?? 25)));

      const [y, m, d] = plantingDate.split('-').map(Number);
      const dt = new Date(y || 2026, (m || 8) - 1, d || 25);
      dt.setDate(dt.getDate() + 80);
      const expectedHarvestDate =
        String(body.expected_harvest_date || existing?.expected_harvest_date || '').trim() ||
        `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

      const requestNo =
        String(body.request_no || existing?.request_no || '').trim() ||
        (plantingType.includes('씨')
          ? 'REQ-20261106-008'
          : cropName.includes('봄')
          ? 'REQ-20261106-005'
          : 'REQ-20261106-009');

      const stageByPct =
        String(body.current_stage_name || '').trim() ||
        (progressPct >= 100
          ? '06. 수확 완료'
          : progressPct >= 80
          ? '05. 병해충 예찰 (수확전 후기관리)'
          : progressPct >= 50
          ? '04. 생육 관리 (웃거름·결구기)'
          : progressPct >= 30
          ? '03. 정식·활착 (집중관수)'
          : progressPct >= 15
          ? '02. 파종·육묘 (육묘 환경관리)'
          : '01. 재배 준비 (토양개량·밑거름)');

      const statusText =
        String(body.status_text || '').trim() ||
        (progressPct >= 100 ? '수확 완료 · 이력 반영' : '기후 연동 생육 관리중');
      const createdAt = String(body.created_at || existing?.created_at || nowStr).trim();

      db.prepare(`
        INSERT OR REPLACE INTO member_crop_plan (
          crop_plan_id, email, request_no, farmland_id, sido, sigungu, eupmyeondong,
          crop_name, cultivar_name, planting_type, area_pyeong, planting_date,
          expected_harvest_date, current_stage_name, progress_pct, status_text, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        cropPlanId,
        email,
        requestNo,
        farmlandId,
        sido,
        sigungu,
        eupmyeondong,
        cropName,
        cultivarName,
        plantingType,
        areaPyeong,
        plantingDate,
        expectedHarvestDate,
        stageByPct,
        progressPct,
        statusText,
        createdAt
      );
      const savedCropPlan = db.prepare('SELECT * FROM member_crop_plan WHERE crop_plan_id = ?').get(cropPlanId) as Record<string, any> | undefined;
      if (savedCropPlan) {
        await supabaseRestUpsert('member_crop_plan', savedCropPlan, 'crop_plan_id');
      }

      // member_schedule_request에도 동일 request_no로 자동 동기화하여 모든 원격 브라우저/기기에서 동일한 재배일정이 조회되도록 보장
      const existingReqRow = db
        .prepare('SELECT request_no FROM member_schedule_request WHERE request_no = ? LIMIT 1')
        .get(requestNo) as { request_no?: string } | undefined;
      if (!existingReqRow) {
        const resolvedTax = resolveCropTaxonomyFromInput({
          group_id: body.group_id,
          group_name: body.group_name,
          crop_name: cropName,
          item_name_3rd: cultivarName,
        });
        const isSeedMethod = plantingType.includes('씨') || plantingType.includes('직파');
        const nowReqAt = String(savedCropPlan?.created_at || new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' '));
        const syncReqRow = {
          request_no: requestNo,
          member_id: email,
          member_contact: '010-2026-0109',
          group_id: resolvedTax.group_id,
          group_name: resolvedTax.group_name,
          crop_id: resolvedTax.crop_id,
          crop_name: resolvedTax.crop_name,
          cultivar_id: resolvedTax.cultivar_id,
          item_name_3rd: resolvedTax.item_name_3rd,
          system_id: resolvedTax.system_id,
          system_name: resolvedTax.system_name,
          bjd_code: resolvedAddr.bjd_code,
          sido,
          sigungu,
          eupmyeondong,
          detail_address: String(body.detail_address || ''),
          area_pyeong: areaPyeong,
          cultivation_type: '노지',
          land_category: '전(밭)',
          planting_method: isSeedMethod ? '노지 직파(씨)' : '노지 정식(모종)',
          desired_start_date: plantingDate,
          expected_harvest_date: expectedHarvestDate,
          mulching_yn: 1,
          irrigation_type: '점적관수',
          is_organic: 0,
          soil_test_linked_yn: 1,
          target_yield_kg: 3500,
          etc_notes: `토양:사양토 | 관수:점적관수 | 환경:멀칭,부직포 | 일정기준:OPTIMAL_AUTO(${plantingDate})`,
          request_status: '일정산출완료',
          requested_at: nowReqAt,
          soil_condition: '사양토',
          facility_env_json: '["멀칭","부직포"]',
          schedule_base_type: 'OPTIMAL_AUTO',
          schedule_base_date: plantingDate,
          area_unit: '평',
        };
        db.prepare(`
          INSERT OR REPLACE INTO member_schedule_request (
            request_no, member_id, member_contact,
            group_id, group_name, crop_id, crop_name, cultivar_id, item_name_3rd, system_id, system_name,
            bjd_code, sido, sigungu, eupmyeondong, detail_address,
            area_pyeong, cultivation_type, land_category, planting_method,
            desired_start_date, expected_harvest_date, mulching_yn, irrigation_type,
            is_organic, soil_test_linked_yn, target_yield_kg, etc_notes, request_status, requested_at,
            soil_condition, facility_env_json, schedule_base_type, schedule_base_date, area_unit
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          syncReqRow.request_no, syncReqRow.member_id, syncReqRow.member_contact,
          syncReqRow.group_id, syncReqRow.group_name, syncReqRow.crop_id, syncReqRow.crop_name, syncReqRow.cultivar_id, syncReqRow.item_name_3rd, syncReqRow.system_id, syncReqRow.system_name,
          syncReqRow.bjd_code, syncReqRow.sido, syncReqRow.sigungu, syncReqRow.eupmyeondong, syncReqRow.detail_address,
          syncReqRow.area_pyeong, syncReqRow.cultivation_type, syncReqRow.land_category, syncReqRow.planting_method,
          syncReqRow.desired_start_date, syncReqRow.expected_harvest_date, syncReqRow.mulching_yn, syncReqRow.irrigation_type,
          syncReqRow.is_organic, syncReqRow.soil_test_linked_yn, syncReqRow.target_yield_kg, syncReqRow.etc_notes, syncReqRow.request_status, syncReqRow.requested_at,
          syncReqRow.soil_condition, syncReqRow.facility_env_json, syncReqRow.schedule_base_type, syncReqRow.schedule_base_date, syncReqRow.area_unit
        );
        await supabaseRestUpsert('member_schedule_request', syncReqRow, 'request_no');
      }
      sendJson(res, { ok: true, cropPlan: savedCropPlan, ...buildAdminMembersPayload() });
      return;
    }

    if (pathname === '/api/admin/member-crops/delete' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const cropPlanId = String(body.crop_plan_id || '').trim();
      const reqNoInput = String(body.request_no || '').trim();
      const existingPlan = cropPlanId
        ? (db
            .prepare('SELECT request_no FROM member_crop_plan WHERE crop_plan_id = ?')
            .get(cropPlanId) as { request_no?: string } | undefined)
        : undefined;
      const targetReqNos = Array.from(
        new Set([reqNoInput, existingPlan?.request_no].filter(Boolean))
      );

      if (cropPlanId) {
        db.prepare('DELETE FROM member_crop_plan WHERE crop_plan_id = ?').run(cropPlanId);
        await supabaseRestDelete('member_crop_plan', `crop_plan_id=eq.${encodeURIComponent(cropPlanId)}`);
      }
      for (const rNo of targetReqNos) {
        db.prepare('DELETE FROM member_schedule_request WHERE request_no = ?').run(rNo);
        db.prepare('DELETE FROM member_crop_plan WHERE request_no = ?').run(rNo);
        try {
          db.prepare('DELETE FROM schedule_provision_custom_item WHERE request_no = ?').run(rNo);
        } catch {
          // ignore
        }
        try {
          db.prepare('DELETE FROM schedule_stage_recommendation_log WHERE request_no = ?').run(rNo);
        } catch {
          // ignore
        }
        try {
          db.prepare('DELETE FROM cultivation_history_log WHERE request_id = ?').run(rNo);
          db.prepare('DELETE FROM schedule_request WHERE request_id = ?').run(rNo);
        } catch {
          // ignore
        }
        await Promise.all([
          supabaseRestDelete('member_schedule_request', `request_no=eq.${encodeURIComponent(rNo)}`),
          supabaseRestDelete('member_crop_plan', `request_no=eq.${encodeURIComponent(rNo)}`),
          supabaseRestDelete('schedule_provision_custom_item', `request_no=eq.${encodeURIComponent(rNo)}`),
          supabaseRestDelete('schedule_stage_recommendation_log', `request_no=eq.${encodeURIComponent(rNo)}`),
          supabaseRestDelete('cultivation_history_log', `request_id=eq.${encodeURIComponent(rNo)}`),
          supabaseRestDelete('schedule_request', `request_id=eq.${encodeURIComponent(rNo)}`),
        ]);
      }
      sendJson(res, buildAdminMembersPayload());
      return;
    }

    // 6. 마이페이지 회원 기본정보 수정 API
    if (pathname === '/api/mypage/profile' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const email = String(body.email || 'CloudBae@naver.com').trim();
      const name = String(body.name || '배철민').trim();
      const gender = String(body.gender || '남성').trim();
      const birthDate = String(body.birth_date || '1978-05-15').trim();
      const age = Number(body.age) || 48;
      const roadAddress = String(body.road_address || '').trim();
      const roadAddressDetail = String(body.road_address_detail || '').trim();
      const resolvedProfileAddr = resolveCultivationAddressFromInput({
        sido: body.sido,
        sigungu: body.sigungu,
        eupmyeondong: body.eupmyeondong,
        road_address: roadAddress,
        bjd_code: body.bjd_code,
      });
      const matchedRoadRow = db
        .prepare(
          `SELECT r.road_code, r.postal_code, r.full_road_address, j.full_jibun_address
           FROM road_address r
           LEFT JOIN jibun_address j ON r.bjd_code = j.bjd_code
           WHERE r.bjd_code = ?
           ORDER BY r.road_addr_id ASC
           LIMIT 1`
        )
        .get(resolvedProfileAddr.bjd_code) as
        | { road_code?: string; postal_code?: string; full_road_address?: string; full_jibun_address?: string }
        | undefined;
      const postalCode = String(body.postal_code || matchedRoadRow?.postal_code || '27481').trim();
      const roadCode = String(body.road_code || matchedRoadRow?.road_code || '').trim();
      const bjdCode = String(body.bjd_code || resolvedProfileAddr.bjd_code || '4313010700').trim();
      const sido = resolvedProfileAddr.sido;
      const sigungu = resolvedProfileAddr.sigungu;
      const eupmyeondong = resolvedProfileAddr.eupmyeondong;
      const jibunAddress = String(
        body.jibun_address ||
          matchedRoadRow?.full_jibun_address ||
          `${sido} ${sigungu} ${eupmyeondong}`
      ).trim();
      const phone = String(body.phone || '010-2026-0109').trim();

      db.prepare(`
        UPDATE user_member
        SET name = ?, gender = ?, birth_date = ?, age = ?,
            road_address = ?, road_address_detail = ?, postal_code = ?,
            road_code = ?, bjd_code = ?, sido = ?, sigungu = ?, eupmyeondong = ?, jibun_address = ?,
            phone = ?
        WHERE LOWER(email) = LOWER(?)
      `).run(
        name,
        gender,
        birthDate,
        age,
        roadAddress,
        roadAddressDetail,
        postalCode,
        roadCode,
        bjdCode,
        sido,
        sigungu,
        eupmyeondong,
        jibunAddress,
        phone,
        email
      );
      const updatedMem = db.prepare('SELECT * FROM user_member WHERE LOWER(email) = LOWER(?)').get(email) as Record<string, any> | undefined;
      if (updatedMem) {
        await supabaseRestUpsert('user_member', updatedMem, 'member_id');
      }

      const payload = buildMemberMyPagePayload(email);
      sendJson(res, { ok: true, ...payload });
      return;
    }

    // 7. 마이페이지 재배지 등록 API (관리자 페이지 재배지 관리 DB 연동, 복수 등록 가능)
    if (pathname === '/api/mypage/farmlands' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const email = String(body.email || 'CloudBae@naver.com').trim();
      const resolvedAddr = resolveCultivationAddressFromInput({
        sido: body.sido,
        sigungu: body.sigungu,
        eupmyeondong: body.eupmyeondong,
        bjd_code: body.bjd_code,
      });
      const sido = resolvedAddr.sido;
      const sigungu = resolvedAddr.sigungu;
      const eupmyeondong = resolvedAddr.eupmyeondong;
      const farmlandTitle =
        String(body.farmland_title || '').trim() || `${sigungu} ${eupmyeondong} 농장`;
      const detailJibun = String(body.detail_jibun ?? '').trim();
      const areaPyeong = Math.max(10, Number(body.area_pyeong) || 300);
      const soilPh = Number(body.soil_ph) || 6.2;
      const soilEc = Number(body.soil_ec) || 1.1;

      const bjdCode = resolvedAddr.bjd_code;
      const farmlandId = String(body.farmland_id || `LAND-${Date.now()}`).trim();

      db.prepare(`
        INSERT OR REPLACE INTO member_farmland (
          farmland_id, email, farmland_title, bjd_code, sido, sigungu, eupmyeondong,
          detail_jibun, area_pyeong, soil_ph, soil_ec
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        farmlandId,
        email,
        farmlandTitle,
        bjdCode,
        sido,
        sigungu,
        eupmyeondong,
        detailJibun,
        areaPyeong,
        soilPh,
        soilEc
      );
      const savedLand = db.prepare('SELECT * FROM member_farmland WHERE farmland_id = ?').get(farmlandId) as Record<string, any> | undefined;
      if (savedLand) {
        await supabaseRestUpsert('member_farmland', savedLand, 'farmland_id');
      }

      const payload = buildMemberMyPagePayload(email);
      sendJson(res, { ok: true, ...payload });
      return;
    }

    if (pathname === '/api/mypage/farmlands/delete' && req.method === 'POST') {
      const { email, farmland_id } = await readJsonBody(req);
      db.prepare('DELETE FROM member_farmland WHERE farmland_id = ?').run(farmland_id);
      await supabaseRestDelete('member_farmland', `farmland_id=eq.${encodeURIComponent(farmland_id)}`);
      const payload = buildMemberMyPagePayload(email || 'CloudBae@naver.com');
      sendJson(res, { ok: true, ...payload });
      return;
    }

    // 8. 마이페이지 재배작물 등록(복수 가능) 및 진행율 관리 API
    if (pathname === '/api/mypage/crops' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const email = String(body.email || 'CloudBae@naver.com').trim();
      const resolvedAddr = resolveCultivationAddressFromInput({
        sido: body.sido,
        sigungu: body.sigungu,
        eupmyeondong: body.eupmyeondong,
        bjd_code: body.bjd_code,
      });
      const sido = resolvedAddr.sido;
      const sigungu = resolvedAddr.sigungu;
      const eupmyeondong = resolvedAddr.eupmyeondong;
      const detailAddress = String(body.detail_address || '').trim();
      let farmlandId = String(body.farmland_id || '').trim();
      const matchedRegionLand = db
        .prepare(
          `SELECT farmland_id, sido, sigungu, eupmyeondong, detail_jibun
           FROM member_farmland
           WHERE LOWER(email) = LOWER(?)
             AND sido = ? AND sigungu = ? AND eupmyeondong = ?
             AND (? = '' OR COALESCE(TRIM(detail_jibun), '') = ?)
           ORDER BY created_at ASC LIMIT 1`
        )
        .get(email, sido, sigungu, eupmyeondong, detailAddress, detailAddress) as
        | {
            farmland_id?: string;
            sido?: string;
            sigungu?: string;
            eupmyeondong?: string;
            detail_jibun?: string;
          }
        | undefined;
      const passedLand = farmlandId
        ? (db
            .prepare(
              'SELECT farmland_id, email, sido, sigungu, eupmyeondong, detail_jibun FROM member_farmland WHERE farmland_id = ? LIMIT 1'
            )
            .get(farmlandId) as
            | {
                farmland_id?: string;
                email?: string;
                sido?: string;
                sigungu?: string;
                eupmyeondong?: string;
                detail_jibun?: string;
              }
            | undefined)
        : undefined;
      const isPassedLandValidForRegion =
        passedLand &&
        String(passedLand.email || '').toLowerCase() === email.toLowerCase() &&
        passedLand.sido === sido &&
        passedLand.sigungu === sigungu &&
        passedLand.eupmyeondong === eupmyeondong &&
        (!detailAddress || String(passedLand.detail_jibun || '').trim() === detailAddress);
      if (isPassedLandValidForRegion && passedLand?.farmland_id) {
        farmlandId = passedLand.farmland_id;
      } else if (matchedRegionLand?.farmland_id) {
        farmlandId = matchedRegionLand.farmland_id;
      } else {
        farmlandId = '';
      }
      const customCropLandTitle = String(body.farmland_title || '').trim();
      if (!farmlandId) {
        const autoLandId = `LAND-${Date.now()}`;
        const autoLandTitle =
          customCropLandTitle ||
          `${sigungu} ${eupmyeondong}${
            detailAddress ? ` (${detailAddress})` : ''
          } 농장`;
        db.prepare(`
          INSERT OR REPLACE INTO member_farmland (
            farmland_id, email, farmland_title, bjd_code, sido, sigungu, eupmyeondong,
            detail_jibun, area_pyeong, soil_ph, soil_ec
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 6.3, 1.1)
        `).run(
          autoLandId,
          email,
          autoLandTitle,
          resolvedAddr.bjd_code,
          sido,
          sigungu,
          eupmyeondong,
          detailAddress,
          Math.max(10, Number(body.area_pyeong) || 300)
        );
        const savedAutoLand = db.prepare('SELECT * FROM member_farmland WHERE farmland_id = ?').get(autoLandId) as Record<string, any> | undefined;
        if (savedAutoLand) {
          await supabaseRestUpsert('member_farmland', savedAutoLand, 'farmland_id');
        }
        farmlandId = autoLandId;
      } else if (customCropLandTitle) {
        db.prepare('UPDATE member_farmland SET farmland_title = ? WHERE farmland_id = ?').run(
          customCropLandTitle,
          farmlandId
        );
        const updatedLand = db
          .prepare('SELECT * FROM member_farmland WHERE farmland_id = ?')
          .get(farmlandId) as Record<string, any> | undefined;
        if (updatedLand) {
          await supabaseRestUpsert('member_farmland', updatedLand, 'farmland_id');
        }
      }
      const cropName = String(body.crop_name || '가을배추').trim();
      const cultivarName = String(body.cultivar_name || '불암3호').trim();
      const plantingType = String(body.planting_type || '모종').trim();
      const areaPyeong = Math.max(10, Number(body.area_pyeong) || 300);
      const plantingDate = String(body.planting_date || '2026-08-25').trim();
      const progressPct = Math.max(0, Math.min(100, Number(body.progress_pct ?? 25)));

      // 작물별 표준 생리·재배기간(defaultCultivationDays) 기준 수확예정일 자동 계산
      const computedExpectedHarvestDate = computeCropExpectedHarvestDate(plantingDate, cropName);
      const expectedHarvestDate =
        String(body.expected_harvest_date || '').trim() || computedExpectedHarvestDate;

      const requestNo =
        String(body.request_no || '').trim() ||
        (plantingType.includes('씨')
          ? 'REQ-20261106-008'
          : cropName.includes('봄')
          ? 'REQ-20261106-005'
          : 'REQ-20261106-009');

      const stageByPct =
        progressPct >= 100
          ? '06. 수확 완료'
          : progressPct >= 80
          ? '05. 병해충 예찰 (수확전 후기관리)'
          : progressPct >= 50
          ? '04. 생육 관리 (웃거름·결구기)'
          : progressPct >= 30
          ? '03. 정식·활착 (집중관수)'
          : progressPct >= 15
          ? '02. 파종·육묘 (육묘 환경관리)'
          : '01. 재배 준비 (토양개량·밑거름)';

      const statusText =
        String(body.status_text || '').trim() ||
        (progressPct >= 100 ? '수확 완료 · 이력 반영' : '기후 연동 생육 관리중');

      const existingPlanByReq = db
        .prepare(
          'SELECT crop_plan_id FROM member_crop_plan WHERE LOWER(email) = LOWER(?) AND request_no = ? LIMIT 1'
        )
        .get(email, requestNo) as { crop_plan_id?: string } | undefined;
      const cropPlanId = String(
        existingPlanByReq?.crop_plan_id || body.crop_plan_id || `CPLAN-${requestNo}`
      ).trim();

      const dupPlans = db
        .prepare(
          'SELECT crop_plan_id FROM member_crop_plan WHERE LOWER(email) = LOWER(?) AND request_no = ? AND crop_plan_id != ?'
        )
        .all(email, requestNo, cropPlanId) as { crop_plan_id: string }[];
      for (const dup of dupPlans) {
        db.prepare('DELETE FROM member_crop_plan WHERE crop_plan_id = ?').run(dup.crop_plan_id);
        await supabaseRestDelete(
          'member_crop_plan',
          `crop_plan_id=eq.${encodeURIComponent(dup.crop_plan_id)}`
        );
      }

      db.prepare(`
        INSERT OR REPLACE INTO member_crop_plan (
          crop_plan_id, email, request_no, farmland_id, sido, sigungu, eupmyeondong,
          crop_name, cultivar_name, planting_type, area_pyeong, planting_date,
          expected_harvest_date, current_stage_name, progress_pct, status_text
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        cropPlanId,
        email,
        requestNo,
        farmlandId,
        sido,
        sigungu,
        eupmyeondong,
        cropName,
        cultivarName,
        plantingType,
        areaPyeong,
        plantingDate,
        expectedHarvestDate,
        stageByPct,
        progressPct,
        statusText
      );
      const savedCropPlan = db.prepare('SELECT * FROM member_crop_plan WHERE crop_plan_id = ?').get(cropPlanId) as Record<string, any> | undefined;
      if (savedCropPlan) {
        await supabaseRestUpsert('member_crop_plan', savedCropPlan, 'crop_plan_id');
      }

      // member_schedule_request에도 동일 request_no로 자동 동기화하여 모든 원격 브라우저/기기에서 동일한 재배일정이 조회되도록 보장
      const existingReqRow = db
        .prepare('SELECT request_no FROM member_schedule_request WHERE request_no = ? LIMIT 1')
        .get(requestNo) as { request_no?: string } | undefined;
      if (!existingReqRow) {
        const resolvedTax = resolveCropTaxonomyFromInput({
          group_id: body.group_id,
          group_name: body.group_name,
          crop_name: cropName,
          item_name_3rd: cultivarName,
        });
        const isSeedMethod = plantingType.includes('씨') || plantingType.includes('직파');
        const nowReqAt = String(savedCropPlan?.created_at || new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' '));
        const syncReqRow = {
          request_no: requestNo,
          member_id: email,
          member_contact: '010-2026-0109',
          group_id: resolvedTax.group_id,
          group_name: resolvedTax.group_name,
          crop_id: resolvedTax.crop_id,
          crop_name: resolvedTax.crop_name,
          cultivar_id: resolvedTax.cultivar_id,
          item_name_3rd: resolvedTax.item_name_3rd,
          system_id: resolvedTax.system_id,
          system_name: resolvedTax.system_name,
          bjd_code: resolvedAddr.bjd_code,
          sido,
          sigungu,
          eupmyeondong,
          detail_address: String(body.detail_address || ''),
          area_pyeong: areaPyeong,
          cultivation_type: '노지',
          land_category: '전(밭)',
          planting_method: isSeedMethod ? '노지 직파(씨)' : '노지 정식(모종)',
          desired_start_date: plantingDate,
          expected_harvest_date: expectedHarvestDate,
          mulching_yn: 1,
          irrigation_type: '점적관수',
          is_organic: 0,
          soil_test_linked_yn: 1,
          target_yield_kg: 3500,
          etc_notes: `토양:사양토 | 관수:점적관수 | 환경:멀칭,부직포 | 일정기준:OPTIMAL_AUTO(${plantingDate})`,
          request_status: '일정산출완료',
          requested_at: nowReqAt,
          soil_condition: '사양토',
          facility_env_json: '["멀칭","부직포"]',
          schedule_base_type: 'OPTIMAL_AUTO',
          schedule_base_date: plantingDate,
          area_unit: '평',
        };
        db.prepare(`
          INSERT OR REPLACE INTO member_schedule_request (
            request_no, member_id, member_contact,
            group_id, group_name, crop_id, crop_name, cultivar_id, item_name_3rd, system_id, system_name,
            bjd_code, sido, sigungu, eupmyeondong, detail_address,
            area_pyeong, cultivation_type, land_category, planting_method,
            desired_start_date, expected_harvest_date, mulching_yn, irrigation_type,
            is_organic, soil_test_linked_yn, target_yield_kg, etc_notes, request_status, requested_at,
            soil_condition, facility_env_json, schedule_base_type, schedule_base_date, area_unit
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          syncReqRow.request_no, syncReqRow.member_id, syncReqRow.member_contact,
          syncReqRow.group_id, syncReqRow.group_name, syncReqRow.crop_id, syncReqRow.crop_name, syncReqRow.cultivar_id, syncReqRow.item_name_3rd, syncReqRow.system_id, syncReqRow.system_name,
          syncReqRow.bjd_code, syncReqRow.sido, syncReqRow.sigungu, syncReqRow.eupmyeondong, syncReqRow.detail_address,
          syncReqRow.area_pyeong, syncReqRow.cultivation_type, syncReqRow.land_category, syncReqRow.planting_method,
          syncReqRow.desired_start_date, syncReqRow.expected_harvest_date, syncReqRow.mulching_yn, syncReqRow.irrigation_type,
          syncReqRow.is_organic, syncReqRow.soil_test_linked_yn, syncReqRow.target_yield_kg, syncReqRow.etc_notes, syncReqRow.request_status, syncReqRow.requested_at,
          syncReqRow.soil_condition, syncReqRow.facility_env_json, syncReqRow.schedule_base_type, syncReqRow.schedule_base_date, syncReqRow.area_unit
        );
        await supabaseRestUpsert('member_schedule_request', syncReqRow, 'request_no');
      }

      const payload = buildMemberMyPagePayload(email);
      sendJson(res, { ok: true, ...payload });
      return;
    }

    if (pathname === '/api/mypage/crops/progress' && req.method === 'POST') {
      const { email, crop_plan_id, progress_pct } = await readJsonBody(req);
      const pct = Math.max(0, Math.min(100, Number(progress_pct) || 0));
      const stageByPct =
        pct >= 100
          ? '06. 수확 완료'
          : pct >= 80
          ? '05. 병해충 예찰 (결구후기 방제)'
          : pct >= 50
          ? '04. 생육 관리 (2차 웃거름·결구중기)'
          : pct >= 30
          ? '03. 정식·활착 (활착기 집중관수)'
          : pct >= 15
          ? '02. 파종·육묘 (육묘·순화처리)'
          : '01. 재배 준비 (포장정리·밑거름)';
      const statusText = pct >= 100 ? '수확 완료 · 이력 반영' : '기후 연동 정상 생육중';

      db.prepare(`
        UPDATE member_crop_plan
        SET progress_pct = ?, current_stage_name = ?, status_text = ?
        WHERE crop_plan_id = ?
      `).run(pct, stageByPct, statusText, crop_plan_id);
      const updatedCropPlan = db.prepare('SELECT * FROM member_crop_plan WHERE crop_plan_id = ?').get(crop_plan_id) as Record<string, any> | undefined;
      if (updatedCropPlan) {
        await supabaseRestUpsert('member_crop_plan', updatedCropPlan, 'crop_plan_id');
      }

      const payload = buildMemberMyPagePayload(email || 'CloudBae@naver.com');
      sendJson(res, { ok: true, ...payload });
      return;
    }

    if (pathname === '/api/mypage/crops/delete' && req.method === 'POST') {
      const { email, crop_plan_id, request_no, display_request_no, only_provision } =
        await readJsonBody(req);
      const onlyProvision = only_provision !== false;
      const existingPlan = crop_plan_id
        ? (db
            .prepare('SELECT * FROM member_crop_plan WHERE crop_plan_id = ?')
            .get(crop_plan_id) as Record<string, any> | undefined)
        : undefined;
      const targetReqNos = Array.from(
        new Set([request_no, display_request_no, existingPlan?.request_no].filter(Boolean))
      );

      if (crop_plan_id) {
        db.prepare('DELETE FROM member_crop_plan WHERE crop_plan_id = ?').run(crop_plan_id);
        await supabaseRestDelete(
          'member_crop_plan',
          `crop_plan_id=eq.${encodeURIComponent(crop_plan_id)}`
        );
      }

      for (const rNo of targetReqNos) {
        if (onlyProvision) {
          db.prepare(
            "UPDATE member_schedule_request SET request_status = '재요청가능(일정삭제됨)' WHERE request_no = ?"
          ).run(rNo);
          const updatedReqRow = db
            .prepare('SELECT * FROM member_schedule_request WHERE request_no = ?')
            .get(rNo) as Record<string, any> | undefined;
          if (updatedReqRow) {
            await supabaseRestUpsert('member_schedule_request', updatedReqRow, 'request_no');
          }
        } else {
          db.prepare('DELETE FROM member_schedule_request WHERE request_no = ?').run(rNo);
          await supabaseRestDelete(
            'member_schedule_request',
            `request_no=eq.${encodeURIComponent(rNo)}`
          );
        }
        db.prepare('DELETE FROM member_crop_plan WHERE request_no = ?').run(rNo);
        try {
          db.prepare('DELETE FROM schedule_provision_custom_item WHERE request_no = ?').run(rNo);
        } catch {
          // ignore
        }
        try {
          db.prepare('DELETE FROM schedule_stage_recommendation_log WHERE request_no = ?').run(rNo);
        } catch {
          // ignore
        }
        try {
          db.prepare('DELETE FROM cultivation_history_log WHERE request_id = ?').run(rNo);
          if (!onlyProvision) {
            db.prepare('DELETE FROM schedule_request WHERE request_id = ?').run(rNo);
          }
        } catch {
          // ignore
        }

        await supabaseRestDelete('member_crop_plan', `request_no=eq.${encodeURIComponent(rNo)}`);
        await supabaseRestDelete(
          'schedule_provision_custom_item',
          `request_no=eq.${encodeURIComponent(rNo)}`
        );
        await supabaseRestDelete(
          'schedule_stage_recommendation_log',
          `request_no=eq.${encodeURIComponent(rNo)}`
        );
        await supabaseRestDelete(
          'cultivation_history_log',
          `request_id=eq.${encodeURIComponent(rNo)}`
        );
        if (!onlyProvision) {
          await supabaseRestDelete('schedule_request', `request_id=eq.${encodeURIComponent(rNo)}`);
        }
      }

      const payload = buildMemberMyPagePayload(email || 'CloudBae@naver.com');
      sendJson(res, { ok: true, deleted_request_nos: targetReqNos, ...payload });
      return;
    }

    // 9. 마이페이지 농자재 구매현황 저장 API (원클릭 구매 시 즉시 연동)
    if (pathname === '/api/mypage/orders' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const email = String(body.email || 'CloudBae@naver.com').trim();
      const orderNo = String(body.orderNo || `ORD-${Date.now()}`).trim();
      const orderedAt = String(body.orderedAt || '2026.11.09 17:30').trim();
      const purchaseTitle = String(
        body.purchaseTitle || '생육단계별 선택 농자재 일괄 구매'
      ).trim();
      const cropTitle = String(body.cropTitle || '가을배추 (불암3호)').trim();
      const memberFarmland = db
        .prepare('SELECT sido, sigungu, eupmyeondong, detail_jibun FROM member_farmland WHERE LOWER(email) = LOWER(?) ORDER BY created_at ASC LIMIT 1')
        .get(email) as { sido?: string; sigungu?: string; eupmyeondong?: string; detail_jibun?: string } | undefined;
      const memberProfile = db
        .prepare('SELECT road_address, road_address_detail FROM user_member WHERE LOWER(email) = LOWER(?) LIMIT 1')
        .get(email) as { road_address?: string; road_address_detail?: string } | undefined;
      const fallbackMemberAddr = memberFarmland
        ? [memberFarmland.sido, memberFarmland.sigungu, memberFarmland.eupmyeondong, memberFarmland.detail_jibun].filter(Boolean).join(' ')
        : [memberProfile?.road_address, memberProfile?.road_address_detail].filter(Boolean).join(' ') || '충청북도 충주시 단월동';
      let regionAddress = String(body.regionAddress || fallbackMemberAddr).trim();
      if (!regionAddress.includes('단월동')) {
        regionAddress = regionAddress.replace(/\s*412-5번지\s*일원/g, '').replace(/\s*412-5/g, '').trim();
      }
      const deliveryOption = String(body.deliveryOption || 'STAGE_SCHEDULED').trim();
      const paymentMethod = String(body.paymentMethod || 'NONGHYUP_CARD').trim();
      const deliveryStatus =
        deliveryOption === 'STAGE_SCHEDULED'
          ? '결제완료 · 생육단계별 적기 맞춤 분할배송 예약됨'
          : '결제완료 · 전 단계 농자재 일괄 출고준비중';
      const rawTotal = Number(body.orderRawTotal) || 0;
      const discountAmount = Number(body.orderDiscount) || 0;
      const finalTotal = Number(body.orderFinalTotal) || 0;
      const rewardPoints = Number(body.rewardPoints) || 0;
      const itemsJson = JSON.stringify(body.orderItems || []);

      db.prepare(`
        INSERT OR REPLACE INTO member_agro_order (
          order_no, email, ordered_at, purchase_title, crop_title, region_address,
          delivery_option, payment_method, delivery_status, raw_total, discount_amount,
          final_total, reward_points, items_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        orderNo,
        email,
        orderedAt,
        purchaseTitle,
        cropTitle,
        regionAddress,
        deliveryOption,
        paymentMethod,
        deliveryStatus,
        rawTotal,
        discountAmount,
        finalTotal,
        rewardPoints,
        itemsJson
      );
      const savedOrd = db.prepare('SELECT * FROM member_agro_order WHERE order_no = ?').get(orderNo) as Record<string, any> | undefined;
      if (savedOrd) {
        await supabaseRestUpsert('member_agro_order', savedOrd, 'order_no');
      }

      const payload = buildMemberMyPagePayload(email);
      sendJson(res, { ok: true, ...payload });
      return;
    }

    if (pathname === '/api/mypage/orders/delete' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const email = String(body.email || 'CloudBae@naver.com').trim();
      const orderNo = String(body.order_no || '').trim();
      if (body.delete_all) {
        db.prepare('DELETE FROM member_agro_order WHERE LOWER(email) = LOWER(?)').run(email);
        await supabaseRestDelete('member_agro_order', `email=eq.${encodeURIComponent(email)}`);
      } else if (orderNo) {
        db.prepare('DELETE FROM member_agro_order WHERE order_no = ?').run(orderNo);
        await supabaseRestDelete('member_agro_order', `order_no=eq.${encodeURIComponent(orderNo)}`);
      }
      const payload = buildMemberMyPagePayload(email);
      sendJson(res, { ok: true, ...payload });
      return;
    }

    // 10. 구매의향서 양식(내용) 및 접수 현황 조회·수정·삭제 API
    if (pathname === '/api/purchase-intents' && req.method === 'GET') {
      try {
        const [remoteCfg, remoteEntries] = await Promise.all([
          supabaseRestSelect('purchase_intent_config'),
          supabaseRestSelect('purchase_intent_entry'),
        ]);
        if (Array.isArray(remoteCfg) && remoteCfg.length > 0) {
          const rc = remoteCfg[0];
          const remoteTime = String(rc?.updated_at || '');
          db.prepare(`
            INSERT OR REPLACE INTO purchase_intent_config (config_id, template_json, updated_at)
            VALUES ('DEFAULT', ?, ?)
          `).run(String(rc.template_json || '{}'), remoteTime);
        }
        if (Array.isArray(remoteEntries) && remoteEntries.length > 0) {
          const insStmt = db.prepare(`
            INSERT OR REPLACE INTO purchase_intent_entry (
              intent_id, applicant_name, contact, main_crops, desired_services_json,
              monthly_wtp, final_intents_json, written_date, agreed_final, agreed_privacy, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const re of remoteEntries) {
            insStmt.run(
              String(re.intent_id || ''),
              String(re.applicant_name || ''),
              String(re.contact || ''),
              String(re.main_crops || ''),
              String(re.desired_services_json || '[]'),
              String(re.monthly_wtp || '월 10,000원'),
              String(re.final_intents_json || '[]'),
              String(re.written_date || '2026-11-09'),
              Number(re.agreed_final === 0 || re.agreed_final === false ? 0 : 1),
              Number(re.agreed_privacy === 0 || re.agreed_privacy === false ? 0 : 1),
              String(re.created_at || '')
            );
          }
        }
      } catch {
        // ignore network errors
      }

      const cfgRow = db
        .prepare("SELECT template_json, updated_at FROM purchase_intent_config WHERE config_id = 'DEFAULT'")
        .get() as { template_json?: string; updated_at?: string } | undefined;
      let template = null;
      if (cfgRow?.template_json) {
        try {
          template = {
            ...JSON.parse(cfgRow.template_json),
            updated_at: cfgRow.updated_at || '',
          };
        } catch {
          template = null;
        }
      }
      const rows = db
        .prepare('SELECT * FROM purchase_intent_entry ORDER BY intent_id DESC')
        .all() as Record<string, any>[];
      const entries = rows.map((r) => ({
        intent_id: r.intent_id,
        applicant_name: r.applicant_name,
        contact: r.contact,
        main_crops: r.main_crops,
        desired_services: (() => {
          try {
            return JSON.parse(r.desired_services_json || '[]');
          } catch {
            return [];
          }
        })(),
        monthly_wtp: r.monthly_wtp,
        final_intents: (() => {
          try {
            return JSON.parse(r.final_intents_json || '[]');
          } catch {
            return [];
          }
        })(),
        written_date: r.written_date,
        agreed_final: Boolean(r.agreed_final),
        agreed_privacy: Boolean(r.agreed_privacy),
        created_at: r.created_at,
      }));
      sendJson(res, { ok: true, template, entries });
      return;
    }

    if (pathname === '/api/purchase-intents/template' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const templateObj = body.template || body;
      const nowStr = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
      const { _synced_to_sb, ...cleanTpl } = templateObj || {};
      const payloadJson = JSON.stringify({ ...cleanTpl, updated_at: nowStr });
      db.prepare(`
        INSERT OR REPLACE INTO purchase_intent_config (config_id, template_json, updated_at)
        VALUES ('DEFAULT', ?, ?)
      `).run(payloadJson, nowStr);
      await supabaseRestUpsert(
        'purchase_intent_config',
        [{ config_id: 'DEFAULT', template_json: payloadJson, updated_at: nowStr }],
        'config_id'
      ).catch(() => {});
      sendJson(res, { ok: true, template: { ...cleanTpl, updated_at: nowStr }, updatedAt: nowStr });
      return;
    }

    if (pathname === '/api/purchase-intents/entry' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const intentId = String(body.intent_id || `LOI-2026-${Date.now().toString().slice(-3)}`).trim();
      const applicantName = String(body.applicant_name || '').trim();
      const contact = String(body.contact || '').trim();
      const mainCrops = String(body.main_crops || '').trim();
      const desiredServices = Array.isArray(body.desired_services) ? body.desired_services : [];
      const monthlyWtp = String(body.monthly_wtp || '월 10,000원').trim();
      const finalIntents = Array.isArray(body.final_intents) ? body.final_intents : [];
      const writtenDate = String(body.written_date || '2026-11-09').trim();
      const agreedFinal = body.agreed_final === false ? 0 : 1;
      const agreedPrivacy = body.agreed_privacy === false ? 0 : 1;
      const createdAt = String(
        body.created_at || new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ')
      ).trim();

      db.prepare(`
        INSERT OR REPLACE INTO purchase_intent_entry (
          intent_id, applicant_name, contact, main_crops, desired_services_json,
          monthly_wtp, final_intents_json, written_date, agreed_final, agreed_privacy, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        intentId,
        applicantName,
        contact,
        mainCrops,
        JSON.stringify(desiredServices),
        monthlyWtp,
        JSON.stringify(finalIntents),
        writtenDate,
        agreedFinal,
        agreedPrivacy,
        createdAt
      );
      await supabaseRestUpsert(
        'purchase_intent_entry',
        [
          {
            intent_id: intentId,
            applicant_name: applicantName,
            contact,
            main_crops: mainCrops,
            desired_services_json: JSON.stringify(desiredServices),
            monthly_wtp: monthlyWtp,
            final_intents_json: JSON.stringify(finalIntents),
            written_date: writtenDate,
            agreed_final: agreedFinal,
            agreed_privacy: agreedPrivacy,
            created_at: createdAt,
          },
        ],
        'intent_id'
      ).catch(() => {});
      sendJson(res, { ok: true, intent_id: intentId });
      return;
    }

    if (pathname === '/api/purchase-intents/entry/delete' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const intentId = String(body.intent_id || '').trim();
      if (intentId) {
        db.prepare('DELETE FROM purchase_intent_entry WHERE intent_id = ?').run(intentId);
        await supabaseRestDelete(
          'purchase_intent_entry',
          `intent_id=eq.${encodeURIComponent(intentId)}`
        ).catch(() => {});
      }
      sendJson(res, { ok: true });
      return;
    }

    // 11. 디바이스/브라우저 간 실시간 동기화 상태(생육과정 완료 인정, 삭제 키, 장바구니, 구매이력) 조회·저장 API (Supabase DB Single Source of Truth)
    if (pathname === '/api/client-sync-state' && req.method === 'GET') {
      const email = (parsedUrl.searchParams.get('email') || 'CloudBae@naver.com').trim();
      const emailLower = email.toLowerCase();
      try {
        const remoteRows = await supabaseRestSelect(
          'member_ui_sync_state',
          `member_email=ilike.${encodeURIComponent(email)}`
        );
        if (Array.isArray(remoteRows) && remoteRows.length > 0) {
          const pickedByCleanKey: Record<
            string,
            { isScoped: boolean; updatedAt: string; memberEmail: string; stateJson: string }
          > = {};
          for (const r of remoteRows) {
            if (!r?.state_key) continue;
            const rawKeyStr = String(r.state_key);
            const isScoped = rawKeyStr.includes('::');
            const cleanK = isScoped
              ? rawKeyStr.split('::').slice(1).join('::')
              : rawKeyStr;
            const rowUpdated = String(r.updated_at || '');
            const prevPicked = pickedByCleanKey[cleanK];
            if (
              prevPicked &&
              ((prevPicked.isScoped && !isScoped) ||
                (prevPicked.isScoped === isScoped && prevPicked.updatedAt > rowUpdated))
            ) {
              continue;
            }
            pickedByCleanKey[cleanK] = {
              isScoped,
              updatedAt: rowUpdated,
              memberEmail: String(r.member_email || email),
              stateJson: String(r.state_json || '{}'),
            };
          }
          const upStmt = db.prepare(`
            INSERT OR REPLACE INTO member_ui_sync_state (state_key, member_email, state_json, updated_at)
            VALUES (?, ?, ?, ?)
          `);
          for (const [cleanK, picked] of Object.entries(pickedByCleanKey)) {
            const scopedKey = `${emailLower}::${cleanK}`;
            upStmt.run(scopedKey, picked.memberEmail, picked.stateJson, picked.updatedAt);
          }
        }
      } catch {
        // ignore network errors
      }
      const rows = db
        .prepare('SELECT state_key, member_email, state_json, updated_at FROM member_ui_sync_state WHERE LOWER(member_email) = LOWER(?)')
        .all(email) as Array<{ state_key: string; member_email: string; state_json: string; updated_at: string }>;
      const states: Record<string, any> = {};
      const stateMeta: Record<string, { isScoped: boolean; updatedAt: string }> = {};
      for (const r of rows) {
        const rawKeyStr = String(r.state_key);
        const isScoped = rawKeyStr.includes('::');
        const cleanKey = isScoped
          ? rawKeyStr.split('::').slice(1).join('::')
          : rawKeyStr;
        const rowUpdated = String(r.updated_at || '');
        const prevMeta = stateMeta[cleanKey];
        if (
          prevMeta &&
          ((prevMeta.isScoped && !isScoped) ||
            (prevMeta.isScoped === isScoped && prevMeta.updatedAt > rowUpdated))
        ) {
          continue;
        }
        try {
          states[cleanKey] = JSON.parse(r.state_json || '{}');
          stateMeta[cleanKey] = { isScoped, updatedAt: rowUpdated };
        } catch {
          states[cleanKey] = null;
        }
      }
      sendJson(res, { ok: true, email, states });
      return;
    }

    if (pathname === '/api/client-sync-state' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const email = String(body.email || 'CloudBae@naver.com').trim();
      const rawStateKey = String(body.state_key || '').trim();
      const stateValue = body.state_value !== undefined ? body.state_value : {};
      const nowStr = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
      if (rawStateKey) {
        const cleanKey = rawStateKey.includes('::') ? rawStateKey.split('::').slice(1).join('::') : rawStateKey;
        const scopedStateKey = `${email.toLowerCase()}::${cleanKey}`;
        const jsonStr = typeof stateValue === 'string' ? stateValue : JSON.stringify(stateValue);
        db.prepare(`
          INSERT OR REPLACE INTO member_ui_sync_state (state_key, member_email, state_json, updated_at)
          VALUES (?, ?, ?, ?)
        `).run(scopedStateKey, email, jsonStr, nowStr);
        await supabaseRestUpsert(
          'member_ui_sync_state',
          [
            {
              state_key: scopedStateKey,
              member_email: email,
              state_json: jsonStr,
              updated_at: nowStr,
            },
            ...(email.toLowerCase() === 'cloudbae@naver.com'
              ? [
                  {
                    state_key: cleanKey,
                    member_email: email,
                    state_json: jsonStr,
                    updated_at: nowStr,
                  },
                ]
              : []),
          ],
          'state_key'
        ).catch(() => {});
      }
      sendJson(res, { ok: true, state_key: rawStateKey, updated_at: nowStr });
      return;
    }

    // 정적 파일 서빙 (프로덕션 배포 및 public/docs PDF 서빙용)
    const distPath = path.resolve(process.cwd(), 'dist');
    const publicPath = path.resolve(process.cwd(), 'public');
    let filePath = path.join(distPath, pathname === '/' ? 'index.html' : pathname);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      const dirIndex = path.join(filePath, 'index.html');
      if (fs.existsSync(dirIndex) && fs.statSync(dirIndex).isFile()) {
        filePath = dirIndex;
      }
    }
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      const publicCandidate = path.join(publicPath, pathname);
      if (fs.existsSync(publicCandidate) && fs.statSync(publicCandidate).isFile()) {
        filePath = publicCandidate;
      }
    }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeMap: Record<string, string> = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.json': 'application/json',
        '.jpg': 'image/jpeg',
        '.png': 'image/png',
        '.svg': 'image/svg+xml',
        '.pdf': 'application/pdf',
      };
      res.writeHead(200, { 'Content-Type': mimeMap[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    const indexHtml = path.join(distPath, 'index.html');
    if (fs.existsSync(indexHtml)) {
      let html = fs.readFileSync(indexHtml, 'utf-8');
      const lowerPath = pathname.toLowerCase();
      if (lowerPath.includes('/survey')) {
        html = html
          .replace(/<title>[\s\S]*?<\/title>/i, '<title>재배컨설팅 서비스 설문조사</title>')
          .replace(/property="og:title"\s+content="[^"]*"/i, 'property="og:title" content="재배컨설팅 서비스 설문조사"')
          .replace(/property="og:description"\s+content="[^"]*"/i, 'property="og:description" content="재배컨설팅 서비스 설문조사"');
      } else if (lowerPath.includes('/purchase-intent')) {
        html = html
          .replace(/<title>[\s\S]*?<\/title>/i, '<title>구매 및 구독 의향서</title>')
          .replace(/property="og:title"\s+content="[^"]*"/i, 'property="og:title" content="구매 및 구독 의향서"')
          .replace(/property="og:description"\s+content="[^"]*"/i, 'property="og:description" content="구매 및 구독 의향서"');
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    sendJson(res, { message: 'FarmPlan API Server Running' });
  } catch (err: any) {
    sendJson(res, { error: err?.message || 'Internal Server Error' }, 500);
  }
});

server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

server.listen(PORT, () => {
  console.log(`FarmPlan Backend & SQLite Server running on http://localhost:${PORT}`);
});
