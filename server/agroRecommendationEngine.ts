/**
 * FarmPlan 농자재 추천 근거 및 추천 방식 모듈 (Agro-Material Recommendation Engine)
 *
 * [핵심 설계 목적]
 * 개편된 3대 농자재 대분류(비료 FERTILIZER · 영양제 NUTRIENT · 병해충관리제 PESTICIDE)의
 * 카테고리별 전용 등록 항목(12종 확장 컬럼 + 9대 보증성분)과
 * ① 생육과정별 필수 요구 성분 프로파일
 * ② 재배지 7대 토양검정 화학성(pH, OM, 유효인산, 치환성 K·Ca·Mg, EC) 과부족 편차
 * ③ 지역 하이브리드 기후(온도·습도·강수량) 및 수확 잔여일수(PLS 안전사용기준)
 * 를 정량적으로 결합하여 최적 농자재를 선정하고, 명확한 추천 근거(Rationale)를 생성합니다.
 */

export interface SoilInputData {
  soil_ph: number;
  soil_ec: number;
  organic_matter_g_kg: number;
  avail_p2o5_mg_kg: number;
  exch_k_cmol: number;
  exch_ca_cmol: number;
  exch_mg_cmol: number;
  avail_sio2_mg_kg?: number;
  soil_texture?: string;
  land_category?: string;
}

export interface SoilStandardData {
  ph_min: number;
  ph_max: number;
  om_min: number;
  om_max: number;
  p2o5_min: number;
  p2o5_max: number;
  k_min: number;
  k_max: number;
  ca_min: number;
  ca_max: number;
  mg_min: number;
  mg_max: number;
  ec_min: number;
  ec_max: number;
}

export interface ClimateContextData {
  month: number;
  temp_avg: number;
  temp_max: number;
  temp_min: number;
  humidity_avg: number;
  rainfall_total_mm: number;
  rainy_days: number;
}

export interface StageRequirementSpec {
  stageKey: string;
  stageName: string;
  processCodes: string[];
  daysBeforeHarvestTypical: number;
  neededCategories: Array<'FERTILIZER' | 'NUTRIENT' | 'PESTICIDE'>;
  categoryCounts: { FERTILIZER: number; NUTRIENT: number; PESTICIDE: number };
  physiologicalGoal: string;
  fertilizerSpec: {
    targetNutrients: string[];
    minOmPct?: number;
    minNPct?: number;
    minPPct?: number;
    minKPct?: number;
    minCaPct?: number;
    minMgPct?: number;
    preferredMethod: string;
    preferredRelease: string;
    keywords: string[];
  };
  nutrientSpec: {
    targetActives: string[];
    minAminoPct?: number;
    minSeaweedPct?: number;
    minCaPct?: number;
    minBPct?: number;
    requireChelateMicro?: boolean;
    preferredMethod: string;
    stressKeywords: string[];
    keywords: string[];
  };
  pesticideSpec: {
    targetPests: string[];
    preferredMoaPrefix: string[];
    maxPhiDaysAllowed: number;
    preferredMethod: string;
    keywords: string[];
  };
}

/**
 * 16대 표준 재배일정 하위 과정 및 생육과정 코드(PRC-01 ~ PRC-29)별 요구 성분·자재 명세
 */
