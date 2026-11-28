export const STAGE_MATERIAL_USAGE_STORAGE_KEY = 'hanfarm_stage_material_usage_guides_v1';

export interface StageMaterialUsageGuide {
  key: string; // `${stageKey}__${materialKey}`
  stageCode: string;
  stageName: string;
  materialId: string;
  productName: string;
  materialCategory: 'FERTILIZER' | 'NUTRIENT' | 'PESTICIDE' | 'SEED' | 'SEEDLING';
  dosageRate: string; // 사용량 (평수·토양·기후 기준 포장용량 및 권장 갯수)
  applicationStandard: string; // 시비기준 / 희석배수 / 적용기준
  applicationMethod: string; // 시비방법 / 살포방법 / 작업방법
  cautionText: string; // 주의사항
  rationaleBasis: string; // 생육단계·토양·기후 처방 근거
  updatedByAdmin?: boolean;
  updatedAt?: string;
}

export const normalizeStageUsageKey = (
  stageCodeOrName: string,
  materialIdOrName: string
): string => {
  const sKey = String(stageCodeOrName || 'SCH-01')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
  const mKey = String(materialIdOrName || 'MAT-01')
    .trim()
    .replace(/\s+/g, '_');
  return `${sKey}__${mKey}`;
};

export const loadSavedStageMaterialUsageGuides = (): Record<string, StageMaterialUsageGuide> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STAGE_MATERIAL_USAGE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch {
    // ignore
  }
  return {};
};

export const saveStageMaterialUsageGuidesMap = (
  map: Record<string, StageMaterialUsageGuide>,
  syncEmail = 'CloudBae@naver.com'
) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STAGE_MATERIAL_USAGE_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
  try {
    fetch('/api/client-sync-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: syncEmail,
        state_key: 'stage_material_usage_guides_v1',
        state_value: map,
      }),
    }).catch(() => {});
  } catch {
    // ignore
  }
};

export const upsertSingleStageMaterialUsageGuide = (
  guide: StageMaterialUsageGuide,
  syncEmail = 'CloudBae@naver.com'
): Record<string, StageMaterialUsageGuide> => {
  const current = loadSavedStageMaterialUsageGuides();
  const keyById = normalizeStageUsageKey(guide.stageCode, guide.materialId);
  const keyByName = normalizeStageUsageKey(guide.stageCode, guide.productName);
  const stamped: StageMaterialUsageGuide = {
    ...guide,
    key: keyById,
    updatedByAdmin: true,
    updatedAt: new Date(Date.now() + 9 * 3600 * 1000)
      .toISOString()
      .slice(0, 16)
      .replace('T', ' '),
  };
  const next = {
    ...current,
    [keyById]: stamped,
    [keyByName]: stamped,
  };
  saveStageMaterialUsageGuidesMap(next, syncEmail);
  return next;
};

/**
 * 생육단계(stage) × 개별 추천 농자재(product)의 특성·성분·포장용량·권장갯수·평수·토양·기후를 종합하여
 * 쇼핑몰 일반 설명이 아닌 "해당 생육단계 안에서의 이 제품 전용 사용방법"을 근거에 맞게 자동 생성합니다.
 */
