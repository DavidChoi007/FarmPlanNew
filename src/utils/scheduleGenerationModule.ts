export const SCHEDULE_GEN_MODULE_STORAGE_KEY = 'hanfarm_schedule_generation_module_v1';
export const SCHEDULE_GEN_MODULE_SYNC_KEY = 'schedule_generation_module_v1';

export type ScheduleGenModuleCategory = 'RULE_LOGIC' | 'AI_AGENT';

export interface ScheduleGenerationModuleItem {
  id: string;
  key: string;
  category: ScheduleGenModuleCategory;
  code: string;
  title: string;
  badge: string;
  formulaOrMethod: string;
  formula?: string;
  description: string;
  uncheckEffect: string;
  impact_when_disabled?: string;
  enabled: boolean;
}

export interface ScheduleGenerationModuleConfig {
  version: number;
  updated_at: string;
  updated_by: string;
  items: ScheduleGenerationModuleItem[];
}

export const DEFAULT_SCHEDULE_GENERATION_MODULE_ITEMS: ScheduleGenerationModuleItem[] = [
  // ==================== 1. 정량 규칙 · 수식 로직 선택 (RULE_LOGIC) ====================
  {
    id: 'RULE-01',
    key: 'past_climate_blend_avg',
    category: 'RULE_LOGIC',
    code: 'LOGIC-CLIMATE-BLEND',
    title: '작년 실측 기후 + 올해 예측 기후(+6개월 이내) 평균 대입 로직 (BLENDED_AVG)',
    badge: '기후 결합 규칙',
    formulaOrMethod: 'T_apply = (T_past(MM-DD) + T_forecast(YYYY-MM-DD)) ÷ 2',
    description:
      '동일 날짜에 작년 지역별 실측 기후(climate_address_daily)와 올해 예측 기후(climate_future_daily, 현재 기준 +6개월 이내)가 모두 존재할 때 두 기후 데이터의 평균값을 대입하여 일별 기온·습도·강수량을 산출합니다.',
    uncheckEffect:
      '선택 해제 시 올해 예측 기후를 혼합하지 않고 작년 동일 날짜(MM-DD) 실측 기후 단독 기준으로 일정을 산출합니다.',
    enabled: true,
  },
  {
    id: 'RULE-02',
    key: 'unforecast_past_fallback',
    category: 'RULE_LOGIC',
    code: 'LOGIC-PAST-FALLBACK',
    title: '+6개월 이후 미예측 구간 작년 동일 날짜(MM-DD) 기후 단독 폴백 로직 (PAST_ONLY)',
    badge: '미예측 폴백 규칙',
    formulaOrMethod: 'Date > Horizon(+6개월) ⇒ T_apply = T_past(MM-DD)',
    description:
      '기상청 예측 범위를 벗어나는 +6개월 이후 미예측 날짜(12월 31일 안쪽 날짜 및 익년 포함)는 작년 동일 월·일(MM-DD)의 지역별 기후 데이터를 단독 참고하여 16개 생육과정 일정을 끊김 없이 생성합니다.',
    uncheckEffect:
      '선택 해제 시 미예측 구간에 작년 일별 실측치 대신 평년 기본 기온(18.5℃)을 고정 대입합니다.',
    enabled: true,
  },
  {
    id: 'RULE-03',
    key: 'seedling_opt_temp_filter',
    category: 'RULE_LOGIC',
    code: 'LOGIC-SEEDLING-OPT-TEMP',
    title: '첫 실질적 생육 작업(모종 정식 등) 최저·최고 한계온도 제외 및 최적 예상 온도 시작 로직',
    badge: '모종 최적온도 시작',
    formulaOrMethod: 'Exclude(T_past < min_temp ∨ T_past > max_temp) → Select(opt_temp 구간)',
    description:
      '첫 실질적 생육 작업(정식 등)을 시작할 때 작년 기준 해당 작물(모종)의 최저온도(min_temp) 미만 및 최고온도(max_temp) 초과 기간을 제외하고, 최적 예상 온도(opt_temp)에 도달하는 날 시작일을 결정합니다.',
    uncheckEffect:
      '선택 해제 시 한계온도 제외 및 최적온도 탐색 없이 사용자가 요청한 희망 시작일(desired_start_date)을 그대로 시작일로 적용합니다.',
    enabled: true,
  },
  {
    id: 'RULE-04',
    key: 'seed_germination_early_start',
    category: 'RULE_LOGIC',
    code: 'LOGIC-SEED-GERM-START',
    title: "작물구분 '씨(종자)' 선택 시 적정 발아온도 이상 빠른 시기 평균날씨 파종 시작 로직",
    badge: '씨 발아온도 조기파종',
    formulaOrMethod: "planting_type == '씨' ⇒ Earliest(T_avg ≥ germination_temp ∧ 강수 ≤ 4mm)",
    description:
      "작물구분 값이 '씨'일 경우 평균 온도가 적정 발아온도(germination_temp) 이상인 빠른 시기에 평균날씨(무강우·적습)를 선택하여 생육과정 중 파종 및 육묘 역산 일정을 시작합니다.",
    uncheckEffect:
      '선택 해제 시 발아온도 조기 탐색을 수행하지 않고 기본 희망 시작일 기준 표준 간격으로 파종일을 설정합니다.',
    enabled: true,
  },
  {
    id: 'RULE-05',
    key: 'regional_pgdd_matching',
    category: 'RULE_LOGIC',
    code: 'LOGIC-REGIONAL-PGDD',
    title: '재배지(시도·시군구·읍면동) 및 품종 조·중·만생종별 목표 적산온도(GDD/PGDD) 매칭 로직',
    badge: '지역별 적산온도 연동',
    formulaOrMethod: 'Target_PGDD = Regional_Template_PGDD(시도·시군구·읍면동) × Maturity_Scale',
    description:
      '같은 농작물이라도 지역별로 적산온도가 달라질 수 있으므로 [4. 농작물 관리 > 작물별 생육 과정 적산온도 관리]에 등록된 시도·시군구·읍면동 기준 목표 적산온도(PGDD)와 품종 숙기 계수를 우선 적용합니다.',
    uncheckEffect:
      '선택 해제 시 지역·품종별 적산온도 편차를 반영하지 않고 전국 공통 표준 소요일수(고정 Offset)로만 산출합니다.',
    enabled: true,
  },
  {
    id: 'RULE-06',
    key: 'soil_topo_microclimate_offset',
    category: 'RULE_LOGIC',
    code: 'LOGIC-SOIL-TOPO-OFFSET',
    title: '토양검정(pH·유기물·배수등급) 및 지형(고랭지·분지)·멀칭 미기후 보정 로직',
    badge: '토양·지형 미기후 보정',
    formulaOrMethod: 'T_field = T_air + ΔT_topo(지형·고도) + ΔT_mulch(멀칭/하우스) + ΔD_lime(pH)',
    description:
      '산성 토양(pH < 5.9) 석회 시용 후 가스 피해 방지를 위한 반응 일수(+1~3일) 확보, 고랭지·산간분지·해안 지형별 기온감률, 비닐멀칭/시설하우스 지온 상승분을 정밀 반영합니다.',
    uncheckEffect:
      '선택 해제 시 토양 석회 반응일수 및 지형·멀칭 미기후 온도 보정치를 0(보정 없음)으로 처리합니다.',
    enabled: true,
  },
  {
    id: 'RULE-07',
    key: 'cascade_stage_shift',
    category: 'RULE_LOGIC',
    code: 'LOGIC-CASCADE-SHIFT',
    title: '선행 생육과정 일자 변경·지연 시 후속 공정 자동 연쇄 보정(Cascade Shift) 로직',
    badge: '후속 일정 연쇄 보정',
    formulaOrMethod: 'ΔD = New_Date(stage_k) - Old_Date(stage_k) ⇒ Shift(stage_{k+1..16}, +ΔD)',
    description:
      '특정 생육과정의 실제 수행일 또는 예정 시작일이 변경될 경우, 후속 생육과정들의 일정을 목표 적산온도 도달 간격 및 표준 소요일수에 맞춰 자동으로 연쇄 재산출합니다.',
    uncheckEffect:
      '선택 해제 시 특정 생육과정 일자를 수정하더라도 후속 생육과정 일자는 자동 이동하지 않고 개별 공정만 변경됩니다.',
    enabled: true,
  },

  // ==================== 2. AI 에이전트 · AI 추론 모델 선택 (AI_AGENT) ====================
  {
    id: 'AI-01',
    key: 'ai_multivariate_pgdd_model',
    category: 'AI_AGENT',
    code: 'AI-AGENT-MULTIVARIATE-PGDD',
    title: 'AI 다변량 생육속도 추론 에이전트 (AI-PGDD 광합성 동화효율·습도·강수 복합 모델)',
    badge: 'AI 생육속도 추론',
    formulaOrMethod: 'AI_PGDD = Raw_GDD × k_conv × η_thermal(적온동화) × w_moisture(습도·강우) × f_soil',
    description:
      '단순 기온 합산(Raw GDD) 대신, 생육적온 광합성 동화효율(thermalEfficiency), 강수량·상대습도·일조 스트레스 가중치(moistureWeight), 토양 비옥도·배수 효율을 AI 다변량 가중치로 복합 추론하여 일일 실질 생육속도(AI-PGDD)를 산출합니다.',
    uncheckEffect:
      '선택 해제 시 AI 다변량 기상·토양 가중치를 제외하고 단순 온도차 일반 적산온도(Raw GDD) 수식으로만 도달일을 계산합니다.',
    enabled: true,
  },
  {
    id: 'AI-02',
    key: 'ai_work_date_optimizer',
    category: 'AI_AGENT',
    code: 'AI-AGENT-WORKDATE-OPT',
    title: 'AI 농작업 적기 탐색 및 기상 악화(강우·과습·폭염·동해) 회피 보정 에이전트',
    badge: 'AI 작업적기 탐색',
    formulaOrMethod: 'Best_Date = argmax_{d ∈ [D_pgdd ± R]} Score_AI(강수, 습도, 기온, 작업성격)',
    description:
      '목표 적산온도 도달일 전후(±searchRange일)의 기상 데이터를 스코어링하여 공정 성격별(경운·시비·방제, 멀칭·정식, 웃거름 추비, 수확·예건)로 호우(≥8mm)·과습·폭염·동해 위험을 회피하는 최적 작업일로 자동 이동(Shift) 보정합니다.',
    uncheckEffect:
      '선택 해제 시 강우·과습 등 기상 악화 회피 보정을 수행하지 않고 순수 적산온도 도달 당일(Shift 0일)을 그대로 적용합니다.',
    enabled: true,
  },
  {
    id: 'AI-03',
    key: 'ai_stage_agro_recommender',
    category: 'AI_AGENT',
    code: 'AI-AGENT-STAGE-RECOMMENDER',
    title: 'AI 에이전트 생육단계별 맞춤 농자재 처방 및 AI 추천 소견서(근거) 자동 생성',
    badge: 'AI 농자재 처방·소견',
    formulaOrMethod: 'Top1_Material = AI_Rank(생육단계 목표성분, 토양검정 화학성, 기후·PLS, 평수 소요량)',
    description:
      '산출된 16개 생육과정 일정과 재배지 토양검정·기후 조건을 결합하여 각 생육과정별 최고 점수 농자재(비료·영양제·병해충관리제·종자·모종) 및 평수별 필요 수량을 산출하고 AI 처방 소견서를 생성합니다.',
    uncheckEffect:
      '선택 해제 시 AI 맞춤 처방 소견서 및 기후·토양 가중치 스코어링을 생략하고 기본 표준 자재 정보만 매칭합니다.',
    enabled: true,
  },
];