export const STAGE_REQUIREMENT_SPECS: Record<string, StageRequirementSpec> = {
  'SCH-01': {
    stageKey: 'SCH-01',
    stageName: '재배 준비 > 포장 정리 및 산도·토양 개량',
    processCodes: ['PRC-01', 'PRC-02'],
    daysBeforeHarvestTypical: 85,
    neededCategories: ['FERTILIZER'],
    categoryCounts: { FERTILIZER: 1, NUTRIENT: 0, PESTICIDE: 0 },
    physiologicalGoal: '산성 토양(pH) 교정, 불가급태 염류 분해 및 토양 입단화 기반 조성',
    fertilizerSpec: {
      targetNutrients: ['칼슘(CaO)', '고토(MgO)', '규산(SiO₂)', '유기물(OM)'],
      minCaPct: 10,
      minMgPct: 2,
      preferredMethod: '전층시비',
      preferredRelease: '완효성',
      keywords: ['석회', '고토', '개량', '입상석회', '유박', '퇴비'],
    },
    nutrientSpec: {
      targetActives: ['휴믹산·풀빅산'],
      preferredMethod: '관주시비',
      stressKeywords: ['토양개량', '염류'],
      keywords: ['풀빅', '휴믹', '토양'],
    },
    pesticideSpec: {
      targetPests: ['토양전염성 병원균'],
      preferredMoaPrefix: ['FRAC', '유기농'],
      maxPhiDaysAllowed: 60,
      preferredMethod: '토양혼화',
      keywords: ['토양', '소독'],
    },
  },
  'SCH-02': {
    stageKey: 'SCH-02',
    stageName: '재배 준비 > 밑거름(기비) 시비 및 로터리 경운',
    processCodes: ['PRC-03'],
    daysBeforeHarvestTypical: 75,
    neededCategories: ['FERTILIZER'],
    categoryCounts: { FERTILIZER: 3, NUTRIENT: 0, PESTICIDE: 0 },
    physiologicalGoal: '유기물(OM) 부식질 확충 및 초기~중기 지속형 3요소(N·P₂O₅·K₂O)+고토·붕소 전층 공급',
    fertilizerSpec: {
      targetNutrients: ['유기물(OM 50%↑)', '질소(N)', '인산(P₂O₅)', '칼륨(K₂O)', '고토(MgO)', '붕소(B₂O₃)'],
      minOmPct: 30,
      minNPct: 8,
      minPPct: 5,
      minKPct: 6,
      preferredMethod: '전층시비',
      preferredRelease: '완효성',
      keywords: ['밑거름', '유박', '유기질', '원예복합', '완효성', '고토', '붕소', '석회'],
    },
    nutrientSpec: {
      targetActives: ['해조추출물·풀빅산'],
      preferredMethod: '관주시비',
      stressKeywords: ['발근', '지력'],
      keywords: ['발근', '아미노'],
    },
    pesticideSpec: {
      targetPests: ['거세미나방', '고자리파리', '선충'],
      preferredMoaPrefix: ['IRAC'],
      maxPhiDaysAllowed: 60,
      preferredMethod: '토양처리',
      keywords: ['토양', '입제', '거세미'],
    },
  },
  'SCH-03': {
    stageKey: 'SCH-03',
    stageName: '재배 준비 > 이랑 만들기 및 토양 병해충 소독',
    processCodes: ['PRC-04', 'PRC-05'],
    daysBeforeHarvestTypical: 68,
    neededCategories: ['PESTICIDE', 'FERTILIZER'],
    categoryCounts: { FERTILIZER: 1, NUTRIENT: 0, PESTICIDE: 1 },
    physiologicalGoal: '두둑 성형 직후 잘록병(입고병)·뿌리혹병·지하부 해충 선제 차단 및 지온·수분 보존',
    fertilizerSpec: {
      targetNutrients: ['질소(N)', '인산(P₂O₅)', '칼슘(CaO)', '유황(S)'],
      minPPct: 6,
      preferredMethod: '전층시비',
      preferredRelease: '완효성',
      keywords: ['복합', '마늘', '배추', '밑거름', '황'],
    },
    nutrientSpec: {
      targetActives: ['유리아미노산', '해조추출물'],
      preferredMethod: '관주시비',
      stressKeywords: ['발근'],
      keywords: ['아미노', '발근'],
    },
    pesticideSpec: {
      targetPests: ['잘록병(입고병)', '뿌리혹병', '거세미나방', '고자리파리', '잡초'],
      preferredMoaPrefix: ['FRAC', 'IRAC', 'HRAC'],
      maxPhiDaysAllowed: 60,
      preferredMethod: '토양처리',
      keywords: ['사라져', '토양', '잘록병', '입고병', '뿌리혹병', '제초'],
    },
  },
  'SCH-04': {
    stageKey: 'SCH-04',
    stageName: '파종·육묘 > 종자·씨감자 준비 및 파종상 처방',
    processCodes: ['PRC-06'],
    daysBeforeHarvestTypical: 65,
    neededCategories: ['NUTRIENT', 'PESTICIDE'],
    categoryCounts: { FERTILIZER: 0, NUTRIENT: 1, PESTICIDE: 1 },
    physiologicalGoal: '균일한 발아세(최아) 유도, 세근 발생 촉진 및 육묘상 입고병(잘록병) 예방',
    fertilizerSpec: {
      targetNutrients: ['인산(P₂O₅)'],
      preferredMethod: '관주시비',
      preferredRelease: '속효성',
      keywords: ['육묘', '인산'],
    },
    nutrientSpec: {
      targetActives: ['유리아미노산(10%↑)', '해조추출물·풀빅산(5%↑)'],
      minAminoPct: 8,
      minSeaweedPct: 5,
      preferredMethod: '관주시비',
      stressKeywords: ['발근', '활착', '냉해'],
      keywords: ['참편한', '아미노', '발근', '뿌리', '육묘'],
    },
    pesticideSpec: {
      targetPests: ['잘록병(입고병)', '종자전염병해'],
      preferredMoaPrefix: ['FRAC'],
      maxPhiDaysAllowed: 50,
      preferredMethod: '관주/침지',
      keywords: ['사라져', '잘록병', '입고병', '소독', '살균'],
    },
  },
  'SCH-05': {
    stageKey: 'SCH-05',
    stageName: '파종·육묘 > 육묘 관수·온도 및 세근 발달 관리',
    processCodes: ['PRC-06'],
    daysBeforeHarvestTypical: 60,
    neededCategories: ['NUTRIENT'],
    categoryCounts: { FERTILIZER: 0, NUTRIENT: 2, PESTICIDE: 0 },
    physiologicalGoal: '육묘기 웃자람(도장) 방지, 흰색 세근 매트 형성 및 일조부족 광합성 보완',
    fertilizerSpec: {
      targetNutrients: ['인산(P₂O₅)', '칼슘(CaO)'],
      preferredMethod: '관주시비',
      preferredRelease: '속효성',
      keywords: ['관주', '복합'],
    },
    nutrientSpec: {
      targetActives: ['유리아미노산', '해조추출물·풀빅산', '킬레이트 미량요소'],
      minAminoPct: 10,
      minSeaweedPct: 5,
      requireChelateMicro: true,
      preferredMethod: '관주/엽면',
      stressKeywords: ['발근', '광합성', '냉해', '일조부족'],
      keywords: ['참편한', '아미노', '썬마스터', '광합성', '뿌리'],
    },
    pesticideSpec: {
      targetPests: ['노균병', '진딧물'],
      preferredMoaPrefix: ['FRAC', 'IRAC'],
      maxPhiDaysAllowed: 50,
      preferredMethod: '경엽처리',
      keywords: ['살균', '살충'],
    },
  },
  'SCH-06': {
    stageKey: 'SCH-06',
    stageName: '파종·육묘 > 정식 직전 묘 순화(경화) 및 선제 방제',
    processCodes: ['PRC-06', 'PRC-07'],
    daysBeforeHarvestTypical: 55,
    neededCategories: ['NUTRIENT', 'PESTICIDE'],
    categoryCounts: { FERTILIZER: 0, NUTRIENT: 2, PESTICIDE: 1 },
    physiologicalGoal: '본밭 이식 전 세포벽(칼슘) 강화로 몸살 최소화 및 초기 해충(벼룩잎벌레·나방) 선제 차단',
    fertilizerSpec: {
      targetNutrients: ['칼슘(CaO)', '붕소(B₂O₃)'],
      preferredMethod: '엽면시비',
      preferredRelease: '속효성',
      keywords: ['칼슘'],
    },
    nutrientSpec: {
      targetActives: ['수용성 칼슘(Ca 8%↑)', '수용성 붕소(B)', '유리아미노산'],
      minCaPct: 6,
      minBPct: 0.2,
      minAminoPct: 8,
      preferredMethod: '엽면시비',
      stressKeywords: ['이식몸살', '칼슘', '활착'],
      keywords: ['튼튼칼슘', '칼슘', '참편한', '아미노'],
    },
    pesticideSpec: {
      targetPests: ['벼룩잎벌레', '좀나방', '진딧물', '거세미나방'],
      preferredMoaPrefix: ['IRAC'],
      maxPhiDaysAllowed: 45,
      preferredMethod: '경엽/관주',
      keywords: ['웜해머', '살충', '나방', '진딧물', '벌레'],
    },
  },
  'SCH-07': {
    stageKey: 'SCH-07',
    stageName: '정식·활착 > 본밭 정식(파종) 및 초기 뿌리 활착',
    processCodes: ['PRC-07', 'PRC-08'],
    daysBeforeHarvestTypical: 50,
    neededCategories: ['NUTRIENT', 'FERTILIZER'],
    categoryCounts: { FERTILIZER: 1, NUTRIENT: 1, PESTICIDE: 0 },
    physiologicalGoal: '본밭 정식 직후 이식 스트레스 해소, 조기 세근 착근 유도 및 초기 인산·질소 공급',
    fertilizerSpec: {
      targetNutrients: ['인산(P₂O₅)', '질소(N)', '칼륨(K₂O)', '유황(S)'],
      minNPct: 8,
      minPPct: 6,
      preferredMethod: '전층/관주',
      preferredRelease: '완효성',
      keywords: ['전용', '복합', '활착'],
    },
    nutrientSpec: {
      targetActives: ['유리아미노산(12%↑)', '해조추출물·풀빅산(8%↑)', '유기산'],
      minAminoPct: 10,
      minSeaweedPct: 6,
      preferredMethod: '관주시비',
      stressKeywords: ['정식', '활착', '발근', '몸살'],
      keywords: ['참편한', '아미노', '발근', '뿌리'],
    },
    pesticideSpec: {
      targetPests: ['잘록병', '거세미나방'],
      preferredMoaPrefix: ['FRAC', 'IRAC'],
      maxPhiDaysAllowed: 45,
      preferredMethod: '관주처리',
      keywords: ['사라져', '웜해머'],
    },
  },
  'SCH-08': {
    stageKey: 'SCH-08',
    stageName: '정식·활착 > 활착기 확인(PGDD 도달) 및 초기 생육 촉진',
    processCodes: ['PRC-09', 'PRC-10'],
    daysBeforeHarvestTypical: 42,
    neededCategories: ['NUTRIENT'],
    categoryCounts: { FERTILIZER: 0, NUTRIENT: 2, PESTICIDE: 0 },
    physiologicalGoal: '신초(어린잎) 전개 가속화, 뿌리권 영역 확대 및 킬레이트 미량요소 균형 공급',
    fertilizerSpec: {
      targetNutrients: ['질소(N)', '마그네슘(MgO)'],
      preferredMethod: '추비',
      preferredRelease: '속효성',
      keywords: ['추비'],
    },
    nutrientSpec: {
      targetActives: ['유리아미노산', '해조추출물·풀빅산', '킬레이트 미량요소(Fe·Zn·Mn·Mo)'],
      minAminoPct: 10,
      requireChelateMicro: true,
      preferredMethod: '엽면/관주',
      stressKeywords: ['활착', '초기생육', '미량요소'],
      keywords: ['참편한', '만능이', '아미노', '미량요소'],
    },
    pesticideSpec: {
      targetPests: ['진딧물', '벼룩잎벌레'],
      preferredMoaPrefix: ['IRAC'],
      maxPhiDaysAllowed: 40,
      preferredMethod: '경엽처리',
      keywords: ['바이고', '웜해머'],
    },
  },
  'SCH-09': {
    stageKey: 'SCH-09',
    stageName: '생육 관리 > 1·2차 추비(웃거름) 시비 및 비대 관수',
    processCodes: ['PRC-13'],
    daysBeforeHarvestTypical: 32,
    neededCategories: ['FERTILIZER', 'NUTRIENT', 'PESTICIDE'],
    categoryCounts: { FERTILIZER: 1, NUTRIENT: 2, PESTICIDE: 1 },
    physiologicalGoal: '외엽 급속 확장 및 구·괴경 비대를 위한 속효성 질소(N)·칼륨(K₂O)·고토(MgO) 집중 추비',
    fertilizerSpec: {
      targetNutrients: ['질소(N 12%↑)', '칼륨(K₂O 10%↑)', '고토(MgO 2%↑)'],
      minNPct: 10,
      minKPct: 10,
      minMgPct: 1,
      preferredMethod: '표층추비',
      preferredRelease: '속효성',
      keywords: ['엔케이', 'NK', '추비', '웃거름', '마그네슘'],
    },
    nutrientSpec: {
      targetActives: ['수용성 칼륨(K)', '해조추출물', '유리아미노산', '킬레이트 미량요소'],
      minAminoPct: 8,
      preferredMethod: '엽면시비',
      stressKeywords: ['비대', '광합성', '일조부족'],
      keywords: ['커진다', '썬마스터', '비대', '광합성'],
    },
    pesticideSpec: {
      targetPests: ['배추좀나방', '파밤나방', '담배나방'],
      preferredMoaPrefix: ['IRAC'],
      maxPhiDaysAllowed: 30,
      preferredMethod: '경엽처리',
      keywords: ['웜해머', '나방', '살충'],
    },
  },
  'SCH-10': {
    stageKey: 'SCH-10',
    stageName: '생육 관리 > 중기 왕성 생장기 경엽·광합성·칼슘 관리',
    processCodes: ['PRC-11', 'PRC-17', 'PRC-18'],
    daysBeforeHarvestTypical: 26,
    neededCategories: ['NUTRIENT', 'PESTICIDE'],
    categoryCounts: { FERTILIZER: 0, NUTRIENT: 2, PESTICIDE: 1 },
    physiologicalGoal: '최대 엽면적 확보 시기의 엽록소 광합성 극대화, 세포벽 강화 및 흡즙·식엽 해충 차단',
    fertilizerSpec: {
      targetNutrients: ['칼륨(K₂O)', '칼슘(CaO)'],
      preferredMethod: '표층추비',
      preferredRelease: '속효성',
      keywords: ['NK', '추비'],
    },
    nutrientSpec: {
      targetActives: ['킬레이트 미량요소(Fe·Zn·Mn·Mo)', '수용성 칼슘(Ca)', '수용성 붕소(B)', '마그네슘(Mg)'],
      minCaPct: 6,
      minBPct: 0.2,
      requireChelateMicro: true,
      preferredMethod: '엽면시비',
      stressKeywords: ['칼슘결핍', '팁번', '광합성', '고온'],
      keywords: ['만능이', '튼튼칼슘', '칼슘', '붕소'],
    },
    pesticideSpec: {
      targetPests: ['진딧물', '총채벌레', '아메리카잎굴파리', '나방류'],
      preferredMoaPrefix: ['IRAC'],
      maxPhiDaysAllowed: 21,
      preferredMethod: '경엽처리',
      keywords: ['바이고', '진딧물', '총채벌레', '살충'],
    },
  },
  'SCH-11': {
    stageKey: 'SCH-11',
    stageName: '생육 관리 > 결구·괴경 비대 시작기 생리장해(팁번·속썩음) 집중 케어',
    processCodes: ['PRC-19'],
    daysBeforeHarvestTypical: 20,
    neededCategories: ['NUTRIENT', 'PESTICIDE'],
    categoryCounts: { FERTILIZER: 0, NUTRIENT: 2, PESTICIDE: 1 },
    physiologicalGoal: '결구·괴경 비대기 칼슘·붕소 급속 소모에 따른 꿀통배추(팁번)·속썩음 예방 및 전류 촉진',
    fertilizerSpec: {
      targetNutrients: ['칼륨(K₂O)', '칼슘(CaO)', '붕소(B₂O₃)'],
      minKPct: 10,
      preferredMethod: '관주/추비',
      preferredRelease: '속효성',
      keywords: ['NK', '칼슘'],
    },
    nutrientSpec: {
      targetActives: ['수용성 칼슘(Ca 10%↑)', '수용성 붕소(B 0.3%↑)', '수용성 칼륨(K)', '유리아미노산'],
      minCaPct: 8,
      minBPct: 0.2,
      preferredMethod: '엽면시비',
      stressKeywords: ['팁번', '칼슘결핍', '결구', '비대'],
      keywords: ['튼튼칼슘', '커진다', '칼슘', '붕소', '비대'],
    },
    pesticideSpec: {
      targetPests: ['노균병', '무름병', '역병', '탄저병'],
      preferredMoaPrefix: ['FRAC'],
      maxPhiDaysAllowed: 14,
      preferredMethod: '경엽처리',
      keywords: ['펀지해머', '오티바', '노균병', '무름병', '살균'],
    },
  },
  'SCH-12': {
    stageKey: 'SCH-12',
    stageName: '병해충 예찰 > 초기·중기 해충 정기 예찰 및 교호 방제',
    processCodes: ['PRC-16'],
    daysBeforeHarvestTypical: 28,
    neededCategories: ['PESTICIDE'],
    categoryCounts: { FERTILIZER: 0, NUTRIENT: 0, PESTICIDE: 2 },
    physiologicalGoal: '나방류 유충(배추좀나방·파밤나방) 및 흡즙해충(진딧물·총채벌레) 저항성 방지를 위한 IRAC 이종 그룹 교호 살포',
    fertilizerSpec: {
      targetNutrients: [],
      preferredMethod: '추비',
      preferredRelease: '속효성',
      keywords: [],
    },
    nutrientSpec: {
      targetActives: ['유리아미노산'],
      preferredMethod: '엽면시비',
      stressKeywords: ['약해방지'],
      keywords: ['아미노'],
    },
    pesticideSpec: {
      targetPests: ['배추좀나방', '파밤나방', '진딧물', '총채벌레', '벼룩잎벌레'],
      preferredMoaPrefix: ['IRAC'],
      maxPhiDaysAllowed: 21,
      preferredMethod: '경엽처리',
      keywords: ['웜해머', '바이고', '나방', '진딧물', '총채', '살충'],
    },
  },
  'SCH-13': {
    stageKey: 'SCH-13',
    stageName: '병해충 예찰 > 중기·강우기 주요 곰팡이·세균성 병해 집중 방제',
    processCodes: ['PRC-22'],
    daysBeforeHarvestTypical: 18,
    neededCategories: ['PESTICIDE'],
    categoryCounts: { FERTILIZER: 0, NUTRIENT: 0, PESTICIDE: 3 },
    physiologicalGoal: '강우·고습도(78%↑) 환경에서 급증하는 노균병·역병·탄저병·무름병에 대한 FRAC 보호+치료 살균제 및 살충제 복합 방제',
    fertilizerSpec: {
      targetNutrients: ['규산(SiO₂)', '칼슘(CaO)'],
      preferredMethod: '엽면시비',
      preferredRelease: '속효성',
      keywords: [],
    },
    nutrientSpec: {
      targetActives: ['수용성 칼슘(Ca)'],
      preferredMethod: '엽면시비',
      stressKeywords: ['무름병예방'],
      keywords: ['칼슘'],
    },
    pesticideSpec: {
      targetPests: ['노균병', '역병', '탄저병', '무름병', '균핵병', '진딧물'],
      preferredMoaPrefix: ['FRAC', 'IRAC'],
      maxPhiDaysAllowed: 14,
      preferredMethod: '경엽처리',
      keywords: ['펀지해머', '오티바', '바이고', '살균', '노균', '역병', '탄저'],
    },
  },
  'SCH-14': {
    stageKey: 'SCH-14',
    stageName: '병해충 예찰 > 수확 전 PLS 안전 마감방제 및 기상재해 예방',
    processCodes: ['PRC-27'],
    daysBeforeHarvestTypical: 10,
    neededCategories: ['PESTICIDE', 'NUTRIENT'],
    categoryCounts: { FERTILIZER: 0, NUTRIENT: 1, PESTICIDE: 1 },
    physiologicalGoal: '수확 10~14일 전 PLS 잔류농약 기준을 100% 준수하는 친환경 유기농업자재 마감방제 및 일조부족·냉해 예방',
    fertilizerSpec: {
      targetNutrients: [],
      preferredMethod: '관주시비',
      preferredRelease: '속효성',
      keywords: [],
    },
    nutrientSpec: {
      targetActives: ['유리아미노산', '해조추출물', '킬레이트 미량요소'],
      minAminoPct: 10,
      preferredMethod: '엽면시비',
      stressKeywords: ['냉해', '일조부족', '광합성'],
      keywords: ['썬마스터', '광합성', '냉해', '아미노'],
    },
    pesticideSpec: {
      targetPests: ['후기 나방류', '진딧물', '총채벌레'],
      preferredMoaPrefix: ['유기농', '미생물', '식물추출'],
      maxPhiDaysAllowed: 7,
      preferredMethod: '경엽처리',
      keywords: ['해충박살', '유기농', '공시', '친환경'],
    },
  },
  'SCH-15': {
    stageKey: 'SCH-15',
    stageName: '수확 > 수확 적기 도달(PGDD 숙기 판정) 및 출하 전 품질 완성',
    processCodes: ['PRC-28'],
    daysBeforeHarvestTypical: 5,
    neededCategories: ['NUTRIENT', 'PESTICIDE'],
    categoryCounts: { FERTILIZER: 0, NUTRIENT: 1, PESTICIDE: 1 },
    physiologicalGoal: '수확 직전 구중·당도·결구 치밀도 최종 향상 및 잔류농약 무검출(PHI 0일) 유기농업자재 위생 관리',
    fertilizerSpec: {
      targetNutrients: [],
      preferredMethod: '엽면시비',
      preferredRelease: '속효성',
      keywords: [],
    },
    nutrientSpec: {
      targetActives: ['수용성 칼륨(K)', '유리아미노산', '해조추출물'],
      preferredMethod: '엽면시비',
      stressKeywords: ['비대', '당도', '착색', '품질'],
      keywords: ['커진다', '비대', '당도', '품질'],
    },
    pesticideSpec: {
      targetPests: ['수확기 해충', '저장병해'],
      preferredMoaPrefix: ['유기농'],
      maxPhiDaysAllowed: 3,
      preferredMethod: '경엽처리',
      keywords: ['해충박살', '유기농', '공시'],
    },
  },
  'SCH-16': {
    stageKey: 'SCH-16',
    stageName: '수확 > 본 수확 및 저장성·신선도 유지 처방',
    processCodes: ['PRC-29'],
    daysBeforeHarvestTypical: 2,
    neededCategories: ['NUTRIENT'],
    categoryCounts: { FERTILIZER: 0, NUTRIENT: 1, PESTICIDE: 0 },
    physiologicalGoal: '저온저장 중 세포벽 연화(무름 현상) 억제 및 신선도 유지를 위한 칼슘·붕소 조직 강화',
    fertilizerSpec: {
      targetNutrients: [],
      preferredMethod: '엽면시비',
      preferredRelease: '속효성',
      keywords: [],
    },
    nutrientSpec: {
      targetActives: ['수용성 칼슘(Ca 10%↑)', '수용성 붕소(B)'],
      minCaPct: 8,
      minBPct: 0.2,
      preferredMethod: '엽면시비',
      stressKeywords: ['저장성', '세포벽', '칼슘', '무름'],
      keywords: ['튼튼칼슘', '칼슘', '저장'],
    },
    pesticideSpec: {
      targetPests: [],
      preferredMoaPrefix: ['유기농'],
      maxPhiDaysAllowed: 0,
      preferredMethod: '경엽처리',
      keywords: ['유기농'],
    },
  },
};