export const generateEvidenceBasedStageMaterialUsageGuide = (params: {
  stageCode?: string;
  stageGroupName?: string;
  subItemName?: string;
  stepOrder?: number;
  cropName?: string;
  areaPyeong?: number;
  soilPh?: number;
  soilEc?: number;
  soilCondition?: string;
  targetPgdd?: number;
  material: any;
}): StageMaterialUsageGuide => {
  const {
    stageCode = 'SCH-01',
    stageGroupName = '생육 관리',
    subItemName = '생육단계 맞춤 작업',
    stepOrder = 1,
    cropName = '배추',
    areaPyeong = 500,
    soilPh = 6.2,
    soilEc = 1.1,
    soilCondition = '양토',
    targetPgdd = 120,
    material = {},
  } = params;

  const matId = String(material?.material_id || material?.id || 'MAT-01').trim();
  const productName = String(
    material?.product_name || material?.productName || '맞춤 추천 농자재'
  ).trim();
  const subType = String(material?.sub_type || material?.subType || '').trim();
  const unitSpec = String(material?.unit_spec || material?.unitSpec || '20 kg').trim();
  const unitLabel = String(material?.unit_label || material?.unitLabel || '개').trim();
  const recQty = Math.max(
    1,
    Number(material?.recommendedQty || material?.recommended_qty || material?.defaultQty || 1)
  );
  const totalCap =
    material?.totalCapacityLabel || `${unitSpec} × ${recQty}${unitLabel}`;
  const rawCat = String(material?.material_category || '').toUpperCase();
  const combinedText = `${stageGroupName} ${subItemName} ${productName} ${subType}`;

  const category: 'FERTILIZER' | 'NUTRIENT' | 'PESTICIDE' | 'SEED' | 'SEEDLING' =
    rawCat === 'SEED' || /종자|씨앗/.test(combinedText)
      ? 'SEED'
      : rawCat === 'SEEDLING' || /모종|육묘|건묘|포트묘/.test(combinedText)
      ? 'SEEDLING'
      : rawCat === 'PESTICIDE' ||
        /농약|살충|살균|방제|약제|수화제|유제|액상수화제|입제|나방|진딧물|무름병|노균병|뿌리혹병|총채/.test(
          `${rawCat} ${productName} ${subType}`
        )
      ? 'PESTICIDE'
      : rawCat === 'NUTRIENT' ||
        /영양|칼슘|붕소|아미노산|해조|규산|미량요소|활착|발근|엽면/.test(
          `${rawCat} ${productName} ${subType}`
        )
      ? 'NUTRIENT'
      : 'FERTILIZER';

  const stageTitleClean = String(subItemName || stageGroupName)
    .replace(/\s*\([^)]*\)/g, '')
    .trim();

  // 생육단계 성격 판별
  const isSoilPrepStage =
    stepOrder <= 2 || /토양|밑거름|기비|퇴비|석회|경운|정지|이랑/.test(`${stageGroupName} ${subItemName}`);
  const isSowingOrPlantingStage =
    (stepOrder >= 3 && stepOrder <= 5) ||
    /파종|육묘|정식|이식|활착|가식/.test(`${stageGroupName} ${subItemName}`);
  const isEarlyGrowthStage =
    (stepOrder >= 6 && stepOrder <= 8) ||
    /1차\s*추비|초기\s*생육|외엽|생장\s*촉진|웃거름\s*1차/.test(`${stageGroupName} ${subItemName}`);
  const isMidLateHeadingStage =
    (stepOrder >= 9 && stepOrder <= 11) ||
    /결구|비대|2차\s*추비|3차\s*추비|구비대|후기\s*추비/.test(`${stageGroupName} ${subItemName}`);
  const isHarvestStage =
    stepOrder >= 15 || /수확|선별|예건|저장/.test(`${stageGroupName} ${subItemName}`);

  // 물량 계산 (500평 기준 물 500L 표준, 평수에 비례)
  const waterLiter = Math.max(100, Math.round((areaPyeong / 100) * 100));
  const per100PyeongQty = Math.max(0.2, Math.round((recQty / Math.max(1, areaPyeong / 100)) * 10) / 10);

  let dosageRate = `${areaPyeong.toLocaleString()}평 기준 ${unitSpec} × 권장 ${recQty}${unitLabel} (총 ${totalCap} · 100평당 약 ${per100PyeongQty}${unitLabel})`;
  let applicationStandard = '';
  let applicationMethod = '';
  let cautionText = '';
  let rationaleBasis = '';

  // 1) 제품 유형 × 생육단계별 정밀 분기
  if (category === 'PESTICIDE') {
    const isEcoFriendly = /친환경|유기농|클린바이오|미생물|식물추출/.test(`${productName} ${subType}`);
    const isSoilGranule = /입제|토양혼화|뿌리혹병|고자리파리|선충/.test(`${productName} ${subType}`);
    const isBactericideOrFungicide = /무름병|세균|살균|노균병|탄저|균핵|일품/.test(
      `${productName} ${subType}`
    );

    if (isSoilGranule || isSoilPrepStage) {
      applicationStandard = `${stageTitleClean} 단계 로터리 경운 직전 토양 전면 처리 (10a당 정량 기준 ${areaPyeong.toLocaleString()}평 ${recQty}${unitLabel})`;
      applicationMethod = `[${stageTitleClean}] 이랑 조성 전 토양 표면에 ${productName}을(를) 균일하게 산포한 뒤 15~20cm 깊이로 로터리 경운하여 토양과 골고루 혼화합니다.`;
      cautionText = `토양 수분이 너무 건조하면 약효 발현이 지연되므로 적습 상태에서 혼화 처리하고, 작업 시 방진마스크와 보호장갑을 착용하세요.`;
      rationaleBasis = `[${stageTitleClean}] 정식 전 토양 내 월동 병원균(뿌리혹병·균핵병) 및 토양해충(고자리파리·거세미나방) 밀도를 선제 차단하기 위한 토양 혼화 처방`;
    } else if (isEcoFriendly) {
      applicationStandard = `물 ${waterLiter.toLocaleString()}L에 500~1,000배 희석 (물 20L 1말당 20~40mL 정량 희석)`;
      applicationMethod = `[${stageTitleClean}] 시기 작물 잎 앞뒷면과 줄기 지제부에 약액이 흘러내릴 정도로 충분량 경엽 살포합니다. 예방 목적으로 5~7일 간격 2회 연속 살포 시 효과가 높습니다.`;
      cautionText = `친환경 유기농업 자재이므로 병해충 발생 초기나 예방 시기에 살포하고, 화학 합성 농약 및 강알칼리성 자재와의 혼용을 피하세요.`;
      rationaleBasis = `[${stageTitleClean}] 잔류농약(PLS) 우려 없이 ${cropName}의 병해충 저항성을 높이고 수확기까지 안전하게 방제하기 위한 친환경 맞춤 처방`;
    } else if (isBactericideOrFungicide) {
      applicationStandard = `물 ${waterLiter.toLocaleString()}L에 1,000~1,500배 희석 (물 20L 1말당 13~20mL · ${areaPyeong.toLocaleString()}평 ${recQty}${unitLabel} 소요)`;
      applicationMethod = `[${stageTitleClean}] 강우 전후 또는 습도가 높은 시기, ${cropName}의 결구 시작부(생장점)와 아랫잎 지제부까지 약액이 깊숙이 침투하도록 노즐을 낮추어 정밀 살포합니다.`;
      cautionText = `비를 맞은 직후에는 잎 표면의 물기가 마른 뒤 살포하고, 동일 계통(FRAC) 약제 연용을 피해 저항성 발현을 방지하세요. (PLS 안전사용기준 준수)`;
      rationaleBasis = `[${stageTitleClean}] 적산온도 ${targetPgdd}℃ 구간 다습·강우 조건에서 급증하는 무름병·노균병 등 세균·곰팡이성 병해를 적기 차단하기 위한 전문 방제 처방`;
    } else {
      applicationStandard = `물 ${waterLiter.toLocaleString()}L에 1,000배 정량 희석 (물 20L 1말당 20mL · ${areaPyeong.toLocaleString()}평 권장 ${recQty}${unitLabel})`;
      applicationMethod = `[${stageTitleClean}] 해충이 은신하는 ${cropName} 잎 뒷면과 속잎(생장점 부위)에 약액이 골고루 묻도록 이른 오전 또는 해질 무렵 안개 분무합니다.`;
      cautionText = `한낮 고온기(28℃ 이상) 살포 시 약해 우려가 있으므로 피하고, 꿀벌 등 화분매개충 활동 시간대와 강우 직전 살포를 삼가세요. (PLS 수확 전 사용일수 준수)`;
      rationaleBasis = `[${stageTitleClean}] 기온 상승기 급증하는 나방류·진딧물·총채벌레의 초기 유충 밀도를 억제하여 잎 손상과 바이러스 매개를 방지하는 맞춤 처방`;
    }
  } else if (category === 'NUTRIENT') {
    const isCalciumBoron = /칼슘|붕소|칼보론|꿀통|무름|세포벽|규산/.test(`${productName} ${subType}`);
    const isRootAmino = /발근|활착|뿌리|아미노산|해조|파워루트|스트레스/.test(
      `${productName} ${subType}`
    );

    if (isCalciumBoron) {
      applicationStandard = isMidLateHeadingStage
        ? `[결구·비대 집중기] 물 ${waterLiter.toLocaleString()}L에 500~1,000배 희석 (물 20L당 20~40mL) · 7~10일 간격 2~3회 엽면시비`
        : `[${stageTitleClean}] 물 ${waterLiter.toLocaleString()}L에 1,000배 희석 (물 20L당 20mL) 엽면 살포`;
      applicationMethod = `[${stageTitleClean}] 단계에서 ${cropName}의 속잎(생장점)과 외엽 앞뒷면에 고르게 묻도록 미세 노즐로 엽면시비합니다. 토양 수분이 부족할 때 관주와 병행하면 칼슘 흡수율이 배가됩니다.`;
      cautionText = `칼슘·붕소제는 인산염이나 알칼리성 약제와 혼용 시 침전이 발생할 수 있으므로 가급적 단용 살포하거나 사전 혼용 테스트 후 이른 아침·저녁에 살포하세요.`;
      rationaleBasis = `[${stageTitleClean}] 급격한 생육·결구 비대기 칼슘 결핍으로 인한 꿀통배추(팁번)·무름 증상을 예방하고 세포벽을 단단하게 강화하기 위한 처방 (토양 pH ${soilPh} 연동)`;
    } else if (isRootAmino || isSowingOrPlantingStage) {
      applicationStandard = `[${stageTitleClean}] 정식 직후~초기 활착기 물 ${waterLiter.toLocaleString()}L에 500~800배 희석 관주 또는 1,000배 엽면시비`;
      applicationMethod = `[${stageTitleClean}] 모종 정식 후 뿌리 주변 토양(포기당 200~300mL)에 관주하거나 잎 전면에 골고루 엽면 살포하여 세근(잔뿌리) 발근과 초기 활착을 촉진합니다.`;
      cautionText = `정식 직후 고농도 시비는 뿌리 삼투압 스트레스를 유발할 수 있으므로 권장 희석배수를 준수하고, 흐린 날이나 해질 무렵 처리하면 흡수율이 가장 높습니다.`;
      rationaleBasis = `[${stageTitleClean}] 이식 몸살 및 저온·고온 스트레스를 완화하고 새 뿌리(세근) 발달을 촉진하여 초기 생육 기반을 조기에 확보하기 위한 맞춤 처방`;
    } else {
      applicationStandard = `[${stageTitleClean}] 물 ${waterLiter.toLocaleString()}L에 800~1,000배 희석 (물 20L 1말당 20~25mL) 경엽 및 관주 병행`;
      applicationMethod = `[${stageTitleClean}] 생육 상태나 약제 방제 후 세력 회복을 위해 잎 앞뒷면에 균일하게 엽면시비하거나 점적관수 라인을 통해 관주 공급합니다.`;
      cautionText = `일교차가 크거나 한낮 직사광선이 강한 시간대를 피해 오전 9시 이전 또는 오후 4시 이후에 살포하여 잎 끝 타는 현상(약해)을 예방하세요.`;
      rationaleBasis = `[${stageTitleClean}] 적산온도 ${targetPgdd}℃ 도달 시점 광합성 효율과 양분 이동성을 높여 균일한 생육과 구·결구 충실도를 높이는 영양 처방`;
    }
  } else if (category === 'FERTILIZER') {
    const isOrganicCompost = /유박|퇴비|유기질|유기물|흙살림/.test(`${productName} ${subType}`);
    const isLimeOrSoilConditioner = /석회|고토|규산|토양개량|산도/.test(`${productName} ${subType}`);
    const isTopDressingNK =
      /추비|웃거름|NK|엔케이|비대|회복/.test(`${productName} ${subType}`) ||
      isEarlyGrowthStage ||
      isMidLateHeadingStage;

    if (isOrganicCompost) {
      applicationStandard = `[${stageTitleClean}] 파종·정식 10~14일 전 본밭 밑거름 전층 시비 (${areaPyeong.toLocaleString()}평 총 ${totalCap})`;
      applicationMethod = `[${stageTitleClean}] 본밭 전면에 ${productName} ${recQty}${unitLabel}을(를) 고르게 살포한 뒤 15~20cm 깊이로 로터리 경운하여 흙과 완전히 섞어줍니다.`;
      cautionText = `정식 직전에 살포하면 발효열과 암모니아 가스로 인해 뿌리 장해 및 고자리파리 유인이 발생할 수 있으므로 반드시 정식 10~14일 전에 시비하고 충분한 토양 수분을 유지하세요.`;
      rationaleBasis = `[${stageTitleClean}] 재배지 토양(${soilCondition} · pH ${soilPh})의 보수력·보비력을 높이고 생육 후기까지 지효성 유기 양분을 안정적으로 공급하기 위한 기비 처방`;
    } else if (isLimeOrSoilConditioner) {
      applicationStandard = `[${stageTitleClean}] 정식 2~3주 전 토양 산도(pH ${soilPh}) 교정 및 칼슘·고토 보충 시비 (${areaPyeong.toLocaleString()}평 ${recQty}${unitLabel})`;
      applicationMethod = `[${stageTitleClean}] 퇴비·화학비료 시비 1주일 전에 먼저 밭 전면에 골고루 살포하고 깊이 갈이(심경)하여 토양 하층부까지 산도를 교정합니다.`;
      cautionText = `질소질 비료나 완숙 퇴비와 같은 날 동시에 혼합 살포하면 암모니아 가스가 휘산되어 질소 성분이 손실되므로 반드시 5~7일 간격을 두고 시비하세요.`;
      rationaleBasis = `[${stageTitleClean}] 산성 토양을 ${cropName} 최적 산도(pH 6.0~6.5)로 교정하여 뿌리혹병 발생을 억제하고 석회·고토 결핍을 원천 예방하는 토양개량 처방`;
    } else if (isTopDressingNK && !isSoilPrepStage) {
      applicationStandard = `[${stageTitleClean}] 포기 사이(고랑·어깨) 정량 추비 시비 (${areaPyeong.toLocaleString()}평 기준 ${unitSpec} × ${recQty}${unitLabel})`;
      applicationMethod = `[${stageTitleClean}] ${cropName} 뿌리에서 10~15cm 떨어진 이랑 어깨 또는 고랑에 포기당 일정량씩 점시비(또는 줄시비)한 뒤 가볍게 흙으로 덮고 관수하여 용해를 돕습니다.`;
      cautionText = `비료 입자가 ${cropName} 잎이나 생장점(속잎)에 직접 닿으면 비료 해(잎 타는 증상)가 발생하므로 잎에 묻지 않게 주의하고, 1회 과량 시비 대신 정량 분시를 준수하세요. (현재 토양 EC ${soilEc} dS/m 고려)`;
      rationaleBasis = `[${stageTitleClean}] 적산온도 ${targetPgdd}℃ 생육 급신장기에 요구량이 급증하는 질소(N)·칼륨(K) 및 미량요소를 적기 보충하여 외엽 확장과 결구 비대를 촉진하는 추비 처방`;
    } else {
      applicationStandard = `[${stageTitleClean}] 이랑 조성 및 멀칭 5~7일 전 본밭 기준량 시비 (${areaPyeong.toLocaleString()}평 총 ${totalCap})`;
      applicationMethod = `[${stageTitleClean}] 밑거름으로 밭 전면에 ${productName}을(를) 균일하게 살포한 후 로터리 정지 작업을 실시하고 두둑(이랑)을 성형합니다.`;
      cautionText = `사양토나 배수가 빠른 포장은 비효 유실을 막기 위해 완효성 비료를 활용하거나 밑거름 비율을 줄이고 추비로 나누어 시비하며, 과습 시 염류 집적에 주의하세요.`;
      rationaleBasis = `[${stageTitleClean}] ${cropName} 초기 뿌리 활착부터 중기 생육까지 N-P-K 균형 양분을 끊김 없이 공급하기 위한 ${areaPyeong.toLocaleString()}평 맞춤 기비 처방`;
    }
  } else if (category === 'SEED') {
    applicationStandard = `[${stageTitleClean}] 발아 적온(18~22℃) 유지 · 105구/128구 육묘 트레이 1구당 1립 점파 (${areaPyeong.toLocaleString()}평 기준 ${recQty}${unitLabel})`;
    applicationMethod = `[${stageTitleClean}] 원예용 육묘 상토에 충분한 수분을 공급한 뒤 0.5~0.8cm 깊이로 파종공을 내어 1립씩 파종하고 질석(버미큘라이트)으로 가볍게 복토 후 신문지·차광망으로 수분 증발을 막아줍니다.`;
    cautionText = `파종 후 상토 온도가 30℃ 이상 올라가면 고온 발아 불량 및 웃자람이 발생하므로 통풍과 차광 관리에 유의하고, 발아 즉시 피복재를 제거하여 햇빛을 충분히 받게 하세요.`;
    rationaleBasis = `[${stageTitleClean}] 균일한 발아율 확보와 초기 무병 건묘 육성을 위한 파종 표준 처방`;
  } else {
    // SEEDLING (모종)
    applicationStandard = `[${stageTitleClean}] 본엽 4~5매 외기순화 건묘 기준 · 이랑 간격 60~65cm × 포기 간격 35~40cm 정식 (${areaPyeong.toLocaleString()}평 ${recQty}${unitLabel})`;
    applicationMethod = `[${stageTitleClean}] 정식 2~3시간 전 육묘 트레이에 물과 발근제를 충분히 관수(침지)한 뒤, 본밭 정식 구멍에 상토 윗면이 밭 흙보다 0.5cm 정도 살짝 높거나 수평이 되도록 심고 포기 주변에 충분히 물을 줍니다.`;
    cautionText = `모종 생장점(속잎)이 흙에 묻히도록 깊게 심으면 무름병 발생과 활착 지연의 원인이 되므로 얕게 심고, 한낮 고온기를 피해 흐린 날 오후나 해질 무렵에 정식하세요.`;
    rationaleBasis = `[${stageTitleClean}] 정식 직후 몸살을 최소화하고 조기 뿌리 활착(생존율 98% 이상)을 유도하기 위한 표준 정식 처방`;
  }

  if (isHarvestStage && category !== 'PESTICIDE') {
    cautionText = `수확 및 저장 단계에서는 과도한 질소 시비나 수분 공급을 중단하고, 청명하고 건조한 날 수확하여 저장성을 높이세요.`;
  }

  return {
    key: normalizeStageUsageKey(stageCode, matId),
    stageCode,
    stageName: stageTitleClean,
    materialId: matId,
    productName,
    materialCategory: category,
    dosageRate,
    applicationStandard,
    applicationMethod,
    cautionText,
    rationaleBasis,
    updatedByAdmin: false,
  };
};