export function createDefaultScheduleGenerationModuleConfig(): ScheduleGenerationModuleConfig {
  return {
    version: 1,
    updated_at: new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' '),
    updated_by: '관리자 (기본값 전체 선택)',
    items: DEFAULT_SCHEDULE_GENERATION_MODULE_ITEMS.map((it) => ({
      ...it,
      formula: it.formulaOrMethod,
      impact_when_disabled: it.uncheckEffect,
      enabled: true,
    })),
  };
}

export function normalizeScheduleGenerationModuleConfig(
  raw?: any
): ScheduleGenerationModuleConfig {
  const def = createDefaultScheduleGenerationModuleConfig();
  if (!raw || typeof raw !== 'object') return def;

  const rawItems: any[] = Array.isArray(raw.items) ? raw.items : [];
  const byKey = new Map<string, boolean>();
  for (const r of rawItems) {
    if (r && typeof r === 'object') {
      if (r.key) byKey.set(String(r.key), Boolean(r.enabled));
      if (r.id) byKey.set(String(r.id), Boolean(r.enabled));
    }
  }
  if (raw.enabledMap && typeof raw.enabledMap === 'object') {
    for (const [k, v] of Object.entries(raw.enabledMap)) {
      byKey.set(k, Boolean(v));
    }
  }

  return {
    version: Number(raw.version || 1),
    updated_at: String(raw.updated_at || def.updated_at),
    updated_by: String(raw.updated_by || def.updated_by),
    items: DEFAULT_SCHEDULE_GENERATION_MODULE_ITEMS.map((item) => ({
      ...item,
      formula: item.formulaOrMethod,
      impact_when_disabled: item.uncheckEffect,
      enabled: byKey.has(item.key)
        ? Boolean(byKey.get(item.key))
        : byKey.has(item.id)
        ? Boolean(byKey.get(item.id))
        : true,
    })),
  };
}

export function getEnabledModuleFlags(config?: ScheduleGenerationModuleConfig | null): Record<string, boolean> {
  const normalized = normalizeScheduleGenerationModuleConfig(config);
  const map: Record<string, boolean> = {};
  for (const it of normalized.items) {
    map[it.key] = Boolean(it.enabled);
    map[it.id] = Boolean(it.enabled);
  }
  return map;
}

export function loadScheduleGenerationModuleFromStorage(): ScheduleGenerationModuleConfig {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createDefaultScheduleGenerationModuleConfig();
  }
  try {
    const raw = window.localStorage.getItem(SCHEDULE_GEN_MODULE_STORAGE_KEY);
    if (raw) {
      return normalizeScheduleGenerationModuleConfig(JSON.parse(raw));
    }
  } catch {
    // ignore storage errors
  }
  return createDefaultScheduleGenerationModuleConfig();
}

export function saveScheduleGenerationModuleToStorage(
  config: ScheduleGenerationModuleConfig
): ScheduleGenerationModuleConfig {
  const normalized = normalizeScheduleGenerationModuleConfig(config);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(SCHEDULE_GEN_MODULE_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // ignore storage errors
    }
  }
  return normalized;
}