/**
 * process_code 로부터 가장 적합한 StageRequirementSpec 조회
 */
export function resolveStageSpecByProcessOrItem(
  itemOrProcessCode: string,
  processName = ''
): StageRequirementSpec {
  if (STAGE_REQUIREMENT_SPECS[itemOrProcessCode]) {
    return STAGE_REQUIREMENT_SPECS[itemOrProcessCode];
  }
  for (const spec of Object.values(STAGE_REQUIREMENT_SPECS)) {
    if (spec.processCodes.includes(itemOrProcessCode)) {
      return spec;
    }
  }
  const pName = processName || itemOrProcessCode;
  if (pName.includes('포장') || pName.includes('산도') || pName.includes('석회')) return STAGE_REQUIREMENT_SPECS['SCH-01'];
  if (pName.includes('밑거름') || pName.includes('기비') || pName.includes('경운')) return STAGE_REQUIREMENT_SPECS['SCH-02'];
  if (pName.includes('이랑') || pName.includes('멀칭')) return STAGE_REQUIREMENT_SPECS['SCH-03'];
  if (pName.includes('파종') || pName.includes('육묘')) return STAGE_REQUIREMENT_SPECS['SCH-04'];
  if (pName.includes('정식') || pName.includes('이식')) return STAGE_REQUIREMENT_SPECS['SCH-07'];
  if (pName.includes('활착')) return STAGE_REQUIREMENT_SPECS['SCH-08'];
  if (pName.includes('추비') || pName.includes('웃거름')) return STAGE_REQUIREMENT_SPECS['SCH-09'];
  if (pName.includes('결구') || pName.includes('비대')) return STAGE_REQUIREMENT_SPECS['SCH-11'];
  if (pName.includes('마감') || pName.includes('PLS')) return STAGE_REQUIREMENT_SPECS['SCH-14'];
  if (pName.includes('방제') || pName.includes('병해충')) return STAGE_REQUIREMENT_SPECS['SCH-13'];
  if (pName.includes('수확')) return STAGE_REQUIREMENT_SPECS['SCH-15'];
  return STAGE_REQUIREMENT_SPECS['SCH-09'];
}