/**
 * 저장된 관리자 작성 사용방법이 있으면 우선 반환하고,
 * 없으면 해당 생육단계 × 추천 농자재의 근거 기반 자동생성 사용방법을 반환합니다.
 */
export const resolveStageMaterialUsageGuide = (params: {
  stageCode?: string;
  stageGroupName?: string;
  subItemName?: string;
  stepOrder?: number;
  cropName?: string;
  areaPyeong?: number;
  soilPh?: number;
  soilEc?: number;
  soilCondition?: string;
  targetPgdd?: number;
  material: any;
  savedGuidesMap?: Record<string, StageMaterialUsageGuide>;
}): StageMaterialUsageGuide => {
  const autoGuide = generateEvidenceBasedStageMaterialUsageGuide(params);
  const mat = params.material || {};

  // 1) material 객체 내부에 stage_usage_guide 가 직접 들어있는 경우
  if (mat.stage_usage_guide && typeof mat.stage_usage_guide === 'object') {
    const g = mat.stage_usage_guide;
    if (g.dosageRate || g.applicationMethod || g.applicationStandard) {
      return {
        ...autoGuide,
        ...g,
        dosageRate: g.dosageRate || autoGuide.dosageRate,
        applicationStandard: g.applicationStandard || autoGuide.applicationStandard,
        applicationMethod: g.applicationMethod || autoGuide.applicationMethod,
        cautionText: g.cautionText || autoGuide.cautionText,
        rationaleBasis: g.rationaleBasis || autoGuide.rationaleBasis,
      };
    }
  }

  // 2) 관리자 저장 맵(localStorage / client-sync-state)에서 조회
  const map = params.savedGuidesMap || loadSavedStageMaterialUsageGuides();
  const sCode = String(params.stageCode || 'SCH-01').trim();
  const matId = String(mat.material_id || mat.id || '').trim();
  const prodName = String(mat.product_name || mat.productName || '').trim();

  const candidateKeys = [
    normalizeStageUsageKey(sCode, matId),
    normalizeStageUsageKey(sCode, prodName),
    normalizeStageUsageKey(params.subItemName || '', matId),
    normalizeStageUsageKey(params.subItemName || '', prodName),
  ];

  for (const k of candidateKeys) {
    const saved = map[k];
    if (saved && (saved.dosageRate || saved.applicationMethod || saved.applicationStandard)) {
      return {
        ...autoGuide,
        ...saved,
        dosageRate: saved.dosageRate || autoGuide.dosageRate,
        applicationStandard: saved.applicationStandard || autoGuide.applicationStandard,
        applicationMethod: saved.applicationMethod || autoGuide.applicationMethod,
        cautionText: saved.cautionText || autoGuide.cautionText,
        rationaleBasis: saved.rationaleBasis || autoGuide.rationaleBasis,
      };
    }
  }

  return autoGuide;
};

