import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { runPostgresQuery, supabaseRestUpsert } from './supabaseClient.ts';

const dbPath = path.resolve(process.cwd(), 'data', 'farmplan.db');
const sqliteDb = new DatabaseSync(dbPath);

async function migrateAllToSupabase() {
  console.log('==============================================================');
  console.log('[Supabase Migration] 1단계: PostgreSQL 17 전체 19개 테이블 스키마 생성...');
  console.log('==============================================================');

  const ddlSql = `
    -- 1. 1단계: 작물군 (crop_group)
    CREATE TABLE IF NOT EXISTS public.crop_group (
      group_id TEXT PRIMARY KEY,
      group_name TEXT NOT NULL,
      description TEXT,
      icon_name TEXT DEFAULT 'Sprout',
      sort_order INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1
    );

    -- 2. 2단계: 작물 (crop)
    CREATE TABLE IF NOT EXISTS public.crop (
      crop_id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES public.crop_group(group_id) ON DELETE CASCADE ON UPDATE CASCADE,
      crop_name TEXT NOT NULL,
      scientific_name TEXT,
      description TEXT,
      is_active INTEGER DEFAULT 1
    );

    -- 3. 품종 (cultivar)
    CREATE TABLE IF NOT EXISTS public.cultivar (
      cultivar_id TEXT PRIMARY KEY,
      crop_id TEXT NOT NULL REFERENCES public.crop(crop_id) ON DELETE CASCADE ON UPDATE CASCADE,
      cultivar_name TEXT NOT NULL,
      maturity_type TEXT NOT NULL,
      avg_growth_days INTEGER NOT NULL,
      characteristics TEXT,
      is_active INTEGER DEFAULT 1
    );

    -- 4. 3단계: 재배작형 (cropping_system)
    CREATE TABLE IF NOT EXISTS public.cropping_system (
      system_id TEXT PRIMARY KEY,
      crop_id TEXT NOT NULL REFERENCES public.crop(crop_id) ON DELETE CASCADE ON UPDATE CASCADE,
      system_name TEXT NOT NULL,
      cultivation_method TEXT NOT NULL,
      sowing_months TEXT NOT NULL,
      harvest_months TEXT NOT NULL,
      is_overwintering INTEGER DEFAULT 0,
      base_temp_tb DOUBLE PRECISION NOT NULL,
      required_gdd DOUBLE PRECISION NOT NULL,
      required_raw_gdd DOUBLE PRECISION NOT NULL,
      opt_temp_min DOUBLE PRECISION NOT NULL,
      opt_temp_max DOUBLE PRECISION NOT NULL,
      limit_temp_min DOUBLE PRECISION NOT NULL,
      limit_temp_max DOUBLE PRECISION NOT NULL,
      damage_temp_low DOUBLE PRECISION NOT NULL,
      damage_temp_high DOUBLE PRECISION NOT NULL
    );

    -- 5. 생육 구분 기초 코드 (growth_type_code)
    CREATE TABLE IF NOT EXISTS public.growth_type_code (
      type_code TEXT PRIMARY KEY,
      type_name TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER DEFAULT 1
    );

    -- 6. 생육과정 기초 코드 (growth_process_code)
    CREATE TABLE IF NOT EXISTS public.growth_process_code (
      process_code TEXT PRIMARY KEY,
      process_name TEXT NOT NULL,
      process_type TEXT DEFAULT 'WORK',
      description TEXT,
      sort_order INTEGER DEFAULT 1
    );

    -- 7. 표준 생육단계 및 농작업 템플릿 (standard_template)
    CREATE TABLE IF NOT EXISTS public.standard_template (
      template_id TEXT PRIMARY KEY,
      group_id TEXT,
      crop_id TEXT,
      cultivar_id TEXT,
      system_id TEXT NOT NULL REFERENCES public.cropping_system(system_id) ON DELETE CASCADE ON UPDATE CASCADE,
      step_order INTEGER NOT NULL,
      item_type TEXT NOT NULL,
      item_category TEXT NOT NULL,
      item_code TEXT NOT NULL,
      item_name TEXT NOT NULL,
      target_gdd_ratio DOUBLE PRECISION NOT NULL,
      target_pgdd DOUBLE PRECISION NOT NULL,
      days_from_start INTEGER NOT NULL,
      tolerance_days INTEGER DEFAULT 3,
      guide_criteria TEXT,
      climate_countermeasure TEXT
    );

    -- 8. 작물별 토양 기준치 (soil_standard)
    CREATE TABLE IF NOT EXISTS public.soil_standard (
      standard_id TEXT PRIMARY KEY,
      crop_id TEXT NOT NULL,
      ph_min DOUBLE PRECISION, ph_max DOUBLE PRECISION,
      om_min DOUBLE PRECISION, om_max DOUBLE PRECISION,
      p2o5_min DOUBLE PRECISION, p2o5_max DOUBLE PRECISION,
      k_min DOUBLE PRECISION, k_max DOUBLE PRECISION,
      ca_min DOUBLE PRECISION, ca_max DOUBLE PRECISION,
      mg_min DOUBLE PRECISION, mg_max DOUBLE PRECISION,
      sio2_min DOUBLE PRECISION, sio2_max DOUBLE PRECISION,
      ec_min DOUBLE PRECISION, ec_max DOUBLE PRECISION
    );

    -- 9. 비료 및 작물보호제 마스터 (agro_material)
    CREATE TABLE IF NOT EXISTS public.agro_material (
      material_id TEXT PRIMARY KEY,
      material_category TEXT NOT NULL,
      sub_type TEXT NOT NULL,
      product_name TEXT NOT NULL,
      is_organic INTEGER DEFAULT 0,
      target_nutrient_or_pest TEXT NOT NULL,
      n_pct DOUBLE PRECISION DEFAULT 0,
      p_pct DOUBLE PRECISION DEFAULT 0,
      k_pct DOUBLE PRECISION DEFAULT 0,
      ca_pct DOUBLE PRECISION DEFAULT 0,
      om_pct DOUBLE PRECISION DEFAULT 0,
      dosage_per_100pyeong TEXT NOT NULL,
      unit_spec TEXT NOT NULL,
      unit_price INTEGER NOT NULL,
      usage_stage TEXT NOT NULL,
      weather_trigger TEXT
    );

    -- 10. 기상 관측지점 (weather_station)
    CREATE TABLE IF NOT EXISTS public.weather_station (
      station_id TEXT PRIMARY KEY,
      region_code TEXT NOT NULL,
      station_name TEXT NOT NULL,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      altitude_m DOUBLE PRECISION NOT NULL,
      grid_x INTEGER NOT NULL,
      grid_y INTEGER NOT NULL,
      fallback_station_id TEXT,
      sync_status TEXT DEFAULT 'ACTIVE',
      last_synced_at TEXT
    );

    -- 11. 관측지점 일별 기상 (weather_daily_data)
    CREATE TABLE IF NOT EXISTS public.weather_daily_data (
      weather_id TEXT PRIMARY KEY,
      station_id TEXT NOT NULL REFERENCES public.weather_station(station_id) ON DELETE CASCADE ON UPDATE CASCADE,
      weather_date TEXT NOT NULL,
      data_type TEXT NOT NULL,
      temp_avg DOUBLE PRECISION NOT NULL,
      temp_max DOUBLE PRECISION NOT NULL,
      temp_min DOUBLE PRECISION NOT NULL,
      precipitation_mm DOUBLE PRECISION DEFAULT 0,
      humidity_pct DOUBLE PRECISION DEFAULT 60,
      is_interpolated INTEGER DEFAULT 0,
      source_type TEXT DEFAULT 'MANUAL_SEED',
      synced_at TEXT NOT NULL
    );

    -- 12. 재배환경 온도보정 (weather_env_correction)
    CREATE TABLE IF NOT EXISTS public.weather_env_correction (
      correction_id TEXT PRIMARY KEY,
      env_name TEXT NOT NULL,
      cultivation_method TEXT NOT NULL,
      mulching_yn INTEGER DEFAULT 0,
      temp_offset_c DOUBLE PRECISION NOT NULL,
      altitude_lapse_rate DOUBLE PRECISION DEFAULT -0.6,
      description TEXT
    );

    -- 13. 기상 동기화 이력 (weather_sync_log)
    CREATE TABLE IF NOT EXISTS public.weather_sync_log (
      sync_id TEXT PRIMARY KEY,
      station_id TEXT NOT NULL,
      sync_type TEXT NOT NULL,
      target_period TEXT NOT NULL,
      record_count INTEGER NOT NULL,
      interpolated_count INTEGER DEFAULT 0,
      status TEXT NOT NULL,
      executed_at TEXT NOT NULL,
      memo TEXT
    );

    -- 14. 농가 재배일정 요청 (schedule_request)
    CREATE TABLE IF NOT EXISTS public.schedule_request (
      request_id TEXT PRIMARY KEY,
      farmer_name TEXT NOT NULL,
      region_name TEXT NOT NULL,
      station_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      crop_id TEXT NOT NULL,
      cultivar_id TEXT NOT NULL,
      system_id TEXT NOT NULL,
      request_type TEXT NOT NULL,
      area_pyeong INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      expected_harvest_date TEXT NOT NULL,
      mulching_yn INTEGER DEFAULT 1,
      irrigation_yn INTEGER DEFAULT 1,
      is_organic INTEGER DEFAULT 0,
      has_soil_test INTEGER DEFAULT 0,
      soil_ph DOUBLE PRECISION,
      soil_k DOUBLE PRECISION,
      soil_om DOUBLE PRECISION,
      accumulated_pgdd DOUBLE PRECISION DEFAULT 0,
      remaining_pgdd DOUBLE PRECISION NOT NULL,
      progress_pct INTEGER DEFAULT 0,
      pipeline_status TEXT NOT NULL,
      requested_at TEXT NOT NULL
    );

    -- 15. 농가 재배이력 로그 (cultivation_history_log)
    CREATE TABLE IF NOT EXISTS public.cultivation_history_log (
      history_id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL REFERENCES public.schedule_request(request_id) ON DELETE CASCADE ON UPDATE CASCADE,
      item_type TEXT NOT NULL,
      item_code TEXT NOT NULL,
      item_name TEXT NOT NULL,
      predicted_date TEXT NOT NULL,
      actual_date TEXT NOT NULL,
      confirmed_at TEXT NOT NULL,
      material_used TEXT,
      calculated_stage_pgdd DOUBLE PRECISION DEFAULT 0,
      sequence_check TEXT DEFAULT 'PASS',
      date_valid TEXT DEFAULT 'PASS',
      missing_flag INTEGER DEFAULT 0,
      reliability_score DOUBLE PRECISION DEFAULT 0.95,
      quality_flag TEXT DEFAULT 'NORMAL',
      include_in_training INTEGER DEFAULT 1
    );

    -- 16. 생육예측모델 버전 (growth_model_version)
    CREATE TABLE IF NOT EXISTS public.growth_model_version (
      version_id TEXT PRIMARY KEY,
      crop_id TEXT NOT NULL,
      cultivar_id TEXT NOT NULL,
      system_id TEXT NOT NULL,
      version_tag TEXT NOT NULL,
      model_track TEXT NOT NULL,
      base_temp_tb DOUBLE PRECISION NOT NULL,
      stage_1_name TEXT, stage_1_pgdd DOUBLE PRECISION,
      stage_2_name TEXT, stage_2_pgdd DOUBLE PRECISION,
      stage_3_name TEXT, stage_3_pgdd DOUBLE PRECISION,
      total_pgdd DOUBLE PRECISION NOT NULL,
      env_correction_factor DOUBLE PRECISION DEFAULT 1.0,
      predicted_mae_days DOUBLE PRECISION NOT NULL,
      error_cause_type TEXT,
      sample_count INTEGER DEFAULT 0,
      status TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      release_note TEXT
    );

    -- 17. 전국 재배지 주소록 마스터 (cultivation_address)
    CREATE TABLE IF NOT EXISTS public.cultivation_address (
      address_id INTEGER PRIMARY KEY,
      bjd_code TEXT UNIQUE NOT NULL,
      sido TEXT NOT NULL,
      sigungu TEXT NOT NULL,
      eupmyeondong TEXT NOT NULL,
      full_address TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cult_addr_sido ON public.cultivation_address(sido);
    CREATE INDEX IF NOT EXISTS idx_cult_addr_sigungu ON public.cultivation_address(sido, sigungu);
    CREATE INDEX IF NOT EXISTS idx_cult_addr_dong ON public.cultivation_address(eupmyeondong);

    -- 18. 전국 재배지 토양 성분 조사 (soil_address_survey, FK: bjd_code)
    CREATE TABLE IF NOT EXISTS public.soil_address_survey (
      bjd_code TEXT PRIMARY KEY REFERENCES public.cultivation_address(bjd_code) ON DELETE CASCADE ON UPDATE CASCADE,
      survey_year INTEGER NOT NULL DEFAULT 2025,
      land_category TEXT NOT NULL,
      soil_texture TEXT NOT NULL,
      drainage_class TEXT NOT NULL,
      soil_ph DOUBLE PRECISION NOT NULL,
      soil_ec DOUBLE PRECISION NOT NULL,
      organic_matter_g_kg DOUBLE PRECISION NOT NULL,
      avail_p2o5_mg_kg DOUBLE PRECISION NOT NULL,
      exch_k_cmol DOUBLE PRECISION NOT NULL,
      exch_ca_cmol DOUBLE PRECISION NOT NULL,
      exch_mg_cmol DOUBLE PRECISION NOT NULL,
      avail_sio2_mg_kg DOUBLE PRECISION NOT NULL,
      lime_req_kg_10a DOUBLE PRECISION NOT NULL,
      fertility_grade TEXT NOT NULL,
      source_agency TEXT NOT NULL DEFAULT '농촌진흥청 흙토람 토양검정 DB',
      exam_day TEXT NOT NULL DEFAULT '2025-10-25',
      updated_at TEXT NOT NULL
    );

    -- 19. 전국 재배지 2025년 일별 기후 데이터 (climate_address_daily, FK: bjd_code)
    CREATE TABLE IF NOT EXISTS public.climate_address_daily (
      bjd_code TEXT NOT NULL REFERENCES public.cultivation_address(bjd_code) ON DELETE CASCADE ON UPDATE CASCADE,
      record_date TEXT NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      day INTEGER NOT NULL,
      temp_min DOUBLE PRECISION NOT NULL,
      temp_max DOUBLE PRECISION NOT NULL,
      temp_avg DOUBLE PRECISION NOT NULL,
      humidity_avg INTEGER NOT NULL,
      precipitation_mm DOUBLE PRECISION NOT NULL,
      PRIMARY KEY (bjd_code, record_date)
    );
    CREATE INDEX IF NOT EXISTS idx_climate_daily_month ON public.climate_address_daily(month);

    -- 20. 농작물 재배 일정 요청 관리 테이블 (member_schedule_request, FK: bjd_code)
    CREATE TABLE IF NOT EXISTS public.member_schedule_request (
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
      bjd_code TEXT NOT NULL REFERENCES public.cultivation_address(bjd_code) ON DELETE CASCADE ON UPDATE CASCADE,
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
      requested_at TEXT NOT NULL
    );

    -- PostgREST 스키마 캐시 리로드
    NOTIFY pgrst, 'reload schema';
  `;

  await runPostgresQuery(ddlSql);
  console.log('✅ 20개 테이블 스키마 및 외래키(FK) 생성 완료!');

  // PostgREST 스키마 반영을 위해 1.5초 대기
  await new Promise((r) => setTimeout(r, 1500));

  console.log('\n==============================================================');
  console.log('[Supabase Migration] 2단계: 마스터/주소/토양/요청 19개 테이블 데이터 이관...');
  console.log('==============================================================');

  const tablesToMigrate: Array<{
    name: string;
    pk: string;
    transform?: (row: any) => any;
  }> = [
    { name: 'crop_group', pk: 'group_id' },
    { name: 'crop', pk: 'crop_id' },
    { name: 'cultivar', pk: 'cultivar_id' },
    { name: 'cropping_system', pk: 'system_id' },
    { name: 'growth_type_code', pk: 'type_code' },
    { name: 'growth_process_code', pk: 'process_code' },
    { name: 'standard_template', pk: 'template_id' },
    { name: 'soil_standard', pk: 'standard_id' },
    { name: 'agro_material', pk: 'material_id' },
    { name: 'weather_station', pk: 'station_id' },
    { name: 'weather_daily_data', pk: 'weather_id' },
    { name: 'weather_env_correction', pk: 'correction_id' },
    { name: 'weather_sync_log', pk: 'sync_id' },
    {
      name: 'schedule_request',
      pk: 'request_id',
      transform: (r) => {
        const copy = { ...r, accumulated_pgdd: r.Accumulated_pgdd ?? r.accumulated_pgdd ?? 0 };
        delete copy.Accumulated_pgdd;
        return copy;
      },
    },
    { name: 'cultivation_history_log', pk: 'history_id' },
    {
      name: 'growth_model_version',
      pk: 'version_id',
      transform: (r) => {
        const copy = { ...r, model_track: r.model_Track ?? r.model_track ?? 'TRACK_A_BASE' };
        delete copy.model_Track;
        return copy;
      },
    },
    { name: 'cultivation_address', pk: 'address_id' },
    { name: 'soil_address_survey', pk: 'bjd_code' },
    { name: 'member_schedule_request', pk: 'request_no' },
  ];

  for (const tbl of tablesToMigrate) {
    const rawRows = sqliteDb.prepare(`SELECT * FROM ${tbl.name}`).all() as any[];
    const rows = tbl.transform ? rawRows.map(tbl.transform) : rawRows;
    const batchSize = 500;
    for (let i = 0; i < rows.length; i += batchSize) {
      const chunk = rows.slice(i, i + batchSize);
      const ok = await supabaseRestUpsert(tbl.name, chunk, tbl.pk);
      if (!ok) {
        throw new Error(`테이블 [${tbl.name}] Upsert 실패 (offset: ${i})`);
      }
    }
    console.log(` - [완료] ${tbl.name.padEnd(26)}: ${rows.length.toLocaleString()}건 이관 성공`);
  }

  console.log('\n==============================================================');
  console.log('[Supabase Migration] 3단계: 전국 4,455개 읍·면·동 × 365일 기후 데이터 적재...');
  console.log('==============================================================');

  const existingClimate = await runPostgresQuery('SELECT COUNT(*) as cnt FROM public.climate_address_daily;');
  const currentCnt = Number(existingClimate.rows[0]?.cnt || 0);
  if (currentCnt >= 1600000) {
    console.log(` - [건너뜀] climate_address_daily 이미 ${currentCnt.toLocaleString()}건 적재됨`);
  } else {
    const sidos = sqliteDb
      .prepare('SELECT DISTINCT sido FROM cultivation_address ORDER BY address_id ASC')
      .all() as Array<{ sido: string }>;

    const SIDO_CLIMATE_PROFILE: Record<
      string,
      { baseMean: number; amp: number; diurnal: number; rainScale: number; humBase: number }
    > = {
      서울특별시: { baseMean: 12.8, amp: 15.0, diurnal: 8.8, rainScale: 1.05, humBase: 61 },
      부산광역시: { baseMean: 15.0, amp: 12.2, diurnal: 7.6, rainScale: 1.22, humBase: 64 },
      대구광역시: { baseMean: 14.3, amp: 14.5, diurnal: 9.8, rainScale: 0.88, humBase: 58 },
      인천광역시: { baseMean: 12.5, amp: 14.2, diurnal: 7.9, rainScale: 0.98, humBase: 66 },
      광주광역시: { baseMean: 14.1, amp: 13.8, diurnal: 9.2, rainScale: 1.12, humBase: 65 },
      대전광역시: { baseMean: 13.3, amp: 14.6, diurnal: 9.6, rainScale: 1.04, humBase: 63 },
      울산광역시: { baseMean: 14.4, amp: 12.8, diurnal: 8.9, rainScale: 1.08, humBase: 62 },
      세종특별자치시: { baseMean: 12.9, amp: 14.8, diurnal: 10.2, rainScale: 1.02, humBase: 64 },
      경기도: { baseMean: 12.1, amp: 15.3, diurnal: 10.4, rainScale: 1.06, humBase: 63 },
      강원특별자치도: { baseMean: 10.2, amp: 15.1, diurnal: 10.8, rainScale: 1.18, humBase: 64 },
      충청북도: { baseMean: 12.3, amp: 15.2, diurnal: 10.9, rainScale: 1.0, humBase: 63 },
      충청남도: { baseMean: 12.9, amp: 14.4, diurnal: 10.1, rainScale: 1.03, humBase: 66 },
      전북특별자치도: { baseMean: 13.5, amp: 14.1, diurnal: 9.9, rainScale: 1.08, humBase: 66 },
      전라남도: { baseMean: 14.3, amp: 12.9, diurnal: 9.1, rainScale: 1.18, humBase: 68 },
      경상북도: { baseMean: 12.8, amp: 14.6, diurnal: 11.1, rainScale: 0.92, humBase: 60 },
      경상남도: { baseMean: 14.2, amp: 13.3, diurnal: 9.7, rainScale: 1.16, humBase: 63 },
      제주특별자치도: { baseMean: 16.4, amp: 10.5, diurnal: 6.8, rainScale: 1.38, humBase: 70 },
    };

    for (const { sido } of sidos) {
      const prof = SIDO_CLIMATE_PROFILE[sido] || SIDO_CLIMATE_PROFILE['충청북도'];
      const safeSido = sido.replace(/'/g, "''");
      const batchSql = `
        INSERT INTO public.climate_address_daily (
          bjd_code, record_date, year, month, day,
          temp_min, temp_max, temp_avg, humidity_avg, precipitation_mm
        )
        SELECT
          a.bjd_code,
          to_char(d.dt, 'YYYY-MM-DD') AS record_date,
          2025 AS year,
          EXTRACT(MONTH FROM d.dt)::int AS month,
          EXTRACT(DAY FROM d.dt)::int AS day,
          ROUND((${prof.baseMean} - ${prof.amp} * cos(2 * pi() * (EXTRACT(DOY FROM d.dt) - 20) / 365.0) - ${prof.diurnal} / 2.0 + ((a.address_id % 9) - 4) * 0.15)::numeric, 1)::float8 AS temp_min,
          ROUND((${prof.baseMean} - ${prof.amp} * cos(2 * pi() * (EXTRACT(DOY FROM d.dt) - 20) / 365.0) + ${prof.diurnal} / 2.0 + ((a.address_id % 9) - 4) * 0.15)::numeric, 1)::float8 AS temp_max,
          ROUND((${prof.baseMean} - ${prof.amp} * cos(2 * pi() * (EXTRACT(DOY FROM d.dt) - 20) / 365.0) + ((a.address_id % 9) - 4) * 0.15)::numeric, 1)::float8 AS temp_avg,
          LEAST(96, GREATEST(35, ROUND(${prof.humBase} + 14 * sin(2 * pi() * (EXTRACT(DOY FROM d.dt) - 110) / 365.0) + (a.address_id % 7) - 3)::int)) AS humidity_avg,
          CASE
            WHEN ((EXTRACT(DOY FROM d.dt)::int * 17 + (a.address_id % 13)) % 11) = 0
            THEN ROUND(((8.5 + (EXTRACT(DOY FROM d.dt)::int % 28)) * ${prof.rainScale})::numeric, 1)::float8
            ELSE 0.0
          END AS precipitation_mm
        FROM public.cultivation_address a
        CROSS JOIN generate_series('2025-01-01'::date, '2025-12-31'::date, '1 day'::interval) AS d(dt)
        WHERE a.sido = '${safeSido}'
        ON CONFLICT (bjd_code, record_date) DO NOTHING;
      `;
      await runPostgresQuery(batchSql, 180000);
      console.log(` - [완료] ${sido.padEnd(12)} 2025년 365일 일별 기후 데이터 적재 완료`);
    }
  }

  console.log('\n==============================================================');
  console.log('[Supabase Migration] 4단계: 최종 이관 건수 검증...');
  console.log('==============================================================');
  const verifyRes = await runPostgresQuery(`
    SELECT 'crop_group' AS tbl, COUNT(*) AS cnt FROM public.crop_group
    UNION ALL SELECT 'crop', COUNT(*) FROM public.crop
    UNION ALL SELECT 'cultivar', COUNT(*) FROM public.cultivar
    UNION ALL SELECT 'cropping_system', COUNT(*) FROM public.cropping_system
    UNION ALL SELECT 'growth_type_code', COUNT(*) FROM public.growth_type_code
    UNION ALL SELECT 'growth_process_code', COUNT(*) FROM public.growth_process_code
    UNION ALL SELECT 'standard_template', COUNT(*) FROM public.standard_template
    UNION ALL SELECT 'soil_standard', COUNT(*) FROM public.soil_standard
    UNION ALL SELECT 'agro_material', COUNT(*) FROM public.agro_material
    UNION ALL SELECT 'weather_station', COUNT(*) FROM public.weather_station
    UNION ALL SELECT 'weather_daily_data', COUNT(*) FROM public.weather_daily_data
    UNION ALL SELECT 'weather_env_correction', COUNT(*) FROM public.weather_env_correction
    UNION ALL SELECT 'weather_sync_log', COUNT(*) FROM public.weather_sync_log
    UNION ALL SELECT 'schedule_request', COUNT(*) FROM public.schedule_request
    UNION ALL SELECT 'cultivation_history_log', COUNT(*) FROM public.cultivation_history_log
    UNION ALL SELECT 'growth_model_version', COUNT(*) FROM public.growth_model_version
    UNION ALL SELECT 'cultivation_address', COUNT(*) FROM public.cultivation_address
    UNION ALL SELECT 'soil_address_survey', COUNT(*) FROM public.soil_address_survey
    UNION ALL SELECT 'climate_address_daily', COUNT(*) FROM public.climate_address_daily;
  `);

  for (const r of verifyRes.rows) {
    console.log(` ✅ Supabase [${String(r.tbl).padEnd(25)}] : ${Number(r.cnt).toLocaleString()}건`);
  }
}

migrateAllToSupabase().catch((err) => {
  console.error('[Supabase Migration Error]', err);
  process.exit(1);
});