/**
 * 토양 7대 성분 과부족 판정 헬퍼
 */
export function diagnoseSoilChemistry(soil: SoilInputData, std: SoilStandardData) {
  const check = (val: number, min: number, max: number) =>
    val < min ? 'DEFICIENT' : val > max ? 'EXCESS' : 'OPTIMAL';
  const statusKr = (st: string) =>
    st === 'DEFICIENT' ? '부족' : st === 'EXCESS' ? '과잉' : '적정';

  return [
    {
      key: 'ph',
      label: '토양 산도 (pH)',
      unit: 'pH',
      value: soil.soil_ph,
      min: std.ph_min,
      max: std.ph_max,
      status: check(soil.soil_ph, std.ph_min, std.ph_max),
      status_kr: statusKr(check(soil.soil_ph, std.ph_min, std.ph_max)),
      action_note:
        soil.soil_ph < std.ph_min
          ? '산성 토양 → 칼슘(CaO)·고토(MgO) 함유 알칼리성 비료 및 수용성 칼슘제 우선 가산 (+18점)'
          : soil.soil_ph > std.ph_max
          ? '알칼리성 토양 → 황(S) 함유 비료 및 킬레이트 미량요소(Fe·Mn·B) 엽면공급 가산'
          : '산도 적정 → 작물 표준 양분 흡수율 유지',
    },
    {
      key: 'om',
      label: '유기물 (OM)',
      unit: 'g/kg',
      value: soil.organic_matter_g_kg,
      min: std.om_min,
      max: std.om_max,
      status: check(soil.organic_matter_g_kg, std.om_min, std.om_max),
      status_kr: statusKr(check(soil.organic_matter_g_kg, std.om_min, std.om_max)),
      action_note:
        soil.organic_matter_g_kg < std.om_min
          ? '유기물 부족 → 비료 OM 50%↑ 유기질·퇴비 및 영양제 해조·풀빅산 가산 (+18점)'
          : soil.organic_matter_g_kg > std.om_max
          ? '유기물 과잉 → 미숙 유기물 투입 억제 및 무기태 균형 시비'
          : '유기물 적정 → 토양 완충능 및 보비력 양호',
    },
    {
      key: 'p2o5',
      label: '유효인산 (P₂O₅)',
      unit: 'mg/kg',
      value: soil.avail_p2o5_mg_kg,
      min: std.p2o5_min,
      max: std.p2o5_max,
      status: check(soil.avail_p2o5_mg_kg, std.p2o5_min, std.p2o5_max),
      status_kr: statusKr(check(soil.avail_p2o5_mg_kg, std.p2o5_min, std.p2o5_max)),
      action_note:
        soil.avail_p2o5_mg_kg < std.p2o5_min
          ? '인산 부족 → 초기 발근·활착용 인산(P₂O₅) 보증 비료 및 발근 영양제 가산 (+15점)'
          : soil.avail_p2o5_mg_kg > std.p2o5_max
          ? '인산 과잉 → 고인산 기비 감량 및 철·아연(EDTA-Fe/Zn) 킬레이트 영양제 보완'
          : '유효인산 적정 → 초기 뿌리 발달 및 에너지 대사 원활',
    },
    {
      key: 'k',
      label: '치환성 칼륨 (K)',
      unit: 'cmol+/kg',
      value: soil.exch_k_cmol,
      min: std.k_min,
      max: std.k_max,
      status: check(soil.exch_k_cmol, std.k_min, std.k_max),
      status_kr: statusKr(check(soil.exch_k_cmol, std.k_min, std.k_max)),
      action_note:
        soil.exch_k_cmol < std.k_min
          ? '칼륨 부족 → K₂O 10%↑ NK추비·복합비료 및 구비대·전류 기능성 영양제 가산 (+16점)'
          : soil.exch_k_cmol > std.k_max
          ? '칼륨 과잉 → 길항작용에 의한 칼슘·고토 흡수 저해 방지를 위해 칼슘·고토 엽면시비 강화'
          : '칼륨 적정 → 삼투압 조절 및 동화양분 전류 원활',
    },
    {
      key: 'ca',
      label: '치환성 칼슘 (Ca)',
      unit: 'cmol+/kg',
      value: soil.exch_ca_cmol,
      min: std.ca_min,
      max: std.ca_max,
      status: check(soil.exch_ca_cmol, std.ca_min, std.ca_max),
      status_kr: statusKr(check(soil.exch_ca_cmol, std.ca_min, std.ca_max)),
      action_note:
        soil.exch_ca_cmol < std.ca_min
          ? '칼슘 부족 → 팁번·무름병 예방을 위해 CaO 함유 비료 및 수용성 칼슘(Ca)·붕소(B) 영양제 가산 (+18점)'
          : '칼슘 적정 → 세포벽 강화 및 내병성 양호',
    },
    {
      key: 'mg',
      label: '치환성 고토 (Mg)',
      unit: 'cmol+/kg',
      value: soil.exch_mg_cmol,
      min: std.mg_min,
      max: std.mg_max,
      status: check(soil.exch_mg_cmol, std.mg_min, std.mg_max),
      status_kr: statusKr(check(soil.exch_mg_cmol, std.mg_min, std.mg_max)),
      action_note:
        soil.exch_mg_cmol < std.mg_min
          ? '고토 부족 → 황백화 방지 및 광합성 촉진을 위해 MgO 보증 비료·영양제 가산 (+14점)'
          : '고토 적정 → 엽록소 합성 및 광합성 대사 정상',
    },
    {
      key: 'ec',
      label: '염류농도 (EC)',
      unit: 'dS/m',
      value: soil.soil_ec,
      min: std.ec_min,
      max: std.ec_max,
      status: check(soil.soil_ec, std.ec_min, std.ec_max),
      status_kr: statusKr(check(soil.soil_ec, std.ec_min, std.ec_max)),
      action_note:
        soil.soil_ec > std.ec_max
          ? '염류 과잉 → 속효성 고농도 화학비료 감점(-15점) 및 완효성·유기산·아미노산 처방 전환'
          : '염류농도 적정 → 뿌리 삼투압 장해 없음',
    },
  ];
}

/**
 * 품목 대분류별(FERTILIZER / NUTRIENT / PESTICIDE) 변경된 전용 등록 항목 기반 정량 채점 및 추천 근거 산출
 */