/**
 * 표준 16단계 생육과정별 대표 추천 농자재들의 초기 사용방법 데이터를 근거에 맞게 자동 생성하여
 * localStorage에 아직 없는 항목들을 시드(seed)합니다.
 */
export const ensureDefaultStageMaterialUsageGuidesSeeded = (): Record<
  string,
  StageMaterialUsageGuide
> => {
  const existing = loadSavedStageMaterialUsageGuides();
  const DEFAULT_STAGE_MATERIALS_SEED: Array<{
    stageCode: string;
    stageGroupName: string;
    subItemName: string;
    stepOrder: number;
    targetPgdd: number;
    materials: Array<{
      material_id: string;
      product_name: string;
      sub_type: string;
      material_category: 'FERTILIZER' | 'NUTRIENT' | 'PESTICIDE' | 'SEED' | 'SEEDLING';
      unit_spec: string;
      unit_label: string;
      recommendedQty: number;
    }>;
  }> = [
    {
      stageCode: 'SCH-01',
      stageGroupName: '01. 재배 준비 (토양 관리)',
      subItemName: '토양 검정 및 유기물 퇴비·석회 살포',
      stepOrder: 1,
      targetPgdd: 0,
      materials: [
        {
          material_id: 'FERT-PRD-05',
          product_name: '완숙 유박 비료 (4-2-1 · 유기물 70%)',
          sub_type: '유기질 퇴비',
          material_category: 'FERTILIZER',
          unit_spec: '20 kg',
          unit_label: '포',
          recommendedQty: 12,
        },
        {
          material_id: 'FERT-PRD-04',
          product_name: '입상 고토석회 비료 (산도교정·무사마귀병 예방)',
          sub_type: '토양개량제',
          material_category: 'FERTILIZER',
          unit_spec: '20 kg',
          unit_label: '포',
          recommendedQty: 8,
        },
        {
          material_id: 'ALT-NUTR-A-SCH-01',
          product_name: '뿌리활착·생육촉진 고농축 아미노산 영양제',
          sub_type: '토양미생물·활성제',
          material_category: 'NUTRIENT',
          unit_spec: '1 L',
          unit_label: '병',
          recommendedQty: 2,
        },
      ],
    },
    {
      stageCode: 'SCH-02',
      stageGroupName: '01. 재배 준비 (토양 관리)',
      subItemName: '밑거름 시비 및 이랑 조성·멀칭',
      stepOrder: 2,
      targetPgdd: 0,
      materials: [
        {
          material_id: 'FERT-PRD-01',
          product_name: '복합비료 15-15-15 (원예용 밑거름)',
          sub_type: '밑거름 복합비료',
          material_category: 'FERTILIZER',
          unit_spec: '20 kg',
          unit_label: '포',
          recommendedQty: 4,
        },
        {
          material_id: 'ALT-FERT-A-SCH-02',
          product_name: '배추 맞춤 완효성 균형 복합비료',
          sub_type: '맞춤 완효성비료',
          material_category: 'FERTILIZER',
          unit_spec: '20 kg',
          unit_label: '포',
          recommendedQty: 3,
        },
        {
          material_id: 'ALT-PEST-PREV-SCH-02',
          product_name: '생육기 토양·줄기 병해충 예방 살균·살충제',
          sub_type: '토양 혼화 약제',
          material_category: 'PESTICIDE',
          unit_spec: '500 mL',
          unit_label: '병',
          recommendedQty: 1,
        },
      ],
    },
    {
      stageCode: 'SCH-05',
      stageGroupName: '03. 정식 · 초기 활착기',
      subItemName: '본밭 모종 정식 및 초기 관수',
      stepOrder: 5,
      targetPgdd: 95,
      materials: [
        {
          material_id: 'MAT-SDL-01',
          product_name: '가을배추 105구 우량 외기순화 건묘 트레이',
          sub_type: '우량 포트 육묘',
          material_category: 'SEEDLING',
          unit_spec: '105구 × 1판',
          unit_label: '판',
          recommendedQty: 15,
        },
        {
          material_id: 'MAT-NUTR-01',
          product_name: '파워루트 발근·활착 촉진 액비 (아미노산+해조추출물)',
          sub_type: '발근·활착 촉진제',
          material_category: 'NUTRIENT',
          unit_spec: '1 L',
          unit_label: '병',
          recommendedQty: 2,
        },
      ],
    },
    {
      stageCode: 'SCH-07',
      stageGroupName: '03. 정식 · 초기 활착기',
      subItemName: '뿌리 활착 확인 및 1차 추비(웃거름) 시비',
      stepOrder: 7,
      targetPgdd: 210,
      materials: [
        {
          material_id: 'FERT-PRD-02',
          product_name: 'NK 마그네슘 추비특호 (18-0-16)',
          sub_type: '웃거름(추비)',
          material_category: 'FERTILIZER',
          unit_spec: '20 kg',
          unit_label: '포',
          recommendedQty: 3,
        },
        {
          material_id: 'ALT-NUTR-A-SCH-07',
          product_name: '뿌리활착·생육촉진 고농축 아미노산 영양제',
          sub_type: '생육활성 영양제',
          material_category: 'NUTRIENT',
          unit_spec: '1 L',
          unit_label: '병',
          recommendedQty: 1,
        },
        {
          material_id: 'ALT-NUTR-CA-SCH-07',
          product_name: '고농축 수용성 칼슘·붕소 엽면시비제',
          sub_type: '칼슘·붕소 영양제',
          material_category: 'NUTRIENT',
          unit_spec: '500 mL',
          unit_label: '병',
          recommendedQty: 1,
        },
      ],
    },
    {
      stageCode: 'SCH-09',
      stageGroupName: '04. 외엽 신장 · 결구 시작기',
      subItemName: '외엽 확보 2차 추비 및 칼슘·붕소 엽면시비',
      stepOrder: 9,
      targetPgdd: 430,
      materials: [
        {
          material_id: 'MAT-NUTR-03',
          product_name: '칼슘보론 액상 영양제 (결구기 꿀통배추 예방)',
          sub_type: '칼슘·붕소 영양제',
          material_category: 'NUTRIENT',
          unit_spec: '500 mL',
          unit_label: '병',
          recommendedQty: 2,
        },
        {
          material_id: 'FERT-PRD-02',
          product_name: 'NK 마그네슘 추비특호 (18-0-16)',
          sub_type: '웃거름(추비)',
          material_category: 'FERTILIZER',
          unit_spec: '20 kg',
          unit_label: '포',
          recommendedQty: 3,
        },
        {
          material_id: 'ALT-PEST-PREV-SCH-09',
          product_name: '생육기 토양·줄기 병해충 예방 살균·살충제',
          sub_type: '예방 전용 약제',
          material_category: 'PESTICIDE',
          unit_spec: '500 mL',
          unit_label: '병',
          recommendedQty: 1,
        },
      ],
    },
    {
      stageCode: 'SCH-13',
      stageGroupName: '05. 결구 비대 · 병해충 방제기',
      subItemName: '강우 전후 무름병·노균병 및 나방류 집중 방제',
      stepOrder: 13,
      targetPgdd: 690,
      materials: [
        {
          material_id: 'MAT-PEST-01',
          product_name: '일품 무름병·세균병 전문 입상수화제',
          sub_type: '전문 살균제',
          material_category: 'PESTICIDE',
          unit_spec: '250 g',
          unit_label: '봉',
          recommendedQty: 2,
        },
        {
          material_id: 'ALT-PEST-A-SCH-13',
          product_name: '배추 전문 속효성 방제 약제 (나방·진딧물 동시방제)',
          sub_type: '전문 살충·살균제',
          material_category: 'PESTICIDE',
          unit_spec: '500 mL',
          unit_label: '병',
          recommendedQty: 1,
        },
        {
          material_id: 'ALT-PEST-ECO-SCH-13',
          product_name: '친환경 유기농업 방제 자재 (클린바이오)',
          sub_type: '친환경 방제 자재',
          material_category: 'PESTICIDE',
          unit_spec: '1 L',
          unit_label: '병',
          recommendedQty: 1,
        },
        {
          material_id: 'ALT-NUTR-IMM-SCH-13',
          product_name: '병해충 내병성 강화 칼슘·규산 영양제',
          sub_type: '세포벽 강화 영양제',
          material_category: 'NUTRIENT',
          unit_spec: '1 L',
          unit_label: '병',
          recommendedQty: 1,
        },
      ],
    },
  ];

  let changed = false;
  const next = { ...existing };

  for (const stg of DEFAULT_STAGE_MATERIALS_SEED) {
    for (const mat of stg.materials) {
      const kId = normalizeStageUsageKey(stg.stageCode, mat.material_id);
      const kName = normalizeStageUsageKey(stg.stageCode, mat.product_name);
      if (!next[kId]) {
        const generated = generateEvidenceBasedStageMaterialUsageGuide({
          stageCode: stg.stageCode,
          stageGroupName: stg.stageGroupName,
          subItemName: stg.subItemName,
          stepOrder: stg.stepOrder,
          targetPgdd: stg.targetPgdd,
          areaPyeong: 500,
          material: mat,
        });
        next[kId] = generated;
        next[kName] = generated;
        changed = true;
      }
    }
  }

  if (changed && typeof window !== 'undefined') {
    try {
      localStorage.setItem(STAGE_MATERIAL_USAGE_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  return next;
};
