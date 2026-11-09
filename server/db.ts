import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { generateKoreaAddressDataset, generateKoreaRoadAndJibunDatasets } from './koreaAddresses.ts';
import { populateNationwide2025ClimateTable, populateNationwide2026FutureClimateTable } from './climateData.ts';
import { populateNationwideSoilTable } from './soilData.ts';
import {
  FERTILIZER_CATEGORIES,
  NUTRIENT_CATEGORIES,
  PESTICIDE_CATEGORIES,
  INITIAL_FERTILIZER_PRODUCTS,
  INITIAL_NUTRIENT_PRODUCTS,
  INITIAL_PESTICIDE_PRODUCTS,
} from './fertilizerProductAssets.ts';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'farmplan.db');
export const db = new DatabaseSync(dbPath);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA busy_timeout = 5000;
`);

export function initDatabase() {
  db.exec(`
    PRAGMA foreign_keys = ON;

    -- 1. 1단계: 작물군 (crop_group)
    CREATE TABLE IF NOT EXISTS crop_group (
      group_id TEXT PRIMARY KEY,
      group_name TEXT NOT NULL,
      description TEXT,
      icon_name TEXT DEFAULT 'Sprout',
      sort_order INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1
    );

    -- 2. 2단계: 작물 및 품종 (crop & cultivar)
    CREATE TABLE IF NOT EXISTS crop (
      crop_id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      crop_name TEXT NOT NULL,
      scientific_name TEXT,
      description TEXT,
      min_temp TEXT DEFAULT '5',
      max_temp TEXT DEFAULT '25',
      opt_temp TEXT DEFAULT '15~20',
      planting_type TEXT DEFAULT '모종', -- 씨 | 모종
      germination_temp TEXT DEFAULT '', -- 작물구분 값이 '씨' 일때 기입
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (group_id) REFERENCES crop_group(group_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cultivar (
      cultivar_id TEXT PRIMARY KEY,
      crop_id TEXT NOT NULL,
      cultivar_name TEXT NOT NULL,
      maturity_type TEXT NOT NULL, -- 조생종, 중생종, 만생종
      avg_growth_days INTEGER NOT NULL,
      characteristics TEXT,
      min_temp TEXT DEFAULT '5',
      max_temp TEXT DEFAULT '25',
      opt_temp TEXT DEFAULT '15~20',
      planting_type TEXT DEFAULT '모종', -- 씨 | 모종
      germination_temp TEXT DEFAULT '', -- 작물구분 값이 '씨' 일때 기입
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (crop_id) REFERENCES crop(crop_id) ON DELETE CASCADE
    );

    -- 3. 3단계: 재배작형 (cropping_system)
    CREATE TABLE IF NOT EXISTS cropping_system (
      system_id TEXT PRIMARY KEY,
      crop_id TEXT NOT NULL,
      system_name TEXT NOT NULL, -- 노지 봄재배, 노지 가을재배, 난지형 월동재배 등
      cultivation_method TEXT NOT NULL, -- OPEN_FIELD, GREENHOUSE_UNHEATED, GREENHOUSE_HEATED
      sowing_months TEXT NOT NULL, -- 파종/정식 적기 월 (예: 2~3월)
      harvest_months TEXT NOT NULL, -- 수확 적기 월 (예: 6~7월)
      is_overwintering INTEGER DEFAULT 0, -- 월동작형 여부 (저온장해 예외 적용)
      base_temp_tb REAL NOT NULL, -- 기준온도 Tb (℃)
      required_gdd REAL NOT NULL, -- 필요유효적산온도 PGDD (℃·일)
      required_raw_gdd REAL NOT NULL, -- 일반 필요적산온도 0℃ 기준 (℃·일)
      opt_temp_min REAL NOT NULL, -- 생육최적 최저온도
      opt_temp_max REAL NOT NULL, -- 생육최적 최고온도
      limit_temp_min REAL NOT NULL, -- 생육한계 최저온도
      limit_temp_max REAL NOT NULL, -- 생육한계 최고온도
      damage_temp_low REAL NOT NULL, -- 저온장해 온도
      damage_temp_high REAL NOT NULL, -- 고온장해 온도
      FOREIGN KEY (crop_id) REFERENCES crop(crop_id) ON DELETE CASCADE
    );

    -- 4-00. 생육 구분 코드 테이블 (growth_type_code)
    CREATE TABLE IF NOT EXISTS growth_type_code (
      type_code TEXT PRIMARY KEY,
      type_name TEXT NOT NULL,
      stage_color TEXT DEFAULT '#22a559',
      icon_type TEXT DEFAULT 'leaf',
      description TEXT,
      sort_order INTEGER DEFAULT 1
    );

    -- 4-0. 생육과정 기초 코드 테이블 (growth_process_code)
    CREATE TABLE IF NOT EXISTS growth_process_code (
      process_code TEXT PRIMARY KEY,
      process_name TEXT NOT NULL,
      process_type TEXT DEFAULT 'STG-GROWTH', -- growth_type_code.type_code (예: STG-PREP ~ STG-HARVEST)
      description TEXT,
      sort_order INTEGER DEFAULT 1
    );

    -- 4. 표준 생육단계 및 농작업 템플릿 (standard_template)
    CREATE TABLE IF NOT EXISTS standard_template (
      template_id TEXT PRIMARY KEY,
      group_id TEXT,
      crop_id TEXT,
      cultivar_id TEXT,
      system_id TEXT NOT NULL,
      bjd_code TEXT DEFAULT '4313010700',
      sido TEXT DEFAULT '충청북도',
      sigungu TEXT DEFAULT '충주시',
      eupmyeondong TEXT DEFAULT '단월동',
      step_order INTEGER NOT NULL,
      item_type TEXT NOT NULL, -- STAGE (생육단계) | WORK (농작업)
      item_category TEXT NOT NULL, -- MAJOR (주요재배일정) | DETAIL (세부재배일정)
      item_code TEXT NOT NULL,
      item_name TEXT NOT NULL,
      target_gdd_ratio REAL NOT NULL, -- 전체 GDD 대비 도달 비율 (0.0 ~ 1.0) 또는 음수(파종전 준비)
      target_pgdd REAL NOT NULL, -- 목표 누적 PGDD (℃·일)
      days_from_start INTEGER NOT NULL, -- 정식/파종일 기준 표준 소요일 (예: -15, 0, +8, +34)
      tolerance_days INTEGER DEFAULT 3, -- 권장 허용범위 (±일)
      guide_criteria TEXT, -- 생육단계 판단 도움말 및 작업 기준
      climate_countermeasure TEXT, -- 사전/즉시/사후 대책 및 6대 방법론
      FOREIGN KEY (system_id) REFERENCES cropping_system(system_id) ON DELETE CASCADE
    );

    -- 5. 토양 기준치 및 지역 표준 토양 DB (soil_standard & regional_soil)
    CREATE TABLE IF NOT EXISTS soil_standard (
      standard_id TEXT PRIMARY KEY,
      crop_id TEXT NOT NULL,
      ph_min REAL, ph_max REAL,
      om_min REAL, om_max REAL, -- 유기물 (g/kg)
      p2o5_min REAL, p2o5_max REAL, -- 유효인산 (mg/kg)
      k_min REAL, k_max REAL, -- 칼륨 (cmol+/kg)
      ca_min REAL, ca_max REAL, -- 칼슘 (cmol+/kg)
      mg_min REAL, mg_max REAL, -- 마그네슘 (cmol+/kg)
      sio2_min REAL, sio2_max REAL, -- 유효규산 (mg/kg)
      ec_min REAL, ec_max REAL -- 전기전도도 (dS/m)
    );

    -- 6-0. 비료 분류 기초 코드 테이블 (fertilizer_category_code)
    CREATE TABLE IF NOT EXISTS fertilizer_category_code (
      category_code TEXT PRIMARY KEY,
      category_name TEXT NOT NULL,
      description TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 1
    );

    -- 6-0-B. 영양제 기초 코드 테이블 (nutrient_category_code)
    CREATE TABLE IF NOT EXISTS nutrient_category_code (
      category_code TEXT PRIMARY KEY,
      category_name TEXT NOT NULL,
      description TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 1
    );

    -- 6-0-C. 병해충관리제 기초 코드 테이블 (pesticide_category_code)
    CREATE TABLE IF NOT EXISTS pesticide_category_code (
      category_code TEXT PRIMARY KEY,
      category_name TEXT NOT NULL,
      description TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 1
    );

    -- 6. 비료 및 작물보호제(농약) 마스터 DB (agro_material)
    CREATE TABLE IF NOT EXISTS agro_material (
      material_id TEXT PRIMARY KEY,
      material_category TEXT NOT NULL, -- FERTILIZER (비료) | PESTICIDE (작물보호제) | NUTRIENT (작물영양제)
      sub_type TEXT NOT NULL, -- 유기물비료, 복합비료, 칼슘제, 살충제, 살균제, 제초제
      product_name TEXT NOT NULL, -- 예: 한팜칼슘 10Kg, NK복합비료(20-10-10)
      is_organic INTEGER DEFAULT 0, -- 유기농자재 여부
      target_nutrient_or_pest TEXT NOT NULL, -- 보충 성분 또는 대상 병해충/잡초
      n_pct REAL DEFAULT 0, p_pct REAL DEFAULT 0, k_pct REAL DEFAULT 0, ca_pct REAL DEFAULT 0, om_pct REAL DEFAULT 0,
      dosage_per_100pyeong TEXT NOT NULL, -- 100평(또는 10a)당 표준 시비/처방량
      unit_spec TEXT NOT NULL, -- 포장 규격 (예: 10Kg, 200ml)
      unit_price INTEGER NOT NULL, -- 단가 (원)
      usage_stage TEXT NOT NULL, -- 밑거름, 1차웃거름, 2차웃거름, 잡초관리, 병해충방제
      weather_trigger TEXT -- 기후 조건 트리거 (예: 고온다습/장마기 역병 예방)
    );

    -- 7. 내부 기상정보 마스터 및 일별 기온 테이블 (초기 자체 구축 -> 추후 공공DB 자동 적재)
    CREATE TABLE IF NOT EXISTS weather_station (
      station_id TEXT PRIMARY KEY,
      region_code TEXT NOT NULL,
      station_name TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      altitude_m REAL NOT NULL,
      grid_x INTEGER NOT NULL,
      grid_y INTEGER NOT NULL,
      fallback_station_id TEXT,
      sync_status TEXT DEFAULT 'ACTIVE',
      last_synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS weather_daily_data (
      weather_id TEXT PRIMARY KEY,
      station_id TEXT NOT NULL,
      weather_date TEXT NOT NULL,
      data_type TEXT NOT NULL, -- OBSERVED (실측/과거) | FORECAST (예측기후)
      temp_avg REAL NOT NULL,
      temp_max REAL NOT NULL,
      temp_min REAL NOT NULL,
      precipitation_mm REAL DEFAULT 0,
      humidity_pct REAL DEFAULT 60,
      is_interpolated INTEGER DEFAULT 0,
      source_type TEXT DEFAULT 'MANUAL_SEED', -- MANUAL_SEED (내부시드/수동) | KMA_API (공공DB자동)
      synced_at TEXT NOT NULL,
      FOREIGN KEY (station_id) REFERENCES weather_station(station_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS weather_env_correction (
      correction_id TEXT PRIMARY KEY,
      env_name TEXT NOT NULL,
      cultivation_method TEXT NOT NULL,
      mulching_yn INTEGER DEFAULT 0,
      temp_offset_c REAL NOT NULL,
      altitude_lapse_rate REAL DEFAULT -0.6,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS weather_sync_log (
      sync_id TEXT PRIMARY KEY,
      station_id TEXT NOT NULL,
      sync_type TEXT NOT NULL, -- SEED | MANUAL_EDIT | CSV_UPLOAD | PUBLIC_API_BATCH
      target_period TEXT NOT NULL,
      record_count INTEGER NOT NULL,
      interpolated_count INTEGER DEFAULT 0,
      status TEXT NOT NULL,
      executed_at TEXT NOT NULL,
      memo TEXT
    );

    -- 8. 농가 작물재배 일정 요청 및 재배이력 관제 테이블 (schedule_request & cultivation_history)
    CREATE TABLE IF NOT EXISTS schedule_request (
      request_id TEXT PRIMARY KEY, -- 예: CULT-2026-000123
      farmer_name TEXT NOT NULL,
      region_name TEXT NOT NULL,
      station_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      crop_id TEXT NOT NULL,
      cultivar_id TEXT NOT NULL,
      system_id TEXT NOT NULL,
      request_type TEXT NOT NULL, -- NEW_PLAN (신규수립 S100) | CLIMATE_READJUST (기후재조정 S200) | DELAY_READJUST (미이행갱신)
      area_pyeong INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      expected_harvest_date TEXT NOT NULL,
      mulching_yn INTEGER DEFAULT 1,
      irrigation_yn INTEGER DEFAULT 1,
      is_organic INTEGER DEFAULT 0,
      has_soil_test INTEGER DEFAULT 0,
      soil_ph REAL, soil_k REAL, soil_om REAL,
      Accumulated_pgdd REAL DEFAULT 0,
      remaining_pgdd REAL NOT NULL,
      progress_pct INTEGER DEFAULT 0,
      pipeline_status TEXT NOT NULL, -- S120_RECEIVED | S130_DB_MATCHING | S140_GDD_CALC | S150_COMPLETED | S220_ALERT_SENT | S230_READJUSTED
      requested_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cultivation_history_log (
      history_id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      item_type TEXT NOT NULL, -- STAGE | WORK
      item_code TEXT NOT NULL,
      item_name TEXT NOT NULL,
      predicted_date TEXT NOT NULL,
      actual_date TEXT NOT NULL,
      confirmed_at TEXT NOT NULL,
      material_used TEXT,
      calculated_stage_pgdd REAL DEFAULT 0,
      sequence_check TEXT DEFAULT 'PASS',
      date_valid TEXT DEFAULT 'PASS',
      missing_flag INTEGER DEFAULT 0,
      reliability_score REAL DEFAULT 0.95,
      quality_flag TEXT DEFAULT 'NORMAL', -- NORMAL | WARNING | OUTLIER
      include_in_training INTEGER DEFAULT 1,
      FOREIGN KEY (request_id) REFERENCES schedule_request(request_id) ON DELETE CASCADE
    );

    -- 9. 생육예측모델(GDD) 엔진 A안/B안 및 버전 관리 테이블 (growth_model_version)
    CREATE TABLE IF NOT EXISTS growth_model_version (
      version_id TEXT PRIMARY KEY,
      crop_id TEXT NOT NULL,
      cultivar_id TEXT NOT NULL,
      system_id TEXT NOT NULL,
      version_tag TEXT NOT NULL, -- 예: v1.0, v1.1-candidate
      model_Track TEXT NOT NULL, -- TRACK_A_BASE (A안 기본/환경보정) | TRACK_B_SELECTIVE (B안 선택적 갱신)
      base_temp_tb REAL NOT NULL,
      stage_1_name TEXT, stage_1_pgdd REAL,
      stage_2_name TEXT, stage_2_pgdd REAL,
      stage_3_name TEXT, stage_3_pgdd REAL,
      total_pgdd REAL NOT NULL,
      env_correction_factor REAL DEFAULT 1.0,
      predicted_mae_days REAL NOT NULL, -- 예측오차 (일)
      error_cause_type TEXT, -- CULTIVAR_ERR (품종오차) | ENV_ERR (환경오차) | RECORD_ERR (기록오차) | NONE
      sample_count INTEGER DEFAULT 0,
      status TEXT NOT NULL, -- ACTIVE (운영중) | CANDIDATE (검증대기 후보) | ARCHIVED (이전버전)
      updated_at TEXT NOT NULL,
      release_note TEXT
    );

    -- 10. 전국 재배지 주소록 테이블 (지번 기준: 시/도 · 시/군/구 · 읍면동)
    CREATE TABLE IF NOT EXISTS cultivation_address (
      address_id INTEGER PRIMARY KEY AUTOINCREMENT,
      bjd_code TEXT UNIQUE NOT NULL,
      sido TEXT NOT NULL,
      sigungu TEXT NOT NULL,
      eupmyeondong TEXT NOT NULL,
      full_address TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cult_addr_sido ON cultivation_address(sido);
    CREATE INDEX IF NOT EXISTS idx_cult_addr_sigungu ON cultivation_address(sido, sigungu);
    CREATE INDEX IF NOT EXISTS idx_cult_addr_dong ON cultivation_address(eupmyeondong);
    CREATE INDEX IF NOT EXISTS idx_cult_addr_full ON cultivation_address(full_address);

    -- 10-A. 전국 도로명 주소 테이블 (회원가입 주소검색 및 재배지 도로명 주소 마스터)
    CREATE TABLE IF NOT EXISTS road_address (
      road_addr_id INTEGER PRIMARY KEY AUTOINCREMENT,
      road_code TEXT UNIQUE NOT NULL,
      postal_code TEXT NOT NULL,
      sido TEXT NOT NULL,
      sigungu TEXT NOT NULL,
      eupmyeondong TEXT NOT NULL,
      road_name TEXT NOT NULL,
      underground_yn INTEGER DEFAULT 0,
      building_main_no INTEGER NOT NULL,
      building_sub_no INTEGER DEFAULT 0,
      building_name TEXT DEFAULT '',
      bjd_code TEXT NOT NULL,
      full_road_address TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_road_addr_sido ON road_address(sido);
    CREATE INDEX IF NOT EXISTS idx_road_addr_sigungu ON road_address(sido, sigungu);
    CREATE INDEX IF NOT EXISTS idx_road_addr_road ON road_address(road_name);
    CREATE INDEX IF NOT EXISTS idx_road_addr_bjd ON road_address(bjd_code);
    CREATE INDEX IF NOT EXISTS idx_road_addr_full ON road_address(full_road_address);

    -- 10-B. 전국 지번 주소 테이블 (회원가입 주소검색 및 재배지 지번 주소 마스터)
    CREATE TABLE IF NOT EXISTS jibun_address (
      jibun_addr_id INTEGER PRIMARY KEY AUTOINCREMENT,
      bjd_code TEXT UNIQUE NOT NULL,
      postal_code TEXT NOT NULL,
      sido TEXT NOT NULL,
      sigungu TEXT NOT NULL,
      eupmyeondong TEXT NOT NULL,
      ri_name TEXT DEFAULT '',
      mountain_yn INTEGER DEFAULT 0,
      jibun_main_no INTEGER NOT NULL,
      jibun_sub_no INTEGER DEFAULT 0,
      full_jibun_address TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_jibun_addr_sido ON jibun_address(sido);
    CREATE INDEX IF NOT EXISTS idx_jibun_addr_sigungu ON jibun_address(sido, sigungu);
    CREATE INDEX IF NOT EXISTS idx_jibun_addr_dong ON jibun_address(eupmyeondong);
    CREATE INDEX IF NOT EXISTS idx_jibun_addr_full ON jibun_address(full_jibun_address);

    -- 13. 제품 구입시 계좌이체용 결제 은행계좌 관리 테이블
    CREATE TABLE IF NOT EXISTS payment_bank_account (
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
      cash_receipt_info TEXT DEFAULT '현금영수증(소득공제/지출증빙) 및 전자세금계산서 100% 발행 가능',
      transfer_guide_memo TEXT DEFAULT '입금자명을 주문자 성함(또는 농장명)과 동일하게 입력해 주시면 10분 이내 자동 입금확인 처리됩니다.',
      sort_order INTEGER DEFAULT 1,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- 4-1. 작물별 생육 과정 관리 테이블 (1단계 · 2단계 · 품종별 생육과정 + 생육기간 + 작업내용(nvarchar(1000)) + 필요 농자재 + 사용팁(nvarchar(1000)))
    CREATE TABLE IF NOT EXISTS crop_growth_process_plan (
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
      work_content NVARCHAR(1000) NOT NULL DEFAULT '',
      required_materials_json TEXT NOT NULL DEFAULT '[]',
      usage_tip NVARCHAR(1000) NOT NULL DEFAULT '',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- 15. 설문조사 관리 마스터 테이블 (URL 배포용 설문 양식)
    CREATE TABLE IF NOT EXISTS survey_form (
      survey_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      greeting_text TEXT NOT NULL,
      intro_text TEXT NOT NULL,
      duration_text TEXT NOT NULL,
      notice_text TEXT NOT NULL,
      footer_title TEXT NOT NULL,
      footer_sub TEXT NOT NULL,
      questions_json TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- 15-B. 설문조사 참여자 응답 수집 데이터 테이블
    CREATE TABLE IF NOT EXISTS survey_response (
      response_id TEXT PRIMARY KEY,
      survey_id TEXT NOT NULL,
      respondent_name TEXT DEFAULT '익명 농업인',
      respondent_region TEXT DEFAULT '',
      respondent_contact TEXT DEFAULT '',
      q1_age TEXT NOT NULL,
      q2_scale TEXT NOT NULL,
      q3_crops_json TEXT NOT NULL,
      q3_other_text TEXT DEFAULT '',
      q4_difficulty TEXT NOT NULL,
      q5_schedule_intent TEXT NOT NULL,
      q6_schedule_wtp TEXT NOT NULL,
      q7_ai_pest_intent TEXT NOT NULL,
      q8_bundle_wtp TEXT NOT NULL,
      q9_commerce_intent TEXT NOT NULL,
      answers_json TEXT NOT NULL DEFAULT '{}',
      submitted_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- 16. 농자재 추천 모듈 관리 — 하이브리드(정량 규칙 모듈 + AI Agent) 전역 정책 설정 테이블
    CREATE TABLE IF NOT EXISTS agro_recommendation_policy (
      policy_id TEXT PRIMARY KEY,
      engine_mode TEXT NOT NULL DEFAULT 'HYBRID_RULE_AI', -- HYBRID_RULE_AI | RULE_ONLY | AI_AGENT_PRIORITY
      organic_preference TEXT NOT NULL DEFAULT 'BALANCED', -- BALANCED | ORGANIC_FIRST | CONVENTIONAL_FIRST
      price_strategy TEXT NOT NULL DEFAULT 'EFFICIENCY_BALANCED', -- EFFICIENCY_BALANCED | COST_SAVER | PREMIUM_YIELD
      brand_priority TEXT NOT NULL DEFAULT 'NUVO_HANFARM_FIRST', -- NUVO_HANFARM_FIRST | NONE
      deficiency_boost_pct INTEGER NOT NULL DEFAULT 20, -- 토양 성분 부족 시 비료/영양제 추천량 증량(%)
      excess_reduce_pct INTEGER NOT NULL DEFAULT 30, -- 토양 성분 과잉 시 해당 성분 비료 감량(%)
      climate_high_humidity_pct REAL NOT NULL DEFAULT 75.0, -- 고습도 살균제 예방 트리거(%)
      climate_rain_trigger_mm REAL NOT NULL DEFAULT 15.0, -- 강우 병해 방제 트리거(mm)
      climate_high_temp_c REAL NOT NULL DEFAULT 27.0, -- 고온 해충·칼슘결핍 트리거(℃)
      climate_low_temp_c REAL NOT NULL DEFAULT 10.0, -- 저온 냉해·활착지연 영양제 트리거(℃)
      ai_system_prompt TEXT NOT NULL,
      rationale_sections_json TEXT NOT NULL DEFAULT '["SOIL_DIAGNOSIS","GROWTH_PHYSIOLOGY","CLIMATE_PEST_RISK","DOSAGE_MIX_TIP"]',
      auto_apply_to_schedule INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- 16-B. 농자재 추천 모듈 관리 — 생육과정별 비료·영양제·병해충관리제 매칭 규칙 테이블
    CREATE TABLE IF NOT EXISTS agro_stage_mapping_rule (
      rule_id TEXT PRIMARY KEY,
      stage_category TEXT NOT NULL, -- 기비/토양준비 | 파종/정식/활착 | 영양생장/추비 | 개화/착과/결구 | 비대/성숙/수확 | 병해충집중방제
      process_codes_csv TEXT NOT NULL, -- 매칭 생육과정 코드 (예: PRC-01,PRC-02,PRC-03)
      stage_keywords_csv TEXT NOT NULL, -- 매칭 생육과정 키워드 (예: 밑거름,기비,토양,경운,퇴비)
      fertilizer_categories_csv TEXT NOT NULL, -- 추천 비료 분류 키워드
      nutrient_categories_csv TEXT NOT NULL, -- 추천 영양제 분류 키워드
      pesticide_categories_csv TEXT NOT NULL, -- 추천 병해충관리제 분류 키워드
      physiological_goal TEXT NOT NULL, -- 생육단계 핵심 생리 목표 (추천 근거 생성용)
      soil_linkage_rule TEXT NOT NULL, -- 토양검정 연계 처방 공식 설명
      climate_linkage_rule TEXT NOT NULL, -- 기후(온도·습도·강우) 연계 방제 공식 설명
      priority_weight INTEGER NOT NULL DEFAULT 10,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- 16-C. 농자재 추천 모듈 실행 로그 및 관리자 보정(Override) 이력 테이블
    CREATE TABLE IF NOT EXISTS agro_recommendation_history (
      rec_id TEXT PRIMARY KEY,
      bjd_code TEXT NOT NULL,
      region_name TEXT NOT NULL,
      group_id TEXT NOT NULL,
      crop_id TEXT NOT NULL,
      crop_name TEXT NOT NULL,
      cultivar_id TEXT DEFAULT '',
      cultivar_name TEXT DEFAULT '',
      process_code TEXT NOT NULL,
      process_name TEXT NOT NULL,
      area_pyeong INTEGER NOT NULL DEFAULT 300,
      soil_summary_json TEXT NOT NULL,
      climate_summary_json TEXT NOT NULL,
      recommended_fertilizers_json TEXT NOT NULL,
      recommended_nutrients_json TEXT NOT NULL,
      recommended_pesticides_json TEXT NOT NULL,
      ai_rationale_text TEXT NOT NULL,
      total_estimated_cost INTEGER NOT NULL DEFAULT 0,
      admin_override_note TEXT DEFAULT '',
      source_context TEXT DEFAULT 'ADMIN_SIMULATOR', -- ADMIN_SIMULATOR | SCHEDULE_ENGINE
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  seedInitialData();
  ensureAdditionalLeafCrops();
  ensureCropAndCultivarExtraColumns();
  ensureGrowthTypeCodes();
  ensureGrowthProcessCodes();
  ensureStandardTemplateTaxonomyColumns();
  ensureCultivationAddresses();
  ensureRoadAndJibunAddresses();
  populateNationwide2025ClimateTable(db);
  populateNationwide2026FutureClimateTable(db);
  populateNationwideSoilTable(db);
  ensureMemberScheduleRequests();
  ensureFertilizerCategoryCodes();
  ensureNutrientCategoryCodes();
  ensurePesticideCategoryCodes();
  ensureAgroMaterials();
  ensurePaymentBankAccounts();
  ensureCropGrowthProcessPlans();
  ensureSurveyData();
  ensureAgroRecommendationModuleData();
}

function ensureFertilizerCategoryCodes() {
  db.prepare("DELETE FROM fertilizer_category_code WHERE category_code = 'CAT-FERT-07' AND category_name = 'TEST'").run();
  const existingCount = (db.prepare('SELECT COUNT(*) as cnt FROM fertilizer_category_code').get() as { cnt: number }).cnt;
  if (existingCount < FERTILIZER_CATEGORIES.length) {
    const ins = db.prepare(`
      INSERT OR IGNORE INTO fertilizer_category_code (category_code, category_name, description, sort_order)
      VALUES (?, ?, ?, ?)
    `);
    FERTILIZER_CATEGORIES.forEach((cat, idx) => {
      ins.run(cat.code, cat.name, cat.desc, idx + 1);
    });
  }

  // 기존 category_name 에 괄호 '(...)' 가 포함된 항목은 괄호 내용을 description 끝에 덧붙이고 category_name 에서는 제거
  const rows = db
    .prepare('SELECT category_code, category_name, description FROM fertilizer_category_code')
    .all() as Array<{ category_code: string; category_name: string; description: string }>;
  const upd = db.prepare(
    'UPDATE fertilizer_category_code SET category_name = ?, description = ? WHERE category_code = ?'
  );
  for (const r of rows) {
    const m = String(r.category_name || '').match(/^([^(]+)\s*(\([^)]+\))\s*$/);
    if (m) {
      const cleanName = m[1].trim();
      const parenPart = m[2].trim();
      const curDesc = String(r.description || '').trim();
      const nextDesc = curDesc.includes(parenPart) ? curDesc : `${curDesc} ${parenPart}`.trim();
      upd.run(cleanName, nextDesc, r.category_code);
    }
  }
}

function ensureNutrientCategoryCodes() {
  const existingCount = (db.prepare('SELECT COUNT(*) as cnt FROM nutrient_category_code').get() as { cnt: number }).cnt;
  if (existingCount < NUTRIENT_CATEGORIES.length) {
    const ins = db.prepare(`
      INSERT OR IGNORE INTO nutrient_category_code (category_code, category_name, description, sort_order)
      VALUES (?, ?, ?, ?)
    `);
    NUTRIENT_CATEGORIES.forEach((cat, idx) => {
      ins.run(cat.code, cat.name, cat.desc, idx + 1);
    });
  }
}

function ensurePesticideCategoryCodes() {
  const existingCount = (db.prepare('SELECT COUNT(*) as cnt FROM pesticide_category_code').get() as { cnt: number }).cnt;
  if (existingCount < PESTICIDE_CATEGORIES.length) {
    const ins = db.prepare(`
      INSERT OR IGNORE INTO pesticide_category_code (category_code, category_name, description, sort_order)
      VALUES (?, ?, ?, ?)
    `);
    PESTICIDE_CATEGORIES.forEach((cat, idx) => {
      ins.run(cat.code, cat.name, cat.desc, idx + 1);
    });
  }
}

function ensureCropGrowthProcessPlans() {
  const stripParen = (s: string) => String(s || '').split('(')[0].trim();

  const allMaterials = db.prepare('SELECT * FROM agro_material').all() as any[];
  const pickMaterials = (ids: string[]) =>
    ids
      .map((id) => allMaterials.find((m) => m.material_id === id))
      .filter(Boolean)
      .map((m) => ({
        material_id: m.material_id,
        material_category: m.material_category,
        sub_type: m.sub_type,
        product_name: m.product_name,
        manufacturer: m.manufacturer || '(주)누보',
        weight_spec: m.weight_spec || m.unit_spec || '',
        nutrient_ratio_summary: m.nutrient_ratio_summary || m.target_nutrient_or_pest || '',
        dosage_per_100pyeong: m.dosage_per_100pyeong || '',
        unit_price: m.unit_price || 0,
        thumbnail_url: m.thumbnail_url || `/api/agro-materials/image/${encodeURIComponent(m.material_id)}/thumb`,
      }));

  // 1단계 적용군(crop_group) -> 2단계 적용 작물분류(crop) -> 3단계 제품명(cultivar) 마스터 테이블 기준 동기화
  const leafGroup = db
    .prepare("SELECT group_id, group_name FROM crop_group WHERE group_id = 'GRP-LEAF'")
    .get() as { group_id: string; group_name: string } | undefined;
  const cabbageCrop = db
    .prepare("SELECT crop_id, group_id, crop_name FROM crop WHERE crop_id = 'CRP-CABBAGE'")
    .get() as { crop_id: string; group_id: string; crop_name: string } | undefined;
  const foodGroup = db
    .prepare("SELECT group_id, group_name FROM crop_group WHERE group_id = 'GRP-FOOD'")
    .get() as { group_id: string; group_name: string } | undefined;
  const potatoCrop = db
    .prepare("SELECT crop_id, group_id, crop_name FROM crop WHERE crop_id = 'CRP-POTATO'")
    .get() as { crop_id: string; group_id: string; crop_name: string } | undefined;

  const cabbageGroupName = leafGroup?.group_name || '엽채류 (잎채소)';
  const cabbageCropName = cabbageCrop?.crop_name || '가을배추';
  const potatoGroupName = foodGroup?.group_name || '식량작물 (서류·곡류)';
  const potatoCropName = potatoCrop?.crop_name || '감자';

  // cultivar 테이블에 실제 등록된 불암3호 품종 ID 확인 (CV-BRM3 또는 CV-BULAM3)
  const bulamCvRow = db
    .prepare(
      "SELECT cultivar_id, cultivar_name FROM cultivar WHERE crop_id = 'CRP-CABBAGE' AND (cultivar_name = '불암3호' OR cultivar_id IN ('CV-BRM3', 'CV-BULAM3')) ORDER BY CASE WHEN cultivar_id = 'CV-BRM3' THEN 0 ELSE 1 END LIMIT 1"
    )
    .get() as { cultivar_id: string; cultivar_name: string } | undefined;
  const primaryBulamId = bulamCvRow?.cultivar_id || 'CV-BRM3';
  const primaryBulamName = bulamCvRow?.cultivar_name || '불암3호';

  const sumiCvRow = db
    .prepare(
      "SELECT cultivar_id, cultivar_name FROM cultivar WHERE crop_id = 'CRP-POTATO' AND (cultivar_id = 'CV-SUMI' OR cultivar_name LIKE '수미%') LIMIT 1"
    )
    .get() as { cultivar_id: string; cultivar_name: string } | undefined;
  const primarySumiId = sumiCvRow?.cultivar_id || 'CV-SUMI';
  const primarySumiName = sumiCvRow?.cultivar_name || '수미 (Superior)';

  // cultivar 마스터 테이블에 존재하지 않는 구형 cultivar_id(예: CV-BULAM3 중복본) 정리
  if (primaryBulamId !== 'CV-BULAM3') {
    db.prepare("DELETE FROM crop_growth_process_plan WHERE cultivar_id = 'CV-BULAM3'").run();
  }

  const insertPlan = db.prepare(`
    INSERT OR REPLACE INTO crop_growth_process_plan (
      plan_id, group_id, group_name, crop_id, crop_name, cultivar_id, cultivar_name,
      template_id, process_code, process_name, process_type, step_order, target_pgdd,
      start_date, end_date, work_content, required_materials_json, usage_tip, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
  `);

  const shortBulam = primaryBulamId.replace(/^CV-/, '');

  const initialPlans = [
    // ==================== 가을배추 (1단계: 엽채류 (잎채소) > 2단계: 가을배추 > 3단계: 불암3호) 생육 전과정 (6대 생육 구분 기초 코드 STG-PREP ~ STG-HARVEST 전 구간 반영) ====================
    {
      plan_id: `CGP-CAB-${shortBulam}-01`,
      group_id: 'GRP-LEAF',
      group_name: cabbageGroupName,
      crop_id: 'CRP-CABBAGE',
      crop_name: cabbageCropName,
      cultivar_id: primaryBulamId,
      cultivar_name: primaryBulamName,
      template_id: `TPL-GRP-LEAF-CRP-CABBAGE-${primaryBulamId}-01`,
      process_code: 'PRC-03',
      process_name: '밑거름',
      process_type: 'STG-PREP',
      step_order: 1,
      target_pgdd: 0,
      start_date: '',
      end_date: '',
      work_content:
        '정식 10~14일 전에 토양 산도(pH 6.2~6.5) 교정용 입상 고토석회를 먼저 살포·경운하고, 정식 7일 전 완숙 유기질비료(토토유박)와 원예용 밑거름 복합비료를 전층 시비한 뒤 로터리 작업을 수행합니다. 이후 폭 70~80cm, 높이 25~30cm의 고휴(높은 이랑)를 성형하고 뿌리혹병·입고병 예방 살균제를 처리한 뒤 흑색 유공비닐 멀칭을 완료합니다.',
      required_materials_json: JSON.stringify(
        pickMaterials(['FERT-PRD-04', 'FERT-PRD-05', 'FERT-PRD-01', 'MAT-PEST-04'])
      ),
      usage_tip:
        '[농자재 사용팁] ① 명품입상석회(고토석회)는 가스장해 및 암모니아 휘산을 막기 위해 반드시 유박·복합비료 살포 7일 전에 먼저 살포하세요. ② 토토유박(100평당 3~5포)과 슈퍼원예복합(100평당 1.5~2포)은 표층에만 뿌리지 말고 토심 15~20cm까지 골고루 섞이도록 로터리 경운해야 정식 초기 비료 해(뿌리 농도장해)를 예방할 수 있습니다. ③ [UPL/누보] 사라져 미탁제(1,000배액)는 정식 전후 토양에 관주 처리하여 잘록병(입고병)과 뿌리혹병을 선제 차단하세요.',
    },
    {
      plan_id: `CGP-CAB-${shortBulam}-02`,
      group_id: 'GRP-LEAF',
      group_name: cabbageGroupName,
      crop_id: 'CRP-CABBAGE',
      crop_name: cabbageCropName,
      cultivar_id: primaryBulamId,
      cultivar_name: primaryBulamName,
      template_id: `TPL-GRP-LEAF-CRP-CABBAGE-${primaryBulamId}-02`,
      process_code: 'PRC-06',
      process_name: '종자·종구 소독, 최아',
      process_type: 'STG-NURSERY',
      step_order: 2,
      target_pgdd: 0,
      start_date: '',
      end_date: '',
      work_content:
        '정식 25~28일 전 가을배추(불암3호) 코팅 종자 및 원예용 상토, 105구(또는 128구) 플러그 트레이를 소독·준비하여 1공 1립 파종합니다. 육묘 중 주간 20~25℃, 야간 15~18℃ 적온 및 오전 관수를 유지하고, 정식 5~7일 전부터 외기 순화(경화) 및 진딧물·벼룩잎벌레 예방 관주를 실시하여 본엽 3~4매 건묘를 육성합니다.',
      required_materials_json: JSON.stringify(pickMaterials(['MAT-NUTR-03', 'MAT-NUTR-05', 'MAT-PEST-04', 'MAT-PEST-05'])),
      usage_tip:
        '[농자재 사용팁] ① 육묘 중 고온과습 시 잘록병(입고병)과 도장(웃자람)이 발생하므로 오전 10시 이전에만 관수하고 [UPL/누보] 사라져 미탁제(1,000배액)로 입고병을 예방하세요. ② 정식 3일 전 트레이에 [누보] 엔플러스 참편한 아미노(500배액)와 [인바이오/누보] 웜해머를 관주 처리하면 본밭 이식 후 초기 뿌리 활착과 해충 예방 효과가 동시에 확보됩니다.',
    },
    {
      plan_id: `CGP-CAB-${shortBulam}-03`,
      group_id: 'GRP-LEAF',
      group_name: cabbageGroupName,
      crop_id: 'CRP-CABBAGE',
      crop_name: cabbageCropName,
      cultivar_id: primaryBulamId,
      cultivar_name: primaryBulamName,
      template_id: `TPL-GRP-LEAF-CRP-CABBAGE-${primaryBulamId}-03`,
      process_code: 'PRC-08',
      process_name: '본밭 정식',
      process_type: 'STG-PLANT',
      step_order: 3,
      target_pgdd: 0,
      start_date: '',
      end_date: '',
      work_content:
        '본엽 3~4매가 전개된 건전한 가을배추(불암3호) 플러그 묘를 정식 전날 충분히 관수 및 아미노산 발근제에 침지 처리합니다. 폭염 시간대를 피해 오후 3시 이후에 주간 40~45cm 간격으로 심고, 모종 상토가 겉흙과 완전히 밀착되도록 구멍당 충분한 관수를 실시한 뒤 멀칭 비닐 구멍 주변을 흙으로 복토하여 고온 열풍 피해를 차단합니다.',
      required_materials_json: JSON.stringify(pickMaterials(['MAT-NUTR-03', 'FERT-PRD-03'])),
      usage_tip:
        '[농자재 사용팁] ① [누보] 엔플러스 참편한 아미노(500배 희석액)를 정식 직전 육묘 트레이에 관주 침지하거나 정식 직후 포기 관주하면 세근(잔뿌리) 발생이 3~4일 빨라집니다. ② 노동력 절감을 위해 추비 생략형으로 재배할 경우 정식 시 [조비] 단한번 완효성 비료를 포기당 정량 측조 시비하세요.',
    },
    {
      plan_id: `CGP-CAB-${shortBulam}-04`,
      group_id: 'GRP-LEAF',
      group_name: cabbageGroupName,
      crop_id: 'CRP-CABBAGE',
      crop_name: cabbageCropName,
      cultivar_id: primaryBulamId,
      cultivar_name: primaryBulamName,
      template_id: `TPL-GRP-LEAF-CRP-CABBAGE-${primaryBulamId}-04`,
      process_code: 'PRC-10',
      process_name: '활착기',
      process_type: 'STG-PLANT',
      step_order: 4,
      target_pgdd: 136,
      start_date: '',
      end_date: '',
      work_content:
        '정식 후 7~10일경(누적 적산온도 136℃ 도달) 새 흰색 잔뿌리가 본밭 토양에 내리고 중심부 어린 속잎이 꼿꼿하게 일어서며 생장을 시작하는지 전 포전을 예찰합니다. 고온·건조나 지하부 해충으로 고사·위조된 결주 포기는 예비 건묘로 즉시 보식하고 초기 활착 관수를 실시합니다.',
      required_materials_json: JSON.stringify(pickMaterials(['MAT-NUTR-03', 'MAT-NUTR-05'])),
      usage_tip:
        '[농자재 사용팁] ① 고온·가뭄으로 뿌리 활착이 지연되거나 잎 끝이 황화될 경우 [누보] 엔플러스 참편한 아미노(500배액)와 [누보] 엔플러스 만능이(12종 종합영양제, 1,000배 희석액)를 관주 또는 엽면살포하면 초기 뿌리권 형성과 엽록소 회복이 빠르게 촉진됩니다.',
    },
    {
      plan_id: `CGP-CAB-${shortBulam}-05`,
      group_id: 'GRP-LEAF',
      group_name: cabbageGroupName,
      crop_id: 'CRP-CABBAGE',
      crop_name: cabbageCropName,
      cultivar_id: primaryBulamId,
      cultivar_name: primaryBulamName,
      template_id: `TPL-GRP-LEAF-CRP-CABBAGE-${primaryBulamId}-05`,
      process_code: 'PRC-13',
      process_name: '1차 웃거름',
      process_type: 'STG-GROWTH',
      step_order: 5,
      target_pgdd: 220,
      start_date: '',
      end_date: '',
      work_content:
        '정식 후 약 14~15일경(누적 적산온도 220℃ 도달 시점) 새 뿌리가 완전히 활착하고 외엽이 왕성하게 전개되는 시기에 맞춰 포기 사이 비닐에 구멍을 뚫어 1차 웃거름(NK 추비)을 시비합니다. 또한 고온 건조기 급증하는 벼룩잎벌레와 파밤나방 초기 유충을 선제 방제합니다.',
      required_materials_json: JSON.stringify(pickMaterials(['FERT-PRD-02', 'MAT-PEST-05'])),
      usage_tip:
        '[농자재 사용팁] ① [누보] 엔케이(NK) 마그네슘 추비특호는 속효성 질소·칼륨과 고토·붕소가 결합되어 있어 포기에서 10cm 떨어진 지점에 티스푼 1스푼(약 10~15g)씩 찔러 넣고 흙으로 덮어주면 외엽 생장이 탁월합니다. ② 벼룩잎벌레·초기 해충 방제를 위해 [인바이오/누보] 웜해머 분산성액제(1,000배액)를 경엽살포하세요.',
    },
    {
      plan_id: `CGP-CAB-${shortBulam}-06`,
      group_id: 'GRP-LEAF',
      group_name: cabbageGroupName,
      crop_id: 'CRP-CABBAGE',
      crop_name: cabbageCropName,
      cultivar_id: primaryBulamId,
      cultivar_name: primaryBulamName,
      template_id: `TPL-GRP-LEAF-CRP-CABBAGE-${primaryBulamId}-06`,
      process_code: 'PRC-16',
      process_name: '초기 병해충 예방 방제',
      process_type: 'STG-PEST',
      step_order: 6,
      target_pgdd: 260,
      start_date: '',
      end_date: '',
      work_content:
        '생육 초기~중기 주 2회 정기 예찰을 통해 바이러스 매개충(진딧물·총채벌레), 벼룩잎벌레, 배추좀나방·파밤나방 초기 유충 및 지제부 잘록병·뿌리혹병 발생 여부를 집중 점검하고 발생 초기에 선제 방제를 실시합니다.',
      required_materials_json: JSON.stringify(pickMaterials(['MAT-PEST-05', 'MAT-PEST-02'])),
      usage_tip:
        '[농자재 사용팁] ① 잎 뒷면과 생장점 안쪽에 숨어 있는 진딧물·나방 어린 유충을 예찰하여 [인바이오/누보] 웜해머 분산성액제(1,000배액)와 [바이엘/누보] 바이고 액상수화제(2,000배액)를 교호 살포하면 약제 저항성 없이 방제할 수 있습니다.',
    },
    {
      plan_id: `CGP-CAB-${shortBulam}-07`,
      group_id: 'GRP-LEAF',
      group_name: cabbageGroupName,
      crop_id: 'CRP-CABBAGE',
      crop_name: cabbageCropName,
      cultivar_id: primaryBulamId,
      cultivar_name: primaryBulamName,
      template_id: `TPL-GRP-LEAF-CRP-CABBAGE-${primaryBulamId}-07`,
      process_code: 'PRC-17',
      process_name: '중기 왕성 생장기',
      process_type: 'STG-GROWTH',
      step_order: 7,
      target_pgdd: 330,
      start_date: '',
      end_date: '',
      work_content:
        '정식 후 20~28일경(누적 적산온도 330℃ 도달) 가을배추의 바깥잎(외엽) 수와 엽면적이 최대치로 확보되며 향후 결구를 좌우할 광합성 동화양분을 집중 축적하는 시기입니다. 고랑 제초 및 배수로 정비를 병행하고, 외엽이 튼튼하게 자라도록 미량요소·칼슘 엽면시비와 중기 나방류·진딧물 방제를 실시합니다.',
      required_materials_json: JSON.stringify(pickMaterials(['MAT-NUTR-05', 'MAT-NUTR-02', 'MAT-PEST-02'])),
      usage_tip:
        '[농자재 사용팁] ① 가을배추는 외엽 크기가 최종 배추 통의 크기를 결정하므로 이 시기에 [누보] 엔플러스 만능이(1,000배액)와 [누보] 엔플러스 튼튼칼슘(500배액)을 엽면시비하여 잎 두께와 광합성 효율을 극대화하세요. ② 배추좀나방·파밤나방 발생 초기에 [바이엘/누보] 바이고 액상수화제(2,000배액)를 살포하세요.',
    },
    {
      plan_id: `CGP-CAB-${shortBulam}-08`,
      group_id: 'GRP-LEAF',
      group_name: cabbageGroupName,
      crop_id: 'CRP-CABBAGE',
      crop_name: cabbageCropName,
      cultivar_id: primaryBulamId,
      cultivar_name: primaryBulamName,
      template_id: `TPL-GRP-LEAF-CRP-CABBAGE-${primaryBulamId}-08`,
      process_code: 'PRC-19',
      process_name: '결구 · 구비대 · 괴경비대 · 착과 시작 확인',
      process_type: 'STG-GROWTH',
      step_order: 8,
      target_pgdd: 432,
      start_date: '',
      end_date: '',
      work_content:
        '정식 후 30~35일경(누적 적산온도 432℃ 도달) 바깥잎이 충분히 확보된 후 속잎이 안쪽으로 말리며 결구가 시작되는 핵심 시기입니다. 하루 중 양분과 수분 소모가 가장 많으므로 고랑 관수를 실시하고, 결구기 대표 생리장해인 꿀통배추(내엽갈변·팁번) 및 노균병·무름병 예방을 위해 킬레이트 칼슘·붕소 영양제와 종합살균제를 병행합니다.',
      required_materials_json: JSON.stringify(pickMaterials(['MAT-NUTR-02', 'MAT-PEST-03'])),
      usage_tip:
        '[농자재 사용팁] ① [누보] 엔플러스 튼튼칼슘(500배 희석액)은 결구 시작기부터 5~7일 간격으로 총 3회, 반드시 아침 일찍이나 해질 무렵에 속잎(생장점 부위)까지 충분히 젖도록 살포해야 흡수율이 극대화됩니다. ② 가을 강우 직후 노균병·무름병 예방을 위해 [인바이오/누보] 펀지해머 액상수화제(1,000배액)를 선제 살포하세요.',
    },
    {
      plan_id: `CGP-CAB-${shortBulam}-09`,
      group_id: 'GRP-LEAF',
      group_name: cabbageGroupName,
      crop_id: 'CRP-CABBAGE',
      crop_name: cabbageCropName,
      cultivar_id: primaryBulamId,
      cultivar_name: primaryBulamName,
      template_id: `TPL-GRP-LEAF-CRP-CABBAGE-${primaryBulamId}-09`,
      process_code: 'PRC-20',
      process_name: '2차 웃거름',
      process_type: 'STG-GROWTH',
      step_order: 9,
      target_pgdd: 565,
      start_date: '',
      end_date: '',
      work_content:
        '정식 후 40~48일경(누적 적산온도 565℃ 도달) 배추 속잎이 빠르게 차오르는 결구 비대 최성기에 맞춰 이랑 어깨 또는 고랑에 2차 웃거름(NK복합비료)을 시비합니다. 또한 구의 무게감(결구 충실도)과 맛·저장성을 높이기 위해 인산가리·규산 비대촉진제와 광합성·스트레스 회복 영양제를 병행 처리합니다.',
      required_materials_json: JSON.stringify(pickMaterials(['FERT-PRD-02', 'MAT-NUTR-04', 'MAT-NUTR-01'])),
      usage_tip:
        '[농자재 사용팁] ① 2차 추비 시 뿌리가 고랑 쪽까지 넓게 뻗어 있으므로 배추 포기 바로 밑이 아닌 이랑 어깨나 고랑 가장자리에 [누보] 엔케이(NK) 마그네슘 추비특호를 시비하세요. ② [누보] 엔플러스 커진다(500배액)와 [누보] 엔플러스 썬마스터를 함께 엽면시비하면 가을 일조 부족기에도 배추 속이 단단하고 무겁게 차오릅니다.',
    },
    {
      plan_id: `CGP-CAB-${shortBulam}-10`,
      group_id: 'GRP-LEAF',
      group_name: cabbageGroupName,
      crop_id: 'CRP-CABBAGE',
      crop_name: cabbageCropName,
      cultivar_id: primaryBulamId,
      cultivar_name: primaryBulamName,
      template_id: `TPL-GRP-LEAF-CRP-CABBAGE-${primaryBulamId}-10`,
      process_code: 'PRC-22',
      process_name: '중기·장마기 병해충 집중 방제',
      process_type: 'STG-PEST',
      step_order: 10,
      target_pgdd: 640,
      start_date: '',
      end_date: '',
      work_content:
        '가을 강우 및 고습도(평균습도 78% 이상) 지속 구간에 급증하는 세균성 무름병·노균병·밑둥썩음병과 결구 내부로 파고드는 파밤나방·배추좀나방을 집중 방제하고, 고랑 배수로 정비 및 병든 하엽 제거로 통풍·위생 환경을 관리합니다.',
      required_materials_json: JSON.stringify(pickMaterials(['MAT-PEST-03', 'MAT-PEST-02', 'MAT-PEST-06'])),
      usage_tip:
        '[농자재 사용팁] ① 강우 예보 전후로 [인바이오/누보] 펀지해머 액상수화제(1,000배액)를 지제부(밑둥)까지 흠뻑 젖도록 살포하여 무름병·노균병 확산을 차단하고, 수확 전 농약안전사용기준(PLS)을 철저히 준수하세요.',
    },
    {
      plan_id: `CGP-CAB-${shortBulam}-11`,
      group_id: 'GRP-LEAF',
      group_name: cabbageGroupName,
      crop_id: 'CRP-CABBAGE',
      crop_name: cabbageCropName,
      cultivar_id: primaryBulamId,
      cultivar_name: primaryBulamName,
      template_id: `TPL-GRP-LEAF-CRP-CABBAGE-${primaryBulamId}-11`,
      process_code: 'PRC-28',
      process_name: '수확 적기 도달 확인',
      process_type: 'STG-HARVEST',
      step_order: 11,
      target_pgdd: 733,
      start_date: '',
      end_date: '',
      work_content:
        '정식 후 68~73일경(누적 적산온도 733℃ 도달) 배추 통 상부를 손으로 눌렀을 때 속이 단단하게 차오르고 결구율이 85~90% 이상 도달했는지 숙기를 판정합니다. 갑작스러운 초겨울 한파(영하 -2℃ 이하) 예보 시 외엽을 끈으로 묶어주거나 부직포를 피복하여 동해를 예방하고 수확 일정을 확정합니다.',
      required_materials_json: JSON.stringify(pickMaterials(['MAT-NUTR-04', 'MAT-PEST-06'])),
      usage_tip:
        '[농자재 사용팁] ① 수확 임박기에는 농약안전사용기준(PLS) 잔류 우려가 없는 [누보] 엔플러스 해충박살 파워(유기농업자재 공시-2-5-315, 500배액)로 후기 진딧물·해충만 안전하게 관리하세요. ② 수확 7~10일 전 [누보] 엔플러스 커진다를 마지막으로 엽면시비하면 구중 증가와 겨울철 김장 저장성이 크게 향상됩니다.',
    },
    {
      plan_id: `CGP-CAB-${shortBulam}-12`,
      group_id: 'GRP-LEAF',
      group_name: cabbageGroupName,
      crop_id: 'CRP-CABBAGE',
      crop_name: cabbageCropName,
      cultivar_id: primaryBulamId,
      cultivar_name: primaryBulamName,
      template_id: `TPL-GRP-LEAF-CRP-CABBAGE-${primaryBulamId}-12`,
      process_code: 'PRC-29',
      process_name: '본 수확 작업 및 현장 예건·큐어링',
      process_type: 'STG-HARVEST',
      step_order: 12,
      target_pgdd: 785,
      start_date: '',
      end_date: '',
      work_content:
        '누적 유효적산온도 785℃ 도달 후 이슬이 마른 맑은 날 오전~오후에 본 수확 작업을 실시합니다. 뿌리 밑둥(근관부)을 깨끗하게 절단하고 병든 하엽과 노화 잎을 제거하되, 유통·저장 중 수분 증발과 물리적 손상을 막아줄 건전한 보호 겉잎 2~3매를 남긴 뒤 통풍망(3포기 망) 포장 또는 저온저장고 예냉 입고를 진행합니다.',
      required_materials_json: JSON.stringify(pickMaterials(['MAT-NUTR-02'])),
      usage_tip:
        '[농자재 사용팁] ① 수확 직전 비가 내렸거나 아침 안개·이슬이 마르지 않은 상태에서 수확하여 망 작업을 하면 저장 중 무름병 부패가 급증하므로 반드시 물기가 완전히 마른 뒤 수확하세요. ② 장기 저온저장용 가을배추는 수확 5일 전 [누보] 엔플러스 튼튼칼슘을 처리한 개체가 저장 중 갈변 현상이 현저히 적습니다.',
    },
    // ==================== 감자 (1단계: 식량작물 (서류·곡류) > 2단계: 감자 > 3단계: 수미 (Superior)) 대표 샘플 ====================
    {
      plan_id: 'CGP-POT-SUMI-01',
      group_id: 'GRP-FOOD',
      group_name: potatoGroupName,
      crop_id: 'CRP-POTATO',
      crop_name: potatoCropName,
      cultivar_id: primarySumiId,
      cultivar_name: primarySumiName,
      template_id: 'TPL-GRP-FOOD-CRP-POTATO-CV-SUMI-02',
      process_code: 'PRC-03',
      process_name: '퇴비·밑거름 시비 및 경운·멀칭',
      process_type: 'STG-PREP',
      step_order: 1,
      target_pgdd: 0,
      start_date: '',
      end_date: '',
      work_content:
        '노지 봄감자(수미) 파종 10일 전 완숙 유박과 감자 전용 밑거름 복합비료를 전량 기비로 살포하고 깊이갈이 로터리를 실시합니다. 감자는 생육 기간이 짧아 추비보다 밑거름 위주로 시비하며, 폭 70~80cm 두둑을 만들고 흑색 또는 투명 비닐 멀칭으로 초기 지온을 확보합니다.',
      required_materials_json: JSON.stringify(pickMaterials(['FERT-PRD-05', 'FERT-PRD-01', 'MAT-PEST-04'])),
      usage_tip:
        '[농자재 사용팁] ① 감자 포전에 미숙 퇴비나 알칼리성 석회를 파종 직전에 과다 살포하면 더뎅이병(창가병)이 급증하므로 완숙 유기질비료(참조은 유박)와 황산가리계 원예복합비료(슈퍼원예복합), [UPL/누보] 사라져 미탁제를 정량 처리하세요.',
    },
  ];

  for (const p of initialPlans) {
    insertPlan.run(
      p.plan_id,
      p.group_id,
      p.group_name,
      p.crop_id,
      p.crop_name,
      p.cultivar_id,
      p.cultivar_name,
      p.template_id,
      p.process_code,
      stripParen(p.process_name),
      p.process_type,
      p.step_order,
      p.target_pgdd,
      '',
      '',
      p.work_content,
      p.required_materials_json,
      p.usage_tip
    );
  }

  // 가을배추(CRP-CABBAGE)의 다른 등록된 모든 품종들(불암플러스, 휘파람, 휘파람골드, 가을베타 등)에도 1단계·2단계·3단계 기준 9단계 전과정 보장
  const otherCabbageCultivars = db
    .prepare(
      'SELECT cultivar_id, cultivar_name FROM cultivar WHERE crop_id = ? AND cultivar_id != ?'
    )
    .all('CRP-CABBAGE', primaryBulamId) as Array<{ cultivar_id: string; cultivar_name: string }>;

  const bulamSteps = initialPlans.filter((p) => p.cultivar_id === primaryBulamId);
  for (const cv of otherCabbageCultivars) {
    const shortCv = cv.cultivar_id.replace(/^CV-/, '');
    for (const s of bulamSteps) {
      const seqStr = String(s.step_order).padStart(2, '0');
      const planId = `CGP-CAB-${shortCv}-${seqStr}`;
      const tplId = `TPL-GRP-LEAF-CRP-CABBAGE-${cv.cultivar_id}-${seqStr}`;
      insertPlan.run(
        planId,
        'GRP-LEAF',
        cabbageGroupName,
        'CRP-CABBAGE',
        cabbageCropName,
        cv.cultivar_id,
        cv.cultivar_name,
        tplId,
        s.process_code,
        stripParen(s.process_name),
        s.process_type,
        s.step_order,
        s.target_pgdd,
        '',
        '',
        s.work_content.replace(/불암3호/g, cv.cultivar_name),
        s.required_materials_json,
        s.usage_tip
      );
    }
  }

  // 테이블 내 모든 행에서 '(' 이후의 텍스트 및 기존 고정 생육기간(start_date, end_date) 데이터 삭제, 1·2·3단계 명칭 동기화
  db.exec(`
    UPDATE crop_growth_process_plan
    SET start_date = '', end_date = '';

    UPDATE crop_growth_process_plan
    SET process_name = TRIM(SUBSTR(process_name, 1, INSTR(process_name, '(') - 1))
    WHERE INSTR(process_name, '(') > 0;

    UPDATE crop_growth_process_plan
    SET cultivar_name = (
      SELECT cv.cultivar_name FROM cultivar cv WHERE cv.cultivar_id = crop_growth_process_plan.cultivar_id
    )
    WHERE EXISTS (
      SELECT 1 FROM cultivar cv WHERE cv.cultivar_id = crop_growth_process_plan.cultivar_id
    );

    UPDATE crop_growth_process_plan
    SET crop_id = COALESCE(
      (SELECT cv.crop_id FROM cultivar cv WHERE cv.cultivar_id = crop_growth_process_plan.cultivar_id),
      crop_id
    );

    UPDATE crop_growth_process_plan
    SET crop_name = (
      SELECT c.crop_name FROM crop c WHERE c.crop_id = crop_growth_process_plan.crop_id
    ),
    group_id = COALESCE(
      (SELECT c.group_id FROM crop c WHERE c.crop_id = crop_growth_process_plan.crop_id),
      group_id
    )
    WHERE EXISTS (
      SELECT 1 FROM crop c WHERE c.crop_id = crop_growth_process_plan.crop_id
    );

    UPDATE crop_growth_process_plan
    SET group_name = (
      SELECT g.group_name FROM crop_group g WHERE g.group_id = crop_growth_process_plan.group_id
    )
    WHERE EXISTS (
      SELECT 1 FROM crop_group g WHERE g.group_id = crop_growth_process_plan.group_id
    );

    UPDATE growth_process_code
    SET process_name = TRIM(SUBSTR(process_name, 1, INSTR(process_name, '(') - 1))
    WHERE INSTR(process_name, '(') > 0;

    UPDATE standard_template
    SET item_name = TRIM(SUBSTR(item_name, 1, INSTR(item_name, '(') - 1))
    WHERE INSTR(item_name, '(') > 0;

    UPDATE crop_growth_process_plan
    SET process_type = COALESCE(
      (SELECT gc.process_type FROM growth_process_code gc WHERE gc.process_code = crop_growth_process_plan.process_code),
      CASE
        WHEN process_code IN ('PRC-01', 'PRC-02', 'PRC-03', 'PRC-04', 'PRC-05') THEN 'STG-PREP'
        WHEN process_code IN ('PRC-06', 'PRC-07') THEN 'STG-NURSERY'
        WHEN process_code IN ('PRC-08', 'PRC-09', 'PRC-10') THEN 'STG-PLANT'
        WHEN process_code IN ('PRC-16', 'PRC-22', 'PRC-27') THEN 'STG-PEST'
        WHEN process_code IN ('PRC-28', 'PRC-29', 'PRC-30') THEN 'STG-HARVEST'
        ELSE 'STG-GROWTH'
      END
    );

    UPDATE standard_template
    SET item_type = COALESCE(
      (SELECT gc.process_type FROM growth_process_code gc WHERE gc.process_code = standard_template.item_code),
      CASE
        WHEN item_code IN ('PRC-01', 'PRC-02', 'PRC-03', 'PRC-04', 'PRC-05') THEN 'STG-PREP'
        WHEN item_code IN ('PRC-06', 'PRC-07') THEN 'STG-NURSERY'
        WHEN item_code IN ('PRC-08', 'PRC-09', 'PRC-10') THEN 'STG-PLANT'
        WHEN item_code IN ('PRC-16', 'PRC-22', 'PRC-27') THEN 'STG-PEST'
        WHEN item_code IN ('PRC-28', 'PRC-29', 'PRC-30') THEN 'STG-HARVEST'
        ELSE 'STG-GROWTH'
      END
    );
  `);
}

function ensurePaymentBankAccounts() {
  const cnt = (db.prepare('SELECT COUNT(*) as c FROM payment_bank_account').get() as { c: number }).c;
  if (cnt > 0) return;

  const insertAcc = db.prepare(`
    INSERT INTO payment_bank_account (
      account_id, bank_code, bank_name, account_number, account_holder,
      account_purpose, branch_name, is_primary, is_active, auto_confirm_enabled,
      cash_receipt_info, transfer_guide_memo, sort_order, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
  `);

  const initialAccounts = [
    {
      account_id: 'BANK-ACC-01',
      bank_code: '011',
      bank_name: 'NH농협은행',
      account_number: '301-0264-8892-11',
      account_holder: '(주)팜플랜농자재',
      account_purpose: '비료·영양재·병해충관리제 통합 결제 (대표계좌)',
      branch_name: '수원영통중앙지점',
      is_primary: 1,
      is_active: 1,
      auto_confirm_enabled: 1,
      cash_receipt_info: '면세/영세율 계산서 및 농업용 현금영수증(지출증빙) 즉시 발행',
      transfer_guide_memo: '입금자명에 [주문자명+연락처뒷4자리] 기재 시 5분 내 자동 입금확인 및 당일 출고 처리됩니다.',
      sort_order: 1,
    },
    {
      account_id: 'BANK-ACC-02',
      bank_code: '012',
      bank_name: '지역농·축협 (단위농협)',
      account_number: '351-1098-4420-53',
      account_holder: '(주)팜플랜농자재',
      account_purpose: '비료 20kg 포대 대량주문 · 농협조합원 전용 결제',
      branch_name: '경기남부원예농협 본점',
      is_primary: 0,
      is_active: 1,
      auto_confirm_enabled: 1,
      cash_receipt_info: '농협 조합원 면세 계산서 및 경영체 증빙 영수증 발행 지원',
      transfer_guide_memo: '단위농협 계좌 간 이체 수수료 면제 계좌입니다. 20포(파레트) 이상 대량 발주 시 우선 확인됩니다.',
      sort_order: 2,
    },
    {
      account_id: 'BANK-ACC-03',
      bank_code: '004',
      bank_name: 'KB국민은행',
      account_number: '462901-04-281940',
      account_holder: '(주)팜플랜농자재',
      account_purpose: '영양재 · 병해충관리제 소포장 택배 결제',
      branch_name: '판교테크노밸리지점',
      is_primary: 0,
      is_active: 1,
      auto_confirm_enabled: 1,
      cash_receipt_info: '현금영수증(소득공제/지출증빙) 및 전자세금계산서 발행 가능',
      transfer_guide_memo: '오후 3시 이전 입금 완료 건은 한진/농협택배로 당일 발송됩니다.',
      sort_order: 3,
    },
    {
      account_id: 'BANK-ACC-04',
      bank_code: '003',
      bank_name: 'IBK기업은행',
      account_number: '108-094821-04-015',
      account_holder: '주식회사 팜플랜(FarmPlan)',
      account_purpose: '영농조합법인 · 농업회사법인 · 지자체 보조사업 전용 결제',
      branch_name: '가산디지털중앙지점',
      is_primary: 0,
      is_active: 1,
      auto_confirm_enabled: 1,
      cash_receipt_info: '법인 전자세금계산서 · 지방보조금(보탬e) 거래명세서·납품확인서 완비',
      transfer_guide_memo: '영농조합법인 또는 지자체 보조사업 결제 시 사업자등록증 사본을 고객센터로 함께 전달해 주세요.',
      sort_order: 4,
    },
    {
      account_id: 'BANK-ACC-05',
      bank_code: '088',
      bank_name: '신한은행',
      account_number: '140-013-884920',
      account_holder: '(주)팜플랜농자재',
      account_purpose: '일반 농자재 계좌이체 보조 결제',
      branch_name: '양재가락유통지점',
      is_primary: 0,
      is_active: 1,
      auto_confirm_enabled: 0,
      cash_receipt_info: '현금영수증 및 전자세금계산서 발행 가능',
      transfer_guide_memo: '타행 이체 점검 시간(23:30~00:30) 외 상시 입금 가능 계좌입니다.',
      sort_order: 5,
    },
  ];

  for (const acc of initialAccounts) {
    insertAcc.run(
      acc.account_id,
      acc.bank_code,
      acc.bank_name,
      acc.account_number,
      acc.account_holder,
      acc.account_purpose,
      acc.branch_name,
      acc.is_primary,
      acc.is_active,
      acc.auto_confirm_enabled,
      acc.cash_receipt_info,
      acc.transfer_guide_memo,
      acc.sort_order
    );
  }
}

function ensureAgroMaterials() {
  const existingCols = new Set(
    (db.prepare('PRAGMA table_info(agro_material)').all() as Array<{ name: string }>).map((c) => c.name)
  );
  const extraCols: Array<[string, string]> = [
    ['product_code', "TEXT DEFAULT '30001000011'"],
    ['category_code', "TEXT DEFAULT 'CAT-NPK-COMP'"],
    ['manufacturer', "TEXT DEFAULT '대유'"],
    ['formulation_type', "TEXT DEFAULT '입상 (Granular)'"],
    ['organic_label', "TEXT DEFAULT '(유기농)'"],
    ['weight_spec', "TEXT DEFAULT '20Kg'"],
    ['volume_spec', "TEXT DEFAULT '0ml'"],
    ['origin_country', "TEXT DEFAULT '대한민국 (국산)'"],
    ['contact_phone', "TEXT DEFAULT '1588-2026'"],
    ['nutrient_ratio_summary', "TEXT DEFAULT ''"],
    ['mg_pct', 'REAL DEFAULT 0'],
    ['b_pct', 'REAL DEFAULT 0'],
    ['sio2_pct', 'REAL DEFAULT 0'],
    ['s_pct', 'REAL DEFAULT 0'],
    ['retail_price', 'INTEGER DEFAULT 15000'],
    ['discount_rate', 'REAL DEFAULT 12.0'],
    ['reward_points', 'INTEGER DEFAULT 300'],
    ['stock_status', "TEXT DEFAULT '정상판매 · 즉시출고'"],
    ['thumbnail_url', "TEXT DEFAULT ''"],
    ['detail_image_1', "TEXT DEFAULT ''"],
    ['detail_image_2', "TEXT DEFAULT ''"],
    ['detail_image_3', "TEXT DEFAULT ''"],
    ['detail_image_4', "TEXT DEFAULT ''"],
    ['description_banner_url', "TEXT DEFAULT ''"],
  ];
  for (const [colName, colDef] of extraCols) {
    if (!existingCols.has(colName)) {
      db.exec(`ALTER TABLE agro_material ADD COLUMN ${colName} ${colDef}`);
    }
  }

  // 기존 구형 MAT-FERT-* 샘플 비료가 남아있다면 실제 비료 전문점 5종 샘플 데이터(FERT-PRD-01 ~ 05)로 교체
  db.prepare("DELETE FROM agro_material WHERE material_id LIKE 'MAT-FERT-%'").run();

  const upsertFert = db.prepare(`
    INSERT OR REPLACE INTO agro_material (
      material_id, product_code, material_category, sub_type, category_code, manufacturer,
      product_name, formulation_type, is_organic, organic_label,
      weight_spec, volume_spec, origin_country, contact_phone,
      target_nutrient_or_pest, nutrient_ratio_summary,
      n_pct, p_pct, k_pct, ca_pct, mg_pct, b_pct, sio2_pct, s_pct, om_pct,
      dosage_per_100pyeong, unit_spec, retail_price, unit_price, discount_rate, reward_points, stock_status,
      usage_stage, weather_trigger,
      thumbnail_url, detail_image_1, detail_image_2, detail_image_3, detail_image_4, description_banner_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const f of [
    ...INITIAL_FERTILIZER_PRODUCTS,
    ...INITIAL_NUTRIENT_PRODUCTS,
    ...INITIAL_PESTICIDE_PRODUCTS,
  ]) {
    upsertFert.run(
      f.material_id,
      f.product_code,
      f.material_category,
      f.sub_type,
      f.category_code,
      f.manufacturer,
      f.product_name,
      f.formulation_type,
      f.is_organic,
      f.organic_label,
      f.weight_spec,
      f.volume_spec,
      f.origin_country,
      f.contact_phone,
      f.target_nutrient_or_pest,
      f.nutrient_ratio_summary,
      f.n_pct,
      f.p_pct,
      f.k_pct,
      f.ca_pct,
      f.mg_pct,
      f.b_pct,
      f.sio2_pct,
      f.s_pct,
      f.om_pct,
      f.dosage_per_100pyeong,
      f.unit_spec,
      f.retail_price,
      f.unit_price,
      f.discount_rate,
      f.reward_points,
      f.stock_status,
      f.usage_stage,
      f.weather_trigger,
      f.thumbnail_url,
      f.detail_image_1,
      f.detail_image_2,
      f.detail_image_3,
      f.detail_image_4,
      f.description_banner_url
    );
  }

  // 비료/영양제/병해충관리제 분류 기초 코드 마스터와 상품의 sub_type 명칭 동기화
  db.exec(`
    UPDATE agro_material
    SET sub_type = (
      SELECT fc.category_name
      FROM fertilizer_category_code fc
      WHERE fc.category_code = agro_material.category_code
    )
    WHERE material_category = 'FERTILIZER'
      AND EXISTS (
        SELECT 1
        FROM fertilizer_category_code fc
        WHERE fc.category_code = agro_material.category_code
      );

    UPDATE agro_material
    SET sub_type = (
      SELECT nc.category_name
      FROM nutrient_category_code nc
      WHERE nc.category_code = agro_material.category_code
    )
    WHERE material_category = 'NUTRIENT'
      AND EXISTS (
        SELECT 1
        FROM nutrient_category_code nc
        WHERE nc.category_code = agro_material.category_code
      );

    UPDATE agro_material
    SET sub_type = (
      SELECT pc.category_name
      FROM pesticide_category_code pc
      WHERE pc.category_code = agro_material.category_code
    )
    WHERE material_category = 'PESTICIDE'
      AND EXISTS (
        SELECT 1
        FROM pesticide_category_code pc
        WHERE pc.category_code = agro_material.category_code
      );
  `);

  // 모든 NUTRIENT / PESTICIDE 상품에도 이미지 경로 및 요약 기본값 자동 보정
  const allRows = db.prepare('SELECT * FROM agro_material').all() as any[];
  const updateImgs = db.prepare(`
    UPDATE agro_material
    SET thumbnail_url = CASE WHEN thumbnail_url IS NULL OR thumbnail_url = '' THEN ? ELSE thumbnail_url END,
        detail_image_1 = CASE WHEN detail_image_1 IS NULL OR detail_image_1 = '' THEN ? ELSE detail_image_1 END,
        detail_image_2 = CASE WHEN detail_image_2 IS NULL OR detail_image_2 = '' THEN ? ELSE detail_image_2 END,
        detail_image_3 = CASE WHEN detail_image_3 IS NULL OR detail_image_3 = '' THEN ? ELSE detail_image_3 END,
        detail_image_4 = CASE WHEN detail_image_4 IS NULL OR detail_image_4 = '' THEN ? ELSE detail_image_4 END,
        description_banner_url = CASE WHEN description_banner_url IS NULL OR description_banner_url = '' THEN ? ELSE description_banner_url END,
        nutrient_ratio_summary = CASE WHEN nutrient_ratio_summary IS NULL OR nutrient_ratio_summary = '' THEN ? ELSE nutrient_ratio_summary END,
        retail_price = CASE WHEN retail_price IS NULL OR retail_price = 0 THEN ? ELSE retail_price END,
        product_code = CASE WHEN product_code IS NULL OR product_code = '' THEN ? ELSE product_code END,
        organic_label = CASE WHEN organic_label IS NULL OR organic_label = '' THEN ? ELSE organic_label END,
        weight_spec = CASE WHEN weight_spec IS NULL OR weight_spec = '' THEN ? ELSE weight_spec END,
        volume_spec = CASE WHEN volume_spec IS NULL OR volume_spec = '' THEN ? ELSE volume_spec END,
        origin_country = CASE WHEN origin_country IS NULL OR origin_country = '' THEN ? ELSE origin_country END,
        contact_phone = CASE WHEN contact_phone IS NULL OR contact_phone = '' THEN ? ELSE contact_phone END,
        discount_rate = CASE WHEN discount_rate IS NULL OR discount_rate = 0 THEN ? ELSE discount_rate END,
        reward_points = CASE WHEN reward_points IS NULL OR reward_points = 0 THEN ? ELSE reward_points END
    WHERE material_id = ?
  `);
  for (let idx = 0; idx < allRows.length; idx++) {
    const r = allRows[idx];
    const idEnc = encodeURIComponent(r.material_id);
    const defaultRatio =
      r.material_category === 'PESTICIDE'
        ? `유효 방제성분 표준함량 · ${r.sub_type}`
        : `N ${r.n_pct || 0}% · P ${r.p_pct || 0}% · K ${r.k_pct || 0}% · Ca ${r.ca_pct || 0}% · 유기물 ${r.om_pct || 0}%`;
    const unitP = Number(r.unit_price || 12000);
    const retailP = Number(r.retail_price) > 0 ? Number(r.retail_price) : Math.round(unitP * 1.15);
    const discRate = retailP > unitP ? Number((((retailP - unitP) / retailP) * 100).toFixed(1)) : 12.0;
    const rewardPts = Math.round(unitP * 0.02);
    const isMl = String(r.unit_spec || '').toLowerCase().includes('ml') || String(r.unit_spec || '').toLowerCase().includes('l');
    updateImgs.run(
      `/api/agro-materials/image/${idEnc}/thumb`,
      `/api/agro-materials/image/${idEnc}/detail1`,
      `/api/agro-materials/image/${idEnc}/detail2`,
      `/api/agro-materials/image/${idEnc}/detail3`,
      `/api/agro-materials/image/${idEnc}/detail4`,
      `/api/agro-materials/image/${idEnc}/desc`,
      defaultRatio,
      retailP,
      `300010000${String(20 + idx).padStart(2, '0')}`,
      r.is_organic ? '(유기농)' : '(비유기농)',
      isMl ? '0Kg' : String(r.unit_spec || '20Kg').split('/')[0].trim(),
      isMl ? String(r.unit_spec || '500ml').split('/')[0].trim() : '0ml',
      '대한민국 (국산)',
      '1588-2026',
      discRate,
      rewardPts,
      r.material_id
    );
  }
}

function ensureMemberScheduleRequests() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS member_schedule_request (
      request_no TEXT PRIMARY KEY,
      member_id TEXT NOT NULL DEFAULT 'CloudBase',
      member_contact TEXT DEFAULT '010-2026-0001',
      group_id TEXT NOT NULL,
      group_name TEXT NOT NULL,
      crop_id TEXT NOT NULL,
      crop_name TEXT NOT NULL,
      cultivar_id TEXT NOT NULL,
      item_name_3rd TEXT NOT NULL,
      system_id TEXT NOT NULL,
      system_name TEXT NOT NULL,
      bjd_code TEXT NOT NULL,
      sido TEXT NOT NULL,
      sigungu TEXT NOT NULL,
      eupmyeondong TEXT NOT NULL,
      detail_address TEXT NOT NULL,
      area_pyeong INTEGER NOT NULL,
      cultivation_type TEXT NOT NULL,
      land_category TEXT NOT NULL DEFAULT '전(밭)',
      planting_method TEXT NOT NULL DEFAULT '육묘정식',
      desired_start_date TEXT NOT NULL,
      expected_harvest_date TEXT NOT NULL,
      mulching_yn INTEGER NOT NULL DEFAULT 1,
      irrigation_type TEXT NOT NULL DEFAULT '점적관수',
      is_organic INTEGER NOT NULL DEFAULT 0,
      soil_test_linked_yn INTEGER NOT NULL DEFAULT 1,
      target_yield_kg INTEGER NOT NULL DEFAULT 0,
      etc_notes TEXT,
      request_status TEXT NOT NULL DEFAULT '일정산출완료',
      requested_at TEXT NOT NULL,
      FOREIGN KEY (bjd_code) REFERENCES cultivation_address(bjd_code) ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  // 기존 구형 하드코딩 데이터('배추', '엽근채류', '마늘', '무' 등 기초 코드에 없는 작물명) 또는 잘못된 읍면동 매핑이 있으면 정규 기초 코드 및 실제 읍면동 주소로 일괄 갱신
  const legacyCheck = db
    .prepare(
      "SELECT COUNT(*) as cnt FROM member_schedule_request WHERE crop_name = '배추' OR group_name = '엽근채류' OR (request_no = 'REQ-20261102-003' AND eupmyeondong != '대관령면')"
    )
    .get() as { cnt: number };
  const cntRow = db.prepare('SELECT COUNT(*) as cnt FROM member_schedule_request').get() as { cnt: number };
  if (cntRow.cnt >= 9 && legacyCheck.cnt === 0) return;

  const findAddr = (
    sidoLike: string,
    sigunguLike?: string,
    eupmyeondongLike?: string
  ): { bjd_code: string; sido: string; sigungu: string; eupmyeondong: string } => {
    if (sigunguLike && eupmyeondongLike) {
      const exact = db
        .prepare(
          'SELECT bjd_code, sido, sigungu, eupmyeondong FROM cultivation_address WHERE sido LIKE ? AND sigungu LIKE ? AND eupmyeondong LIKE ? ORDER BY address_id ASC LIMIT 1'
        )
        .get(`%${sidoLike}%`, `%${sigunguLike}%`, `%${eupmyeondongLike}%`) as any;
      if (exact) return exact;
    }
    if (sigunguLike) {
      const r = db
        .prepare('SELECT bjd_code, sido, sigungu, eupmyeondong FROM cultivation_address WHERE sido LIKE ? AND sigungu LIKE ? ORDER BY address_id ASC LIMIT 1')
        .get(`%${sidoLike}%`, `%${sigunguLike}%`) as any;
      if (r) return r;
    }
    const fallback = db
      .prepare('SELECT bjd_code, sido, sigungu, eupmyeondong FROM cultivation_address WHERE sido LIKE ? ORDER BY address_id ASC LIMIT 1')
      .get(`%${sidoLike}%`) as any;
    return fallback || { bjd_code: '1101000100', sido: '서울특별시', sigungu: '종로구', eupmyeondong: '청운동' };
  };

  const a1 = findAddr('충청북도', '충주', '산척');
  const a2 = findAddr('전라남도', '해남', '옥천');
  const a3 = findAddr('강원특별자치도', '평창', '대관령');
  const a4 = findAddr('경상북도', '안동', '풍산');
  const a5 = findAddr('충청남도', '논산', '연무');
  const a6 = findAddr('경기도', '이천', '장호원');
  const a8 = findAddr('경상남도', '밀양', '하남');
  const a9 = findAddr('제주특별자치도', '서귀포', '성산');

  const seedRows = [
    {
      request_no: 'REQ-20261101-001',
      member_id: 'CloudBae@naver.com (배철민)',
      member_contact: '010-3421-8890',
      group_id: 'GRP-LEAF',
      group_name: '엽채류 (잎채소)',
      crop_id: 'CRP-CABBAGE',
      crop_name: '가을배추',
      cultivar_id: 'CV-BRMP',
      item_name_3rd: '불암플러스',
      system_id: 'SYS-CAB-AUT',
      system_name: '노지 가을재배',
      ...a1,
      detail_address: '산척면 송강리 412-3 제1영농포전',
      area_pyeong: 1200,
      cultivation_type: '노지재배',
      land_category: '전(밭)',
      planting_method: '육묘정식',
      desired_start_date: '2026-08-25',
      expected_harvest_date: '2026-11-16',
      mulching_yn: 1,
      irrigation_type: '점적관수',
      is_organic: 0,
      soil_test_linked_yn: 1,
      target_yield_kg: 18500,
      etc_notes: '결구기 칼슘 결핍(꿀통배추) 예방을 위한 엽면시비 일정과 가을 폭우 대비 배수로 정비 일정을 함께 요청함.',
      request_status: '일정산출완료',
      requested_at: '2026-11-01 09:20:15',
    },
    {
      request_no: 'REQ-20261102-002',
      member_id: 'CloudBae@naver.com (배철민)',
      member_contact: '010-5812-3304',
      group_id: 'GRP-LEAF',
      group_name: '엽채류 (잎채소)',
      crop_id: 'CRP-CABBAGE',
      crop_name: '가을배추',
      cultivar_id: 'CV-HPRM',
      item_name_3rd: '휘파람',
      system_id: 'SYS-CAB-AUT',
      system_name: '노지 가을재배',
      ...a2,
      detail_address: '옥천면 영신리 208-1 해남배추단지',
      area_pyeong: 2500,
      cultivation_type: '노지재배',
      land_category: '전(밭)',
      planting_method: '육묘정식',
      desired_start_date: '2026-09-05',
      expected_harvest_date: '2026-12-05',
      mulching_yn: 1,
      irrigation_type: '스프링클러',
      is_organic: 1,
      soil_test_linked_yn: 1,
      target_yield_kg: 32000,
      etc_notes: '친환경 유기농 인증 농가로 화학비료 대신 유박·유기농 칼슘제를 활용한 결구기 추비 일정을 희망함.',
      request_status: '일정산출완료',
      requested_at: '2026-11-02 11:05:40',
    },
    {
      request_no: 'REQ-20261102-003',
      member_id: 'CloudBae@naver.com (배철민)',
      member_contact: '010-7745-1920',
      group_id: 'GRP-FOOD',
      group_name: '식량작물 (서류·곡류)',
      crop_id: 'CRP-POTATO',
      crop_name: '감자',
      cultivar_id: 'CV-SUMI',
      item_name_3rd: '수미 (Superior)',
      system_id: 'SYS-POT-SPR',
      system_name: '노지 봄재배',
      ...a3,
      detail_address: '대관령면 횡계리 654-2 고랭지채소포전',
      area_pyeong: 3000,
      cultivation_type: '고랭지노지',
      land_category: '전(밭)',
      planting_method: '종서파종(직파)',
      desired_start_date: '2026-04-15',
      expected_harvest_date: '2026-07-28',
      mulching_yn: 1,
      irrigation_type: '스프링클러',
      is_organic: 0,
      soil_test_linked_yn: 1,
      target_yield_kg: 27000,
      etc_notes: '해발 700m 준고랭지 구역으로 봄철 늦서리 피해 회피 파종적기와 장마기 역병 예방 방제 일정 포함 요청.',
      request_status: '일정산출완료',
      requested_at: '2026-11-02 15:42:10',
    },
    {
      request_no: 'REQ-20261103-004',
      member_id: 'CloudBae@naver.com (배철민)',
      member_contact: '010-9012-4411',
      group_id: 'GRP-LEAF',
      group_name: '엽채류 (잎채소)',
      crop_id: 'CRP-CABBAGE',
      crop_name: '가을배추',
      cultivar_id: 'CV-HPRG',
      item_name_3rd: '휘파람골드',
      system_id: 'SYS-CAB-AUT',
      system_name: '노지 가을재배',
      ...a4,
      detail_address: '풍산읍 안교리 119-7',
      area_pyeong: 850,
      cultivation_type: '노지재배',
      land_category: '전(밭)',
      planting_method: '육묘정식',
      desired_start_date: '2026-08-28',
      expected_harvest_date: '2026-11-15',
      mulching_yn: 1,
      irrigation_type: '고랑관수',
      is_organic: 0,
      soil_test_linked_yn: 1,
      target_yield_kg: 13000,
      etc_notes: '모래참흙(사양토) 필지로 붕소·칼슘 결핍 예방 엽면시비 시기 및 무름병 방제 알림 요청.',
      request_status: '일정산출완료',
      requested_at: '2026-11-03 10:18:33',
    },
    {
      request_no: 'REQ-20261104-005',
      member_id: 'CloudBae@naver.com (배철민)',
      member_contact: '010-6234-7788',
      group_id: 'GRP-LEAF',
      group_name: '엽채류 (잎채소)',
      crop_id: 'CRP-LETTUCE',
      crop_name: '상추',
      cultivar_id: 'CV-CHEONGCHIMA',
      item_name_3rd: '청치마상추',
      system_id: 'SYS-LET-SPR',
      system_name: '노지 봄·가을재배',
      ...a5,
      detail_address: '연무읍 마전리 88-4 시설하우스 3~6동',
      area_pyeong: 600,
      cultivation_type: '비닐하우스(무가온)',
      land_category: '시설재배지',
      planting_method: '육묘정식',
      desired_start_date: '2026-09-05',
      expected_harvest_date: '2026-10-25',
      mulching_yn: 1,
      irrigation_type: '점적관수',
      is_organic: 0,
      soil_test_linked_yn: 1,
      target_yield_kg: 4800,
      etc_notes: '연작 하우스 포전으로 정식 전 토양소독 및 염류집적(EC) 완화 관수 스케줄과 추대(꽃대) 방지 온도관리 기준 요청.',
      request_status: '일정산출완료',
      requested_at: '2026-11-04 14:05:22',
    },
    {
      request_no: 'REQ-20261104-006',
      member_id: 'CloudBae@naver.com (배철민)',
      member_contact: '010-4119-2039',
      group_id: 'GRP-FOOD',
      group_name: '식량작물 (서류·곡류)',
      crop_id: 'CRP-POTATO',
      crop_name: '감자',
      cultivar_id: 'CV-SEOLBONG',
      item_name_3rd: '설봉',
      system_id: 'SYS-POT-AUT',
      system_name: '노지 가을재배',
      ...a6,
      detail_address: '장호원읍 진암리 302-9',
      area_pyeong: 1500,
      cultivation_type: '노지재배',
      land_category: '전(밭)',
      planting_method: '종서파종(직파)',
      desired_start_date: '2026-08-15',
      expected_harvest_date: '2026-11-10',
      mulching_yn: 1,
      irrigation_type: '점적관수',
      is_organic: 0,
      soil_test_linked_yn: 1,
      target_yield_kg: 13500,
      etc_notes: '더뎅이병 예방을 위해 토양 산도(pH)를 5.5~6.2 수준으로 유지하는 밑거름 처방 및 배토 작업 적기 산출 희망.',
      request_status: '일정산출완료',
      requested_at: '2026-11-04 17:30:00',
    },
    {
      request_no: 'REQ-20261105-007',
      member_id: 'CloudBae@naver.com (배철민)',
      member_contact: '010-8831-5560',
      group_id: 'GRP-FOOD',
      group_name: '식량작물 (서류·곡류)',
      crop_id: 'CRP-POTATO',
      crop_name: '감자',
      cultivar_id: 'CV-DUBAEK',
      item_name_3rd: '두백',
      system_id: 'SYS-POT-SPR',
      system_name: '노지 봄재배',
      ...a8,
      detail_address: '하남읍 수산리 511-2 수산뜰 제4구획',
      area_pyeong: 1800,
      cultivation_type: '노지재배',
      land_category: '답(논)',
      planting_method: '종서파종(직파)',
      desired_start_date: '2026-03-10',
      expected_harvest_date: '2026-06-25',
      mulching_yn: 1,
      irrigation_type: '스프링클러',
      is_organic: 0,
      soil_test_linked_yn: 1,
      target_yield_kg: 16200,
      etc_notes: '논(답리작) 봄감자 재배지로 습해 방지를 위한 고휴(높은이랑) 성형 및 역병 방제 일정 요청.',
      request_status: '일정산출완료',
      requested_at: '2026-11-05 11:12:48',
    },
    {
      request_no: 'REQ-20261106-008',
      member_id: 'CloudBae@naver.com (배철민)',
      member_contact: '010-2940-6612',
      group_id: 'GRP-LEAF',
      group_name: '엽채류 (잎채소)',
      crop_id: 'CRP-SPINACH',
      crop_name: '시금치',
      cultivar_id: 'CV-POHANGCHO',
      item_name_3rd: '포항초 (재래종)',
      system_id: 'SYS-SPI-AUT',
      system_name: '노지 가을·월동재배',
      ...a9,
      detail_address: '성산읍 오조리 914-5 화산회토 영농지',
      area_pyeong: 3500,
      cultivation_type: '노지재배',
      land_category: '전(밭)',
      planting_method: '점파(직파)',
      desired_start_date: '2026-09-25',
      expected_harvest_date: '2026-12-20',
      mulching_yn: 0,
      irrigation_type: '스프링클러',
      is_organic: 1,
      soil_test_linked_yn: 1,
      target_yield_kg: 14000,
      etc_notes: '제주 화산회토 특성상 유기물 함량이 높고 인산 고정력이 강하므로 맞춤형 인산 시비량 및 겨울철 한파 대비 수확적기 산출 요청.',
      request_status: '일정산출완료',
      requested_at: '2026-11-06 08:45:19',
    },
    {
      request_no: 'REQ-20261106-009',
      member_id: 'CloudBae@naver.com (배철민)',
      member_contact: '010-4820-7150',
      group_id: 'GRP-LEAF',
      group_name: '엽채류 (잎채소)',
      crop_id: 'CRP-CABBAGE',
      crop_name: '가을배추',
      cultivar_id: 'CV-BRM3',
      item_name_3rd: '불암3호',
      system_id: 'SYS-CAB-AUT',
      system_name: '노지 가을재배',
      bjd_code: '4305003000',
      sido: '충청북도',
      sigungu: '충주시',
      eupmyeondong: '단월동',
      detail_address: '단월동 382-4번지 달천강변 배추 영농포전 (전 1,000평)',
      area_pyeong: 1000,
      cultivation_type: '노지재배',
      land_category: '전(밭)',
      planting_method: '육묘정식',
      desired_start_date: '2026-08-25',
      expected_harvest_date: '2026-11-15',
      mulching_yn: 1,
      irrigation_type: '점적관수',
      is_organic: 0,
      soil_test_linked_yn: 1,
      target_yield_kg: 15500,
      etc_notes: '충청북도 충주시 단월동 1,000평 노지 가을배추(불암3호) 재배 포전으로, 단월동 기상·토양검정 DB 연동 적산온도(PGDD 785℃·일) 기반 정식·활착·1~2차 웃거름·결구기 칼슘 엽면시비 및 수확적기 산출 요청.',
      request_status: '일정산출완료',
      requested_at: '2026-11-06 13:25:00',
    },
  ];

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO member_schedule_request (
      request_no, member_id, member_contact,
      group_id, group_name, crop_id, crop_name, cultivar_id, item_name_3rd, system_id, system_name,
      bjd_code, sido, sigungu, eupmyeondong, detail_address,
      area_pyeong, cultivation_type, land_category, planting_method,
      desired_start_date, expected_harvest_date, mulching_yn, irrigation_type,
      is_organic, soil_test_linked_yn, target_yield_kg, etc_notes, request_status, requested_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const r of seedRows) {
    stmt.run(
      r.request_no, r.member_id, r.member_contact,
      r.group_id, r.group_name, r.crop_id, r.crop_name, r.cultivar_id, r.item_name_3rd, r.system_id, r.system_name,
      r.bjd_code, r.sido, r.sigungu, r.eupmyeondong, r.detail_address,
      r.area_pyeong, r.cultivation_type, r.land_category, r.planting_method,
      r.desired_start_date, r.expected_harvest_date, r.mulching_yn, r.irrigation_type,
      r.is_organic, r.soil_test_linked_yn, r.target_yield_kg, r.etc_notes, r.request_status, r.requested_at
    );
  }
}

function ensureCultivationAddresses() {
  const row = db.prepare('SELECT COUNT(*) as cnt FROM cultivation_address').get() as { cnt: number };
  if (row.cnt >= 4000) return;

  const dataset = generateKoreaAddressDataset();
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO cultivation_address (bjd_code, sido, sigungu, eupmyeondong, full_address)
    VALUES (?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN TRANSACTION');
  try {
    for (const item of dataset) {
      insertStmt.run(item.bjd_code, item.sido, item.sigungu, item.eupmyeondong, item.full_address);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function ensureRoadAndJibunAddresses() {
  const roadCount = db.prepare('SELECT COUNT(*) as cnt FROM road_address').get() as { cnt: number };
  const jibunCount = db.prepare('SELECT COUNT(*) as cnt FROM jibun_address').get() as { cnt: number };
  if (roadCount.cnt >= 4000 && jibunCount.cnt >= 4000) return;

  const { roadList, jibunList } = generateKoreaRoadAndJibunDatasets();

  const insRoad = db.prepare(`
    INSERT OR IGNORE INTO road_address (
      road_code, postal_code, sido, sigungu, eupmyeondong,
      road_name, underground_yn, building_main_no, building_sub_no,
      building_name, bjd_code, full_road_address
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insJibun = db.prepare(`
    INSERT OR IGNORE INTO jibun_address (
      bjd_code, postal_code, sido, sigungu, eupmyeondong,
      ri_name, mountain_yn, jibun_main_no, jibun_sub_no, full_jibun_address
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN TRANSACTION');
  try {
    if (roadCount.cnt < 4000) {
      for (const r of roadList) {
        insRoad.run(
          r.road_code,
          r.postal_code,
          r.sido,
          r.sigungu,
          r.eupmyeondong,
          r.road_name,
          r.underground_yn,
          r.building_main_no,
          r.building_sub_no,
          r.building_name,
          r.bjd_code,
          r.full_road_address
        );
      }
    }
    if (jibunCount.cnt < 4000) {
      for (const j of jibunList) {
        insJibun.run(
          j.bjd_code,
          j.postal_code,
          j.sido,
          j.sigungu,
          j.eupmyeondong,
          j.ri_name,
          j.mountain_yn,
          j.jibun_main_no,
          j.jibun_sub_no,
          j.full_jibun_address
        );
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function ensureStandardTemplateTaxonomyColumns() {
  const cols = db.prepare('PRAGMA table_info(standard_template)').all() as Array<{ name: string }>;
  const colNames = new Set(cols.map((c) => c.name));
  if (!colNames.has('group_id')) {
    db.exec('ALTER TABLE standard_template ADD COLUMN group_id TEXT');
  }
  if (!colNames.has('crop_id')) {
    db.exec('ALTER TABLE standard_template ADD COLUMN crop_id TEXT');
  }
  if (!colNames.has('cultivar_id')) {
    db.exec('ALTER TABLE standard_template ADD COLUMN cultivar_id TEXT');
  }
  if (!colNames.has('bjd_code')) {
    db.exec("ALTER TABLE standard_template ADD COLUMN bjd_code TEXT DEFAULT '4313010700'");
  }
  if (!colNames.has('sido')) {
    db.exec("ALTER TABLE standard_template ADD COLUMN sido TEXT DEFAULT '충청북도'");
  }
  if (!colNames.has('sigungu')) {
    db.exec("ALTER TABLE standard_template ADD COLUMN sigungu TEXT DEFAULT '충주시'");
  }
  if (!colNames.has('eupmyeondong')) {
    db.exec("ALTER TABLE standard_template ADD COLUMN eupmyeondong TEXT DEFAULT '단월동'");
  }

  // 등록된 모든 작물(crop)에 대해 기본 재배작형(cropping_system)이 누락되어 있으면 보장
  const insertSysIgnore = db.prepare(`
    INSERT OR IGNORE INTO cropping_system (
      system_id, crop_id, system_name, cultivation_method, sowing_months, harvest_months,
      is_overwintering, base_temp_tb, required_gdd, required_raw_gdd,
      opt_temp_min, opt_temp_max, limit_temp_min, limit_temp_max, damage_temp_low, damage_temp_high
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const existingCrops = new Set(
    (db.prepare('SELECT crop_id FROM crop').all() as Array<{ crop_id: string }>).map((c) => c.crop_id)
  );
  if (existingCrops.has('CRP-CABBAGE')) {
    insertSysIgnore.run(
      'SYS-CAB-AUT',
      'CRP-CABBAGE',
      '노지 가을재배',
      'OPEN_FIELD',
      '8월 하순',
      '11월 중순',
      0,
      5.0,
      785,
      1170,
      15,
      20,
      5,
      25,
      2,
      28
    );
  }
  if (existingCrops.has('CRP-POTATO')) {
    insertSysIgnore.run(
      'SYS-POT-SPR',
      'CRP-POTATO',
      '노지 봄재배',
      'OPEN_FIELD',
      '3월 중순',
      '6월 하순~7월 중순',
      0,
      5.0,
      1000,
      1300,
      14,
      23,
      5,
      25,
      5,
      30
    );
  }
  if (existingCrops.has('CRP-LETTUCE')) {
    insertSysIgnore.run(
      'SYS-LET-SPR',
      'CRP-LETTUCE',
      '노지 봄·가을재배',
      'OPEN_FIELD',
      '4월 초순 / 9월 초순',
      '5월 중순 / 10월 하순',
      0,
      4.0,
      520,
      780,
      15,
      20,
      4,
      25,
      2,
      28
    );
  }
  if (existingCrops.has('CRP-SPINACH')) {
    insertSysIgnore.run(
      'SYS-SPI-AUT',
      'CRP-SPINACH',
      '노지 가을·월동재배',
      'OPEN_FIELD',
      '9월 중순~10월 중순',
      '11월 하순~익년 2월',
      1,
      4.0,
      610,
      920,
      15,
      20,
      4,
      24,
      -5,
      26
    );
  }

  // 기존 구형 단축 ID(TPL-POT-01 등) 정리 후 등록된 모든 농작물·품종별 표준 생육과정 적산온도 데이터 일괄 구성
  db.prepare("DELETE FROM standard_template WHERE template_id LIKE 'TPL-POT-%' OR template_id LIKE 'TPL-CAB-%'").run();

  const upsertTpl = db.prepare(`
    INSERT OR REPLACE INTO standard_template (
      template_id, group_id, crop_id, cultivar_id, system_id,
      bjd_code, sido, sigungu, eupmyeondong, step_order,
      item_type, item_category, item_code, item_name,
      target_gdd_ratio, target_pgdd, days_from_start, tolerance_days,
      guide_criteria, climate_countermeasure
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const allCultivars = db
    .prepare(
      `SELECT cv.cultivar_id, cv.cultivar_name, cv.maturity_type, cv.avg_growth_days,
              c.crop_id, c.crop_name, c.group_id
       FROM cultivar cv
       INNER JOIN crop c ON cv.crop_id = c.crop_id
       ORDER BY c.group_id ASC, c.crop_id ASC, cv.cultivar_id ASC`
    )
    .all() as Array<{
    cultivar_id: string;
    cultivar_name: string;
    maturity_type: string;
    avg_growth_days: number;
    crop_id: string;
    crop_name: string;
    group_id: string;
  }>;

  for (const cv of allCultivars) {
    const sysRow = db
      .prepare('SELECT system_id, required_gdd FROM cropping_system WHERE crop_id = ? ORDER BY system_id ASC LIMIT 1')
      .get(cv.crop_id) as { system_id: string; required_gdd: number } | undefined;

    const systemId = sysRow?.system_id || `SYS-${cv.crop_id.replace(/^CRP-/, '')}-STD`;
    if (!sysRow) {
      insertSysIgnore.run(
        systemId,
        cv.crop_id,
        `${cv.crop_name} 표준 노지재배`,
        'OPEN_FIELD',
        '4월 / 9월',
        '6월 / 11월',
        0,
        5.0,
        800,
        1200,
        15,
        22,
        5,
        26,
        2,
        29
      );
    }

    // 품종 조·중·만생종 특성에 따른 적산온도 스케일 팩터
    const maturityScale =
      cv.cultivar_id === 'CV-DUBAEK'
        ? 1.12
        : cv.cultivar_id === 'CV-SEOLBONG'
        ? 0.89
        : cv.cultivar_id === 'CV-BRMP'
        ? 1.02
        : cv.cultivar_id === 'CV-HPRM'
        ? 0.98
        : cv.cultivar_id === 'CV-HPRG'
        ? 1.01
        : cv.cultivar_id === 'CV-FALB'
        ? 1.03
        : 1.0;

    type StepSeed = {
      order: number;
      type: 'WORK' | 'STAGE';
      cat: 'MAJOR' | 'DETAIL';
      code: string;
      name: string;
      ratio: number;
      pgdd: number;
      days: number;
      tol: number;
      guide: string;
      counter: string;
    };

    let steps: StepSeed[] = [];

    if (cv.crop_id === 'CRP-CABBAGE') {
      // 배추 (불암3호, 불암플러스, 휘파람, 휘파람골드, 가을베타 등) — 9단계 생육과정 및 적산온도
      const totalGdd = Math.round(785 * maturityScale);
      steps = [
        {
          order: 1,
          type: 'WORK',
          cat: 'MAJOR',
          code: 'PRC-03',
          name: '밑거름(완숙퇴비·기비) 시비 및 로터리 경운',
          ratio: 0,
          pgdd: 0,
          days: -10,
          tol: 3,
          guide: `[${cv.cultivar_name}] 정식 10일 전 완숙퇴비·석회고토·붕사 및 밑거름 복합비료 살포 후 로터리 경운`,
          counter: '[사전] 집중호우 대비 배수로 30cm 이상 깊게 조성 및 두둑 유실 방지',
        },
        {
          order: 2,
          type: 'WORK',
          cat: 'MAJOR',
          code: 'PRC-08',
          name: '본밭 정식 (육묘 모종 아주심기 및 활착 관수)',
          ratio: 0,
          pgdd: 0,
          days: 0,
          tol: 2,
          guide: `[${cv.cultivar_name}] 본엽 3~4매 건묘를 흐린 날 오후 본밭 재식거리에 맞춰 정식하고 충분히 관수`,
          counter: '[즉시] 고온기 정식 시 활착 지연 예방을 위해 스프링클러 관수 및 차광 관리',
        },
        {
          order: 3,
          type: 'STAGE',
          cat: 'MAJOR',
          code: 'PRC-10',
          name: '활착기(뿌리내림) 확인 및 결주 보식',
          ratio: 0.17,
          pgdd: Math.round(136 * maturityScale),
          days: 8,
          tol: 2,
          guide: `[${cv.cultivar_name}] 정식 후 새 뿌리가 본밭에 내려 중심 어린잎이 꼿꼿하게 생장을 시작하는 상태 (결주 보식 병행)`,
          counter: '[사후] 가뭄·고온으로 활착 지연 시 아미노산 발근제 또는 요소 0.2%액 관주',
        },
        {
          order: 4,
          type: 'WORK',
          cat: 'DETAIL',
          code: 'PRC-13',
          name: '1차 웃거름 (초기 생육 촉진 추비)',
          ratio: 0.28,
          pgdd: Math.round(220 * maturityScale),
          days: 15,
          tol: 3,
          guide: `[${cv.cultivar_name}] 정식 15일경 외엽 확장 촉진을 위해 포기 사이에 NK복합비료 1차 추비 시비`,
          counter: '[사전] 강우 직전 시비 지양, 토양 수분이 적정할 때 시비하여 비료 유실 방지',
        },
        {
          order: 5,
          type: 'STAGE',
          cat: 'MAJOR',
          code: 'PRC-17',
          name: '중기 왕성 생장기 (줄기 신장 · 외엽 번무기)',
          ratio: 0.42,
          pgdd: Math.round(330 * maturityScale),
          days: 25,
          tol: 3,
          guide: `[${cv.cultivar_name}] 바깥잎(외엽)이 최대치로 전개되며 결구를 위한 광합성 동화양분을 집중 축적하는 단계`,
          counter: '[영양관리] 일조 부족 시 칼슘·미량요소 엽면시비로 잎 조직 강화',
        },
        {
          order: 6,
          type: 'STAGE',
          cat: 'MAJOR',
          code: 'PRC-19',
          name: '결구 · 구비대 · 괴경비대 · 착과 시작 확인',
          ratio: 0.55,
          pgdd: Math.round(432 * maturityScale),
          days: 34,
          tol: 3,
          guide: `[${cv.cultivar_name}] 외엽 확보 후 중심부 속잎이 서로 포개지며 배추 통(결구)이 뭉치기 시작하는 핵심 단계`,
          counter: '[즉시] 결구 초기 칼슘 결핍(꿀통배추·팁번) 예방을 위해 염화칼슘 0.3%액 5일 간격 2~3회 엽면살포',
        },
        {
          order: 7,
          type: 'WORK',
          cat: 'DETAIL',
          code: 'PRC-20',
          name: '2차 웃거름 (결구·비대기 추비 및 칼슘·붕소 엽면시비)',
          ratio: 0.72,
          pgdd: Math.round(565 * maturityScale),
          days: 45,
          tol: 3,
          guide: `[${cv.cultivar_name}] 결구 비대 최성기 다량 양분 소모에 맞춘 2차 NK복합비료 추비 및 붕소·칼슘 보충`,
          counter: '[수분·병해관리] 결구기 건조 시 구 비대 불량 발생하므로 적습 유지 및 무름병·노균병 방제',
        },
        {
          order: 8,
          type: 'STAGE',
          cat: 'MAJOR',
          code: 'PRC-28',
          name: '수확 적기 도달 확인 (목표 유효적산온도 PGDD · 숙기 판정)',
          ratio: 0.93,
          pgdd: Math.round(733 * maturityScale),
          days: 72,
          tol: 3,
          guide: `[${cv.cultivar_name}] 배추 통을 눌렀을 때 단단하게 결구율이 85~90% 이상 차오르고 목표 적산온도에 근접한 상태`,
          counter: '[사전] 영하(-2℃ 이하) 한파 예보 시 부직포 피복 또는 외엽 묶어주기로 동해 방지',
        },
        {
          order: 9,
          type: 'WORK',
          cat: 'MAJOR',
          code: 'PRC-29',
          name: '본 수확 작업 및 현장 예건·큐어링(상처 치유)',
          ratio: 1.0,
          pgdd: totalGdd,
          days: 78,
          tol: 4,
          guide: `[${cv.cultivar_name}] 누적 적산온도 ${totalGdd}℃ 도달 후 맑은 날 수확하여 보호 겉잎 2~3매를 남기고 출하·저장`,
          counter: '[사후] 급격한 기온 하강 시 조기 수확 및 저온저장고 예냉 입고',
        },
      ];
    } else if (cv.crop_id === 'CRP-POTATO') {
      // 감자 (수미, 두백, 설봉) — 9단계 생육과정 및 적산온도
      const totalGdd = Math.round(1000 * maturityScale);
      steps = [
        {
          order: 1,
          type: 'WORK',
          cat: 'DETAIL',
          code: 'PRC-02',
          name: '토양개량제(석회·규산·칼슘) 시비 및 심경',
          ratio: 0,
          pgdd: 0,
          days: -16,
          tol: 3,
          guide: `[${cv.cultivar_name}] 파종 2주 전 토양 산도(pH 5.5~6.2) 및 칼슘 보충을 위한 토양개량제 시비 후 깊이갈이`,
          counter: '[토양개선] 더뎅이병 예방을 위해 미숙유기물 및 과도한 석회 시용 지양',
        },
        {
          order: 2,
          type: 'WORK',
          cat: 'MAJOR',
          code: 'PRC-05',
          name: '토양살충·제초제 처리 및 비닐멀칭 피복',
          ratio: 0,
          pgdd: 0,
          days: -3,
          tol: 2,
          guide: `[${cv.cultivar_name}] 완숙퇴비 및 감자 전용 기비 살포 후 두둑 성형·토양살충제 처리 및 흑색비닐 멀칭`,
          counter: '[물리적] 봄철 초기 지온 확보(+1.5~2℃) 및 토양 수분 보존',
        },
        {
          order: 3,
          type: 'WORK',
          cat: 'MAJOR',
          code: 'PRC-07',
          name: '본밭 파종 (직파 · 씨감자 · 마늘 종구 파종)',
          ratio: 0,
          pgdd: 0,
          days: 0,
          tol: 2,
          guide: `[${cv.cultivar_name}] 최아(싹틔우기) 및 절단면 큐어링이 완료된 씨감자를 본밭 이랑에 적정 깊이로 파종`,
          counter: '[사전] 파종기 저온(5℃ 이하)·과습 시 씨감자 부패 방지를 위해 배수로 정비',
        },
        {
          order: 4,
          type: 'STAGE',
          cat: 'MAJOR',
          code: 'PRC-09',
          name: '발아 및 출아기 확인 (비닐 구멍 뚫기)',
          ratio: 0.12,
          pgdd: Math.round(120 * maturityScale),
          days: 18,
          tol: 3,
          guide: `[${cv.cultivar_name}] 씨감자에서 싹이 올라와 멀칭 비닐에 닿기 전 비닐 구멍을 뚫어주고 밑둥 복토(1차 북주기)`,
          counter: '[즉시] 한낮 고온 시 비닐 내부 싹 고온장해 방지를 위해 조기 통기 구멍 확보 및 늦서리 대비 복토',
        },
        {
          order: 5,
          type: 'STAGE',
          cat: 'MAJOR',
          code: 'PRC-12',
          name: '초기 영양생장기 (본엽 전개 및 뿌리권 확장)',
          ratio: 0.25,
          pgdd: Math.round(250 * maturityScale),
          days: 32,
          tol: 3,
          guide: `[${cv.cultivar_name}] 출아 후 건실한 줄기 2~3개만 남기고 눈따기(적아) 및 초기 잡초·배토 관리`,
          counter: '[기계적] 강풍에 의한 줄기 쓰러짐 방지를 위해 밑둥 흙 모아주기',
        },
        {
          order: 6,
          type: 'STAGE',
          cat: 'MAJOR',
          code: 'PRC-18',
          name: '화아분화 · 개화기 및 수정 확인',
          ratio: 0.42,
          pgdd: Math.round(420 * maturityScale),
          days: 48,
          tol: 3,
          guide: `[${cv.cultivar_name}] 지상부 줄기 생장이 정점에 달하고 꽃봉오리 형성·개화와 함께 지하부 복지(기는줄기) 끝이 부풀기 시작하는 단계`,
          counter: '[양분전환] 질소 과다에 의한 도장(웃자람) 억제 및 필요 시 꽃따기로 지하부 양분 전류 유도',
        },
        {
          order: 7,
          type: 'STAGE',
          cat: 'MAJOR',
          code: 'PRC-19',
          name: '결구 · 구비대 · 괴경비대 · 착과 시작 확인',
          ratio: 0.62,
          pgdd: Math.round(620 * maturityScale),
          days: 65,
          tol: 3,
          guide: `[${cv.cultivar_name}] 지하부 감자 괴경(덩이줄기)이 본격적으로 비대하며 전분이 축적되는 핵심 생육단계`,
          counter: '[병해·수분관리] 괴경비대기 가뭄 시 관수 및 봄 장마 대비 배수로 정비·역병 선제 방제',
        },
        {
          order: 8,
          type: 'STAGE',
          cat: 'MAJOR',
          code: 'PRC-28',
          name: '수확 적기 도달 확인 (목표 유효적산온도 PGDD · 숙기 판정)',
          ratio: 0.9,
          pgdd: Math.round(900 * maturityScale),
          days: 88,
          tol: 4,
          guide: `[${cv.cultivar_name}] 지상부 잎·줄기가 서서히 황화되고 감자 표피(껍질)가 단단해지며 목표 적산온도에 도달하는 단계`,
          counter: '[사전] 장마철 집중호우 예보 시 토양 과습에 의한 괴경 부패 방지를 위해 조기 수확 일정 확정',
        },
        {
          order: 9,
          type: 'WORK',
          cat: 'MAJOR',
          code: 'PRC-29',
          name: '본 수확 작업 및 현장 예건·큐어링(상처 치유)',
          ratio: 1.0,
          pgdd: totalGdd,
          days: 100,
          tol: 5,
          guide: `[${cv.cultivar_name}] 누적 적산온도 ${totalGdd}℃ 도달 후 맑은 날 수확하여 그늘에서 통풍 예건(큐어링) 후 크기별 선별·저장`,
          counter: '[사후] 수확 직후 직사광선 노출(녹화) 차단 및 상처 치유 후 저온저장',
        },
      ];
    } else if (cv.crop_id === 'CRP-LETTUCE') {
      // 상추 (청치마상추) — 8단계 생육과정 및 적산온도
      const totalGdd = 520;
      steps = [
        {
          order: 1,
          type: 'WORK',
          cat: 'MAJOR',
          code: 'PRC-03',
          name: '밑거름(완숙퇴비·기비) 시비 및 로터리 경운',
          ratio: 0,
          pgdd: 0,
          days: -7,
          tol: 2,
          guide: `[${cv.cultivar_name}] 정식 7일 전 완숙퇴비 및 엽채류 전용 기비 시용 후 두둑 성형 및 멀칭 피복`,
          counter: '[사전] 배수 불량 시 뿌리썩음 및 균핵병 발생이 쉬우므로 높은 이랑 조성',
        },
        {
          order: 2,
          type: 'WORK',
          cat: 'MAJOR',
          code: 'PRC-08',
          name: '본밭 정식 (육묘 모종 아주심기 및 활착 관수)',
          ratio: 0,
          pgdd: 0,
          days: 0,
          tol: 2,
          guide: `[${cv.cultivar_name}] 본엽 4~5매 우량 포트묘를 재식거리에 맞춰 생장점이 묻히지 않게 정식 후 관수`,
          counter: '[즉시] 정식 직후 강한 햇볕 시 위조(시듦) 방지를 위해 충분한 활착 관수 실시',
        },
        {
          order: 3,
          type: 'STAGE',
          cat: 'MAJOR',
          code: 'PRC-10',
          name: '활착기(뿌리내림) 확인 및 결주 보식',
          ratio: 0.16,
          pgdd: 85,
          days: 6,
          tol: 2,
          guide: `[${cv.cultivar_name}] 정식 5~7일 후 새 흰 뿌리가 내리고 신초(새잎)가 전개되기 시작하는 활착 완료 단계`,
          counter: '[사후] 초기 활착 지연 시 발근 촉진 아미노산 액비 관주',
        },
        {
          order: 4,
          type: 'STAGE',
          cat: 'MAJOR',
          code: 'PRC-12',
          name: '초기 영양생장기 (본엽 전개 및 뿌리권 확장)',
          ratio: 0.32,
          pgdd: 165,
          days: 14,
          tol: 2,
          guide: `[${cv.cultivar_name}] 본엽이 8~10매 이상 빠르게 전개되며 잎 면적과 포기 볼륨이 확대되는 단계`,
          counter: '[병해충예방] 진딧물·총채벌레 및 초기 노균병 예찰 및 친환경 방제',
        },
        {
          order: 5,
          type: 'WORK',
          cat: 'DETAIL',
          code: 'PRC-13',
          name: '1차 웃거름 (초기 생육 촉진 추비)',
          ratio: 0.48,
          pgdd: 250,
          days: 20,
          tol: 2,
          guide: `[${cv.cultivar_name}] 연속 수확을 위한 초세 유지 및 잎 두께 향상을 위해 질소·칼륨·칼슘 추비 관주`,
          counter: '[영양관리] 고온기 칼슘 결핍(팁번·잎끝마름) 예방용 액상칼슘 병행 공급',
        },
        {
          order: 6,
          type: 'STAGE',
          cat: 'MAJOR',
          code: 'PRC-17',
          name: '중기 왕성 생장기 (줄기 신장 · 외엽 번무기)',
          ratio: 0.65,
          pgdd: 340,
          days: 28,
          tol: 3,
          guide: `[${cv.cultivar_name}] 엽장이 규격 크기(15~20cm)에 도달하여 1차 하엽 수확이 가능한 성엽 단계`,
          counter: '[환경관리] 25℃ 이상 고온 지속 시 꽃대 올라옴(추대) 및 쓴맛 증가 주의 (차광·환기)',
        },
        {
          order: 7,
          type: 'STAGE',
          cat: 'MAJOR',
          code: 'PRC-28',
          name: '수확 적기 도달 확인 (목표 유효적산온도 PGDD · 숙기 판정)',
          ratio: 0.88,
          pgdd: 460,
          days: 38,
          tol: 3,
          guide: `[${cv.cultivar_name}] 잎의 광택·두께·크기가 최상급 출하 규격에 도달하고 목표 적산온도에 도달한 상태`,
          counter: '[품질관리] 수확기 과습 시 무름병 우려가 있으므로 통풍 확보 및 노화 하엽 정리',
        },
        {
          order: 8,
          type: 'WORK',
          cat: 'MAJOR',
          code: 'PRC-29',
          name: '본 수확 작업 및 현장 예건·큐어링(상처 치유)',
          ratio: 1.0,
          pgdd: totalGdd,
          days: 45,
          tol: 3,
          guide: `[${cv.cultivar_name}] 누적 적산온도 ${totalGdd}℃ 기준 이른 아침 서늘할 때 수확하여 예냉 후 규격 포장 출하`,
          counter: '[사후] 수확 직후 호흡열 제거를 위한 예냉(4~5℃) 보관으로 신선도 유지',
        },
      ];
    } else {
      // 시금치 (포항초) 및 기타 작물 — 8단계 생육과정 및 적산온도
      const totalGdd = 610;
      steps = [
        {
          order: 1,
          type: 'WORK',
          cat: 'MAJOR',
          code: 'PRC-02',
          name: '토양개량제(석회·규산·칼슘) 시비 및 심경',
          ratio: 0,
          pgdd: 0,
          days: -10,
          tol: 3,
          guide: `[${cv.cultivar_name}] 시금치는 산성 토양에 매우 약하므로 파종 전 석회고토를 시용하여 pH 6.5~7.0으로 교정 후 로터리 경운`,
          counter: '[토양개선] 산성 토양 방치 시 발아 불량 및 뿌리 황화 발생하므로 반드시 산도 교정',
        },
        {
          order: 2,
          type: 'WORK',
          cat: 'MAJOR',
          code: 'PRC-07',
          name: '본밭 파종 (직파 · 씨감자 · 마늘 종구 파종)',
          ratio: 0,
          pgdd: 0,
          days: 0,
          tol: 2,
          guide: `[${cv.cultivar_name}] 침종(물불림) 처리한 종자를 본밭 두둑에 줄뿌림(조파) 또는 산파 후 1~1.5cm 복토·진압`,
          counter: '[사전] 파종 후 토양 건조 시 발아율이 급감하므로 파종 직후 가벼운 살수 관수 실시',
        },
        {
          order: 3,
          type: 'STAGE',
          cat: 'MAJOR',
          code: 'PRC-09',
          name: '발아 및 출아기 확인 (비닐 구멍 뚫기)',
          ratio: 0.12,
          pgdd: 75,
          days: 8,
          tol: 2,
          guide: `[${cv.cultivar_name}] 파종 7~10일 후 떡잎이 고르게 출아하고 본엽 1~2매가 나오기 시작하는 초기 발아 단계`,
          counter: '[즉시] 초기 입고병(잘록병) 및 거세미나방 예찰 관리',
        },
        {
          order: 4,
          type: 'WORK',
          cat: 'DETAIL',
          code: 'PRC-11',
          name: '솎아주기(간작·주간 확보) 및 1차 북주기(배토)',
          ratio: 0.25,
          pgdd: 150,
          days: 18,
          tol: 3,
          guide: `[${cv.cultivar_name}] 본엽 2~3매 시기에 밀식된 포기를 5~7cm 간격으로 솎아주어 채광·통풍 및 뿌리 발달 공간 확보`,
          counter: '[물리적] 밀식 방치 시 도장(웃자람) 및 노균병이 급증하므로 적기 솎음 수행',
        },
        {
          order: 5,
          type: 'STAGE',
          cat: 'MAJOR',
          code: 'PRC-12',
          name: '초기 영양생장기 (본엽 전개 및 뿌리권 확장)',
          ratio: 0.4,
          pgdd: 245,
          days: 28,
          tol: 3,
          guide: `[${cv.cultivar_name}] 본엽이 5~6매 이상 로제트형으로 넓게 퍼지며 직근(주뿌리)이 깊게 발달하는 단계`,
          counter: '[영양관리] 생육 초기 1차 웃거름(요소·NK복합비료) 소량 시비로 엽색 및 세력 확보',
        },
        {
          order: 6,
          type: 'WORK',
          cat: 'DETAIL',
          code: 'PRC-24',
          name: '월동기 피복·보온 관리 및 해빙기 생육재생기 관리',
          ratio: 0.62,
          pgdd: 380,
          days: 42,
          tol: 4,
          guide: `[${cv.cultivar_name}] 저온기·월동기 생육 유지 및 당도 축적을 위한 부직포 피복 관리 및 병해(노균병) 방제`,
          counter: '[보온·배수] 혹한기 동해·건조해 예방을 위한 부직포 피복 및 해빙기 습해 방지',
        },
        {
          order: 7,
          type: 'STAGE',
          cat: 'MAJOR',
          code: 'PRC-28',
          name: '수확 적기 도달 확인 (목표 유효적산온도 PGDD · 숙기 판정)',
          ratio: 0.88,
          pgdd: 540,
          days: 54,
          tol: 3,
          guide: `[${cv.cultivar_name}] 초장 20~25cm 내외로 포기 밑둥이 붉고 단단하게 충실해지며 목표 적산온도에 도달한 상태`,
          counter: '[품질관리] 저온 경과로 당도가 충분히 오른 시점에 수확 일정 확정',
        },
        {
          order: 8,
          type: 'WORK',
          cat: 'MAJOR',
          code: 'PRC-29',
          name: '본 수확 작업 및 현장 예건·큐어링(상처 치유)',
          ratio: 1.0,
          pgdd: totalGdd,
          days: 60,
          tol: 4,
          guide: `[${cv.cultivar_name}] 누적 적산온도 ${totalGdd}℃ 도달 시 붉은 뿌리 목(근관부)을 붙여 수확한 뒤 황화 하엽 제거 및 단 묶음 출하`,
          counter: '[사후] 수확 후 수분 증발 차단을 위해 저온 예냉 및 통기성 포장 출하',
        },
      ];
    }

    const defaultRegion =
      cv.crop_id === 'CRP-CABBAGE'
        ? { bjd_code: '4313010700', sido: '충청북도', sigungu: '충주시', eupmyeondong: '단월동' }
        : cv.crop_id === 'CRP-POTATO'
        ? cv.cultivar_id === 'CV-DUBAEK'
          ? { bjd_code: '4827025000', sido: '경상남도', sigungu: '밀양시', eupmyeondong: '하남읍' }
          : cv.cultivar_id === 'CV-SEOLBONG'
          ? { bjd_code: '4150025000', sido: '경기도', sigungu: '이천시', eupmyeondong: '장호원읍' }
          : { bjd_code: '5176038000', sido: '강원특별자치도', sigungu: '평창군', eupmyeondong: '대관령면' }
        : cv.crop_id === 'CRP-LETTUCE'
        ? { bjd_code: '4423025300', sido: '충청남도', sigungu: '논산시', eupmyeondong: '연무읍' }
        : cv.crop_id === 'CRP-SPINACH'
        ? { bjd_code: '5013025900', sido: '제주특별자치도', sigungu: '서귀포시', eupmyeondong: '성산읍' }
        : { bjd_code: '4313010700', sido: '충청북도', sigungu: '충주시', eupmyeondong: '단월동' };

    for (const s of steps) {
      const seqStr = String(s.order).padStart(2, '0');
      const tplId = `TPL-${cv.group_id}-${cv.crop_id}-${cv.cultivar_id}-${seqStr}`;
      upsertTpl.run(
        tplId,
        cv.group_id,
        cv.crop_id,
        cv.cultivar_id,
        systemId,
        defaultRegion.bjd_code,
        defaultRegion.sido,
        defaultRegion.sigungu,
        defaultRegion.eupmyeondong,
        s.order,
        s.type,
        s.cat,
        s.code,
        s.name,
        s.ratio,
        s.pgdd,
        s.days,
        s.tol,
        s.guide,
        s.counter
      );
    }
  }

  // 가을배추(CRP-CABBAGE)의 모든 생육 과정 적산온도 템플릿 재배지 정보를 "충청북도 충주시 단월동"으로 통일 보장
  db.prepare(`
    UPDATE standard_template
    SET bjd_code = '4313010700',
        sido = '충청북도',
        sigungu = '충주시',
        eupmyeondong = '단월동'
    WHERE crop_id = 'CRP-CABBAGE' OR system_id LIKE 'SYS-CAB%'
  `).run();
  db.prepare(`
    UPDATE standard_template
    SET bjd_code = COALESCE(NULLIF(bjd_code, ''), '4313010700'),
        sido = COALESCE(NULLIF(sido, ''), '충청북도'),
        sigungu = COALESCE(NULLIF(sigungu, ''), '충주시'),
        eupmyeondong = COALESCE(NULLIF(eupmyeondong, ''), '단월동')
    WHERE sido IS NULL OR sido = '' OR sigungu IS NULL OR sigungu = '' OR eupmyeondong IS NULL OR eupmyeondong = ''
  `).run();
}

function ensureGrowthTypeCodes() {
  const cols = db.prepare('PRAGMA table_info(growth_type_code)').all() as Array<{ name: string }>;
  const colNames = new Set(cols.map((c) => c.name));
  if (!colNames.has('stage_color')) {
    db.exec("ALTER TABLE growth_type_code ADD COLUMN stage_color TEXT DEFAULT '#22a559'");
  }
  if (!colNames.has('icon_type')) {
    db.exec("ALTER TABLE growth_type_code ADD COLUMN icon_type TEXT DEFAULT 'leaf'");
  }

  // 기존 WORK / STAGE 구형 구분 코드만 제거하고, 6대 단계 구분 기초 코드가 비어 있을 때만 초기 시드 세팅 (사용자 수정 내용 보존)
  db.prepare("DELETE FROM growth_type_code WHERE type_code IN ('WORK', 'STAGE')").run();

  const existingCount = (db.prepare('SELECT COUNT(*) as cnt FROM growth_type_code').get() as { cnt: number }).cnt;
  if (existingCount >= 6) return;

  const insType = db.prepare(`
    INSERT OR REPLACE INTO growth_type_code (type_code, type_name, stage_color, icon_type, description, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const initialTypes: Array<[string, string, string, string, string, number]> = [
    [
      'STG-PREP',
      '재배 준비',
      '#6b7c93',
      'sprout',
      '포장 정리, 토양 개량(석회·유박·밑거름 시비), 이랑 만들기 및 비닐멀칭 피복 등 파종·정식 전 토양 기반을 조성하는 단계 구분 코드',
      1,
    ],
    [
      'STG-NURSERY',
      '파종·육묘',
      '#2563eb',
      'seedlings',
      '파종(종자 준비·소독), 육묘 관리(관수·온도), 묘 관리(시비·병해충·외기 순화) 등 건묘를 육성하는 파종 및 육묘 단계 구분 코드',
      2,
    ],
    [
      'STG-PLANT',
      '정식·활착',
      '#0d9488',
      'plant',
      '정식(본밭 이식) 및 활착 관리(활착 관수·차광·결주 보식) 등 육묘된 모종을 본밭에 심고 초기 뿌리내림을 유도하는 단계 구분 코드',
      3,
    ],
    [
      'STG-GROWTH',
      '생육 관리',
      '#22a559',
      'leaf',
      '생장 관리(1·2차 웃거름 시비·관수), 줄기·잎 관리(정지·유인·결구 관리), 생육 점검(생육량·생육상태) 등 본밭 생육 집중 관리 단계 구분 코드',
      4,
    ],
    [
      'STG-PEST',
      '병해충 예찰',
      '#d4941e',
      'shield',
      '병해충 예찰(정기 점검), 방제(필요 시 적기 약제 살포), 예방 관리(배수·환경·위생) 등 생육 전 기간 병해충 예방 및 방제 단계 구분 코드',
      5,
    ],
    [
      'STG-HARVEST',
      '수확',
      '#d96b38',
      'harvest',
      '수확(적기 판단 및 본 수확) 및 수확 후 처리(예건·선별·규격 포장·저온저장) 등 수확 및 출하 마감 단계 구분 코드',
      6,
    ],
  ];

  for (const [code, name, color, icon, desc, order] of initialTypes) {
    insType.run(code, name, color, icon, desc, order);
  }
}

function ensureGrowthProcessCodes() {
  // 기존 구형 코드(OP_*, STG_*)가 남아있는 경우 표준 순차 코드(PRC-01 ~ PRC-30) 체계로 일괄 갱신
  const hasNewCodes = db
    .prepare("SELECT COUNT(*) as cnt FROM growth_process_code WHERE process_code = 'PRC-30'")
    .get() as { cnt: number };
  if (hasNewCodes.cnt === 0) {
    db.prepare("DELETE FROM growth_process_code WHERE process_code LIKE 'OP_%' OR process_code LIKE 'STG_%'").run();
  }

  const insertCode = db.prepare(
    'INSERT OR REPLACE INTO growth_process_code (process_code, process_name, process_type, description, sort_order) VALUES (?, ?, ?, ?, ?)'
  );

  // [1단계: 재배 준비 (STG-PREP)]
  insertCode.run('PRC-01', '토양검정 및 예정지 정리', 'STG-PREP', '파종·정식 3~4주 전 토양 시료 채취·검정(pH, 유기물, 인산, 칼륨, EC 등) 및 전작물 잔재물 제거', 1);
  insertCode.run('PRC-02', '토양개량제(석회·규산·칼슘) 시비 및 심경', 'STG-PREP', '파종·정식 2~3주 전 토양 산도(pH) 교정 및 지력 증진을 위한 석회고토·규산질·칼슘제 살포 후 깊이갈이', 2);
  insertCode.run('PRC-03', '밑거름(완숙퇴비·기비) 시비 및 로터리 경운', 'STG-PREP', '파종·정식 1~2주 전 작물별 표준 완숙퇴비 및 밑거름용 복합비료 살포 후 토양 입자를 잘게 부수는 로터리 경운', 3);
  insertCode.run('PRC-04', '두둑(이랑) 성형 및 배수로 조성', 'STG-PREP', '작물별 재식거리에 맞춰 두둑(이랑)을 만들고 집중호우·습해 예방을 위한 고랑 및 외곽 배수로를 깊게 조성', 4);
  insertCode.run('PRC-05', '토양살충·제초제 처리 및 비닐멀칭 피복', 'STG-PREP', '두둑 표면에 토양해충 입제 및 발아전 제초제를 처리한 후 지온 확보·수분 유지·잡초 억제용 비닐멀칭 피복', 5);

  // [2단계: 파종·육묘 (STG-NURSERY)]
  insertCode.run('PRC-06', '종자·종구 소독, 최아(싹틔우기) 및 육묘 관리', 'STG-NURSERY', '종자·씨감자·종구 소독 및 최아 처리, 또는 육묘상 파종 후 건묘 육성 및 정식 전 묘 순화(경화) 관리', 6);
  insertCode.run('PRC-07', '본밭 파종 (직파 · 씨감자 · 마늘 종구 파종)', 'STG-NURSERY', '무·시금치·콩 등 직파 작물의 종자 파종 또는 감자·마늘 등 영양번식 종구를 본밭 이랑에 파종·복토하는 작업', 7);

  // [3단계: 정식·활착 (STG-PLANT)]
  insertCode.run('PRC-08', '본밭 정식 (육묘 모종 아주심기 및 활착 관수)', 'STG-PLANT', '배추·상추·고추·양파·과채류 등 육묘된 건묘를 본밭 재식거리에 맞춰 심고 뿌리 밀착을 위해 충분히 관수하는 작업', 8);
  insertCode.run('PRC-09', '발아 및 출아기 확인 (비닐 구멍 뚫기)', 'STG-PLANT', '파종된 종자나 종구에서 싹이 터서 지면 위로 올라오는 초기 생육단계 (멀칭 비닐 유인·구멍 뚫어주기 병행)', 9);
  insertCode.run('PRC-10', '활착기(뿌리내림) 확인 및 결주 보식', 'STG-PLANT', '정식 후 7~10일경 새 뿌리가 본밭에 내려 중심 어린잎이 꼿꼿하게 생장을 시작하는 단계 (고사 묘 보식 병행)', 10);

  // [4단계: 생육 관리 (STG-GROWTH) 및 5단계: 병해충 예찰 (STG-PEST)]
  insertCode.run('PRC-11', '솎아주기(간작·주간 확보) 및 1차 북주기(배토)', 'STG-GROWTH', '직파·출아 작물의 밀식 묘를 솎아 적정 주수를 확보하고 포기 밑둥에 흙을 모아주어 쓰러짐을 방지하는 작업', 11);
  insertCode.run('PRC-12', '초기 영양생장기 (본엽 전개 및 뿌리권 확장)', 'STG-GROWTH', '본엽 수가 빠르게 증가하며 뿌리권이 넓어지고 초기 광합성 기반이 형성되는 생육단계', 12);
  insertCode.run('PRC-13', '1차 웃거름 (초기 생육 촉진 추비)', 'STG-GROWTH', '초기 영양생장 촉진을 위해 포기 사이나 고랑에 질소·칼륨 위주 1차 추비(NK복합비료·요소 등)를 시비하는 작업', 13);
  insertCode.run('PRC-14', '1차 중경·제초 및 고랑 잡초관리', 'STG-GROWTH', '고랑과 포기 주변의 초기 잡초를 제거하고 굳어진 겉흙을 부드럽게 긁어주어 뿌리 통기성을 높이는 작업', 14);
  insertCode.run('PRC-15', '지주대 설치·유인 줄매기 및 초기 곁순(측지) 정리', 'STG-GROWTH', '고추·과채류 등의 쓰러짐 방지용 지주대 설치·유인 작업 및 방아다리 아래 불필요한 곁순(측지)·하엽 제거', 15);
  insertCode.run('PRC-16', '초기 병해충 예방 방제 (진딧물·총채벌레·잘록병)', 'STG-PEST', '생육 초기 바이러스 매개충(진딧물·총채벌레), 벼룩잎벌레, 거세미나방 및 초기 입고병(잘록병) 선제 방제', 16);
  insertCode.run('PRC-17', '중기 왕성 생장기 (줄기 신장 · 외엽 번무기)', 'STG-GROWTH', '줄기와 바깥잎(외엽)이 최대치로 자라며 이후 결구·구비대·착과를 위한 동화양분을 집중 축적하는 생육단계', 17);
  insertCode.run('PRC-18', '화아분화 · 개화기 및 수정 확인', 'STG-GROWTH', '과채류·고추·두류·서류 등에서 꽃눈이 분화·개화하고 수정이 이루어지는 생식생장 전환 단계', 18);
  insertCode.run('PRC-19', '결구 · 구비대 · 괴경비대 · 착과 시작 확인', 'STG-GROWTH', '엽채류의 속잎 결구 시작, 근채·구근·서류의 지하부 비대 시작, 과채류의 초기 착과가 확인되는 핵심 생육단계', 19);
  insertCode.run('PRC-20', '2차 웃거름 (결구·비대기 추비 및 칼슘·붕소 엽면시비)', 'STG-GROWTH', '다량의 양분이 소모되는 결구·비대·착과기에 맞춘 2차 추비 및 생리장해 예방용 칼슘·붕소 엽면살포 작업', 20);
  insertCode.run('PRC-21', '2차 북주기(배토)·웃자람 억제 및 적엽·적과(열매솎기)', 'STG-GROWTH', '노출된 뿌리·감자 괴경의 녹화 방지용 2차 배토, 통풍·채광 개선용 노화 하엽 제거 및 기형과·종순(마늘쫑) 제거', 21);
  insertCode.run('PRC-22', '중기·장마기 병해충 집중 방제 (무름병·역병·탄저병·나방류)', 'STG-PEST', '고온다습·장마기 급증하는 무름병·노균병·역병·탄저병 및 파밤나방·배추좀나방 등 중기 주요 병해충 집중 방제', 22);
  insertCode.run('PRC-23', '생육 중기 수분 집중 관리 (가뭄 관수 및 폭우 배수)', 'STG-GROWTH', '결구·비대기 가뭄 시 적정 수분 공급을 위한 점적·스프링클러 관수 및 집중호우 시 고랑 물빼기 작업', 23);
  insertCode.run('PRC-24', '월동기 피복·보온 관리 및 해빙기 생육재생기 관리', 'STG-GROWTH', '월동작물(마늘·양파·시금치 등) 동해 예방용 부직포·비닐 피복 및 봄철 해빙기 피복 제거·뿌리 들뜸 답압 관리', 24);
  insertCode.run('PRC-25', '결구·비대·과실 성숙 후기 (등숙 · 착색 · 당도축적기)', 'STG-GROWTH', '결구 내부가 단단히 차오르거나 지하부 구근·괴경 및 과실의 크기·무게·당도·색택이 완성되는 후기 생육단계', 25);
  insertCode.run('PRC-26', '3차 웃거름 (후기 초세 유지 추비) 및 품질향상 영양제 처리', 'STG-GROWTH', '장기 생육 작물의 후기 세력 유지용 3차 추비 및 저장성·착색·당도 향상을 위한 칼륨·인산가리 엽면시비 작업', 26);
  insertCode.run('PRC-27', '수확 전 마감 방제(PLS 준수) 및 동해·도복 방지 관리', 'STG-PEST', '농약안전사용기준(PLS 수확 전 사용일수)을 엄수한 마감 방제 및 한파 대비 배추 묶어주기·쓰러짐 방지 관리', 27);

  // [6단계: 수확 (STG-HARVEST)]
  insertCode.run('PRC-28', '수확 적기 도달 확인 (목표 유효적산온도 PGDD · 숙기 판정)', 'STG-HARVEST', '작형별 목표 누적 유효적산온도(PGDD) 도달 여부와 외관 성숙도(결구율 85~90%, 지상부 황화 등)를 종합 판정하는 단계', 28);
  insertCode.run('PRC-29', '본 수확 작업 및 현장 예건·큐어링(상처 치유)', 'STG-HARVEST', '맑은 날 적기 수확을 실시하고 감자·마늘·양파 등은 수확 직후 통풍 건조(예건·큐어링)로 저장 중 부패를 예방하는 작업', 29);
  insertCode.run('PRC-30', '선별 · 규격 포장 · 출하(저장) 및 수확 후 포장 정리', 'STG-HARVEST', '등급별 선별·규격 포장·출하(저온저장) 후 차기 작기 전염원 차단을 위해 폐비닐 및 작물 잔재물을 정리하는 최종 마감 작업', 30);

  // 기존 standard_template 의 구형 코드(OP_*, STG_*)도 신규 표준 코드(PRC-01 ~ PRC-30)로 매핑 업데이트
  const codeMap: [string, string][] = [
    ['OP_SOIL_AMEND', 'PRC-02'],
    ['OP_SOIL_PREP', 'PRC-03'],
    ['OP_PLOW_MULCH', 'PRC-05'],
    ['OP_SOWING', 'PRC-07'],
    ['OP_PLANTING', 'PRC-08'],
    ['STG_EMERGENCE', 'PRC-09'],
    ['STG_ROOTING', 'PRC-10'],
    ['OP_TOPDRESS_1', 'PRC-13'],
    ['OP_WEED_1', 'PRC-14'],
    ['STG_HEADING_START', 'PRC-19'],
    ['OP_TOPDRESS_2', 'PRC-20'],
    ['OP_PEST_1', 'PRC-22'],
    ['OP_DRAIN_PEST', 'PRC-22'],
    ['STG_HARVEST_READY', 'PRC-28'],
    ['OP_HARVEST', 'PRC-29'],
  ];
  const updateTplCode = db.prepare('UPDATE standard_template SET item_code = ? WHERE item_code = ?');
  for (const [oldCode, newCode] of codeMap) {
    updateTplCode.run(newCode, oldCode);
  }
}

function ensureAdditionalLeafCrops() {
  const insertCropIgnore = db.prepare(
    'INSERT OR IGNORE INTO crop (crop_id, group_id, crop_name, scientific_name, description) VALUES (?, ?, ?, ?, ?)'
  );
  insertCropIgnore.run('CRP-LETTUCE', 'GRP-LEAF', '상추', 'Lactuca sativa', '엽채류 대표 단기 수확 작물 (생육적온 15~20℃, 고온기 추대 주의)');
  insertCropIgnore.run('CRP-SPINACH', 'GRP-LEAF', '시금치', 'Spinacia oleracea', '저온성 엽채류 대표 작물 (생육적온 15~20℃, 내한성 강함)');

  const insertCultivarIgnore = db.prepare(
    'INSERT OR IGNORE INTO cultivar (cultivar_id, crop_id, cultivar_name, maturity_type, avg_growth_days, characteristics) VALUES (?, ?, ?, ?, ?, ?)'
  );
  insertCultivarIgnore.run('CV-CHEONGCHIMA', 'CRP-LETTUCE', '청치마상추', '조생종', 45, '잎이 부드럽고 수확 기간이 긴 대표 잎상추 품종');
  insertCultivarIgnore.run('CV-POHANGCHO', 'CRP-SPINACH', '포항초 (재래종)', '중생종', 60, '노지 월동 및 가을재배용 내한성·당도 우수 품종');

  const insertSystemIgnore = db.prepare(`
    INSERT OR IGNORE INTO cropping_system (
      system_id, crop_id, system_name, cultivation_method, sowing_months, harvest_months,
      is_overwintering, base_temp_tb, required_gdd, required_raw_gdd,
      opt_temp_min, opt_temp_max, limit_temp_min, limit_temp_max, damage_temp_low, damage_temp_high
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertSystemIgnore.run('SYS-LET-SPR', 'CRP-LETTUCE', '노지 봄·가을재배', 'OPEN_FIELD', '4월 초순 / 9월 초순', '5월 중순 / 10월 하순', 0, 4.0, 520, 780, 15, 20, 4, 25, 2, 28);
  insertSystemIgnore.run('SYS-SPI-AUT', 'CRP-SPINACH', '노지 가을·월동재배', 'OPEN_FIELD', '9월 중순~10월 중순', '11월 하순~익년 2월', 1, 4.0, 610, 920, 15, 20, 4, 24, -5, 26);
}

function ensureCropAndCultivarExtraColumns() {
  const cropCols = new Set(
    (db.prepare('PRAGMA table_info(crop)').all() as Array<{ name: string }>).map((c) => c.name)
  );
  const cvCols = new Set(
    (db.prepare('PRAGMA table_info(cultivar)').all() as Array<{ name: string }>).map((c) => c.name)
  );
  const extraDefs: Array<[string, string]> = [
    ['min_temp', "TEXT DEFAULT '5'"],
    ['max_temp', "TEXT DEFAULT '25'"],
    ['opt_temp', "TEXT DEFAULT '15~20'"],
    ['planting_type', "TEXT DEFAULT '모종'"],
    ['germination_temp', "TEXT DEFAULT ''"],
  ];
  for (const [colName, colDef] of extraDefs) {
    if (!cropCols.has(colName)) {
      db.exec(`ALTER TABLE crop ADD COLUMN ${colName} ${colDef}`);
    }
    if (!cvCols.has(colName)) {
      db.exec(`ALTER TABLE cultivar ADD COLUMN ${colName} ${colDef}`);
    }
  }

  // 작물별 기본 온도 및 작물구분(씨/모종), 적정발아온도 초기값 세팅 (비어있는 경우에만 보정)
  const cropDefaults: Array<[string, string, string, string, '씨' | '모종', string]> = [
    ['CRP-CABBAGE', '5', '25', '18~20', '모종', ''],
    ['CRP-POTATO', '5', '28', '14~23', '씨', '15~20'],
    ['CRP-GARLIC', '4', '25', '18~20', '씨', '15~20'],
    ['CRP-ONION', '4', '25', '15~20', '모종', ''],
    ['CRP-RADISH', '8', '25', '17~20', '씨', '20~25'],
    ['CRP-PEPPER', '10', '30', '23~28', '모종', ''],
    ['CRP-LETTUCE', '4', '25', '15~20', '모종', ''],
    ['CRP-SPINACH', '4', '24', '15~20', '씨', '15~20'],
  ];

  const updCrop = db.prepare(`
    UPDATE crop
    SET min_temp = CASE WHEN min_temp IS NULL OR min_temp = '' THEN ? ELSE min_temp END,
        max_temp = CASE WHEN max_temp IS NULL OR max_temp = '' THEN ? ELSE max_temp END,
        opt_temp = CASE WHEN opt_temp IS NULL OR opt_temp = '' THEN ? ELSE opt_temp END,
        planting_type = CASE WHEN planting_type IS NULL OR planting_type = '' OR (planting_type = '모종' AND (germination_temp IS NULL OR germination_temp = '') AND crop_id IN ('CRP-POTATO', 'CRP-GARLIC', 'CRP-RADISH', 'CRP-SPINACH')) THEN ? ELSE planting_type END,
        germination_temp = CASE WHEN (germination_temp IS NULL OR germination_temp = '') AND ? = '씨' THEN ? ELSE germination_temp END
    WHERE crop_id = ?
  `);

  const updCv = db.prepare(`
    UPDATE cultivar
    SET min_temp = CASE WHEN min_temp IS NULL OR min_temp = '' THEN ? ELSE min_temp END,
        max_temp = CASE WHEN max_temp IS NULL OR max_temp = '' THEN ? ELSE max_temp END,
        opt_temp = CASE WHEN opt_temp IS NULL OR opt_temp = '' THEN ? ELSE opt_temp END,
        planting_type = CASE WHEN planting_type IS NULL OR planting_type = '' OR (planting_type = '모종' AND (germination_temp IS NULL OR germination_temp = '') AND crop_id IN ('CRP-POTATO', 'CRP-GARLIC', 'CRP-RADISH', 'CRP-SPINACH')) THEN ? ELSE planting_type END,
        germination_temp = CASE WHEN (germination_temp IS NULL OR germination_temp = '') AND ? = '씨' THEN ? ELSE germination_temp END
    WHERE crop_id = ?
  `);

  for (const [cropId, minT, maxT, optT, pType, germT] of cropDefaults) {
    updCrop.run(minT, maxT, optT, pType, pType, germT, cropId);
    updCv.run(minT, maxT, optT, pType, pType, germT, cropId);
  }
}

function seedInitialData() {
  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM crop_group').get() as { cnt: number };
  if (countRow.cnt > 0) return;

  // 1. 1단계 작물군 시드
  const insertGroup = db.prepare(
    'INSERT INTO crop_group (group_id, group_name, description, icon_name, sort_order) VALUES (?, ?, ?, ?, ?)'
  );
  insertGroup.run('GRP-FOOD', '식량작물 (서류·곡류)', '감자, 고구마, 메밀, 벼 등 적산온도 기반 주곡 및 구황작물', 'Wheat', 1);
  insertGroup.run('GRP-LEAF', '엽채류 (잎채소)', '배추, 상추, 시금치, 양배추 등 정식·활착·결구 단계 관리 중심 작물', 'Leaf', 2);
  insertGroup.run('GRP-SPICE', '조미채소류 (양념류)', '마늘, 양파, 고추, 대파 등 노지 월동 및 장기 생육 관리 작물', 'Flame', 3);
  insertGroup.run('GRP-ROOT', '근채류 (뿌리채소)', '무, 당근, 우엉 등 토심·최저한계온도 및 비대기 수분 관리 작물', 'Carrot', 4);
  insertGroup.run('GRP-FRUIT', '과채류 (열매채소)', '토마토, 수박, 참외, 오이 등 개화·착과 적산온도 관리 작물', 'Apple', 5);

  // 2. 2단계 작물 시드
  const insertCrop = db.prepare(
    'INSERT INTO crop (crop_id, group_id, crop_name, scientific_name, description) VALUES (?, ?, ?, ?, ?)'
  );
  insertCrop.run('CRP-POTATO', 'GRP-FOOD', '감자', 'Solanum tuberosum', '특허 대표 예시 작물 (필요유효적산온도 1,000℃, 생육적온 14~23℃)');
  insertCrop.run('CRP-CABBAGE', 'GRP-LEAF', '배추', 'Brassica rapa subsp. pekinensis', '첨부 설계도(도1~도4) 대표 작물 (정식→활착→결구→수확 단계별 PGDD 관리)');
  insertCrop.run('CRP-GARLIC', 'GRP-SPICE', '마늘', 'Allium sativum', '특허 [0100] 대표 월동작물 (가을 파종 후 겨울 월동, 봄 수확)');
  insertCrop.run('CRP-ONION', 'GRP-SPICE', '양파', 'Allium cepa', '특허 [0100] 노지 월동작물 (저온장해 예외/조절 파라미터 적용)');
  insertCrop.run('CRP-RADISH', 'GRP-ROOT', '무', 'Raphanus sativus', '특허 [0046] 최저한계온도 8℃ 적용 대표 근채류');
  insertCrop.run('CRP-PEPPER', 'GRP-SPICE', '고추', 'Capsicum annuum', '노지 조숙/보통재배 및 병해충(탄저병·역병) 기후예측 방제 핵심 작물');

  // 3. 품종 시드
  const insertCultivar = db.prepare(
    'INSERT INTO cultivar (cultivar_id, crop_id, cultivar_name, maturity_type, avg_growth_days, characteristics) VALUES (?, ?, ?, ?, ?, ?)'
  );
  insertCultivar.run('CV-SUMI', 'CRP-POTATO', '수미 (Superior)', '중생종', 100, '특허 도 7 대표 품종, 생육일수 95~110일, 고온·집중호우 민감');
  insertCultivar.run('CV-DUBAEK', 'CRP-POTATO', '두백', '만생종', 115, '전분 함량 우수, 생육일수 110일 이상 만생종');
  insertCultivar.run('CV-SEOLBONG', 'CRP-POTATO', '설봉', '조생종', 88, '조기 수확 가능 조생종 (80~95일), 고온 적응성 개선');
  insertCultivar.run('CV-BULAM3', 'CRP-CABBAGE', '불암3호', '중생종', 77, '설계도 도 1~4 대표 품종, 결구력 우수 가을배추 표준 품종');
  insertCultivar.run('CV-CHUNGWANG', 'CRP-CABBAGE', '춘광', '조생종', 65, '봄재배 및 터널재배용 내추대성 배추 품종');
  insertCultivar.run('CV-NAMDO', 'CRP-GARLIC', '남도마늘', '조생종', 210, '난지형 월동 대표 품종, 구비대 빠름');
  insertCultivar.run('CV-DAESEO', 'CRP-GARLIC', '대서마늘', '중만생종', 225, '다수확 대과종 난지형 마늘');
  insertCultivar.run('CV-CHEONGA', 'CRP-RADISH', '청아무', '중생종', 70, '가을 김장용 대표 무 품종, 기준온도 8℃ 적용');
  insertCultivar.run('CV-PRK', 'CRP-PEPPER', 'PR탄탄대군', '중생종', 140, '복합 내병성 노지 고추 품종');

  // 4. 3단계 재배작형 시드
  const insertSystem = db.prepare(`
    INSERT INTO cropping_system (
      system_id, crop_id, system_name, cultivation_method, sowing_months, harvest_months,
      is_overwintering, base_temp_tb, required_gdd, required_raw_gdd,
      opt_temp_min, opt_temp_max, limit_temp_min, limit_temp_max, damage_temp_low, damage_temp_high
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertSystem.run('SYS-POT-SPR', 'CRP-POTATO', '노지 봄재배', 'OPEN_FIELD', '3월 중순', '6월 하순~7월 중순', 0, 5.0, 1000, 1300, 14, 23, 5, 25, 5, 30);
  insertSystem.run('SYS-POT-AUT', 'CRP-POTATO', '노지 가을재배', 'OPEN_FIELD', '8월 중순', '11월 초순', 0, 5.0, 950, 1250, 14, 23, 5, 25, 3, 30);
  insertSystem.run('SYS-CAB-AUT', 'CRP-CABBAGE', '노지 가을재배', 'OPEN_FIELD', '8월 하순', '11월 중순', 0, 5.0, 785, 1170, 15, 20, 5, 25, 2, 28);
  insertSystem.run('SYS-CAB-SPR', 'CRP-CABBAGE', '노지 봄재배', 'OPEN_FIELD', '4월 초순', '6월 중순', 0, 5.0, 750, 1100, 15, 20, 5, 25, 4, 28);
  insertSystem.run('SYS-CAB-GH', 'CRP-CABBAGE', '시설하우스(무가온)', 'GREENHOUSE_UNHEATED', '2월 중순', '5월 초순', 0, 5.0, 760, 1120, 15, 22, 5, 27, 0, 30);
  insertSystem.run('SYS-GAR-WIN', 'CRP-GARLIC', '난지형 노지 월동재배', 'OPEN_FIELD', '9월 하순~10월 초순', '익년 5월 중순', 1, 5.0, 1450, 2100, 15, 20, 4, 25, -5, 28);
  insertSystem.run('SYS-ONI-WIN', 'CRP-ONION', '노지 월동재배', 'OPEN_FIELD', '10월 중순~11월 초순', '익년 5월 하순~6월 초순', 1, 5.0, 1500, 2200, 15, 20, 4, 25, -6, 28);
  insertSystem.run('SYS-RAD-AUT', 'CRP-RADISH', '노지 가을재배', 'OPEN_FIELD', '8월 하순~9월 초순', '11월 초중순', 0, 8.0, 680, 1150, 17, 20, 8, 25, 3, 28);
  insertSystem.run('SYS-PEP-OPEN', 'CRP-PEPPER', '노지 조숙재배(멀칭)', 'OPEN_FIELD', '5월 초순', '8월~10월 수시', 0, 10.0, 1650, 2800, 20, 28, 10, 32, 8, 33);

  // 5. 표준 생육단계 및 농작업 템플릿 시드 (배추 노지가을재배 & 감자 노지봄재배)
  const insertTemplate = db.prepare(`
    INSERT INTO standard_template (
      template_id, system_id, step_order, item_type, item_category, item_code, item_name,
      target_gdd_ratio, target_pgdd, days_from_start, tolerance_days, guide_criteria, climate_countermeasure
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  // 배추 노지가을재배 (도 2, 도 3, 도 4 기준)
  insertTemplate.run('TPL-CAB-01', 'SYS-CAB-AUT', 1, 'WORK', 'MAJOR', 'OP_SOIL_PREP', '밑거름 시비 및 이랑·멀칭 만들기', -0.1, 0, -10, 3, '정식 10일 전 퇴비·석회·붕사 살포 후 비닐멀칭 수행', '[사전] 집중호우 대비 고랑 배수로 30cm 이상 깊게 조성 (기계적/물리적 방법)');
  insertTemplate.run('TPL-CAB-02', 'SYS-CAB-AUT', 2, 'WORK', 'MAJOR', 'OP_PLANTING', '본밭 정식 (모종 심기)', 0.0, 0, 0, 2, '본엽 3~4매 건묘를 흐린 날 오후에 정식 후 충분한 관수', '[즉시] 고온기 정식 시 차광망 피복 및 스프링클러 미스트 가동');
  insertTemplate.run('TPL-CAB-03', 'SYS-CAB-AUT', 3, 'STAGE', 'MAJOR', 'STG_ROOTING', '활착 확인', 0.17, 136, 8, 2, '정식 후 새 뿌리가 내리고 중심 어린잎이 꼿꼿하게 자라기 시작하는 상태', '[사후] 활착 지연 시 요소 0.2%액 또는 아미노산 영양제 엽면시비 (영양불균형 개선)');
  insertTemplate.run('TPL-CAB-04', 'SYS-CAB-AUT', 4, 'WORK', 'DETAIL', 'OP_TOPDRESS_1', '1차 웃거름 (추비)', 0.28, 220, 15, 3, '정식 15일 후 포기 사이 구멍을 뚫어 NK복합비료 시비 (20kg/10a)', '[사전] 강우 직전 시비 지양, 토양 수분 적정 시 시비');
  insertTemplate.run('TPL-CAB-05', 'SYS-CAB-AUT', 5, 'STAGE', 'MAJOR', 'STG_HEADING_START', '결구 시작 확인', 0.55, 432, 34, 3, '외엽이 충분히 자란 뒤 안쪽 잎이 서로 포개지며 구가 뭉치기 시작하는 초기 상태', '[즉시] 결구 초기 칼슘 결핍(꿀통배추) 예방을 위해 염화칼슘 0.3%액 엽면살포');
  insertTemplate.run('TPL-CAB-06', 'SYS-CAB-AUT', 6, 'WORK', 'DETAIL', 'OP_PEST_1', '병해충 방제 (1차 · 무름병/진딧물)', 0.65, 510, 41, 2, '결구 시작기 고온다습 시 무름병·노균병·배추좀나방 선제적 방제', '[사전/화학적] 장마·강우 예보 전 침투이행성 약제 살포 및 배수로 정비');
  insertTemplate.run('TPL-CAB-07', 'SYS-CAB-AUT', 7, 'WORK', 'DETAIL', 'OP_TOPDRESS_2', '2차 웃거름 (비대기 추비)', 0.75, 590, 48, 3, '결구 비대기 양분 보충을 위한 2차 NK복합비료 및 칼륨 시비', '[영양개선] 생육 부진 시 광합성 촉진제 및 칼륨 보충');
  insertTemplate.run('TPL-CAB-08', 'SYS-CAB-AUT', 8, 'STAGE', 'MAJOR', 'STG_HARVEST_READY', '수확 적기 확인', 0.94, 733, 72, 3, '배추통을 손으로 눌렀을 때 단단하게 결구율이 85~90% 이상 찬 상태', '[사전] 영하(-2℃ 이하) 한파 예보 시 부직포 피복 또는 묶어주기');
  insertTemplate.run('TPL-CAB-09', 'SYS-CAB-AUT', 9, 'WORK', 'MAJOR', 'OP_HARVEST', '수확 작업', 1.0, 785, 77, 4, '맑은 날 수확하여 겉잎 2~3매만 남기고 출하/저장', '[사후] 동해 피해 우려 시 조기 수확 또는 현장 가저장');

  // 감자 노지봄재배 (특허 도 7 기준)
  insertTemplate.run('TPL-POT-01', 'SYS-POT-SPR', 1, 'WORK', 'DETAIL', 'OP_SOIL_AMEND', '토양개량 (칼슘제 시비)', -0.15, 0, -16, 3, '2023.02.28 기준 칼슘제 20Kg 시비로 토양 산도 및 칼슘 보충', '[토양개선] 산도 초과/미달 교정');
  insertTemplate.run('TPL-POT-02', 'SYS-POT-SPR', 2, 'WORK', 'MAJOR', 'OP_PLOW_MULCH', '퇴비 시비 및 경운·멀칭', -0.02, 0, -3, 2, '가축분 퇴비 20Kg 시비 후 로터리 경운 및 흑색비닐 멀칭 작업', '[물리적] 지온 상승 및 잡초 억제');
  insertTemplate.run('TPL-POT-03', 'SYS-POT-SPR', 3, 'WORK', 'MAJOR', 'OP_SOWING', '씨감자 파종 작업', 0.0, 0, 0, 2, '소독된 씨감자 절단 후 파종 (충북 충주시 기준 3월 중순)', '[사전] 저온(5℃ 이하) 서리 예보 시 비닐 피복 두께 보강');
  insertTemplate.run('TPL-POT-04', 'SYS-POT-SPR', 4, 'STAGE', 'MAJOR', 'STG_EMERGENCE', '출아 및 정식(북주기) 확인', 0.12, 120, 17, 3, '싹이 올라와 비닐 구멍을 뚫어주고 흙으로 북주기 수행', '[즉시] 늦서리(3℃ 이하) 경보 시 왕겨/비닐 응급 피복');
  insertTemplate.run('TPL-POT-05', 'SYS-POT-SPR', 5, 'WORK', 'DETAIL', 'OP_WEED_1', '1차·2차 잡초관리', 0.25, 250, 33, 3, '고랑 제초제 100ml 처리 및 북주기 겸 제초 작업', '[화학적/기계적] 비선택성 제초제 비산 주의');
  insertTemplate.run('TPL-POT-06', 'SYS-POT-SPR', 6, 'WORK', 'DETAIL', 'OP_DRAIN_PEST', '배수로 관리 및 병해충 방제', 0.52, 520, 47, 3, '봄철 강우 대비 배수로 정비 및 살충제 100ml 처리', '[사전/사후] 역병 및 감자뿔나방 방제');
  insertTemplate.run('TPL-POT-07', 'SYS-POT-SPR', 7, 'WORK', 'MAJOR', 'OP_HARVEST', '감자 수확', 1.0, 1000, 122, 5, '잎·줄기가 황화되고 유효적산온도 1,000℃ 도달 시 맑은 날 수확', '[사후] 장마철 집중호우 전 조기 수확으로 부패 방지');

  // 6. 토양 적정 기준치 시드 (특허 [0109] 테이블 반영)
  const insertSoilStd = db.prepare(`
    INSERT INTO soil_standard (
      standard_id, crop_id, ph_min, ph_max, om_min, om_max, p2o5_min, p2o5_max,
      k_min, k_max, ca_min, ca_max, mg_min, mg_max, sio2_min, sio2_max, ec_min, ec_max
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertSoilStd.run('SOIL-STD-POTATO', 'CRP-POTATO', 6.0, 6.5, 25, 35, 300, 400, 0.4, 0.8, 4.0, 7.0, 1.0, 2.0, 130, 180, 0.0, 2.0);
  insertSoilStd.run('SOIL-STD-CABBAGE', 'CRP-CABBAGE', 6.0, 6.8, 25, 35, 350, 450, 0.6, 0.8, 5.0, 6.5, 1.5, 2.5, 130, 180, 0.0, 2.0);
  insertSoilStd.run('SOIL-STD-GARLIC', 'CRP-GARLIC', 6.0, 6.5, 25, 35, 350, 450, 0.5, 0.7, 5.0, 6.5, 1.5, 2.0, 130, 180, 0.0, 2.0);

  // 7. 비료 및 작물보호제 DB 시드 (특허 도 7 및 도 2 반영)
  const insertMaterial = db.prepare(`
    INSERT INTO agro_material (
      material_id, material_category, sub_type, product_name, is_organic,
      target_nutrient_or_pest, n_pct, p_pct, k_pct, ca_pct, om_pct,
      dosage_per_100pyeong, unit_spec, unit_price, usage_stage, weather_trigger
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertMaterial.run('MAT-FERT-01', 'FERTILIZER', '칼슘/토양개량제', '한팜칼슘 10Kg', 0, '칼슘 보충 및 토양 개량', 0, 0, 0, 35, 0, '20Kg 시비 (2포)', '10Kg', 10000, '토양개량 (밑거름)', '산도 불균형 및 결구/괴경 칼슘 부족 시');
  insertMaterial.run('MAT-FERT-02', 'FERTILIZER', '유기물 퇴비', '한팜가축분 퇴비 10Kg', 1, '유기물 보충 및 산도(pH) 완충', 1.2, 0.8, 1.0, 2.0, 65, '50Kg 시비 (5포)', '10Kg', 10000, '퇴비 시비 (밑거름)', '토양 유기물 부족(25g/kg 미만) 또는 pH 초과 시');
  insertMaterial.run('MAT-FERT-03', 'FERTILIZER', '복합비료', 'NK복합비료(20-10-10)', 0, '질소·칼륨 생육기 집중 공급', 20, 10, 10, 0, 0, '20Kg 시비 (1포)', '20Kg', 18000, '1차·2차 웃거름', '활착 이후 영양생장 및 결구 시작기');
  insertMaterial.run('MAT-FERT-04', 'FERTILIZER', '칼륨전용비료', '황산가리(고농도 칼륨)', 0, '칼륨(K) 기준치 미달 집중 보충', 0, 0, 50, 0, 0, '10Kg 배합 시비', '10Kg', 15000, '밑거름·웃거름 복합배합', '토양검정 칼륨 0.4 cmol+/kg 미만 시 자동 배합');
  insertMaterial.run('MAT-PEST-01', 'PESTICIDE', '제초제', '한팜제초제 100ml', 0, '고랑 일년생 및 다년생 잡초 방제', 0, 0, 0, 0, 0, '100ml 희석 처리', '100ml', 5000, '잡초관리 (1·2차)', '봄·여름 기온 상승기 잡초 급증 시');
  insertMaterial.run('MAT-PEST-02', 'PESTICIDE', '살충제', '한팜살충제 200ml', 0, '진딧물·배추좀나방·감자뿔나방 방제', 0, 0, 0, 0, 0, '100ml 처리', '200ml', 5000, '병해충 관리', '일평균기온 20℃ 이상 건조기 해충 밀도 증가 시');
  insertMaterial.run('MAT-PEST-03', 'PESTICIDE', '살균제', '한팜살균제(무름병·역병)', 0, '무름병·역병·노균병 예방 및 치료', 0, 0, 0, 0, 0, '150ml 처리', '250ml', 12000, '병해충 방제', '강수일수 3일 이상 지속 및 습도 80% 이상 예보 시');
  insertMaterial.run('MAT-NUTR-01', 'NUTRIENT', '작물영양제', '한팜광합성·냉해회복제 500ml', 1, '이상기후 스트레스 완화 및 광합성 보충', 3, 2, 5, 5, 15, '250ml 엽면시비', '500ml', 14000, '기후변화 대응 처방', '일조 부족 또는 저온/고온장해 발생 직후');

  // 8. 내부 기상 관측지점 및 일별 기온 시드 (도 4 충북 충주시 등)
  const insertStation = db.prepare(`
    INSERT INTO weather_station (
      station_id, region_code, station_name, latitude, longitude, altitude_m,
      grid_x, grid_y, fallback_station_id, sync_status, last_synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertStation.run('STN-127', '43130', '충북 충주시 (단월동/ASOS 127)', 36.9705, 127.9322, 115.0, 76, 114, 'STN-131', 'ACTIVE', '2026-11-05 03:00:00');
  insertStation.run('STN-131', '43110', '충북 청주시 (ASOS 131)', 36.6392, 127.4407, 58.7, 69, 107, 'STN-127', 'ACTIVE', '2026-11-05 03:00:00');
  insertStation.run('STN-100', '51760', '강원 평창군 (대관령/고랭지)', 37.6771, 128.7183, 772.6, 89, 134, 'STN-105', 'ACTIVE', '2026-11-05 03:00:00');
  insertStation.run('STN-261', '46820', '전남 해남군 (난지형 주산지)', 34.5538, 126.5691, 16.2, 54, 61, 'STN-165', 'ACTIVE', '2026-11-05 03:00:00');

  const insertWeather = db.prepare(`
    INSERT INTO weather_daily_data (
      weather_id, station_id, weather_date, data_type, temp_avg, temp_max, temp_min,
      precipitation_mm, humidity_pct, is_interpolated, source_type, synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // 도 4의 충북 충주시 배추 재배기간 (8/25 ~ 11/15) 대표 일별 데이터 적재
  const sampleDates = [
    { d: '2026-08-25', type: 'OBSERVED', avg: 23.4, max: 28.5, min: 19.1, rain: 0, src: 'MANUAL_SEED' },
    { d: '2026-08-28', type: 'OBSERVED', avg: 22.1, max: 27.2, min: 17.8, rain: 5.2, src: 'MANUAL_SEED' },
    { d: '2026-09-02', type: 'OBSERVED', avg: 21.0, max: 26.0, min: 16.5, rain: 0, src: 'MANUAL_SEED' },
    { d: '2026-09-10', type: 'OBSERVED', avg: 19.5, max: 24.8, min: 14.9, rain: 0, src: 'MANUAL_SEED' },
    { d: '2026-09-20', type: 'OBSERVED', avg: 18.2, max: 23.4, min: 13.1, rain: 12.0, src: 'MANUAL_SEED' },
    { d: '2026-09-28', type: 'OBSERVED', avg: 16.8, max: 22.0, min: 11.5, rain: 0, src: 'MANUAL_SEED' },
    { d: '2026-10-05', type: 'OBSERVED', avg: 14.9, max: 20.4, min: 9.8, rain: 0, src: 'MANUAL_SEED' },
    { d: '2026-10-15', type: 'OBSERVED', avg: 12.6, max: 18.2, min: 7.4, rain: 2.5, src: 'MANUAL_SEED' },
    { d: '2026-10-25', type: 'OBSERVED', avg: 10.8, max: 16.5, min: 5.2, rain: 0, src: 'MANUAL_SEED' },
    { d: '2026-11-05', type: 'OBSERVED', avg: 9.2, max: 14.8, min: 4.1, rain: 0, src: 'MANUAL_SEED' },
    { d: '2026-11-08', type: 'FORECAST', avg: 7.5, max: 13.0, min: 2.1, rain: 0, src: 'MANUAL_SEED' },
    { d: '2026-11-10', type: 'FORECAST', avg: 6.4, max: 11.8, min: 1.2, rain: 0, src: 'MANUAL_SEED' },
    { d: '2026-11-15', type: 'FORECAST', avg: 4.2, max: 9.5, min: -0.8, rain: 0, src: 'MANUAL_SEED' },
  ];
  for (const row of sampleDates) {
    insertWeather.run(
      `STN-127_${row.d}`, 'STN-127', row.d, row.type, row.avg, row.max, row.min,
      row.rain, 65, 0, row.src, '2026-11-05 03:00:00'
    );
  }

  // 환경 보정 계수 시드
  const insertEnvCorr = db.prepare(`
    INSERT INTO weather_env_correction (
      correction_id, env_name, cultivation_method, mulching_yn, temp_offset_c, altitude_lapse_rate, description
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertEnvCorr.run('CORR-OPEN-NONE', '노지 일반재배 (무멀칭)', 'OPEN_FIELD', 0, 0.0, -0.6, '기상관측소 표준 기온 그대로 적용 (고도차 100m당 -0.6℃ 보정)');
  insertEnvCorr.run('CORR-OPEN-MULCH', '노지 비닐멀칭 재배', 'OPEN_FIELD', 1, 1.5, -0.6, '비닐멀칭에 의한 지온 및 근권부 유효기온 +1.5℃ 상승 보정');
  insertEnvCorr.run('CORR-GH-UNHEAT', '시설하우스 (무가온)', 'GREENHOUSE_UNHEATED', 1, 3.8, -0.6, '무가온 비닐하우스 야간 보온 및 주간 일사 상승분 +3.8℃ 보정');
  insertEnvCorr.run('CORR-GH-HEAT', '시설하우스 (가온재배)', 'GREENHOUSE_HEATED', 1, 7.5, 0.0, '난방기 가동으로 최저한계온도 이하 하락 차단 및 평균 +7.5℃ 보정');

  // 기상 수집 로그 시드
  const insertSyncLog = db.prepare(`
    INSERT INTO weather_sync_log (
      sync_id, station_id, sync_type, target_period, record_count, interpolated_count, status, executed_at, memo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertSyncLog.run('SYNC-20261105-01', 'STN-127', 'SEED', '2026-01-01 ~ 2026-12-31', 365, 2, 'SUCCESS', '2026-11-05 03:00:00', '초기 내부 기상 테이블 시드 데이터 생성 (추후 공공DB 기상청 Open API 자동 수집 전환 대기)');

  // 9. 농가 작물재배 일정 요청 및 재배이력 시드 (도 2, 도 3, 특허 도 7 반영)
  const insertReq = db.prepare(`
    INSERT INTO schedule_request (
      request_id, farmer_name, region_name, station_id, group_id, crop_id, cultivar_id, system_id,
      request_type, area_pyeong, start_date, expected_harvest_date, mulching_yn, irrigation_yn,
      is_organic, has_soil_test, soil_ph, soil_k, soil_om, accumulated_pgdd, remaining_pgdd,
      progress_pct, pipeline_status, requested_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertReq.run(
    'CULT-2026-000123', '김한팜 농가', '충북 충주시', 'STN-127',
    'GRP-LEAF', 'CRP-CABBAGE', 'CV-BULAM3', 'SYS-CAB-AUT',
    'NEW_PLAN', 50, '2026-08-25', '2026-11-15', 1, 1,
    0, 1, 6.4, 0.65, 28.0, 520, 265, 38, 'S150_COMPLETED', '2026-08-20 09:15:00'
  );
  insertReq.run(
    'CULT-2026-000124', '박충주 농가', '충북 충주시 단월동 274-3', 'STN-127',
    'GRP-FOOD', 'CRP-POTATO', 'CV-SUMI', 'SYS-POT-SPR',
    'CLIMATE_READJUST', 100, '2026-03-15', '2026-07-15', 1, 0,
    0, 1, 7.4, 0.11, 15.0, 100, 900, 45, 'S230_READJUSTED', '2026-04-05 14:20:00'
  );
  insertReq.run(
    'CULT-2026-000125', '이해남 농가', '전남 해남군', 'STN-261',
    'GRP-SPICE', 'CRP-GARLIC', 'CV-NAMDO', 'SYS-GAR-WIN',
    'NEW_PLAN', 300, '2026-10-02', '2027-05-18', 1, 1,
    1, 1, 6.2, 0.55, 30.0, 290, 1160, 25, 'S150_COMPLETED', '2026-09-25 11:05:00'
  );
  insertReq.run(
    'CULT-2026-000126', '최평창 농가', '강원 평창군', 'STN-100',
    'GRP-ROOT', 'CRP-RADISH', 'CV-CHEONGA', 'SYS-RAD-AUT',
    'DELAY_READJUST', 150, '2026-08-28', '2026-11-08', 0, 1,
    0, 0, null, null, null, 610, 70, 82, 'S220_ALERT_SENT', '2026-11-04 18:40:00'
  );

  // 재배이력 자동 생성 데이터 시드 (도 3의 ③ 영역 반영)
  const insertHist = db.prepare(`
    INSERT INTO cultivation_history_log (
      history_id, request_id, item_type, item_code, item_name,
      predicted_date, actual_date, confirmed_at, material_used,
      calculated_stage_pgdd, sequence_check, date_valid, missing_flag,
      reliability_score, quality_flag, include_in_training
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertHist.run('HIST-001', 'CULT-2026-000123', 'WORK', 'OP_PLANTING', '정식 (본밭 모종 심기)', '2026-08-25', '2026-08-25', '2026-08-25 18:10:00', '배추 불암3호 포트묘', 0, 'PASS', 'PASS', 0, 0.98, 'NORMAL', 1);
  insertHist.run('HIST-002', 'CULT-2026-000123', 'STAGE', 'STG_ROOTING', '활착 확인 (정식→활착 구간)', '2026-09-01', '2026-09-02', '2026-09-02 10:15:00', '-', 136.0, 'PASS', 'PASS', 0, 0.96, 'NORMAL', 1);
  insertHist.run('HIST-003', 'CULT-2026-000123', 'WORK', 'OP_TOPDRESS_1', '1차 웃거름 실행', '2026-09-10', '2026-09-10', '2026-09-10 10:24:00', 'NK복합비료(20-10-10) 20kg/10a 살포', 0, 'PASS', 'PASS', 0, 0.95, 'NORMAL', 1);
  insertHist.run('HIST-004', 'CULT-2026-000123', 'STAGE', 'STG_HEADING_START', '결구 시작 확인 (활착→결구 구간)', '2026-09-28', '2026-09-30', '2026-09-30 16:40:00', '-', 296.0, 'PASS', 'PASS', 0, 0.94, 'NORMAL', 1);
  insertHist.run('HIST-005', 'CULT-2026-000126', 'STAGE', 'STG_ROOTING', '발아/솎음 확인 (날짜 역전 오류 예시)', '2026-09-05', '2026-08-20', '2026-10-15 22:00:00', '-', 45.0, 'FAIL_ORDER', 'OUT_OF_RANGE', 1, 0.32, 'OUTLIER', 0);

  // 10. 생육예측모델(GDD) 엔진 A안/B안 버전 시드
  const insertModelVer = db.prepare(`
    INSERT INTO growth_model_version (
      version_id, crop_id, cultivar_id, system_id, version_tag, model_track,
      base_temp_tb, stage_1_name, stage_1_pgdd, stage_2_name, stage_2_pgdd,
      stage_3_name, stage_3_pgdd, total_pgdd, env_correction_factor,
      predicted_mae_days, error_cause_type, sample_count, status, updated_at, release_note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertModelVer.run(
    'MDL-CAB-V1.0', 'CRP-CABBAGE', 'CV-BULAM3', 'SYS-CAB-AUT', 'v1.0.0', 'TRACK_A_BASE',
    5.0, '정식→활착', 136, '활착→결구시작', 296, '결구시작→수확', 353, 785, 1.0,
    2.4, 'NONE', 128, 'ACTIVE', '2026-08-01 00:00:00', 'A안: 불암3호 노지가을재배 표준 적산온도 모델 (기준온도 5℃, 총 785℃·일)'
  );
  insertModelVer.run(
    'MDL-CAB-V1.1-CAND', 'CRP-CABBAGE', 'CV-BULAM3', 'SYS-CAB-AUT', 'v1.1.0-rc1', 'TRACK_B_SELECTIVE',
    5.0, '정식→활착', 138, '활착→결구시작', 302, '결구시작→수확', 355, 795, 1.04,
    1.1, 'ENV_ERR', 45, 'CANDIDATE', '2026-11-04 21:00:00', 'B안 선택적 갱신 후보: 충북 내륙권 비닐멀칭 환경 오차 보정 반영 (예측오차 2.4일 → 1.1일 단축)'
  );
  insertModelVer.run(
    'MDL-POT-V1.2', 'CRP-POTATO', 'CV-SUMI', 'SYS-POT-SPR', 'v1.2.0', 'TRACK_B_SELECTIVE',
    5.0, '파종→출아/정식', 120, '출아→괴경비대기', 400, '괴경비대→수확', 480, 1000, 1.02,
    1.6, 'CULTIVAR_ERR', 210, 'ACTIVE', '2026-07-20 12:00:00', '특허 청구항 14 반영: 수미 감자 실제 수확 적산온도 역산 데이터 반영 모델'
  );
}

export const DEFAULT_HANFARM_SURVEY_QUESTIONS = [
  {
    id: 'q1',
    number: 1,
    question: '귀하의 연령대는 어떻게 되십니까?',
    subtitle: '',
    type: 'single',
    options: [
      '① 20대 이하',
      '② 30대',
      '③ 40대',
      '④ 50대',
      '⑤ 60대',
      '⑥ 70대 이상',
    ],
  },
  {
    id: 'q2',
    number: 2,
    question: '귀하의 재배 규모는 어느 정도입니까?',
    subtitle: '',
    type: 'single',
    options: [
      '① 텃밭·주말농장',
      '② 소규모 농업인 (1,000평 미만)',
      '③ 중규모 농업인 (1,000~5,000평 미만)',
      '④ 대규모 농업인 (5,000평 이상)',
    ],
  },
  {
    id: 'q3',
    number: 3,
    question: '현재 주로 재배하는 작물은 무엇입니까? (복수 선택 가능)',
    subtitle: '',
    type: 'multiple',
    allowOtherInput: true,
    options: [
      '① 엽채류 (상추, 시금치, 배추 등)',
      '② 과채류 (토마토, 오이, 고추, 딸기 등)',
      '③ 근채류 (무, 당근, 감자, 고구마 등)',
      '④ 양념채소류 (마늘, 양파, 파 등)',
      '⑤ 곡류·두류 (벼, 콩, 옥수수 등)',
      '⑥ 과수류 (사과, 배, 복숭아, 포도 등)',
      '⑦ 기타 (직접 입력)',
    ],
  },
  {
    id: 'q4',
    number: 4,
    question: '현재 작물 재배 시 가장 어려운 점은 무엇입니까?',
    subtitle: '',
    type: 'single',
    options: [
      '① 재배시기 및 농작업 일정 관리',
      '② 병해충 진단 및 방제',
      '③ 비료·농약 등 농자재 선택',
      '④ 특별히 어려운 점 없음',
    ],
  },
  {
    id: 'q5',
    number: 5,
    question: '맞춤형 재배일정 서비스가 제공된다면 이용하시겠습니까?',
    subtitle:
      '작물·품종·지역·기상정보에 따라 파종부터 수확까지 농작업 시기, 시비관리, 병해충 관리 일정을 안내하는 서비스입니다.',
    type: 'single',
    options: [
      '① 반드시 이용',
      '② 이용할 의향 있음',
      '③ 잘 모르겠음',
      '④ 이용 의향 없음',
    ],
  },
  {
    id: 'q6',
    number: 6,
    question: '맞춤형 재배일정 서비스에 월 얼마까지 지불할 의향이 있으십니까?',
    subtitle: '',
    type: 'single',
    options: [
      '① 무료일 때만 이용',
      '② 월 3,000원',
      '③ 월 5,000원',
      '④ 월 10,000원',
      '⑤ 월 10,000원 초과',
    ],
  },
  {
    id: 'q7',
    number: 7,
    question: 'AI 병해충 진단 서비스까지 추가된다면 이용하시겠습니까?',
    subtitle:
      '작물 사진을 촬영하면 AI가 병해충을 진단하고 적절한 관리 및 방제 방법을 안내하는 서비스입니다.',
    type: 'single',
    options: [
      '① 반드시 이용',
      '② 이용할 의향 있음',
      '③ 잘 모르겠음',
      '④ 이용 의향 없음',
    ],
  },
  {
    id: 'q8',
    number: 8,
    question:
      '맞춤형 재배일정과 AI 병해충 진단이 모두 포함된 서비스에 월 얼마까지 지불할 의향이 있으십니까?',
    subtitle: '',
    type: 'single',
    options: [
      '① 무료일 때만 이용',
      '② 월 5,000원',
      '③ 월 10,000원',
      '④ 월 20,000원',
      '⑤ 월 20,000원 초과',
    ],
  },
  {
    id: 'q9',
    number: 9,
    question:
      '재배일정에 맞춰 필요한 농자재를 추천하고 온라인 주문·배송까지 제공한다면 이용하시겠습니까?',
    subtitle: '',
    type: 'single',
    options: [
      '① 적극 이용',
      '② 필요할 때 이용',
      '③ 이용하지 않음',
    ],
  },
];

function ensureSurveyData() {
  const existingFormCount = (
    db.prepare('SELECT COUNT(*) as cnt FROM survey_form').get() as { cnt: number }
  ).cnt;

  if (existingFormCount === 0) {
    db.prepare(`
      INSERT INTO survey_form (
        survey_id, title, greeting_text, intro_text, duration_text, notice_text,
        footer_title, footer_sub, questions_json, is_active, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now', 'localtime'))
    `).run(
      'SURV-HANFARM-2026',
      '한팜 맞춤형 재배관리 서비스 수요조사',
      '안녕하세요.',
      '한팜(HANFARM)은 농업인이 보다 쉽고 효율적으로 작물을 재배할 수 있도록 맞춤형 재배일정 및 AI 병해충 진단 서비스를 개발하고 있습니다.',
      '본 설문은 서비스 개발과 적정 구독료 설정을 위한 조사이며, 약 2~3분 정도 소요됩니다.',
      '※ 본 설문은 맞춤형 재배일정과 AI 병해충 진단이 실제 농작업에 활용할 수 있을 만큼 충분한 정확도와 신뢰성을 갖추었다는 가정하에 응답해 주시기 바랍니다.',
      '설문에 참여해 주셔서 감사합니다.',
      '본 설문 결과는 한팜의 서비스 개발 및 사업성 검토를 위한 목적으로 활용됩니다.',
      JSON.stringify(DEFAULT_HANFARM_SURVEY_QUESTIONS)
    );
  }

  // 초기 샘플 응답(RESP-20261108-001 ~ 010) 정리하여 한팜 맞춤형 재배관리 서비스 수요조사 참여자 수를 0으로 세팅
  db.prepare(
    "DELETE FROM survey_response WHERE survey_id = 'SURV-HANFARM-2026' AND response_id LIKE 'RESP-20261108-%'"
  ).run();
}

function ensureAgroRecommendationModuleData() {
  // 1. 전역 하이브리드(정량 규칙 모듈 + AI Agent) 정책 초기값 시드
  const policyCount = (
    db.prepare('SELECT COUNT(*) as cnt FROM agro_recommendation_policy').get() as { cnt: number }
  ).cnt;
  if (policyCount === 0) {
    db.prepare(`
      INSERT INTO agro_recommendation_policy (
        policy_id, engine_mode, organic_preference, price_strategy, brand_priority,
        deficiency_boost_pct, excess_reduce_pct,
        climate_high_humidity_pct, climate_rain_trigger_mm, climate_high_temp_c, climate_low_temp_c,
        ai_system_prompt, rationale_sections_json, auto_apply_to_schedule, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `).run(
      'DEFAULT_POLICY',
      'HYBRID_RULE_AI',
      'BALANCED',
      'EFFICIENCY_BALANCED',
      'NUVO_HANFARM_FIRST',
      20,
      30,
      75.0,
      15.0,
      27.0,
      10.0,
      '농업 환경·식물영양·작물보호 전문 AI 에이전트로서 ① 재배지역(시도·시군구·읍면동) 토양검정 8대 성분의 작물 적정 기준치 대비 과부족 정량 진단, ② 해당 생육과정의 식물생리학적 양분 요구 특성, ③ 지역 하이브리드 기후(작년+올해 예측 평균) 조건에 따른 병해충·생리장해 예방 근거, ④ 경작 평수 기준 정확한 투입량 및 희석·혼용 주의사항을 수치와 함께 명확히 기술합니다.',
      JSON.stringify(['SOIL_DIAGNOSIS', 'GROWTH_PHYSIOLOGY', 'CLIMATE_PEST_RISK', 'DOSAGE_MIX_TIP']),
      1
    );
  }

  // 2. 생육과정 × 비료·영양제·병해충관리제 매칭 규칙 초기값 시드
  const ruleCount = (
    db.prepare('SELECT COUNT(*) as cnt FROM agro_stage_mapping_rule').get() as { cnt: number }
  ).cnt;
  if (ruleCount === 0) {
    const defaultRules = [
      {
        rule_id: 'RULE-STG-01',
        stage_category: '기비·토양준비기',
        process_codes_csv: 'PRC-01,PRC-02,PRC-03,PRC-04,PRC-05',
        stage_keywords_csv: '토양,경운,밑거름,기비,퇴비,석회,이랑,두둑,멀칭',
        fertilizer_categories_csv: '유기질·퇴비,토양개량·석회·규산,복합비료,완효성',
        nutrient_categories_csv: '토양미생물·효소제,뿌리발근·활착제',
        pesticide_categories_csv: '토양살충·선충제,제초제',
        physiological_goal: '토양 물리성(통기성·보수력) 개선, 산도(pH) 교정 및 초기 생육을 지탱할 기비 양분(N-P-K·유기물·칼슘) 기반 구축',
        soil_linkage_rule: '산도(pH)가 작물 기준치 미달 시 석회/칼슘개량제 필수 추가, 유기물(OM) 부족 시 가축분퇴비·유기질비료 20% 증량 처방',
        climate_linkage_rule: '파종·정식 전 강우 후 토양 수분 유지 및 지온 확보, 월동·토양해충(거세미·굼벵이·고자리파리) 선제 방제',
        priority_weight: 100,
        sort_order: 1,
      },
      {
        rule_id: 'RULE-STG-02',
        stage_category: '파종·정식·활착기',
        process_codes_csv: 'PRC-06,PRC-07,PRC-08,PRC-09,PRC-10,PRC-11',
        stage_keywords_csv: '파종,육묘,정식,활착,발아,출아,보식',
        fertilizer_categories_csv: '완효성,복합비료',
        nutrient_categories_csv: '뿌리발근·활착제,아미노산·해조추출물,종합미량요소',
        pesticide_categories_csv: '살균제,살충제,입고병,잘록병,총채벌레,진딧물',
        physiological_goal: '정식 몸살 최소화, 세근(흰 잔뿌리) 조기 발달 유도 및 초기 엽록소 형성 촉진',
        soil_linkage_rule: '유효인산(P2O5) 부족 시 초기 뿌리 발달 저해를 막기 위해 인산·아미노산 발근제 집중 보강, EC 과잉 시 관주 농도 완화',
        climate_linkage_rule: '저온기(10℃ 이하) 또는 고온건조기 활착 지연 방지용 아미노산·해조류 관주 및 지제부 잘록병·초기 해충 예방',
        priority_weight: 95,
        sort_order: 2,
      },
      {
        rule_id: 'RULE-STG-03',
        stage_category: '영양생장·1차웃거름기',
        process_codes_csv: 'PRC-12,PRC-13,PRC-14,PRC-15,PRC-16,PRC-17',
        stage_keywords_csv: '1차 웃거름,추비,영양생장,외엽,줄기,분얼,초기 병해충,생장기',
        fertilizer_categories_csv: '웃거름·추비(NK),복합비료,질소·가리질',
        nutrient_categories_csv: '종합미량요소,아미노산·해조추출물,마그네슘·광합성',
        pesticide_categories_csv: '살충제,나방,진딧물,벼룩잎벌레,응애',
        physiological_goal: '외엽 수·엽면적 및 줄기 골격 최대 확보를 통한 광합성 동화양분 생산 능력 극대화',
        soil_linkage_rule: '치환성 칼륨(K) 및 마그네슘(Mg) 부족 토양에서 NK+고토 추비 증량, 유기물 과잉 시 질소 과다 웃자람 억제',
        climate_linkage_rule: '기온 상승기(18~26℃) 급증하는 나방류 유충·진딧물·벼룩잎벌레 조기 차단을 위한 침투이행성·교호 살충제 매칭',
        priority_weight: 90,
        sort_order: 3,
      },
      {
        rule_id: 'RULE-STG-04',
        stage_category: '개화·착과·결구시작기',
        process_codes_csv: 'PRC-18,PRC-19',
        stage_keywords_csv: '개화,수정,착과,결구,괴경형성,구비대시작,추대',
        fertilizer_categories_csv: '웃거름·추비(NK),칼슘·붕소비료',
        nutrient_categories_csv: '칼슘·붕소제,개화·착과촉진제,종합미량요소',
        pesticide_categories_csv: '살균제,노균병,무름병,탄저병,총채벌레',
        physiological_goal: '화아분화·수정률 향상, 낙화·낙과 방지 및 세포벽 강화를 통한 생리장해(팁번·배꼽썩음병·내엽갈변) 원천 차단',
        soil_linkage_rule: '치환성 칼슘(Ca) 부족 또는 산성/고EC 토양에서 뿌리의 칼슘 흡수 길항작용을 극복하기 위해 킬레이트 칼슘·붕소 엽면시비 필수 처방',
        climate_linkage_rule: '고온·건조 또는 과습으로 인한 칼슘 이동 저해 대응 및 다습기(습도 75%↑) 노균병·무름병·잿빛곰팡이병 예방 살균제 매칭',
        priority_weight: 95,
        sort_order: 4,
      },
      {
        rule_id: 'RULE-STG-05',
        stage_category: '과실비대·결구충실·2차웃거름기',
        process_codes_csv: 'PRC-20,PRC-21,PRC-22,PRC-23',
        stage_keywords_csv: '2차 웃거름,3차 웃거름,비대,결구비대,구비대,괴경비대,알채움,장마',
        fertilizer_categories_csv: '웃거름·추비(NK),황산가리·인산가리',
        nutrient_categories_csv: '과실·구비대촉진제,칼슘·붕소제,광합성·일조부족보완제',
        pesticide_categories_csv: '살균제,살충제,탄저병,역병,무름병,나방',
        physiological_goal: '잎에서 생성된 탄수화물·전분을 과실·결구·뿌리(구근)로 집중 전류시켜 무게감·크기·단단함 극대화',
        soil_linkage_rule: '칼륨(K) 및 유효인산(P2O5) 부족 시 비대 불량이 직결되므로 고농도 인산가리·규산 액비 및 NK 추비 병행 처방',
        climate_linkage_rule: '장마·강우(15mm↑) 및 일조 부족 시 광합성 보완제(썬마스터 등) 투입, 고온다습기 역병·탄저병·무름병 전문 살균제 집중 배치',
        priority_weight: 92,
        sort_order: 5,
      },
      {
        rule_id: 'RULE-STG-06',
        stage_category: '성숙·착색·수확·저장성향상기',
        process_codes_csv: 'PRC-24,PRC-25,PRC-26,PRC-27,PRC-28',
        stage_keywords_csv: '성숙,착색,당도,수확,결속,동해방지,품질',
        fertilizer_categories_csv: '황산가리·인산가리',
        nutrient_categories_csv: '착색·당도·품질향상제,칼슘·붕소제',
        pesticide_categories_csv: '친환경·유기농방제제,약흔없는약제',
        physiological_goal: '수확 직전 당도·착색·경도(저장성) 향상 및 농약안전사용기준(PLS) 준수 무잔류 안전 수확',
        soil_linkage_rule: '질소질 비료 전면 중단(저장성 저하 및 열과 방지), 칼륨·칼슘 위주 마무리 엽면 공급',
        climate_linkage_rule: '수확기 저온·서리(10℃↓) 대비 냉해 예방 영양제 살포 및 PLS 잔류 면제 친환경 미생물·식물추출물 제제 우선 추천',
        priority_weight: 88,
        sort_order: 6,
      },
    ];

    const insRule = db.prepare(`
      INSERT INTO agro_stage_mapping_rule (
        rule_id, stage_category, process_codes_csv, stage_keywords_csv,
        fertilizer_categories_csv, nutrient_categories_csv, pesticide_categories_csv,
        physiological_goal, soil_linkage_rule, climate_linkage_rule,
        priority_weight, is_active, sort_order, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now', 'localtime'))
    `);
    for (const r of defaultRules) {
      insRule.run(
        r.rule_id,
        r.stage_category,
        r.process_codes_csv,
        r.stage_keywords_csv,
        r.fertilizer_categories_csv,
        r.nutrient_categories_csv,
        r.pesticide_categories_csv,
        r.physiological_goal,
        r.soil_linkage_rule,
        r.climate_linkage_rule,
        r.priority_weight,
        r.sort_order
      );
    }
  }

  // 3. 등록된 모든 작물(crop)에 대해 작물별 적정 토양 기준(soil_standard)이 누락되지 않도록 자동 보완
  const allCrops = db.prepare('SELECT crop_id, group_id, crop_name FROM crop').all() as Array<{
    crop_id: string;
    group_id: string;
    crop_name: string;
  }>;
  const insStd = db.prepare(`
    INSERT OR IGNORE INTO soil_standard (
      standard_id, crop_id,
      ph_min, ph_max, om_min, om_max, p2o5_min, p2o5_max,
      k_min, k_max, ca_min, ca_max, mg_min, mg_max, sio2_min, sio2_max, ec_min, ec_max
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const c of allCrops) {
    const existing = db.prepare('SELECT standard_id FROM soil_standard WHERE crop_id = ?').get(c.crop_id);
    if (!existing) {
      const isRoot = c.group_id === 'GRP-ROOT' || c.crop_name.includes('감자') || c.crop_name.includes('무');
      const isFruitVeg = c.group_id === 'GRP-FRUIT-VEG' || c.crop_name.includes('고추') || c.crop_name.includes('토마토');
      const isSpice = c.group_id === 'GRP-SPICE' || c.crop_name.includes('마늘') || c.crop_name.includes('양파');
      insStd.run(
        `STD-${c.crop_id.replace(/^CRP-/, '')}`,
        c.crop_id,
        isRoot ? 5.8 : 6.0,
        isRoot ? 6.5 : 6.8,
        25,
        35,
        isFruitVeg ? 350 : 300,
        isFruitVeg ? 500 : 450,
        isSpice ? 0.55 : 0.45,
        isSpice ? 0.85 : 0.75,
        5.0,
        6.5,
        1.5,
        2.2,
        150,
        220,
        0.5,
        1.8
      );
    }
  }
}