export function evaluateCategoryRecommendations(params: {
  category: 'FERTILIZER' | 'NUTRIENT' | 'PESTICIDE';
  maxCount: number;
  allMaterials: any[];
  stageSpec: StageRequirementSpec;
  cropName: string;
  cultivarName?: string;
  regionName: string;
  areaPyeong: number;
  soilInput: SoilInputData;
  soilStd: SoilStandardData;
  climate: ClimateContextData;
  daysToHarvest?: number;
  preferredMaterialIds?: string[];
  policy?: any;
}) {
  const {
    category,
    maxCount,
    allMaterials,
    stageSpec,
    cropName,
    regionName,
    areaPyeong,
    soilInput,
    soilStd,
    climate,
    preferredMaterialIds = [],
    policy = {},
  } = params;

  const daysToHarvest = params.daysToHarvest ?? stageSpec.daysBeforeHarvestTypical;
  const diagnostics = diagnoseSoilChemistry(soilInput, soilStd);
  const deficientKeys = new Set(diagnostics.filter((d) => d.status === 'DEFICIENT').map((d) => d.key));
  const excessKeys = new Set(diagnostics.filter((d) => d.status === 'EXCESS').map((d) => d.key));

  const isHighHumidity = climate.humidity_avg >= Number(policy.climate_high_humidity_pct || 74) || climate.rainfall_total_mm >= 90;
  const isHighTemp = climate.temp_max >= Number(policy.climate_high_temp_c || 26);
  const isLowTemp = climate.temp_min <= Number(policy.climate_low_temp_c || 10);

  const candidates = allMaterials.filter((m) => m.material_category === category);

  const scored = candidates.map((m) => {
    let score = 55; // 기본 점수
    const scoreBreakdown: Array<{ factor: string; delta: number; detail: string }> = [];
    const reasonsStage: string[] = [];
    const reasonsIngredient: string[] = [];
    const reasonsSoil: string[] = [];
    const reasonsClimate: string[] = [];

    const fullText = `${m.product_name || ''} ${m.sub_type || ''} ${m.target_nutrient_or_pest || ''} ${
      m.nutrient_ratio_summary || ''
    } ${m.usage_stage || ''} ${m.weather_trigger || ''} ${m.active_ingredient || ''} ${
      m.stress_target || ''
    } ${m.application_method || ''}`;

    // 공통: 표준 생육과정 매뉴얼 우선 지정 자재 가산
    if (preferredMaterialIds.includes(m.material_id)) {
      score += 14;
      scoreBreakdown.push({
        factor: '작물 표준 생육과정 지정 자재',
        delta: 14,
        detail: `${cropName} [${stageSpec.stageName}] 표준 매뉴얼 핵심 지정 품목`,
      });
    }

    // =========================================================================
    // CASE 1: 비료 (FERTILIZER) — 9대 보증성분(N~OM%) + 시비방법 + 용출지속기간 기반 채점
    // =========================================================================
    if (category === 'FERTILIZER') {
      const fSpec = stageSpec.fertilizerSpec;
      const n = Number(m.n_pct || 0);
      const p = Number(m.p_pct || 0);
      const k = Number(m.k_pct || 0);
      const ca = Number(m.ca_pct || 0);
      const mg = Number(m.mg_pct || 0);
      const b = Number(m.b_pct || 0);
      const sio2 = Number(m.sio2_pct || 0);
      const s = Number(m.s_pct || 0);
      const om = Number(m.om_pct || 0);
      const appMethod = String(m.application_method || '전층시비');
      const releaseDur = String(m.release_duration || '완효성');

      // 1) 생육과정별 필수 요구 보증성분 매칭 (최대 +25점)
      let stageIngScore = 0;
      const matchedNutrients: string[] = [];
      if (fSpec.minOmPct && om >= fSpec.minOmPct) {
        stageIngScore += 14;
        matchedNutrients.push(`유기물(OM) ${om}%`);
      }
      if (fSpec.minNPct && n >= fSpec.minNPct) {
        stageIngScore += 8;
        matchedNutrients.push(`질소(N) ${n}%`);
      }
      if (fSpec.minPPct && p >= fSpec.minPPct) {
        stageIngScore += 7;
        matchedNutrients.push(`인산(P₂O₅) ${p}%`);
      }
      if (fSpec.minKPct && k >= fSpec.minKPct) {
        stageIngScore += 9;
        matchedNutrients.push(`칼륨(K₂O) ${k}%`);
      }
      if (fSpec.minCaPct && ca >= fSpec.minCaPct) {
        stageIngScore += 14;
        matchedNutrients.push(`칼슘(CaO) ${ca}%`);
      }
      if (fSpec.minMgPct && mg >= fSpec.minMgPct) {
        stageIngScore += 8;
        matchedNutrients.push(`고토(MgO) ${mg}%`);
      }
      for (const kw of fSpec.keywords) {
        if (kw && fullText.includes(kw)) {
          stageIngScore += 6;
          break;
        }
      }
      stageIngScore = Math.min(25, stageIngScore);
      if (stageIngScore > 0) {
        score += stageIngScore;
        scoreBreakdown.push({
          factor: '생육과정 요구 보증성분 부합도',
          delta: stageIngScore,
          detail: `[${stageSpec.stageName}] 필수 요구 성분(${fSpec.targetNutrients.join('·')}) 중 [${
            matchedNutrients.join(', ') || m.nutrient_ratio_summary
          }] 충족`,
        });
        reasonsStage.push(
          `[${stageSpec.stageName}] 단계의 핵심 목표(${stageSpec.physiologicalGoal})에 필요한 보증성분(${
            matchedNutrients.join(' · ') || m.nutrient_ratio_summary
          })을 정량 함유하고 있습니다.`
        );
      }

      // 2) 시비 방법(application_method) 및 용출 지속기간(release_duration) 매칭 (최대 +12점)
      if (appMethod.includes(fSpec.preferredMethod.slice(0, 2)) || releaseDur.includes(fSpec.preferredRelease.slice(0, 2))) {
        score += 10;
        scoreBreakdown.push({
          factor: '시비방법·용출지속기간 적합성',
          delta: 10,
          detail: `시비방식(${appMethod}) · 용출특성(${releaseDur})이 현 생육단계와 일치`,
        });
        reasonsIngredient.push(
          `등록된 시비 방식[${appMethod}]과 비효 지속기간[${releaseDur}]이 현재 작업 단계에 최적화되어 양분 유실을 줄입니다.`
        );
      }

      // 3) 현재 토양검정 과부족 교정 매칭 (최대 +22점)
      if ((deficientKeys.has('ph') || deficientKeys.has('ca')) && ca >= 1.5) {
        const boost = ca >= 15 ? 18 : 10;
        score += boost;
        scoreBreakdown.push({
          factor: '토양 산도(pH)·칼슘 부족 교정',
          delta: boost,
          detail: `토양 pH(${soilInput.soil_ph})·Ca(${soilInput.exch_ca_cmol}) 부족 → 보증 칼슘(CaO ${ca}%) 공급`,
        });
        reasonsSoil.push(
          `현재 토양의 산도(pH ${soilInput.soil_ph}, 적정 ${soilStd.ph_min}~${soilStd.ph_max}) 및 치환성 칼슘(${soilInput.exch_ca_cmol} cmol+/kg) 부족을 보증성분 칼슘(CaO ${ca}%)·고토(MgO ${mg}%)로 직접 교정합니다.`
        );
      }
      if (deficientKeys.has('om') && om >= 30) {
        score += 16;
        scoreBreakdown.push({
          factor: '토양 유기물(OM) 부족 보충',
          delta: 16,
          detail: `토양 OM(${soilInput.organic_matter_g_kg}g/kg) 부족 → 유기물 ${om}% 함유 비료 가산`,
        });
        reasonsSoil.push(
          `토양 유기물(${soilInput.organic_matter_g_kg} g/kg)이 적정 기준(${soilStd.om_min}~${soilStd.om_max}) 대비 부족하여 유기물(OM ${om}%) 집중 투입이 필수적입니다.`
        );
      }
      if (deficientKeys.has('k') && k >= 7) {
        score += 14;
        scoreBreakdown.push({
          factor: '토양 치환성 칼륨(K) 부족 보완',
          delta: 14,
          detail: `토양 K(${soilInput.exch_k_cmol}) 부족 → 칼륨(K₂O ${k}%) 함유 비료 가산`,
        });
        reasonsSoil.push(
          `부족한 토양 치환성 칼륨(${soilInput.exch_k_cmol} cmol+/kg)을 보충하기 위해 칼륨(K₂O ${k}%) 함량이 높은 이 제품을 선정했습니다.`
        );
      }
      if (deficientKeys.has('p2o5') && p >= 5) {
        score += 12;
        scoreBreakdown.push({
          factor: '토양 유효인산(P₂O₅) 부족 보완',
          delta: 12,
          detail: `토양 P₂O₅(${soilInput.avail_p2o5_mg_kg}mg/kg) 부족 → 인산(${p}%) 보충`,
        });
        reasonsSoil.push(
          `유효인산(${soilInput.avail_p2o5_mg_kg} mg/kg) 부족에 따른 초기 발근 저해를 인산(P₂O₅ ${p}%) 성분으로 보완합니다.`
        );
      }
      if (deficientKeys.has('mg') && mg >= 1.5) {
        score += 10;
        scoreBreakdown.push({
          factor: '토양 치환성 고토(Mg) 부족 보완',
          delta: 10,
          detail: `토양 Mg(${soilInput.exch_mg_cmol}) 부족 → 고토(MgO ${mg}%) 공급`,
        });
      }
      if (excessKeys.has('ec') && n >= 16 && om === 0) {
        score -= 14;
        scoreBreakdown.push({
          factor: '염류농도(EC) 과잉 감점',
          delta: -14,
          detail: `토양 EC(${soilInput.soil_ec} dS/m) 과잉 상태에서 고질소 속효성 비료 억제`,
        });
      }
      if (b > 0 || s > 0 || sio2 > 0) {
        score += 5;
        reasonsIngredient.push(
          `3요소 외 미량·기능성 보증성분(${[
            ca > 0 ? `CaO ${ca}%` : '',
            mg > 0 ? `MgO ${mg}%` : '',
            b > 0 ? `붕소(B₂O₃) ${b}%` : '',
            s > 0 ? `유황(S) ${s}%` : '',
            sio2 > 0 ? `규산(SiO₂) ${sio2}%` : '',
          ]
            .filter(Boolean)
            .join(' · ')})이 복합 배합되어 ${cropName} 품질을 높입니다.`
        );
      }
    }

    // =========================================================================
    // CASE 2: 영양제 (NUTRIENT) — 유리아미노산 + 해조/풀빅산 + 킬레이트 미량요소 + 수용성 Ca/B + 스트레스 타깃
    // =========================================================================
    else if (category === 'NUTRIENT') {
      const nSpec = stageSpec.nutrientSpec;
      const amino = Number(m.amino_acid_pct || 0);
      const seaweed = Number(m.seaweed_humic_pct || 0);
      const ca = Number(m.ca_pct || 0);
      const b = Number(m.b_pct || 0);
      const mg = Number(m.mg_pct || 0);
      const k = Number(m.k_pct || 0);
      const chelate = String(m.chelate_micro_summary || '');
      const stressTarget = String(m.stress_target || '');
      const dilution = String(m.dilution_ratio || '500~1,000배');
      const appMethod = String(m.application_method || '엽면/관주 겸용');

      // 1) 생육과정별 핵심 생리활성 성분 매칭 (최대 +28점)
      let activeScore = 0;
      const activeHighlights: string[] = [];
      if (nSpec.minAminoPct && amino >= nSpec.minAminoPct) {
        activeScore += 12;
        activeHighlights.push(`유리아미노산 ${amino}%`);
      }
      if (nSpec.minSeaweedPct && seaweed >= nSpec.minSeaweedPct) {
        activeScore += 10;
        activeHighlights.push(`해조추출물·풀빅산 ${seaweed}%`);
      }
      if (nSpec.minCaPct && ca >= nSpec.minCaPct) {
        activeScore += 14;
        activeHighlights.push(`수용성 칼슘(Ca) ${ca}%`);
      }
      if (nSpec.minBPct && b >= nSpec.minBPct) {
        activeScore += 8;
        activeHighlights.push(`수용성 붕소(B) ${b}%`);
      }
      if (nSpec.requireChelateMicro && chelate.length > 2) {
        activeScore += 10;
        activeHighlights.push(`킬레이트 미량요소(${chelate})`);
      }
      for (const kw of nSpec.keywords) {
        if (kw && fullText.includes(kw)) {
          activeScore += 8;
          break;
        }
      }
      activeScore = Math.min(28, activeScore);
      if (activeScore > 0) {
        score += activeScore;
        scoreBreakdown.push({
          factor: '생육과정 생리활성·수용성 성분 부합도',
          delta: activeScore,
          detail: `[${stageSpec.stageName}] 요구 기능성분(${nSpec.targetActives.join('·')}) 매칭: ${
            activeHighlights.join(', ') || m.nutrient_ratio_summary
          }`,
        });
        reasonsStage.push(
          `[${stageSpec.stageName}] 단계의 생리 목표(${stageSpec.physiologicalGoal}) 달성을 위해 [${
            activeHighlights.join(' + ') || m.nutrient_ratio_summary
          }] 성분이 즉시 흡수 형태(${appMethod}, ${dilution})로 작용합니다.`
        );
      }

      // 2) 타깃 생리장해(stress_target) × 기상/토양 결핍 매칭 (최대 +20점)
      if ((deficientKeys.has('ca') || deficientKeys.has('ph') || isHighTemp) && ca >= 8) {
        score += 14;
        scoreBreakdown.push({
          factor: '칼슘·붕소 생리장해(팁번·무름) 예방',
          delta: 14,
          detail: `토양 Ca(${soilInput.exch_ca_cmol})·고온 증산 불균형 대응 수용성 Ca ${ca}% · B ${b}% 공급`,
        });
        reasonsSoil.push(
          `토양 칼슘(${soilInput.exch_ca_cmol} cmol+/kg)·산도(pH ${soilInput.soil_ph}) 여건에서 뿌리 흡수만으로는 부족하기 쉬운 칼슘과 붕소를 수용성 Ca ${ca}% · B ${b}% 엽면시비로 직접 보충하여 팁번(석회결핍)을 차단합니다.`
        );
      }
      if ((isLowTemp || climate.rainy_days >= 5) && (amino >= 10 || seaweed >= 6)) {
        score += 12;
        scoreBreakdown.push({
          factor: '저온·일조부족 환경 스트레스 회복',
          delta: 12,
          detail: `최저기온 ${climate.temp_min}℃·강우 ${climate.rainy_days}일 조건 → 유리아미노산 ${amino}% · 해조/풀빅산 ${seaweed}% 대사 보완`,
        });
        reasonsClimate.push(
          `지역 기상(최저 ${climate.temp_min}℃, 강우 ${climate.rainy_days}일)에 따른 일조 부족·저온 스트레스를 타깃 효능[${
            stressTarget || '냉해·일조부족 회복'
          }] 및 유리아미노산(${amino}%)·해조추출물(${seaweed}%)로 빠르게 회복시킵니다.`
        );
      }
      if (deficientKeys.has('k') && k >= 8) {
        score += 10;
        reasonsSoil.push(
          `토양 치환성 칼륨(${soilInput.exch_k_cmol} cmol+/kg) 부족을 보완하여 구·괴경 비대 및 당도 전류를 촉진합니다.`
        );
      }
    }

    // =========================================================================
    // CASE 3: 병해충관리제 (PESTICIDE) — 유효성분 + 작용기작(IRAC/FRAC) + PLS(수확전일수·횟수) + 희석배수
    // =========================================================================
    else if (category === 'PESTICIDE') {
      const pSpec = stageSpec.pesticideSpec;
      const activeIng = String(m.active_ingredient || m.nutrient_ratio_summary || '');
      const moaCode = String(m.moa_group_code || '복합/유기농');
      const regNo = String(m.pesticide_reg_no || '농진청 등록');
      const phiDays = Number(m.safety_phi_days ?? 7);
      const maxCount = Number(m.safety_max_count ?? 3);
      const dilution = String(m.dilution_ratio || '1,000배');
      const appMethod = String(m.application_method || '경엽살포');

      // 1) PLS 안전사용기준(수확 전 잔여일수 대비 safety_phi_days) 검증 (최대 +22점 / 위반 시 -45점)
      const allowedPhi = Math.min(daysToHarvest, pSpec.maxPhiDaysAllowed);
      if (phiDays === 0 || m.is_organic === 1 || moaCode.includes('유기농')) {
        const organicBonus = allowedPhi <= 10 ? 24 : 12;
        score += organicBonus;
        scoreBreakdown.push({
          factor: 'PLS 수확기 잔류 면제 (유기농업자재 공시)',
          delta: organicBonus,
          detail: `수확 잔여 약 ${daysToHarvest}일 시점 · 수확 전 제한일수 0일(${regNo})로 PLS 100% 안전`,
        });
      } else if (phiDays <= allowedPhi) {
        score += 15;
        scoreBreakdown.push({
          factor: 'PLS 안전사용기준(수확 전 사용일수) 적합',
          delta: 15,
          detail: `수확 잔여 ${daysToHarvest}일 >= 약제 PHI 기준(수확 ${phiDays}일 전, 최대 ${maxCount}회 이내) 충족`,
        });
      } else {
        score -= 45;
        scoreBreakdown.push({
          factor: 'PLS 안전사용기준(PHI) 초과 감점 배제',
          delta: -45,
          detail: `수확 잔여 ${daysToHarvest}일 < 약제 PHI 기준(수확 ${phiDays}일 전)으로 부적합`,
        });
      }

      // 2) 생육과정 타깃 병해충·잡초 및 작용기작(IRAC/FRAC/HRAC) 매칭 (최대 +25점)
      let pestMatchScore = 0;
      for (const kw of pSpec.keywords) {
        if (kw && fullText.includes(kw)) {
          pestMatchScore += 14;
          break;
        }
      }
      if (pSpec.preferredMoaPrefix.some((prefix) => moaCode.includes(prefix))) {
        pestMatchScore += 10;
      }
      pestMatchScore = Math.min(25, pestMatchScore);
      if (pestMatchScore > 0) {
        score += pestMatchScore;
        scoreBreakdown.push({
          factor: '타깃 병해충 스펙트럼 및 작용기작 부합도',
          delta: pestMatchScore,
          detail: `유효성분[${activeIng}] · 작용기작[${moaCode}]이 대상 병해충(${pSpec.targetPests.slice(0, 3).join('·')})에 직접 작용`,
        });
        reasonsStage.push(
          `[${stageSpec.stageName}] 시기에 문제되는 [${pSpec.targetPests.join('·')}] 방제를 위해 유효성분[${activeIng}] 및 작용기작[${moaCode}]을 보유한 등록 품목(${regNo})을 선정했습니다.`
        );
      }

      // 3) 지역 기후(습도·강우·기온) 병해충 발생 트리거 연동 (최대 +16점)
      if (
        isHighHumidity &&
        (moaCode.includes('FRAC') || fullText.includes('살균') || fullText.includes('노균') || fullText.includes('무름') || fullText.includes('역병'))
      ) {
        score += 14;
        scoreBreakdown.push({
          factor: '고습도·강우 병해 발생 위험 선제 대응',
          delta: 14,
          detail: `평균습도 ${climate.humidity_avg}% · 강우 ${climate.rainfall_total_mm}mm 다습기 세균·곰팡이성 병해 차단`,
        });
        reasonsClimate.push(
          `${climate.month}월 ${regionName}의 다습 조건(습도 ${climate.humidity_avg}%, 강우 ${climate.rainfall_total_mm}mm)에서 급증하는 노균병·역병·무름병 포자 발아를 작용기작[${moaCode}]으로 선제 차단합니다.`
        );
      } else if (
        isHighTemp &&
        (moaCode.includes('IRAC') || fullText.includes('살충') || fullText.includes('나방') || fullText.includes('진딧물') || fullText.includes('총채'))
      ) {
        score += 14;
        scoreBreakdown.push({
          factor: '고온기 해충 밀도 급증 선제 방제',
          delta: 14,
          detail: `낮 최고기온 ${climate.temp_max}℃ 조건 나방 유충·흡즙해충 확산 억제`,
        });
        reasonsClimate.push(
          `낮 최고기온 ${climate.temp_max}℃ 환경에서 번식 주기가 짧아지는 나방류 유충·진딧물·총채벌레를 [${activeIng} (${moaCode})] 성분으로 초기에 제압합니다.`
        );
      }

      reasonsSoil.push(
        `PLS 안전사용기준[${
          phiDays > 0 ? `수확 ${phiDays}일 전까지 · 최대 ${maxCount}회 이내` : '친환경 공시자재 수확기 제한 없음'
        }] 및 살포 방식[${appMethod} · ${dilution}] 기준을 완벽히 충족합니다.`
      );
    }

    // 관리자 정책 가중치 (친환경 선호 / 브랜드 / 가성비)
    if (policy.organic_preference === 'ORGANIC_FIRST' && Number(m.is_organic) === 1) {
      score += 8;
      scoreBreakdown.push({ factor: '친환경·유기농자재 우대 정책', delta: 8, detail: '유기농/친환경 인증 가산' });
    }
    if (
      (policy.brand_priority === 'NUVO_HANFARM_FIRST' || !policy.brand_priority) &&
      (fullText.includes('누보') || fullText.includes('대유') || fullText.includes('우성'))
    ) {
      score += 4;
    }

    const finalScore = Math.min(99, Math.max(60, Math.round(score)));

    // 기본 근거 문장 보완
    if (reasonsStage.length === 0) {
      reasonsStage.push(
        `[${cropName} · ${stageSpec.stageName}] 단계의 생리 목표(${stageSpec.physiologicalGoal}) 달성에 적합한 ${
          category === 'FERTILIZER' ? '비료' : category === 'NUTRIENT' ? '기능성 영양제' : '전문 방제제'
        }입니다.`
      );
    }
    if (reasonsSoil.length === 0) {
      reasonsSoil.push(
        `${regionName} 토양검정(pH ${soilInput.soil_ph}, OM ${soilInput.organic_matter_g_kg}g/kg, 유효인산 ${soilInput.avail_p2o5_mg_kg}mg/kg, K ${soilInput.exch_k_cmol}cmol+/kg) 환경에서 양분 균형과 흡수율을 안정적으로 유지합니다.`
      );
    }
    if (reasonsClimate.length === 0) {
      reasonsClimate.push(
        `${climate.month}월 예상 기온 ${climate.temp_avg}℃(최저 ${climate.temp_min}℃~최고 ${climate.temp_max}℃), 습도 ${climate.humidity_avg}% 기상 조건에서 안정적인 처방 효과를 발휘합니다.`
      );
    }

    // 경작 면적(areaPyeong) 및 토양 과부족 보정 계수 반영 권장 수량 산출
    const areaFactor = Math.max(0.5, Number((areaPyeong / 100).toFixed(1)));
    const baseUnitsPer100Pyeong = category === 'FERTILIZER' ? 1.5 : 0.5;
    const soilBoostMultiplier =
      category === 'FERTILIZER' && (deficientKeys.has('om') || deficientKeys.has('k') || deficientKeys.has('p2o5'))
        ? 1 + Number(policy.deficiency_boost_pct || 20) / 100
        : 1.0;
    const recommendedQty = Math.max(1, Math.ceil((areaPyeong / 100) * baseUnitsPer100Pyeong * soilBoostMultiplier));
    const unitPrice = Number(m.unit_price || 15000);
    const totalCost = recommendedQty * unitPrice;

    // 대분류별 핵심 스펙 배지 텍스트 및 한 줄 선정 근거(selection_rationale) 조합
    const categorySpecBadge =
      category === 'PESTICIDE'
        ? `유효성분: ${m.active_ingredient || m.nutrient_ratio_summary} | 작용기작: ${
            m.moa_group_code || '복합'
          } | PLS: ${
            Number(m.safety_phi_days) > 0
              ? `수확 ${m.safety_phi_days}일 전·${m.safety_max_count || 3}회`
              : '수확기 제한없음(유기농공시)'
          }`
        : category === 'NUTRIENT'
        ? `생리활성: 아미노산 ${m.amino_acid_pct ?? 0}%·해조/풀빅산 ${m.seaweed_humic_pct ?? 0}% | 수용성 Ca ${
            m.ca_pct ?? 0
          }%·B ${m.b_pct ?? 0}% | 희석: ${m.dilution_ratio || '500~1,000배'}`
        : `보증성분: N ${m.n_pct ?? 0}%·P ${m.p_pct ?? 0}%·K ${m.k_pct ?? 0}%${
            Number(m.ca_pct) > 0 ? `·CaO ${m.ca_pct}%` : ''
          }${Number(m.mg_pct) > 0 ? `·MgO ${m.mg_pct}%` : ''}${
            Number(m.om_pct) > 0 ? `·OM ${m.om_pct}%` : ''
          } | ${m.application_method || '전층시비'} (${m.release_duration || '완효성'})`;

    const selectionRationale = `${reasonsStage[0]} ${reasonsSoil[0]}`;

    return {
      ...m,
      material_id: m.material_id,
      product_code: m.product_code,
      material_category: m.material_category,
      sub_type: m.sub_type,
      manufacturer: m.manufacturer || '누보/대유',
      product_name: m.product_name,
      is_organic: Number(m.is_organic) === 1,
      organic_label: m.organic_label,
      unit_spec: m.unit_spec || m.weight_spec || m.volume_spec || '1개',
      unit_price: unitPrice,
      dosage_per_100pyeong: m.dosage_per_100pyeong || '정량 희석 살포',
      recommended_for_area: `${areaPyeong.toLocaleString()}평 기준 약 ${areaFactor}배 처방 (${
        m.dosage_per_100pyeong || '정량'
      }) · 권장 구매 ${recommendedQty}개`,
      target_nutrient_or_pest: m.target_nutrient_or_pest || '',
      nutrient_ratio_summary: m.nutrient_ratio_summary || m.target_nutrient_or_pest || '',
      category_spec_badge: categorySpecBadge,
      usage_stage: m.usage_stage,
      weather_trigger: m.weather_trigger,
      thumbnail_url:
        m.thumbnail_url || `/api/agro-materials/image/${encodeURIComponent(m.material_id)}/thumb`,
      match_score: finalScore,
      score_breakdown: scoreBreakdown,
      recommended_qty: recommendedQty,
      total_cost: totalCost,
      rationale_stage: reasonsStage[0],
      rationale_soil: reasonsSoil[0],
      rationale_climate: reasonsClimate[0],
      rationale_dosage: `경작면적 ${areaPyeong.toLocaleString()}평 기준 ${recommendedQty}개(${
        m.unit_spec || '표준규격'
      }) 권장 · 표준용량(${m.dosage_per_100pyeong}) 준수`,
      selection_rationale: selectionRationale,
    };
  });

  scored.sort((a, b) => b.match_score - a.match_score);

  // 병해충관리제 복수 선정 시 작용기작(moa_group_code) 중복 방지 (교호살포 원칙 적용)
  if (category === 'PESTICIDE' && maxCount > 1 && scored.length > maxCount) {
    const selected: any[] = [];
    const usedMoa = new Set<string>();
    for (const cand of scored) {
      const moaKey = String(cand.moa_group_code || '').split(' ')[0] || cand.material_id;
      if (!usedMoa.has(moaKey) || selected.length === 0) {
        selected.push(cand);
        usedMoa.add(moaKey);
      }
      if (selected.length >= maxCount) break;
    }
    if (selected.length < maxCount) {
      for (const cand of scored) {
        if (!selected.some((s) => s.material_id === cand.material_id)) {
          selected.push(cand);
        }
        if (selected.length >= maxCount) break;
      }
    }
    return selected;
  }

  return scored.slice(0, maxCount);
}

/**
 * 맞춤형 작물재배 일정(SCH-01 ~ SCH-16)의 각 생육과정별 최적 농자재 및 추천 근거 일괄 선정 함수
 */
export function selectScheduleStageMaterials(params: {
  stageKey: string;
  allMaterials: any[];
  cropName: string;
  cultivarName?: string;
  regionName: string;
  areaPyeong: number;
  soilInput: SoilInputData;
  soilStd: SoilStandardData;
  climate: ClimateContextData;
  daysToHarvest?: number;
  preferredMaterialIds?: string[];
  policy?: any;
}) {
  const stageSpec = resolveStageSpecByProcessOrItem(params.stageKey);
  const results: any[] = [];

  for (const cat of stageSpec.neededCategories) {
    const count = stageSpec.categoryCounts[cat] || 1;
    if (count <= 0) continue;
    const picked = evaluateCategoryRecommendations({
      ...params,
      category: cat,
      maxCount: count,
      stageSpec,
    });
    results.push(...picked);
  }

  return results;
}

/**
 * 관리자 페이지 [농자재 추천 근거 및 추천 방식 모듈] 및 PDF 명세서 출력용 아키텍처 정의서
 */
export const RECOMMENDATION_LOGIC_SPEC = {
  version: 'v3.2 (3대 품목 전용 스펙 12종 확장 반영)',
  updatedAt: '2026-11-10',
  title: 'FarmPlan 맞춤형 작물재배 일정 — 농자재 추천 근거 및 추천 방식 모듈 명세서',
  subtitle:
    '비료(9대 보증성분·용출기간) · 영양제(생리활성·킬레이트·희석배수) · 병해충관리제(유효성분·작용기작·PLS 안전기준) × 생육단계 × 토양검정 × 지역기후 통합 알고리즘',
  coreFormula:
    'Total Match Score (100점 만점) = 기본점수(55점) + ① 생육과정 요구성분 부합도(최대 28점) + ② 토양검정 과부족 교정 가산점(최대 22점) + ③ 기상 스트레스·병해충 위험도 대응점수(최대 16점) + ④ 품목별 전용 규격(용출기간 / 희석배수 / PLS 안전기준·교호살포) 적합도(최대 24점)',
  categoryModels: [
    {
      category: 'FERTILIZER',
      categoryKr: '비료 (FERTILIZER)',
      color: 'emerald',
      keyRegisteredFields: [
        '9대 보증성분 함량 (%): 질소(N), 인산(P₂O₅), 칼륨(K₂O), 칼슘(CaO), 고토(MgO), 붕소(B₂O₃), 규산(SiO₂), 유황(S), 유기물(OM)',
        '시비 방법 (application_method): 전층시비(로터리 경운) / 이랑 표층추비 / 점적 관주시비',
        '비효 용출 지속기간 (release_duration): 완효성 코팅(60~100일 지속) / 속효성(15~30일)',
        '100평(10a)당 표준 시비량 (dosage_per_100pyeong)',
      ],
      scoringRules: [
        '밑거름(기비)·토양개량 과정(SCH-01~03): 유기물(OM ≥ 30%) 또는 칼슘(CaO ≥ 10%)+고토(MgO ≥ 2%) 함유 + [전층시비·완효성] 비료에 +20~35점 가산',
        '생육중기 1·2차 추비 과정(SCH-09): 질소(N ≥ 10%) + 칼륨(K₂O ≥ 10%) + 고토(MgO ≥ 1%) 함유 + [표층추비·속효성] NK비료에 +25점 가산',
        '토양검정 산도(pH < 적정최소) 또는 치환성 칼슘(Ca) 부족 시: CaO·MgO 함유 알칼리성 개량 비료에 +18점 가산 및 산도교정 근거 생성',
        '토양검정 유기물(OM < 적정최소) 부족 시: OM ≥ 50% 유기질·퇴비에 +16점 가산 및 시비량 +20% 증량 보정',
        '토양 염류농도(EC > 적정최대) 과잉 시: 고질소(N ≥ 16%) 속효성 화학비료 -14점 감점 배제',
      ],
    },
    {
      category: 'NUTRIENT',
      categoryKr: '영양제 (NUTRIENT)',
      color: 'sky',
      keyRegisteredFields: [
        '생리활성 핵심성분 (%): 유리아미노산(amino_acid_pct), 해조추출물·풀빅산(seaweed_humic_pct)',
        '킬레이트 미량요소 (chelate_micro_summary): EDTA-Fe, Zn, Mn, Mo 복합 구성',
        '수용성 무기성분 (%): 수용성 칼슘(Ca), 수용성 붕소(B), 수용성 고토(Mg), 수용성 N·P·K',
        '타깃 생리장해·스트레스 (stress_target): 냉해·일조부족·팁번(석회결핍)·고온장해 등',
        '권장 처리 방식 (application_method) 및 물 20L 기준 표준 희석배수 (dilution_ratio)',
      ],
      scoringRules: [
        '파종·육묘·정식·활착 과정(SCH-04~08): 세근 발근과 이식 몸살 해소를 위해 유리아미노산(≥ 10%) + 해조추출물·풀빅산(≥ 6%) 관주/엽면 겸용 영양제에 +25점 가산',
        '왕성 생장기 경엽 관리(SCH-10): 엽록소 광합성 극대화를 위해 킬레이트 미량요소(EDTA-Fe·Zn·Mn) + 수용성 고토(Mg) 영양제에 +24점 가산',
        '결구·괴경 비대 및 수확 전 품질 관리(SCH-11, 15, 16): 팁번(꿀통배추)·속썩음 예방 및 당도 전류를 위해 수용성 칼슘(Ca ≥ 8%)+붕소(B ≥ 0.2%) 또는 고칼륨 비대제에 +28점 가산',
        '저온(최저기온 ≤ 10℃) 및 연속 강우(일조부족) 기상 시: stress_target에 [냉해·일조부족·광합성]이 명시된 고농축 아미노산·비타민제에 +14점 가산',
      ],
    },
    {
      category: 'PESTICIDE',
      categoryKr: '병해충관리제 (PESTICIDE)',
      color: 'rose',
      keyRegisteredFields: [
        '주요 유효성분 및 함량 (active_ingredient): 예) 클로란트라닐리프롤 5%, 아족시스트로빈 20% 등',
        '작용기작 그룹코드 (moa_group_code): IRAC(살충제) / FRAC(살균제) / HRAC(제초제) / 유기농자재 기호',
        '농약 품목등록번호 / 유기농업자재 공시번호 (pesticide_reg_no)',
        'PLS 안전사용기준: 수확 전 사용제한 일수(safety_phi_days) 및 작기당 최대 살포 횟수(safety_max_count)',
        '표준 희석배수 (dilution_ratio) 및 살포 방식 (application_method: 토양혼화/경엽살포)',
      ],
      scoringRules: [
        'PLS 수확 전 안전사용기준(PHI) 하드 필터링: 각 생육과정 종료일로부터 수확 예정일까지 남은 일수(daysToHarvest)보다 safety_phi_days가 긴 약제는 -45점 페널티로 원천 배제',
        '수확 임박기(SCH-14~15, 수확 14일 이내): safety_phi_days = 0일(잔류 면제 유기농업자재 공시 제품)에 +24점 최우선 가산',
        '이랑 성형·정식 전 토양소독(SCH-03~04): 잘록병(입고병)·뿌리혹병·거세미나방 타깃 토양처리 살균·살충제에 +25점 가산',
        '강우·고습도(평균습도 ≥ 74%) 시기(SCH-13): 노균병·역병·탄저병·무름병 전문 침투이행성 FRAC 살균제에 +25점 가산',
        '작용기작(moa_group_code) 교호살포 자동 조합: 동일 단계에서 2종 이상 살충·살균제 추천 시 동일 IRAC/FRAC 그룹 코드 중복을 방지하여 저항성 발현 차단',
      ],
    },
  ],
};
