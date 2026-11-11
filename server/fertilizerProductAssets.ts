export interface FertilizerProductRecord {
  material_id: string;
  product_code: string; // 판매점 제품코드 (예: 30001000011)
  material_category: string; // 'FERTILIZER' | 'NUTRIENT' | 'PESTICIDE' | 'SEED' | 'SEEDLING'
  main_type?: string; // 비료 구분 카테고리 ('천연비료' | '화학비료')
  sub_type: string; // 세부 카테고리명
  category_code: string; // 세부 카테고리 코드
  manufacturer: string; // 제조사/브랜드/육묘장 (예: 아시아종묘, 농우바이오, 팜한농)
  product_name: string;
  formulation_type: string; // 제형 / 종자처리 / 육묘트레이 형태
  is_organic: number;
  organic_label: string; // 유기농/무농약/인증 표기
  weight_spec: string; // 무게 / 종자 중량
  volume_spec: string; // 부피 / 립수 / 구수
  origin_country: string; // 원산지 / 채종지 / 육묘산지
  contact_phone: string; // 연락처
  target_nutrient_or_pest: string;
  nutrient_ratio_summary: string; // 주요 영양소 첨가비 / 종자·모종 핵심 스펙 요약
  n_pct: number;
  p_pct: number;
  k_pct: number;
  ca_pct: number;
  mg_pct: number;
  b_pct: number;
  sio2_pct: number;
  s_pct: number;
  om_pct: number;
  dosage_per_100pyeong: string;
  unit_spec: string;
  retail_price: number; // 표준소비자가격 (원)
  unit_price: number; // 할인가격 (원)
  discount_rate: number; // 할인율 (%)
  reward_points: number; // 적립포인트 (P)
  stock_status: string;
  usage_stage: string;
  weather_trigger: string;
  thumbnail_url: string;
  detail_image_1: string;
  detail_image_2: string;
  detail_image_3: string;
  detail_image_4: string;
  description_banner_url: string;
  // 씨(SEED) 쇼핑몰 표준 전용 등록 항목
  seed_count_spec?: string; // 립수 · 포장단위 (예: 2,000립 / 약 7g / 1봉)
  germination_rate_pct?: string; // 발아율 보증 (%) (예: 85% 이상)
  germination_temp_spec?: string; // 발아 적온 (℃) (예: 20~25℃)
  seed_coating_spec?: string; // 종자 소독·코팅 처리 (예: 필름코팅 / 약제소독필)
  sowing_period_spec?: string; // 파종 적기 · 재배 작형 (예: 가을재배 8월 상순~중순)
  days_to_harvest_spec?: string; // 수확 소요일수 / 숙기 (예: 정식 후 65~70일)
  disease_resistance_spec?: string; // 내병성 · 품종 핵심 특성 (예: 무사마귀병(CR) 저항성)
  variety_reg_no?: string; // 품종 생산·수입 판매신고번호 (예: 제04-0018-2025-1호)
  // 모종(SEEDLING) 쇼핑몰 표준 전용 등록 항목
  plug_tray_spec?: string; // 트레이 규격 · 구수/본수 (예: 128구 트레이 1판 / 50구 연결포트)
  seedling_age_spec?: string; // 육묘 일수 · 묘령/본엽 수 (예: 파종 후 25~28일 · 본엽 4~5매)
  grafting_type_spec?: string; // 접목 여부 · 육묘 방식 (예: 실생 프러그묘 / 병해저항성 대목 접목묘)
  planting_distance_spec?: string; // 재식 거리 주간 × 이랑 (예: 이랑 65cm × 주간 40cm)
  hardening_spec?: string; // 외기 순화 · 뿌리돌림 상태 (예: 노지 자외선·야간 저온 순화 완료 · 뿌리돌림 A급)
  shipping_pack_spec?: string; // 안전 배송 포장 규격 (예: 모종 전용 숨구멍 고정 박스)
}

export const FERTILIZER_MAIN_TYPES = ['천연비료', '화학비료'] as const;
export type FertilizerMainType = (typeof FERTILIZER_MAIN_TYPES)[number];

export function resolveFertilizerMainType(
  subTypeOrCode?: string | null,
  explicitMainType?: string | null
): FertilizerMainType {
  const m = String(explicitMainType || '').trim();
  if (m === '천연비료' || m === '화학비료') return m;
  const s = String(subTypeOrCode || '').trim();
  if (
    s.includes('유기질') ||
    s.includes('퇴비') ||
    s.includes('토양개량') ||
    s.includes('칼슘비료') ||
    s === 'CAT-ORG-COMP' ||
    s === 'CAT-SOIL-CALC'
  ) {
    return '천연비료';
  }
  return '화학비료';
}

export const FERTILIZER_CATEGORIES = [
  {
    code: 'CAT-ORG-COMP',
    main_type: '천연비료',
    name: '유기질·퇴비',
    desc: '토양 유기물(OM) 함량 증진, 떼알구조 형성 및 미생물 활성화를 위한 발효 유박·퇴비 (부산물비료)',
  },
  {
    code: 'CAT-SOIL-CALC',
    main_type: '천연비료',
    name: '토양개량·칼슘비료',
    desc: '산성토양(pH) 교정, 석회·고토·규산 보충 및 배추 무사마귀병·칼슘결핍 예방 비료 (산도교정)',
  },
  {
    code: 'CAT-NPK-COMP',
    main_type: '화학비료',
    name: '복합비료',
    desc: '질소·인산·칼륨 3요소에 고토·붕소·칼슘을 복합 처방한 본밭 밑거름 표준 비료 (원예·기비전용)',
  },
  {
    code: 'CAT-NK-TOP',
    main_type: '화학비료',
    name: '웃거름비료',
    desc: '초기 활착 이후 생육 중기·결구기·비대기에 빠르게 흡수되는 속효성 NK 추비 비료 (NK추비전용)',
  },
  {
    code: 'CAT-CRF-SLOW',
    main_type: '화학비료',
    name: '완효성비료',
    desc: '온도·수분에 따라 60~100일간 양분이 서서히 용출되어 웃거름 노동력을 절감하는 코팅 비료 (코팅지효성)',
  },
  {
    code: 'CAT-SINGLE-K',
    main_type: '화학비료',
    name: '단비·칼륨전용비료',
    desc: '토양검정 결과 특정 부족 성분(칼륨·질소·인산)을 정밀 보충하기 위한 맞춤형 단비 (황산가리·요소)',
  },
];

export const INITIAL_FERTILIZER_PRODUCTS: FertilizerProductRecord[] = [
  {
    material_id: 'FERT-PRD-01',
    product_code: '30001000011',
    material_category: 'FERTILIZER',
    main_type: '화학비료',
    sub_type: '복합비료',
    category_code: 'CAT-NPK-COMP',
    manufacturer: '남해화학(주)',
    product_name: '슈퍼원예복합 (12-7-9+고토2+붕소0.3) 20kg',
    formulation_type: '입상 (Granular)',
    is_organic: 0,
    organic_label: '(일반복합)',
    weight_spec: '20Kg',
    volume_spec: '0ml',
    origin_country: '대한민국 (전남 여수)',
    contact_phone: '061-688-5500',
    target_nutrient_or_pest: '가을배추·감자·상추·시금치 본밭 밑거름 3요소 및 고토·붕소·칼슘 균형 공급',
    nutrient_ratio_summary: 'N 12% · P₂O₅ 7% · K₂O 9% + 고토(MgO) 2.0% + 붕소(B₂O₃) 0.3% + 칼슘(CaO) 1.5% + 유황(S) 4.0%',
    n_pct: 12.0,
    p_pct: 7.0,
    k_pct: 9.0,
    ca_pct: 1.5,
    mg_pct: 2.0,
    b_pct: 0.3,
    sio2_pct: 0,
    s_pct: 4.0,
    om_pct: 0,
    dosage_per_100pyeong: '100평당 30~40kg (1.5~2포 전층시비)',
    unit_spec: '20kg / 포',
    retail_price: 24500,
    unit_price: 21500,
    discount_rate: 12.2,
    reward_points: 430,
    stock_status: '인기품목 · 즉시출고',
    usage_stage: '본밭 밑거름 (파종·정식 1~2주 전 로터리 경운 시)',
    weather_trigger: '봄·가을 노지 정식 전 표준 밑거름 처방 (강우 전 경운 혼화 권장)',
    thumbnail_url: '/images/fertilizers/FERT-PRD-01-thumb.png',
    detail_image_1: '/images/fertilizers/FERT-PRD-01-detail1.png',
    detail_image_2: '/images/fertilizers/FERT-PRD-01-detail2.png',
    detail_image_3: '/images/fertilizers/FERT-PRD-01-detail3.png',
    detail_image_4: '/images/fertilizers/FERT-PRD-01-detail4.png',
    description_banner_url: '/images/fertilizers/FERT-PRD-01-desc.png',
  },
  {
    material_id: 'FERT-PRD-02',
    product_code: '30001000012',
    material_category: 'FERTILIZER',
    main_type: '화학비료',
    sub_type: '웃거름비료',
    category_code: 'CAT-NK-TOP',
    manufacturer: '(주)누보',
    product_name: '엔케이(NK) 마그네슘 추비특호 (18-0-16+고토2+붕소0.2) 20kg',
    formulation_type: '속효성 코팅입상',
    is_organic: 0,
    organic_label: '(일반추비)',
    weight_spec: '20Kg',
    volume_spec: '0ml',
    origin_country: '대한민국 (경기 수원)',
    contact_phone: '1600-7268',
    target_nutrient_or_pest: '활착기 이후 외엽 신장·결구 시작기·괴경비대기 질소·칼륨·마그네슘 급속 보충',
    nutrient_ratio_summary: 'N 18% · P₂O₅ 0% · K₂O 16% + 고토(MgO) 2.0% + 붕소(B₂O₃) 0.2% + 칼슘(CaO) 0.5%',
    n_pct: 18.0,
    p_pct: 0.0,
    k_pct: 16.0,
    ca_pct: 0.5,
    mg_pct: 2.0,
    b_pct: 0.2,
    sio2_pct: 0,
    s_pct: 2.5,
    om_pct: 0,
    dosage_per_100pyeong: '100평당 10~15kg (0.5~0.8포 포기사이 추비)',
    unit_spec: '20kg / 포',
    retail_price: 23000,
    unit_price: 19800,
    discount_rate: 13.9,
    reward_points: 396,
    stock_status: '정상판매 · 산지직송',
    usage_stage: '1차 웃거름(정식 후 15일) · 2차 웃거름(결구·비대 시작기)',
    weather_trigger: '적산온도(PGDD) 활착기·결구개시기 도달 또는 집중호우 후 양분 유실 시',
    thumbnail_url: '/images/fertilizers/FERT-PRD-02-thumb.png',
    detail_image_1: '/images/fertilizers/FERT-PRD-02-detail1.png',
    detail_image_2: '/images/fertilizers/FERT-PRD-02-detail2.png',
    detail_image_3: '/images/fertilizers/FERT-PRD-02-detail3.png',
    detail_image_4: '/images/fertilizers/FERT-PRD-02-detail4.png',
    description_banner_url: '/images/fertilizers/FERT-PRD-02-desc.png',
  },
  {
    material_id: 'FERT-PRD-03',
    product_code: '30001000013',
    material_category: 'FERTILIZER',
    main_type: '화학비료',
    sub_type: '완효성비료',
    category_code: 'CAT-CRF-SLOW',
    manufacturer: '(주)조비',
    product_name: '단한번 완효성 코팅복합 (14-6-8+고토1+붕소0.2) 20kg',
    formulation_type: '수지코팅 완효성 입상 (90일 용출형)',
    is_organic: 0,
    organic_label: '(완효성복합)',
    weight_spec: '20Kg',
    volume_spec: '0ml',
    origin_country: '대한민국 (울산 남구)',
    contact_phone: '1588-4719',
    target_nutrient_or_pest: '1회 밑거름 시비로 수확기까지 90일간 지온·수분에 맞춰 양분 자동 공급 (추비 생력화)',
    nutrient_ratio_summary: 'N 14% · P₂O₅ 6% · K₂O 8% + 고토(MgO) 1.0% + 붕소(B₂O₃) 0.2% + 규산(SiO₂) 2.0% + 유황(S) 3.0%',
    n_pct: 14.0,
    p_pct: 6.0,
    k_pct: 8.0,
    ca_pct: 1.0,
    mg_pct: 1.0,
    b_pct: 0.2,
    sio2_pct: 2.0,
    s_pct: 3.0,
    om_pct: 0,
    dosage_per_100pyeong: '100평당 25~30kg (1.2~1.5포 밑거름 단독 시비)',
    unit_spec: '20kg / 포',
    retail_price: 32000,
    unit_price: 28500,
    discount_rate: 10.9,
    reward_points: 570,
    stock_status: '인기품목 · 대농가추천',
    usage_stage: '본밭 정식·파종 전 두둑 성형 시 1회 전량 시비',
    weather_trigger: '잦은 가을장마·강우로 웃거름 유실 우려가 큰 포전 및 비닐멀칭 재배지',
    thumbnail_url: '/images/fertilizers/FERT-PRD-03-thumb.png',
    detail_image_1: '/images/fertilizers/FERT-PRD-03-detail1.png',
    detail_image_2: '/images/fertilizers/FERT-PRD-03-detail2.jpg',
    detail_image_3: '/images/fertilizers/FERT-PRD-03-detail3.png',
    detail_image_4: '/images/fertilizers/FERT-PRD-03-detail4.png',
    description_banner_url: '/images/fertilizers/FERT-PRD-03-desc.png',
  },
  {
    material_id: 'FERT-PRD-04',
    product_code: '30001000014',
    material_category: 'FERTILIZER',
    main_type: '천연비료',
    sub_type: '토양개량·칼슘비료',
    category_code: 'CAT-SOIL-CALC',
    manufacturer: '(주)풍농',
    product_name: '슈퍼고토석회·칼슘유황 토양개량제 20kg',
    formulation_type: '무분진 입상 (Granular)',
    is_organic: 1,
    organic_label: '(유기농)',
    weight_spec: '20Kg',
    volume_spec: '0ml',
    origin_country: '대한민국 (충남 서천)',
    contact_phone: '02-703-6411',
    target_nutrient_or_pest: '산성토양(pH 6.0 미만) 교정, 배추 뿌리혹병(무사마귀병)·결구내엽갈변(꿀통배추) 예방',
    nutrient_ratio_summary: '칼슘(CaO) 38% · 고토(MgO) 12% + 규산(SiO₂) 8.0% + 유황(S) 5.0% + 붕소(B₂O₃) 0.3% (알칼리분 53%)',
    n_pct: 0.0,
    p_pct: 0.0,
    k_pct: 0.0,
    ca_pct: 38.0,
    mg_pct: 12.0,
    b_pct: 0.3,
    sio2_pct: 8.0,
    s_pct: 5.0,
    om_pct: 0,
    dosage_per_100pyeong: '100평당 40~60kg (2~3포 심경 로터리)',
    unit_spec: '20kg / 포',
    retail_price: 12500,
    unit_price: 10500,
    discount_rate: 16.0,
    reward_points: 210,
    stock_status: '정상판매 · 즉시출고',
    usage_stage: '토양개량 단계 (파종·정식 2~3주 전 살포 후 심경)',
    weather_trigger: '흙토람 토양검정 pH 6.0 미달 또는 치환성 칼슘(Ca) 5.0 cmol+/kg 미달 시 자동 처방',
    thumbnail_url: '/images/fertilizers/FERT-PRD-04-thumb.jpg',
    detail_image_1: '/images/fertilizers/FERT-PRD-04-detail1.jpg',
    detail_image_2: '/images/fertilizers/FERT-PRD-04-detail2.png',
    detail_image_3: '/images/fertilizers/FERT-PRD-04-detail3.png',
    detail_image_4: '/images/fertilizers/FERT-PRD-04-detail4.png',
    description_banner_url: '/images/fertilizers/FERT-PRD-04-desc.jpg',
  },
  {
    material_id: 'FERT-PRD-05',
    product_code: '30001000015',
    material_category: 'FERTILIZER',
    main_type: '천연비료',
    sub_type: '유기질·퇴비',
    category_code: 'CAT-ORG-COMP',
    manufacturer: '상록유기농산',
    product_name: '참조은 1등급 발효 가축분 유박·유기질퇴비 20kg',
    formulation_type: '고온발효 펠릿형 (Pellet)',
    is_organic: 1,
    organic_label: '(유기농)',
    weight_spec: '20Kg',
    volume_spec: '0ml',
    origin_country: '대한민국 (전북 김제)',
    contact_phone: '063-545-8200',
    target_nutrient_or_pest: '토양 유기물(OM) 보충, 토양 완충능(pH)·보수력·통기성 개선 및 지력 증진',
    nutrient_ratio_summary: '유기물(OM) 70% · N 4.2% · P₂O₅ 2.1% · K₂O 1.5% + 칼슘(CaO) 2.5% + 고토(MgO) 0.8%',
    n_pct: 4.2,
    p_pct: 2.1,
    k_pct: 1.5,
    ca_pct: 2.5,
    mg_pct: 0.8,
    b_pct: 0.1,
    sio2_pct: 0,
    s_pct: 0.5,
    om_pct: 70.0,
    dosage_per_100pyeong: '100평당 80~120kg (4~6포 기비 전층시비)',
    unit_spec: '20kg / 포',
    retail_price: 13000,
    unit_price: 11000,
    discount_rate: 15.4,
    reward_points: 220,
    stock_status: '유기농공시 · 즉시출고',
    usage_stage: '밑거름 퇴비 시비 (파종·정식 2주 전 전층 시비)',
    weather_trigger: '흙토람 토양검정 유기물(OM) 25g/kg 미만 또는 산도(pH) 6.8 초과 알칼리 토양 완충 처방',
    thumbnail_url: '/images/fertilizers/FERT-PRD-05-thumb.jpg',
    detail_image_1: '/images/fertilizers/FERT-PRD-05-detail1.png',
    detail_image_2: '/images/fertilizers/FERT-PRD-05-detail2.jpg',
    detail_image_3: '/images/fertilizers/FERT-PRD-05-detail3.jpg',
    detail_image_4: '/images/fertilizers/FERT-PRD-05-detail4.jpg',
    description_banner_url: '/images/fertilizers/FERT-PRD-05-desc.jpg',
  },
  ...[
    {
      id: 'FERT-PRD-06', code: '30001000016', sub: '단비·칼륨전용비료', catCode: 'CAT-SINGLE-K',
      brand: '남해화학(주)', name: '원예용 입상 황산가리 (수용성 칼륨 50% + 유황 17%) 20kg',
      form: '입상 (Granular)', org: 0, orgLbl: '(단비·칼륨전용)', w: '20Kg', origin: '대한민국 (전남 여수)', phone: '061-688-5500',
      target: '감자 전분축적·배추 결구 충실도 향상 및 마늘·양파 구비대·저장성 강화용 칼륨·유황 집중 보충',
      ratio: 'K₂O 50% + 유황(S) 17% + 고토(MgO) 1.0% (염소 무함유 황산가리계)',
      n: 0, p: 0, k: 50, ca: 0, mg: 1.0, b: 0, sio2: 0, s: 17.0, om: 0,
      dosage: '100평당 10~15kg (0.5~0.8포 밑거름 또는 비대기 추비)', spec: '20kg / 포',
      retail: 28000, unit: 24500, stage: '밑거름 정밀보충 및 결구·괴경비대기 웃거름', trigger: '토양검정 치환성 칼륨(K) 0.5 cmol+/kg 미만 부족 필지'
    },
    {
      id: 'FERT-PRD-07', code: '30001000017', sub: '복합비료', catCode: 'CAT-NPK-COMP',
      brand: '(주)팜한농', name: '파워원예특호 (11-8-9+고토2+붕소0.3+칼슘2) 20kg',
      form: '기능성 입상 (Granular)', org: 0, orgLbl: '(일반복합)', w: '20Kg', origin: '대한민국 (울산 남구)', phone: '1644-0901',
      target: '배추·무·고추·감자 초기 뿌리활착 및 본밭 밑거름 3요소·미량요소 통합 공급',
      ratio: 'N 11% · P₂O₅ 8% · K₂O 9% + 칼슘(CaO) 2.0% + 고토(MgO) 2.0% + 붕소(B₂O₃) 0.3%',
      n: 11, p: 8, k: 9, ca: 2.0, mg: 2.0, b: 0.3, sio2: 0, s: 3.5, om: 0,
      dosage: '100평당 30~40kg (1.5~2포 전층시비)', spec: '20kg / 포',
      retail: 25000, unit: 21800, stage: '본밭 정식 10~14일 전 밑거름 로터리', trigger: '일반 노지 밭작물 표준 기비 처방'
    },
    {
      id: 'FERT-PRD-08', code: '30001000018', sub: '웃거름비료', catCode: 'CAT-NK-TOP',
      brand: '남해화학(주)', name: '슈퍼엔케이(NK) 추비왕 (17-0-14+고토2+붕소0.2) 20kg',
      form: '속효성 입상 (Granular)', org: 0, orgLbl: '(일반추비)', w: '20Kg', origin: '대한민국 (전남 여수)', phone: '061-688-5500',
      target: '가을배추 1·2차 웃거름 및 상추·시금치·대파 생육 중기 초세 회복',
      ratio: 'N 17% · P₂O₅ 0% · K₂O 14% + 고토(MgO) 2.0% + 붕소(B₂O₃) 0.2% + 유황(S) 3.0%',
      n: 17, p: 0, k: 14, ca: 0.5, mg: 2.0, b: 0.2, sio2: 0, s: 3.0, om: 0,
      dosage: '100평당 10~15kg (포기 사이 또는 고랑 추비)', spec: '20kg / 포',
      retail: 22500, unit: 19200, stage: '정식 후 15일 1차 추비 · 결구개시기 2차 추비', trigger: '유효적산온도(PGDD) 220℃·일 및 432℃·일 도달 시'
    },
    {
      id: 'FERT-PRD-09', code: '30001000019', sub: '완효성비료', catCode: 'CAT-CRF-SLOW',
      brand: '(주)누보', name: '시비엔(N) 코팅 완효성비료 (15-6-10+고토2+붕소0.2) 20kg',
      form: '폴리머 코팅 입상 (100일 용출)', org: 0, orgLbl: '(완효성복합)', w: '20Kg', origin: '대한민국 (경기 수원)', phone: '1600-7268',
      target: '배추·감자·마늘·양파 밑거름 1회 시비로 웃거름 노동력 80% 절감',
      ratio: 'N 15% · P₂O₅ 6% · K₂O 10% + 고토(MgO) 2.0% + 붕소(B₂O₃) 0.2% + 유황(S) 4.0%',
      n: 15, p: 6, k: 10, ca: 1.0, mg: 2.0, b: 0.2, sio2: 1.5, s: 4.0, om: 0,
      dosage: '100평당 25~30kg (1.2~1.5포 정식 전 전층시비)', spec: '20kg / 포',
      retail: 33000, unit: 29000, stage: '본밭 두둑 성형 및 비닐멀칭 직전 1회 시비', trigger: '비닐멀칭 재배 및 고령·대규모 농가 생력화 처방'
    },
    {
      id: 'FERT-PRD-10', code: '30001000020', sub: '토양개량·칼슘비료', catCode: 'CAT-SOIL-CALC',
      brand: '대유', name: '대유 명품 입상 칼슘유황비료 (CaO 35%+S 12%+B 0.3%) 20kg',
      form: '무분진 입상 (Granular)', org: 1, orgLbl: '(유기농)', w: '20Kg', origin: '대한민국 (충북 괴산)', phone: '1588-4710',
      target: '배추 무사마귀병·무름병 억제, 감자 더뎅이병 경감 및 마늘·양파 향미·저장성 증진',
      ratio: '칼슘(CaO) 35% + 유황(S) 12% + 고토(MgO) 5.0% + 붕소(B₂O₃) 0.3%',
      n: 0, p: 0, k: 0, ca: 35.0, mg: 5.0, b: 0.3, sio2: 3.0, s: 12.0, om: 0,
      dosage: '100평당 30~40kg (1.5~2포 경운 전 살포)', spec: '20kg / 포',
      retail: 16500, unit: 13800, stage: '파종·정식 2주 전 토양개량 단계', trigger: '연작지 토양병원균 밀도 경감 및 칼슘·유황 동시 보충 시'
    },
    {
      id: 'FERT-PRD-11', code: '30001000021', sub: '유기질·퇴비', catCode: 'CAT-ORG-COMP',
      brand: '(주)효성오앤비', name: '토토유박 골드 1등급 혼합유박 (N 4.3-P 2.0-K 1.2+OM 72%) 20kg',
      form: '숙성 펠릿형 (Pellet)', org: 1, orgLbl: '(유기농)', w: '20Kg', origin: '대한민국 (충남 아산)', phone: '041-544-8114',
      target: '아주까리·채종박·미강박 배합 고급 유기질 공급 및 토양 떼알구조·미생물 활성화',
      ratio: '유기물(OM) 72% · N 4.3% · P₂O₅ 2.0% · K₂O 1.2% + 칼슘(CaO) 1.8%',
      n: 4.3, p: 2.0, k: 1.2, ca: 1.8, mg: 0.6, b: 0.1, sio2: 0, s: 0.5, om: 72.0,
      dosage: '100평당 60~100kg (3~5포 밑거름 전층시비)', spec: '20kg / 포',
      retail: 14500, unit: 12200, stage: '파종·정식 10~14일 전 밑거름 시비', trigger: '토양 유기물 함량 부족 필지 및 친환경 농산물 인증 포전'
    },
    {
      id: 'FERT-PRD-12', code: '30001000022', sub: '단비·칼륨전용비료', catCode: 'CAT-SINGLE-K',
      brand: '태경비케이(주)', name: '농업용 입상 붕사·칼슘고토 미량요소 단비 10kg',
      form: '세립 입상 (Fine Granular)', org: 1, orgLbl: '(유기농)', w: '10Kg', origin: '대한민국 (충북 단양)', phone: '043-422-2500',
      target: '배추·무 붕소결핍(속썩음·코르크화) 및 칼슘·고토 결핍 정밀 교정',
      ratio: '붕소(B₂O₃) 11.0% + 칼슘(CaO) 22.0% + 고토(MgO) 8.0%',
      n: 0, p: 0, k: 0, ca: 22.0, mg: 8.0, b: 11.0, sio2: 0, s: 2.0, om: 0,
      dosage: '100평당 2~3kg (밑거름 복합비료와 혼용 살포)', spec: '10kg / 포',
      retail: 18000, unit: 15200, stage: '본밭 정식 1~2주 전 밑거름 혼용 시비', trigger: '사양토(모래참흙) 및 붕소·칼슘 용탈 우려 필지'
    },
    {
      id: 'FERT-PRD-13', code: '30001000023', sub: '복합비료', catCode: 'CAT-NPK-COMP',
      brand: '(주)조비', name: '치요다 원예복합 (14-10-12+고토1.5+붕소0.2) 20kg',
      form: '다공성 입상 (Porous Granular)', org: 0, orgLbl: '(일반복합)', w: '20Kg', origin: '대한민국 (울산 남구)', phone: '1588-4719',
      target: '초기 저온기·건조기에도 물에 즉시 녹아 뿌리 흡수가 빠른 고급 원예 밑거름',
      ratio: 'N 14% · P₂O₅ 10% · K₂O 12% + 고토(MgO) 1.5% + 붕소(B₂O₃) 0.2%',
      n: 14, p: 10, k: 12, ca: 1.0, mg: 1.5, b: 0.2, sio2: 0, s: 3.0, om: 0,
      dosage: '100평당 20~30kg (1~1.5포 기비 시비)', spec: '20kg / 포',
      retail: 29500, unit: 25800, stage: '봄감자·봄배추·마늘·양파 밑거름', trigger: '초봄 저온기 또는 토양 수분이 적어 속효성 용출이 필요할 때'
    },
    {
      id: 'FERT-PRD-14', code: '30001000024', sub: '웃거름비료', catCode: 'CAT-NK-TOP',
      brand: '(주)팜한농', name: '관주용 수용성 질산칼슘·NK 추비 (15-0-15+CaO 18%) 10kg',
      form: '100% 수용성 결정분말', org: 0, orgLbl: '(관주·추비전용)', w: '10Kg', origin: '대한민국 (전북 군산)', phone: '1644-0901',
      target: '점적관수 시설을 통한 질소·칼륨·수용성칼슘 동시 공급 및 결구·비대 촉진',
      ratio: 'N 15% · P₂O₅ 0% · K₂O 15% + 수용성 칼슘(CaO) 18.0% + 붕소(B) 0.2%',
      n: 15, p: 0, k: 15, ca: 18.0, mg: 1.0, b: 0.2, sio2: 0, s: 0, om: 0,
      dosage: '100평당 3~5kg (점적관수 관주 또는 포기 추비)', spec: '10kg / 포',
      retail: 24000, unit: 20500, stage: '생육 중기~결구기 점적관주 추비', trigger: '점적관수 설치 포전 및 결구기 칼슘·칼륨 동시 요구 시'
    },
    {
      id: 'FERT-PRD-15', code: '30001000025', sub: '완효성비료', catCode: 'CAT-CRF-SLOW',
      brand: '(주)팜한농', name: '한번에아리커 완효성비료 (16-7-9+고토2+붕소0.3) 20kg',
      form: '광분해 코팅 완효성 입상', org: 0, orgLbl: '(완효성복합)', w: '20Kg', origin: '대한민국 (울산 남구)', phone: '1644-0901',
      target: '작물 생육 리듬에 맞춘 S자형 양분 용출로 초기 비료해 방지 및 후기 비절 예방',
      ratio: 'N 16% · P₂O₅ 7% · K₂O 9% + 고토(MgO) 2.0% + 붕소(B₂O₃) 0.3%',
      n: 16, p: 7, k: 9, ca: 1.0, mg: 2.0, b: 0.3, sio2: 1.0, s: 3.0, om: 0,
      dosage: '100평당 25~30kg (1.2~1.5포 기비 전층시비)', spec: '20kg / 포',
      retail: 31500, unit: 27800, stage: '본밭 정식 전 밑거름 1회 전량 시비', trigger: '장기 생육 작물 및 추비 생력화 희망 농가'
    },
    {
      id: 'FERT-PRD-16', code: '30001000026', sub: '토양개량·칼슘비료', catCode: 'CAT-SOIL-CALC',
      brand: '(주)한국농자재', name: '황금알 입상 규산질·석회고토 복합 개량제 20kg',
      form: '입상 (Granular)', org: 1, orgLbl: '(유기농)', w: '20Kg', origin: '대한민국 (강원 영월)', phone: '033-374-5100',
      target: '가용성 규산 및 석회·고토 공급으로 산성토양 중화, 줄기 도복 방지 및 내병성 강화',
      ratio: '가용성 규산(SiO₂) 25% + 칼슘(CaO) 32% + 고토(MgO) 8.0%',
      n: 0, p: 0, k: 0, ca: 32.0, mg: 8.0, b: 0.1, sio2: 25.0, s: 1.0, om: 0,
      dosage: '100평당 40~60kg (2~3포 경운 전 살포)', spec: '20kg / 포',
      retail: 13500, unit: 11200, stage: '파종·정식 2~3주 전 심경 시', trigger: '유효규산 150mg/kg 미만 및 산성토양(pH 6.0 미만) 필지'
    },
    {
      id: 'FERT-PRD-17', code: '30001000027', sub: '유기질·퇴비', catCode: 'CAT-ORG-COMP',
      brand: '대유', name: '대유 유기농 골드 발효 유박비료 (OM 70%+휴믹산) 20kg',
      form: '고온살균 펠릿형', org: 1, orgLbl: '(유기농)', w: '20Kg', origin: '대한민국 (충북 괴산)', phone: '1588-4710',
      target: '피마자박·채종박·휴믹산 배합으로 뿌리권 보비력(CEC) 향상 및 가스장해 없는 안전 기비',
      ratio: '유기물(OM) 70% · N 4.5% · P₂O₅ 2.0% · K₂O 1.5% + 부식산(Humic) 5%',
      n: 4.5, p: 2.0, k: 1.5, ca: 2.0, mg: 1.0, b: 0.1, sio2: 0, s: 0.8, om: 70.0,
      dosage: '100평당 60~80kg (3~4포 전층시비)', spec: '20kg / 포',
      retail: 15800, unit: 13500, stage: '정식 10~14일 전 밑거름 시비', trigger: '유기물 부족 토양 및 시설하우스·노지 고품질 재배'
    },
    {
      id: 'FERT-PRD-18', code: '30001000028', sub: '단비·칼륨전용비료', catCode: 'CAT-SINGLE-K',
      brand: '남해화학(주)', name: '맞춤형 코팅 요소·질소 단비 (완효성 N 42%) 20kg',
      form: '유황코팅 프릴입상', org: 0, orgLbl: '(단비·질소전용)', w: '20Kg', origin: '대한민국 (전남 여수)', phone: '061-688-5500',
      target: '초기 생육 부진 포전의 엽면적 급속 확보 및 암모니아 휘산·용탈을 줄인 질소 보충',
      ratio: '질소(N) 42.0% + 유황(S) 8.0% (유황코팅 완효성 요소)',
      n: 42.0, p: 0, k: 0, ca: 0, mg: 0, b: 0, sio2: 0, s: 8.0, om: 0,
      dosage: '100평당 5~8kg (초기 웃거름 소량 정밀 시비)', spec: '20kg / 포',
      retail: 23500, unit: 20200, stage: '활착 직후 ~ 초기 영양생장기 1차 추비', trigger: '초기 저온·강우로 질소 유실 및 엽색 황화 발생 시'
    },
    {
      id: 'FERT-PRD-19', code: '30001000029', sub: '복합비료', catCode: 'CAT-NPK-COMP',
      brand: '(주)풍농', name: '엔피케이(NPK) 감자·서류 전용 복합 (10-10-14+고토2+붕소0.3) 20kg',
      form: '입상 (Granular)', org: 0, orgLbl: '(황산가리계복합)', w: '20Kg', origin: '대한민국 (충남 서천)', phone: '02-703-6411',
      target: '감자·고구마·근채류 지하부 비대 및 전분가 향상을 위한 고칼륨 황산가리계 밑거름',
      ratio: 'N 10% · P₂O₅ 10% · K₂O 14% + 고토(MgO) 2.0% + 붕소(B₂O₃) 0.3% + 유황(S) 6.0%',
      n: 10, p: 10, k: 14, ca: 1.5, mg: 2.0, b: 0.3, sio2: 0, s: 6.0, om: 0,
      dosage: '100평당 30~40kg (1.5~2포 파종 전 전층시비)', spec: '20kg / 포',
      retail: 26000, unit: 22500, stage: '씨감자·구근류 파종 1~2주 전 기비', trigger: '감자(수미·두백·설봉) 및 근채류 파종 준비 단계'
    },
    {
      id: 'FERT-PRD-20', code: '30001000030', sub: '웃거름비료', catCode: 'CAT-NK-TOP',
      brand: '(주)조비', name: '단번에엔케이(NK) 칼슘추비 (16-0-15+CaO 4+MgO 2+B 0.2) 20kg',
      form: '속효성 구형 입상', org: 0, orgLbl: '(칼슘함유추비)', w: '20Kg', origin: '대한민국 (울산 남구)', phone: '1588-4719',
      target: '배추 결구기·마늘 구비대기에 질소·칼륨과 수용성 칼슘·붕소를 동시에 공급하는 기능성 추비',
      ratio: 'N 16% · P₂O₅ 0% · K₂O 15% + 칼슘(CaO) 4.0% + 고토(MgO) 2.0% + 붕소(B₂O₃) 0.2%',
      n: 16, p: 0, k: 15, ca: 4.0, mg: 2.0, b: 0.2, sio2: 0, s: 2.5, om: 0,
      dosage: '100평당 10~15kg (포기 사이 또는 고랑 추비)', spec: '20kg / 포',
      retail: 24500, unit: 21000, stage: '1차·2차 웃거름 (결구 및 구비대기)', trigger: '결구기 칼슘 요구량이 높은 가을배추·양배추 포전'
    },
    {
      id: 'FERT-PRD-21', code: '30001000031', sub: '완효성비료', catCode: 'CAT-CRF-SLOW',
      brand: '남해화학(주)', name: '오래가네 완효성 원예복합 (14-7-10+고토2+붕소0.2) 20kg',
      form: '수지코팅 입상 (85일 용출)', org: 0, orgLbl: '(완효성복합)', w: '20Kg', origin: '대한민국 (전남 여수)', phone: '061-688-5500',
      target: '가을배추 75~85일 전 생육기간 동안 일정하게 양분을 공급하는 맞춤형 완효성 비료',
      ratio: 'N 14% · P₂O₅ 7% · K₂O 10% + 고토(MgO) 2.0% + 붕소(B₂O₃) 0.2% + 칼슘(CaO) 1.5%',
      n: 14, p: 7, k: 10, ca: 1.5, mg: 2.0, b: 0.2, sio2: 1.0, s: 3.5, om: 0,
      dosage: '100평당 25~30kg (1.2~1.5포 밑거름 전층시비)', spec: '20kg / 포',
      retail: 30500, unit: 26800, stage: '본밭 정식 전 로터리 시 1회 전량 시비', trigger: '가을배추(불암3호·휘파람) 80일 작형 표준 완효성 처방'
    },
    {
      id: 'FERT-PRD-22', code: '30001000032', sub: '토양개량·칼슘비료', catCode: 'CAT-SOIL-CALC',
      brand: '(주)누보', name: '엔플러스 패화석·석회보르도 유기농 칼슘개량제 20kg',
      form: '천연 굴패각 미세입상', org: 1, orgLbl: '(유기농)', w: '20Kg', origin: '대한민국 (경남 통영)', phone: '1600-7268',
      target: '해양 천연 굴패각 유래 수용성 칼슘 및 미네랄 공급으로 산성토양 개량 및 뿌리혹병 억제',
      ratio: '칼슘(CaO) 42% + 고토(MgO) 3.0% + 천연 해양미네랄 + 유기물 5%',
      n: 0, p: 0.5, k: 0.5, ca: 42.0, mg: 3.0, b: 0.2, sio2: 2.0, s: 1.5, om: 5.0,
      dosage: '100평당 40~50kg (2~2.5포 정식 2주 전 경운)', spec: '20kg / 포',
      retail: 14000, unit: 11800, stage: '정식 2~3주 전 토양개량 시비', trigger: '친환경·유기농 배추·시금치 포전 산도(pH) 교정 시'
    },
    {
      id: 'FERT-PRD-23', code: '30001000033', sub: '유기질·퇴비', catCode: 'CAT-ORG-COMP',
      brand: '(주)농협케미컬', name: '흙사랑 미생물 발효 입상 유기질비료 (OM 68%+바실러스균) 20kg',
      form: '미생물 접종 펠릿형', org: 1, orgLbl: '(유기농)', w: '20Kg', origin: '대한민국 (충북 청주)', phone: '1588-2026',
      target: '바실러스 유익 미생물과 발효 유기물을 동시 투입하여 연작장해 경감 및 뿌리 발달 촉진',
      ratio: '유기물(OM) 68% · N 4.0% · P₂O₅ 2.2% · K₂O 1.8% + 유익미생물 10⁷ CFU/g',
      n: 4.0, p: 2.2, k: 1.8, ca: 2.2, mg: 1.0, b: 0.1, sio2: 0, s: 0.5, om: 68.0,
      dosage: '100평당 60~100kg (3~5포 밑거름 로터리)', spec: '20kg / 포',
      retail: 15000, unit: 12800, stage: '파종·정식 2주 전 전층시비', trigger: '연작 하우스(상추·엽채류) 및 지력 저하 노지 포전'
    },
    {
      id: 'FERT-PRD-24', code: '30001000034', sub: '단비·칼륨전용비료', catCode: 'CAT-SINGLE-K',
      brand: '(주)풍농', name: '원예용 용성인비·칼륨 복합단비 (P₂O₅ 20%+K₂O 15%+MgO 12%) 20kg',
      form: '입상 (Granular)', org: 0, orgLbl: '(인산·칼륨단비)', w: '20Kg', origin: '대한민국 (충남 서천)', phone: '02-703-6411',
      target: '제주 화산회토 및 개간지 등 유효인산·칼륨·고토가 부족한 토양의 뿌리 활착·내한성 강화',
      ratio: 'P₂O₅ 20% · K₂O 15% + 고토(MgO) 12% + 칼슘(CaO) 20% + 규산(SiO₂) 15%',
      n: 0, p: 20.0, k: 15.0, ca: 20.0, mg: 12.0, b: 0.2, sio2: 15.0, s: 0, om: 0,
      dosage: '100평당 20~30kg (1~1.5포 기비 혼용)', spec: '20kg / 포',
      retail: 21000, unit: 18000, stage: '파종·정식 전 밑거름 보충 시비', trigger: '유효인산 300mg/kg 미만 화산회토(제주 시금치·월동무) 및 신개간지'
    },
    {
      id: 'FERT-PRD-25', code: '30001000035', sub: '복합비료', catCode: 'CAT-NPK-COMP',
      brand: '(주)누보', name: '엔플러스 원예명작 올인원 기비 (13-8-10+CaO 3+MgO 2+B 0.3) 20kg',
      form: '고기능성 균일 입상', org: 0, orgLbl: '(프리미엄복합)', w: '20Kg', origin: '대한민국 (경기 수원)', phone: '1600-7268',
      target: '배추·감자·상추·시금치·마늘 전 작물 본밭 밑거름 3요소와 미량요소 원스톱 공급',
      ratio: 'N 13% · P₂O₅ 8% · K₂O 10% + 칼슘(CaO) 3.0% + 고토(MgO) 2.0% + 붕소(B₂O₃) 0.3% + 유황(S) 5.0%',
      n: 13.0, p: 8.0, k: 10.0, ca: 3.0, mg: 2.0, b: 0.3, sio2: 1.0, s: 5.0, om: 0,
      dosage: '100평당 30kg (1.5포 정식 전 전층시비)', spec: '20kg / 포',
      retail: 26500, unit: 22900, stage: '본밭 정식·파종 1~2주 전 표준 밑거름', trigger: '고품질 다수확 목표 계약재배 농가 표준 밑거름 처방'
    },
  ].map((x) => ({
    material_id: x.id,
    product_code: x.code,
    material_category: 'FERTILIZER',
    main_type: resolveFertilizerMainType(x.sub),
    sub_type: x.sub,
    category_code: x.catCode,
    manufacturer: x.brand,
    product_name: x.name,
    formulation_type: x.form,
    is_organic: x.org,
    organic_label: x.orgLbl,
    weight_spec: x.w,
    volume_spec: '0ml',
    origin_country: x.origin,
    contact_phone: x.phone,
    target_nutrient_or_pest: x.target,
    nutrient_ratio_summary: x.ratio,
    n_pct: x.n,
    p_pct: x.p,
    k_pct: x.k,
    ca_pct: x.ca,
    mg_pct: x.mg,
    b_pct: x.b,
    sio2_pct: x.sio2,
    s_pct: x.s,
    om_pct: x.om,
    dosage_per_100pyeong: x.dosage,
    unit_spec: x.spec,
    retail_price: x.retail,
    unit_price: x.unit,
    discount_rate: Number((((x.retail - x.unit) / x.retail) * 100).toFixed(1)),
    reward_points: Math.round(x.unit * 0.02),
    stock_status: x.org ? '유기농공시 · 즉시출고' : '인기품목 · 즉시출고',
    usage_stage: x.stage,
    weather_trigger: x.trigger,
    thumbnail_url: `/api/agro-materials/image/${x.id}/thumb`,
    detail_image_1: `/api/agro-materials/image/${x.id}/detail1`,
    detail_image_2: `/api/agro-materials/image/${x.id}/detail2`,
    detail_image_3: `/api/agro-materials/image/${x.id}/detail3`,
    detail_image_4: `/api/agro-materials/image/${x.id}/detail4`,
    description_banner_url: `/api/agro-materials/image/${x.id}/desc`,
  })),
];


export const NUTRIENT_CATEGORIES = [
  {
    code: 'CAT-NUT-PHOTO',
    name: '광합성·냉해/스트레스 회복 영양재',
    desc: '일조량 부족·장마·저온 냉해·고온 위조 등 이상기후 스트레스 발생 시 광합성 효율과 수세를 급속 회복시키는 기능성 영양재',
  },
  {
    code: 'CAT-NUT-CALC',
    name: '칼슘·붕소 결핍예방 영양재',
    desc: '배추 결구기 꿀통배추(내엽갈변·팁번), 무·감자 속빈현상 및 세포벽 약화를 예방하는 고흡수 아미노산 킬레이트 액상칼슘·붕소제',
  },
  {
    code: 'CAT-NUT-ROOT',
    name: '뿌리발근·초기활착 영양재',
    desc: '본밭 정식 직후 새 흰색 잔뿌리(세근) 발근을 촉진하고 정식 몸살·활착 지연을 빠르게 극복시키는 고농도 아미노산 발근제',
  },
  {
    code: 'CAT-NUT-BULK',
    name: '결구·괴경·구비대 촉진 영양재',
    desc: '가을배추 결구 비대기·감자 괴경비대기·마늘 구비대기에 인산·가리·규산을 집중 공급하여 무게감과 저장성을 높이는 비대제',
  },
  {
    code: 'CAT-NUT-MICRO',
    name: '종합미량요소·해조 생리활성 영양재',
    desc: '철·아연·망간·몰리브덴·붕소·고토 등 12종 종합미량요소와 해조추출물을 배합해 엽색·잎두께 및 생리활성을 강화하는 종합영양제',
  },
];

export const PESTICIDE_CATEGORIES = [
  {
    code: 'CAT-PST-HERB',
    name: '제초제 (고랑·헛골 비선택성/토양처리)',
    desc: '작물 이랑 사이 고랑(헛골) 및 논밭 두렁의 일년생·다년생 난방제 잡초를 뿌리까지 빠르게 고사시키는 전문 제초제',
  },
  {
    code: 'CAT-PST-INSC',
    name: '살충제 (진딧물·총채벌레·초기해충)',
    desc: '바이러스 매개충인 진딧물·총채벌레·가루이 및 배추좀나방·감자뿔나방을 침투이행 작용으로 방제하는 전문 살충제',
  },
  {
    code: 'CAT-PST-FUNG',
    name: '살균제 (무름병·노균병·역병·탄저병)',
    desc: '장마·가을 강우 및 다습 환경에서 급증하는 배추 무름병·노균병, 감자 역병, 고추 탄저병을 예방·치료하는 광범위 살균제',
  },
  {
    code: 'CAT-PST-SOIL',
    name: '토양살균·살충제 (뿌리혹병·잘록병)',
    desc: '정식·파종 전후 토양 처리 및 관주 처리로 배추 뿌리혹병(무사마귀병), 입고병(잘록병), 고자리파리 등 토양병해충을 방제하는 약제',
  },
  {
    code: 'CAT-PST-MOTH',
    name: '나방·벼룩잎벌레 종합살충제',
    desc: '생육 초기~결구기에 잎과 생장점을 가해하는 파밤나방·배추좀나방·담배거세미나방·벼룩잎벌레를 동시 방제하는 살충제',
  },
  {
    code: 'CAT-PST-ECO',
    name: '친환경 유기농업자재 (PLS 수확전 방제)',
    desc: '님(Neem)·유칼립투스·계피 등 식물유래 천연추출물 기반으로 수확 임박기 PLS 잔류농약 걱정 없이 사용하는 유기농업자재 공시 제품',
  },
];

export const SEED_CATEGORIES = [
  {
    code: 'CAT-SEED-LEAF',
    name: '엽채류 종자 (배추·상추·시금치·양배추)',
    desc: '가을김장배추·봄배추·청치마/적축면상추·시금치 등 발아율 85% 이상 보증 및 무사마귀병(CR)·노균병 저항성 코팅 종자',
  },
  {
    code: 'CAT-SEED-ROOT',
    name: '근채류 종자 (무·당근·우엉·비트)',
    desc: '가을김장무·총각무·중원당근 등 근비대성·치밀도·내추대성이 우수한 코팅/필름소독 근채류 전문 종자',
  },
  {
    code: 'CAT-SEED-FRUIT',
    name: '과채류 종자 (고추·오이·토마토·호박)',
    desc: '탄저병·칼라병(TSWV)·역병 복합내병계 고추 및 다수확 백다다기오이·방울토마토·애호박 F1 교잡종 종자',
  },
  {
    code: 'CAT-SEED-ALLIUM',
    name: '양념·구근류 종자 (대파·양파·부추)',
    desc: '내서성·내한성이 강하고 연백부 길이와 잎 줄기 탄력이 뛰어난 교배종 대파·중만생종 양파·다수확 부추 종자',
  },
  {
    code: 'CAT-SEED-GRAIN',
    name: '두류·특작 종자 (찰옥수수·콩·참깨·들깨)',
    desc: '당도와 찰기가 뛰어난 대학찰/미백2호 찰옥수수, 대립 서리태/백태 콩, 다수확 참깨·들깨 등 식량·특작 정선 종자',
  },
];

export const SEEDLING_CATEGORIES = [
  {
    code: 'CAT-SDL-LEAF',
    name: '배추·양배추·쌈채류 모종',
    desc: '128구·105구 규격 트레이에서 25~30일간 본엽 4~5매로 튼튼하게 키워 노지 자외선·외기 순화까지 마친 A급 엽채류 프러그 모종',
  },
  {
    code: 'CAT-SDL-FRUIT',
    name: '고추·토마토·가지·오이 과채 모종',
    desc: '50구·72구 포트에서 45~75일간 육묘한 탄저병·칼라병 복합내병성 고추 모종 및 대목 접목 토마토·오이·가지 우량 모종',
  },
  {
    code: 'CAT-SDL-HERB',
    name: '대파·양파·쪽파·부추 양념 모종',
    desc: '200구·288구 트레이 육묘 대파·양파 건묘 및 뿌리 활착력이 뛰어난 삼동파·영양부추·쪽파 종구/포트 모종',
  },
  {
    code: 'CAT-SDL-ROOT',
    name: '고구마순·씨감자·마늘 영양번식 모종',
    desc: '조직배양 무병묘(바이러스 프리)에서 채취한 꿀고구마·밤고구마 우량 조직배양순 및 보증 씨감자·종구',
  },
  {
    code: 'CAT-SDL-SPEC',
    name: '접목묘·특수작물 모종 (딸기·수박·참외)',
    desc: '농촌진흥청 품종보호 등록 설향·사철딸기 포트묘 및 덩굴쪼김병 저항성 대목 접목 수박·참외 전문 육묘장 출하 모종',
  },
];

export const INITIAL_NUTRIENT_PRODUCTS: FertilizerProductRecord[] = [
  {
    material_id: 'MAT-NUTR-01',
    product_code: '30002000001',
    material_category: 'NUTRIENT',
    sub_type: '광합성·냉해/스트레스 회복 영양재',
    category_code: 'CAT-NUT-PHOTO',
    manufacturer: '(주)누보',
    product_name: '엔플러스 썬마스터 (광합성 향상 · 일조부족 · 냉해회복제) 500g',
    formulation_type: '고농축 수용성 액제 (Liquid)',
    is_organic: 0,
    organic_label: '(기능성영양제)',
    weight_spec: '500g',
    volume_spec: '500ml',
    origin_country: '대한민국 (경기 수원)',
    contact_phone: '1600-7268',
    target_nutrient_or_pest: '장마·흐린 날 일조량 부족 해소, 광합성 효율 극대화 및 저온 냉해·고온 스트레스 급속 회복',
    nutrient_ratio_summary: 'N 5% · P₂O₅ 3% · K₂O 6% + 고토(MgO) 3.0% + 붕소(B) 0.2% + 철(Fe)·망간(Mn)·아연(Zn) + 광합성 대사촉진물질',
    n_pct: 5.0,
    p_pct: 3.0,
    k_pct: 6.0,
    ca_pct: 0.0,
    mg_pct: 3.0,
    b_pct: 0.2,
    sio2_pct: 0.0,
    s_pct: 1.5,
    om_pct: 15.0,
    dosage_per_100pyeong: '100평당 100~200ml (물 20L당 20~40ml / 500~1,000배 엽면시비)',
    unit_spec: '500g (500ml) / 병',
    retail_price: 22000,
    unit_price: 18500,
    discount_rate: 15.9,
    reward_points: 370,
    stock_status: '인기품목 · 당일출고',
    usage_stage: '생육 전 기간 (일조 부족기 · 장마 직후 · 냉해/서리 피해 전후 5~7일 간격)',
    weather_trigger: '연속 강우·흐린 날 3일 이상 지속으로 일조량 부족 시 또는 기온 급강하(냉해) 예보 직전·직후',
    thumbnail_url: '/images/fertilizers/MAT-NUTR-01-thumb.png',
    detail_image_1: '/images/fertilizers/MAT-NUTR-01-detail1.png',
    detail_image_2: '/images/fertilizers/MAT-NUTR-01-detail2.png',
    detail_image_3: '/images/fertilizers/MAT-NUTR-01-detail3.jpg',
    detail_image_4: '/images/fertilizers/MAT-NUTR-01-detail4.png',
    description_banner_url: '/images/fertilizers/MAT-NUTR-01-desc.png',
  },
  {
    material_id: 'MAT-NUTR-02',
    product_code: '30002000002',
    material_category: 'NUTRIENT',
    sub_type: '칼슘·붕소 결핍예방 영양재',
    category_code: 'CAT-NUT-CALC',
    manufacturer: '(주)누보',
    product_name: '엔플러스 튼튼칼슘 (효과 빠른 아미노산 킬레이트 액상칼슘·붕소제) 500g',
    formulation_type: '아미노산 킬레이트 액상 (Chelated Liquid)',
    is_organic: 0,
    organic_label: '(칼슘·붕소기능성)',
    weight_spec: '500g',
    volume_spec: '500ml',
    origin_country: '대한민국 (경기 수원)',
    contact_phone: '1600-7268',
    target_nutrient_or_pest: '가을배추 결구기 꿀통배추(내엽갈변·팁번) 예방, 무·감자 공동과 방지, 세포벽 강화 및 저장성 향상',
    nutrient_ratio_summary: '수용성 칼슘(CaO) 17.0% + 고토(MgO) 2.0% + 붕소(B₂O₃) 0.5% + 유리 아미노산 10% (상승 흡수 처방)',
    n_pct: 2.0,
    p_pct: 0.0,
    k_pct: 0.0,
    ca_pct: 17.0,
    mg_pct: 2.0,
    b_pct: 0.5,
    sio2_pct: 0.0,
    s_pct: 0.0,
    om_pct: 10.0,
    dosage_per_100pyeong: '100평당 150~200ml (물 20L당 20~40ml / 500~1,000배 속잎 집중 엽면살포)',
    unit_spec: '500g (500ml) / 병',
    retail_price: 20000,
    unit_price: 16800,
    discount_rate: 16.0,
    reward_points: 336,
    stock_status: '베스트셀러 · 즉시출고',
    usage_stage: '외엽 번무기 ~ 결구 시작기 ~ 결구 중기 (5~7일 간격 2~3회 연속 살포)',
    weather_trigger: '결구 개시기(PGDD 432℃·일) 도달 또는 가을 가뭄·고온 건조로 토양 내 칼슘 이동이 저해될 때',
    thumbnail_url: '/images/fertilizers/MAT-NUTR-02-thumb.png',
    detail_image_1: '/images/fertilizers/MAT-NUTR-02-detail1.png',
    detail_image_2: '/images/fertilizers/MAT-NUTR-02-detail2.jpg',
    detail_image_3: '/images/fertilizers/MAT-NUTR-02-detail3.jpg',
    detail_image_4: '/images/fertilizers/MAT-NUTR-02-detail4.png',
    description_banner_url: '/images/fertilizers/MAT-NUTR-02-desc.png',
  },
  {
    material_id: 'MAT-NUTR-03',
    product_code: '30002000003',
    material_category: 'NUTRIENT',
    sub_type: '뿌리발근·초기활착 영양재',
    category_code: 'CAT-NUT-ROOT',
    manufacturer: '(주)누보',
    product_name: '엔플러스 참편한 아미노 (9-1-2+붕소+철+망간 뿌리발근·초기활착 전문자재) 500ml',
    formulation_type: '동물성·식물성 아미노산 고농축 액제',
    is_organic: 0,
    organic_label: '(고농도아미노산)',
    weight_spec: '600g',
    volume_spec: '500ml',
    origin_country: '대한민국 (경기 수원)',
    contact_phone: '1600-7268',
    target_nutrient_or_pest: '정식 직후 세근(흰색 잔뿌리) 폭발적 발근 유도, 이식 몸살 해소 및 초기 활착 지연·저온 생육부진 회복',
    nutrient_ratio_summary: 'N 9% · P₂O₅ 1% · K₂O 2% + 유리 아미노산 25% + 붕소(B) 0.15% + 철(Fe) 0.1% + 망간(Mn) 0.05%',
    n_pct: 9.0,
    p_pct: 1.0,
    k_pct: 2.0,
    ca_pct: 0.5,
    mg_pct: 0.5,
    b_pct: 0.15,
    sio2_pct: 0.0,
    s_pct: 0.5,
    om_pct: 25.0,
    dosage_per_100pyeong: '100평당 관주 250~500ml / 엽면시비 150ml (500배 희석액 육묘침지·포기관주)',
    unit_spec: '500ml / 병',
    retail_price: 19000,
    unit_price: 15900,
    discount_rate: 16.3,
    reward_points: 318,
    stock_status: '정상판매 · 즉시출고',
    usage_stage: '본밭 정식 직전(육묘판 침지) · 정식 직후 ~ 활착기 (PRC-08 ~ PRC-10)',
    weather_trigger: '정식기 고온 건조·과습 또는 저온으로 새 뿌리 내림(활착)이 지연될 때 즉시 처방',
    thumbnail_url: '/images/fertilizers/MAT-NUTR-03-thumb.png',
    detail_image_1: '/images/fertilizers/MAT-NUTR-03-detail1.png',
    detail_image_2: '/images/fertilizers/MAT-NUTR-03-detail2.png',
    detail_image_3: '/images/fertilizers/MAT-NUTR-03-detail3.png',
    detail_image_4: '/images/fertilizers/MAT-NUTR-03-detail4.png',
    description_banner_url: '/images/fertilizers/MAT-NUTR-03-desc.png',
  },
  {
    material_id: 'MAT-NUTR-04',
    product_code: '30002000004',
    material_category: 'NUTRIENT',
    sub_type: '결구·괴경·구비대 촉진 영양재',
    category_code: 'CAT-NUT-BULK',
    manufacturer: '(주)누보',
    product_name: '엔플러스 커진다 (결구·구비대·괴경 발육 향상 및 인산가리 비대 전문자재) 500g',
    formulation_type: '고농도 인산·가리·규산 액상 (Liquid)',
    is_organic: 0,
    organic_label: '(비대·숙기촉진)',
    weight_spec: '500g',
    volume_spec: '500ml',
    origin_country: '대한민국 (경기 수원)',
    contact_phone: '1600-7268',
    target_nutrient_or_pest: '가을배추 결구 충실도(구중)·단단함 향상, 감자 괴경비대·전분축적 및 마늘·양파 구비대 촉진',
    nutrient_ratio_summary: 'N 3% · P₂O₅ 18% · K₂O 22% + 가용성 규산(SiO₂) 4.0% + 붕소(B) 0.2% + 비대활성 아미노산',
    n_pct: 3.0,
    p_pct: 18.0,
    k_pct: 22.0,
    ca_pct: 0.0,
    mg_pct: 1.0,
    b_pct: 0.2,
    sio2_pct: 4.0,
    s_pct: 1.0,
    om_pct: 8.0,
    dosage_per_100pyeong: '100평당 150~200ml (물 20L당 25~40ml / 500~800배액 엽면시비 또는 관주)',
    unit_spec: '500g (500ml) / 병',
    retail_price: 23000,
    unit_price: 19500,
    discount_rate: 15.2,
    reward_points: 390,
    stock_status: '인기품목 · 즉시출고',
    usage_stage: '결구·괴경비대 중기 ~ 성숙 후기 (PRC-19 ~ PRC-26, 7~10일 간격 2회)',
    weather_trigger: '질소 과다로 외엽만 웃자랄(도장) 때 양분을 속잎(결구)·지하부(괴경)로 강제 전류시킬 시',
    thumbnail_url: '/images/fertilizers/MAT-NUTR-04-thumb.png',
    detail_image_1: '/images/fertilizers/MAT-NUTR-04-detail1.png',
    detail_image_2: '/images/fertilizers/MAT-NUTR-04-detail2.jpg',
    detail_image_3: '/images/fertilizers/MAT-NUTR-04-detail3.jpg',
    detail_image_4: '/images/fertilizers/MAT-NUTR-04-detail4.png',
    description_banner_url: '/images/fertilizers/MAT-NUTR-04-desc.png',
  },
  {
    material_id: 'MAT-NUTR-05',
    product_code: '30002000005',
    material_category: 'NUTRIENT',
    sub_type: '종합미량요소·해조 생리활성 영양재',
    category_code: 'CAT-NUT-MICRO',
    manufacturer: '(주)누보',
    product_name: '엔플러스 만능이 (12종 영양성분 & 전작물용 해조·종합미량요소 영양제) 500g',
    formulation_type: '킬레이트 종합미량요소 수용성 액제',
    is_organic: 0,
    organic_label: '(12종종합영양)',
    weight_spec: '500g',
    volume_spec: '500ml',
    origin_country: '대한민국 (경기 수원)',
    contact_phone: '1600-7268',
    target_nutrient_or_pest: '배추·상추·시금치 엽색(엽록소)·잎두께 향상, 미량요소 결핍에 의한 황화현상·생리장해 종합 예방',
    nutrient_ratio_summary: 'N 6% · P₂O₅ 4% · K₂O 6% + 고토(MgO) 2% + 붕소(B) 0.3% + 철·망간·아연·구리·몰리브덴 등 12종 영양성분',
    n_pct: 6.0,
    p_pct: 4.0,
    k_pct: 6.0,
    ca_pct: 1.5,
    mg_pct: 2.0,
    b_pct: 0.3,
    sio2_pct: 0.0,
    s_pct: 1.2,
    om_pct: 15.0,
    dosage_per_100pyeong: '100평당 100~150ml (물 20L당 20ml / 1,000배액 엽면시비)',
    unit_spec: '500g (500ml) / 병',
    retail_price: 18500,
    unit_price: 15500,
    discount_rate: 16.2,
    reward_points: 310,
    stock_status: '정상판매 · 즉시출고',
    usage_stage: '초기 활착 이후 ~ 중기 왕성 생장기 (PRC-10 ~ PRC-17 상시 관리)',
    weather_trigger: '영양생장기 엽색 황화 징후 발생 시 또는 일교차·고온기 미량요소 흡수 불균형 예방 시',
    thumbnail_url: '/images/fertilizers/MAT-NUTR-05-thumb.jpg',
    detail_image_1: '/images/fertilizers/MAT-NUTR-05-detail1.png',
    detail_image_2: '/images/fertilizers/MAT-NUTR-05-detail2.png',
    detail_image_3: '/images/fertilizers/MAT-NUTR-05-detail3.jpg',
    detail_image_4: '/images/fertilizers/MAT-NUTR-05-detail4.png',
    description_banner_url: '/images/fertilizers/MAT-NUTR-05-desc.png',
  },
  ...[
    {
      id: 'MAT-NUTR-06', code: '30002000006', sub: '광합성·냉해/스트레스 회복 영양재', catCode: 'CAT-NUT-PHOTO',
      brand: '대유', name: '대유 부리오일드 (일조부족·광합성 촉진 및 냉해·서리 스트레스 회복제) 500ml',
      form: '수용성 고농축 액제', org: 0, orgLbl: '(광합성기능성)', w: '550g', vol: '500ml', origin: '대한민국 (충북 괴산)', phone: '1588-4710',
      target: '가을장마·안개·흐린 날 광합성 효율 증진 및 초가을·초겨울 급격한 저온 냉해 회복',
      ratio: 'N 6% · P₂O₅ 4% · K₂O 5% + 고토(MgO) 3.5% + 철(Fe) 0.2% + 해조추출물·베타인 18%',
      n: 6, p: 4, k: 5, ca: 0, mg: 3.5, b: 0.2, sio2: 0, s: 1.5, om: 18,
      dosage: '100평당 150ml (물 20L당 20~30ml / 700~1,000배 엽면살포)', spec: '500ml / 병',
      retail: 21000, unit: 17500, stage: '생육 중기~결구기 일조 부족 및 저온 예보 전후', trigger: '연속 강우·흐린 날 또는 기온 10℃ 이하 저온 예보 시'
    },
    {
      id: 'MAT-NUTR-07', code: '30002000007', sub: '칼슘·붕소 결핍예방 영양재', catCode: 'CAT-NUT-CALC',
      brand: '대유', name: '대유 속찬칼슘붕소 (배추 꿀통·팁번 예방 고흡수 킬레이트 칼슘제) 500ml',
      form: '유기산 킬레이트 액상', org: 0, orgLbl: '(칼슘·붕소기능성)', w: '600g', vol: '500ml', origin: '대한민국 (충북 괴산)', phone: '1588-4710',
      target: '배추 내엽갈변(꿀통배추)·무 속빈현상·상추 팁번(잎끝마름) 예방 및 결구 단단함 향상',
      ratio: '수용성 칼슘(CaO) 18.0% + 수용성 붕소(B) 0.6% + 고토(MgO) 2.0% + 글루콘산 킬레이트',
      n: 2, p: 0, k: 0, ca: 18.0, mg: 2.0, b: 0.6, sio2: 0, s: 0, om: 8,
      dosage: '100평당 150~200ml (물 20L당 25ml / 800배 속잎 엽면시비)', spec: '500ml / 병',
      retail: 21500, unit: 18000, stage: '외엽 번무기 ~ 결구 초기·중기 (5~7일 간격 3회)', trigger: '결구 개시기(PGDD 432℃·일) 도달 및 건조·고온기 칼슘 흡수 저해 시'
    },
    {
      id: 'MAT-NUTR-08', code: '30002000008', sub: '뿌리발근·초기활착 영양재', catCode: 'CAT-NUT-ROOT',
      brand: '대유', name: '대유 루트파워 골드 (정식 직후 세근 발근·활착 몸살 극복 전문제) 500ml',
      form: '발근성 아미노산·풀빅산 액제', org: 1, orgLbl: '(유기농)', w: '580g', vol: '500ml', origin: '대한민국 (충북 괴산)', phone: '1588-4710',
      target: '배추·상추·고추 본밭 정식 직후 새 흰 뿌리(세근) 유도 및 고온·과습 활착 몸살 조기 극복',
      ratio: '유리 아미노산 22% + 풀빅산(Fulvic Acid) 12% + P₂O₅ 3% + K₂O 3% + 아연(Zn) 0.1%',
      n: 5, p: 3, k: 3, ca: 0.5, mg: 0.5, b: 0.1, sio2: 0, s: 0.5, om: 34,
      dosage: '100평당 관주 300ml / 엽면 150ml (500배 희석 육묘판 침지·관주)', spec: '500ml / 병',
      retail: 22000, unit: 18500, stage: '정식 직전 트레이 침지 및 정식 후 7일 이내 관주', trigger: '정식기 고온·건조 또는 과습으로 뿌리 활착 지연 우려 시'
    },
    {
      id: 'MAT-NUTR-09', code: '30002000009', sub: '결구·괴경·구비대 촉진 영양재', catCode: 'CAT-NUT-BULK',
      brand: '대유', name: '대유 결구왕·비대왕 (고농도 인산가리 0-28-32 + 가용성규산) 500ml',
      form: '고농축 이온화 액제', org: 0, orgLbl: '(결구·비대촉진)', w: '650g', vol: '500ml', origin: '대한민국 (충북 괴산)', phone: '1588-4710',
      target: '배추 속잎 결구 충실도 극대화, 감자·무·마늘 지하부 구비대 및 전분·당도 향상',
      ratio: 'P₂O₅ 28% · K₂O 32% + 가용성 규산(SiO₂) 3.5% + 붕소(B) 0.3% + 몰리브덴(Mo) 0.02%',
      n: 0, p: 28.0, k: 32.0, ca: 0, mg: 1.0, b: 0.3, sio2: 3.5, s: 1.0, om: 5,
      dosage: '100평당 150ml (물 20L당 20~30ml / 800~1,000배 엽면시비)', spec: '500ml / 병',
      retail: 24000, unit: 20200, stage: '결구 중기 ~ 수확 10일 전 / 감자 개화기 이후 괴경비대기', trigger: '외엽 도장(웃자람) 억제 및 결구·구비대 양분 전류 필요 시'
    },
    {
      id: 'MAT-NUTR-10', code: '30002000010', sub: '종합미량요소·해조 생리활성 영양재', catCode: 'CAT-NUT-MICRO',
      brand: '(주)팜한농', name: '프로파머 해조·아미노 종합미량요소 액비 (아스코필룸 노도섬 25%) 1L',
      form: '북대서양 해조추출 고농축 액제', org: 1, orgLbl: '(유기농)', w: '1.15Kg', vol: '1,000ml', origin: '대한민국 (전북 익산)', phone: '1644-0901',
      target: '엽채류·구근류 생리활성 촉진, 미량요소 결핍 황화현상 예방 및 내한성·내건성 강화',
      ratio: '해조추출물(Ascophyllum) 25% + N 4% · P 2% · K 5% + MgO 2% + Fe·Mn·Zn·B·Cu·Mo',
      n: 4, p: 2, k: 5, ca: 1.0, mg: 2.0, b: 0.25, sio2: 0, s: 1.0, om: 25,
      dosage: '100평당 200ml (물 20L당 20ml / 1,000배 희석 엽면살포)', spec: '1L (1,000ml) / 병',
      retail: 26000, unit: 21800, stage: '전 생육기 10~14일 간격 상시 영양관리', trigger: '친환경 유기농 재배지 및 생육 중기 엽색·잎두께 강화 시'
    },
    {
      id: 'MAT-NUTR-11', code: '30002000011', sub: '광합성·냉해/스트레스 회복 영양재', catCode: 'CAT-NUT-PHOTO',
      brand: '(주)조비', name: '그린라이트 클로로필 (마그네슘·철 엽록소 광합성 부스터) 500ml',
      form: '킬레이트 수용성 액제', org: 0, orgLbl: '(광합성기능성)', w: '560g', vol: '500ml', origin: '대한민국 (울산 남구)', phone: '1588-4719',
      target: '마그네슘·철분 급속 공급을 통한 엽록소 합성 촉진, 하위엽 황화 방지 및 일조 부족 극복',
      ratio: '수용성 고토(MgO) 8.0% + 킬레이트 철(Fe-EDTA) 1.5% + N 5% + 망간(Mn) 0.5% + 아연(Zn) 0.3%',
      n: 5, p: 0, k: 3, ca: 0, mg: 8.0, b: 0.2, sio2: 0, s: 3.0, om: 10,
      dosage: '100평당 150ml (물 20L당 20ml / 1,000배 엽면시비)', spec: '500ml / 병',
      retail: 19500, unit: 16500, stage: '초기~중기 외엽 번무기 및 장마 후 엽색 저하 시', trigger: '토양 치환성 마그네슘 부족 또는 연속 강우 후 잎 황화 발생 시'
    },
    {
      id: 'MAT-NUTR-12', code: '30002000012', sub: '칼슘·붕소 결핍예방 영양재', catCode: 'CAT-NUT-CALC',
      brand: '(주)한국삼공', name: '삼공 슈퍼칼보론 (수용성 칼슘 20% + 붕소 1.0% + 아미노산) 500ml',
      form: '고농도 수용성 액상', org: 0, orgLbl: '(칼슘·붕소기능성)', w: '620g', vol: '500ml', origin: '대한민국 (충남 아산)', phone: '080-024-3030',
      target: '세포벽 페크틴 결합 강화로 배추 무름병 저항성 증대, 꿀통배추·감자 중심공동 현상 예방',
      ratio: '칼슘(CaO) 20.0% + 붕소(B₂O₃) 1.0% + 고토(MgO) 1.5% + L-아미노산 8%',
      n: 3, p: 0, k: 0, ca: 20.0, mg: 1.5, b: 1.0, sio2: 0, s: 0, om: 8,
      dosage: '100평당 150ml (물 20L당 20ml / 1,000배 엽면살포)', spec: '500ml / 병',
      retail: 21000, unit: 17800, stage: '결구 개시기 ~ 결구 중기 (7일 간격 2~3회)', trigger: '고온 건조 및 질소 과다 시비로 칼슘 흡수 길항작용 발생 시'
    },
    {
      id: 'MAT-NUTR-13', code: '30002000013', sub: '뿌리발근·초기활착 영양재', catCode: 'CAT-NUT-ROOT',
      brand: '(주)경농', name: '뿌리왕 하이루트 (휴믹산·해조류·인산 기반 세근발달 촉진제) 1L',
      form: '관주·엽면 겸용 액상', org: 0, orgLbl: '(발근·활착전용)', w: '1.1Kg', vol: '1,000ml', origin: '대한민국 (대구 달성)', phone: '1899-0584',
      target: '배추·감자·마늘 초기 뿌리털 발달 촉진, 냉습해 뿌리 손상 복구 및 양분 흡수력 강화',
      ratio: 'N 6% · P₂O₅ 10% · K₂O 4% + 휴믹산 10% + 해조류추출물 8% + 비타민B1',
      n: 6, p: 10, k: 4, ca: 0, mg: 1.0, b: 0.15, sio2: 0, s: 0.5, om: 18,
      dosage: '100평당 관주 400ml / 엽면 150ml (500~800배 희석)', spec: '1L (1,000ml) / 병',
      retail: 23500, unit: 19900, stage: '정식 직후 활착기 및 폭우 후 뿌리 세력 회복기', trigger: '집중호우·과습으로 뿌리 호흡 저하 및 지상부 시듦(위조) 발생 시'
    },
    {
      id: 'MAT-NUTR-14', code: '30002000014', sub: '결구·괴경·구비대 촉진 영양재', catCode: 'CAT-NUT-BULK',
      brand: '남해화학(주)', name: '하이포타시움 K35 (고농도 칼륨·규산 결구·괴경 비대제) 500ml',
      form: '중성 액상 칼륨제', org: 0, orgLbl: '(비대·품질향상)', w: '640g', vol: '500ml', origin: '대한민국 (전남 여수)', phone: '061-688-5500',
      target: '결구 후기 배추 구중(무게) 증대, 감자 전분 축적, 시금치·마늘 겨울철 동해 예방 및 당도 상승',
      ratio: '수용성 칼륨(K₂O) 35.0% + 가용성 규산(SiO₂) 6.0% + 고토(MgO) 1.5% + 붕소(B) 0.2%',
      n: 0, p: 5, k: 35.0, ca: 0, mg: 1.5, b: 0.2, sio2: 6.0, s: 2.0, om: 0,
      dosage: '100평당 150ml (물 20L당 20ml / 1,000배 엽면살포)', spec: '500ml / 병',
      retail: 22000, unit: 18600, stage: '결구 중후기 ~ 수확 14일 전 (7일 간격 2회)', trigger: '수확 전 구중 확보 및 초겨울 한파 대비 세포액 농도(내한성) 강화 시'
    },
    {
      id: 'MAT-NUTR-15', code: '30002000015', sub: '종합미량요소·해조 생리활성 영양재', catCode: 'CAT-NUT-MICRO',
      brand: '(주)누보', name: '엔플러스 유기농 아미노골드 (유기농공시 천연 아미노산·미량요소) 1L',
      form: '천연 효소가수분해 액제', org: 1, orgLbl: '(유기농)', w: '1.12Kg', vol: '1,000ml', origin: '대한민국 (경기 수원)', phone: '1600-7268',
      target: '친환경·무농약 농작물 생육 촉진, 잎 윤기·두께 개선 및 이상기후 생리장해 예방',
      ratio: '천연 유리아미노산 20% + 유기물(OM) 30% + 붕소(B) 0.2% + 철·아연·망간·몰리브덴',
      n: 4.5, p: 1.5, k: 2.5, ca: 1.0, mg: 1.5, b: 0.2, sio2: 0, s: 0.8, om: 30,
      dosage: '100평당 200ml (물 20L당 25ml / 800배 엽면시비 또는 관주)', spec: '1L (1,000ml) / 병',
      retail: 24500, unit: 20800, stage: '활착기 ~ 생육 중기 ~ 결구기 전 기간', trigger: '유기농 인증 재배지 추비 대체 및 생리활성 강화 시'
    },
    {
      id: 'MAT-NUTR-16', code: '30002000016', sub: '광합성·냉해/스트레스 회복 영양재', catCode: 'CAT-NUT-PHOTO',
      brand: '(주)동방아그로', name: '스트레스제로 프로 (고온 위조·냉해·약해 회복 글리신베타인 액제) 500ml',
      form: '삼투압 조절 기능성 액제', org: 0, orgLbl: '(스트레스회복)', w: '550g', vol: '500ml', origin: '대한민국 (충남 부여)', phone: '02-580-3600',
      target: '폭염기 잎 시듦(위조), 가을 저온·서리 피해 및 농약 혼용 약해 발생 시 세포 삼투압 복원',
      ratio: '글리신베타인 15% + 프롤린(Proline) 8% + K₂O 6% + MgO 2.5% + 비타민C·E',
      n: 3, p: 2, k: 6, ca: 0, mg: 2.5, b: 0.15, sio2: 0, s: 1.0, om: 23,
      dosage: '100평당 150ml (물 20L당 20~30ml / 700~1,000배 엽면시비)', spec: '500ml / 병',
      retail: 23000, unit: 19400, stage: '폭염·한파 예보 2일 전 또는 기상 재해 직후 즉시 살포', trigger: '일최고기온 28℃ 이상 고온 또는 일최저기온 5℃ 이하 저온 예보 시'
    },
    {
      id: 'MAT-NUTR-17', code: '30002000017', sub: '칼슘·붕소 결핍예방 영양재', catCode: 'CAT-NUT-CALC',
      brand: '(주)효성오앤비', name: '유기농 액상 패화석 칼슘·붕소 (공시-2-3-108 · 친환경 칼슘제) 1L',
      form: '천연 유기산 킬레이트 액상', org: 1, orgLbl: '(유기농)', w: '1.18Kg', vol: '1,000ml', origin: '대한민국 (충남 아산)', phone: '041-544-8114',
      target: '친환경 배추·상추·시금치 칼슘 결핍 예방, 잎 조직 치밀화 및 저장 유통기간 연장',
      ratio: '수용성 칼슘(CaO) 14.0% + 수용성 붕소(B) 0.3% + 천연 초산·구연산 킬레이트',
      n: 0, p: 0, k: 1.0, ca: 14.0, mg: 2.0, b: 0.3, sio2: 0, s: 0, om: 12,
      dosage: '100평당 200ml (물 20L당 25~40ml / 500~800배 엽면살포)', spec: '1L (1,000ml) / 병',
      retail: 22500, unit: 18900, stage: '외엽 신장기 ~ 결구 완료 전 (7일 간격 3회)', trigger: '친환경·유기농 포전 결구기 칼슘·붕소 보충 처방'
    },
    {
      id: 'MAT-NUTR-18', code: '30002000018', sub: '뿌리발근·초기활착 영양재', catCode: 'CAT-NUT-ROOT',
      brand: '(주)팜한농', name: '트레이침지·활착전용 루트스타터 (인산·아미노산·해조 발근제) 500ml',
      form: '육묘침지·관주 특화 액제', org: 0, orgLbl: '(육묘·활착전용)', w: '570g', vol: '500ml', origin: '대한민국 (전북 익산)', phone: '1644-0901',
      target: '육묘 후기 뿌리 돌림 완성 및 본밭 정식 후 3일 이내 백색 신근(새뿌리) 활착 유도',
      ratio: 'N 7% · P₂O₅ 12% · K₂O 3% + 발근 아미노산 15% + 아연(Zn) 0.2% + 붕소(B) 0.1%',
      n: 7, p: 12, k: 3, ca: 0, mg: 1.0, b: 0.1, sio2: 0, s: 0.5, om: 15,
      dosage: '100평당 200ml (정식 전 육묘판 500배액 침지 또는 정식 직후 관주)', spec: '500ml / 병',
      retail: 20500, unit: 17200, stage: '육묘 출하 3일 전 및 본밭 정식 당일', trigger: '본밭 정식(PRC-08) 및 활착기(PRC-10) 도달 시'
    },
    {
      id: 'MAT-NUTR-19', code: '30002000019', sub: '결구·괴경·구비대 촉진 영양재', catCode: 'CAT-NUT-BULK',
      brand: '(주)경농', name: '알찬비대 골드 (제1인산칼륨 MKP 액상화 + 몰리브덴·규산) 500ml',
      form: '고순도 액상 인산가리제', org: 0, orgLbl: '(결구·비대촉진)', w: '630g', vol: '500ml', origin: '대한민국 (대구 달성)', phone: '1899-0584',
      target: '질소 과잉 흡수 억제, 배추 결구 속도 단축 및 감자·마늘·양파 구비대·저장성 향상',
      ratio: 'P₂O₅ 24% · K₂O 28% + 규산(SiO₂) 3.0% + 고토(MgO) 1.5% + 몰리브덴(Mo) 0.03%',
      n: 0, p: 24.0, k: 28.0, ca: 0, mg: 1.5, b: 0.2, sio2: 3.0, s: 1.0, om: 0,
      dosage: '100평당 150ml (물 20L당 20ml / 1,000배 엽면살포)', spec: '500ml / 병',
      retail: 22500, unit: 19000, stage: '결구 중기·괴경비대기 ~ 수확 10일 전', trigger: '가을배추 결구율 60% 이상 진행 시 구중 완성 처방'
    },
    {
      id: 'MAT-NUTR-20', code: '30002000020', sub: '종합미량요소·해조 생리활성 영양재', catCode: 'CAT-NUT-MICRO',
      brand: '대유', name: '대유 미리근 골드 (EDTA 킬레이트 10종 미량요소 종합영양제) 500g',
      form: '100% 수용성 미세입상/액상 겸용', org: 0, orgLbl: '(킬레이트미량요소)', w: '500g', vol: '500ml', origin: '대한민국 (충북 괴산)', phone: '1588-4710',
      target: '토양 pH 불균형으로 흡수가 막힌 철·망간·아연·붕소·구리·몰리브덴을 엽면으로 즉시 공급',
      ratio: 'MgO 5.0% + Fe 2.0% + Mn 1.0% + Zn 0.8% + B 1.2% + Cu 0.3% + Mo 0.1% (EDTA 킬레이트)',
      n: 5, p: 3, k: 5, ca: 1.0, mg: 5.0, b: 1.2, sio2: 0, s: 3.0, om: 10,
      dosage: '100평당 100g (물 20L당 20g / 1,000배 희석 엽면시비)', spec: '500g / 병',
      retail: 21000, unit: 17900, stage: '본엽 전개기 ~ 중기 왕성 생장기 ~ 결구 초기', trigger: '신초 황화·잎맥 간 황백화 등 미량요소 결핍 증상 예찰 시'
    },
    {
      id: 'MAT-NUTR-21', code: '30002000021', sub: '광합성·냉해/스트레스 회복 영양재', catCode: 'CAT-NUT-PHOTO',
      brand: '(주)누보', name: '엔플러스 프로아미노 K (초겨울 한파·동해 예방 및 초세유지제) 500ml',
      form: '고농도 아미노산·칼륨 액제', org: 0, orgLbl: '(내한성·초세유지)', w: '590g', vol: '500ml', origin: '대한민국 (경기 수원)', phone: '1600-7268',
      target: '10월 하순~11월 초순 가을배추·월동시금치·마늘의 세포 내 당류 축적 및 동해(서리 피해) 예방',
      ratio: 'N 4% · P₂O₅ 4% · K₂O 14% + 유리아미노산 18% + 고토(MgO) 2.0% + 규산(SiO₂) 2.5%',
      n: 4, p: 4, k: 14, ca: 0, mg: 2.0, b: 0.2, sio2: 2.5, s: 1.0, om: 18,
      dosage: '100평당 150ml (물 20L당 25ml / 800배 엽면살포)', spec: '500ml / 병',
      retail: 22000, unit: 18500, stage: '결구 후기 및 월동 진입 전 (서리 예보 3~5일 전)', trigger: '기상청 첫서리·한파 주의보 예보 시 선제 살포'
    },
    {
      id: 'MAT-NUTR-22', code: '30002000022', sub: '칼슘·붕소 결핍예방 영양재', catCode: 'CAT-NUT-CALC',
      brand: '(주)조비', name: '칼슘파워 액상 (질산칼슘·붕소·마그네슘 고투과성 속잎 전달제) 1L',
      form: '침투성 액상 칼슘제', org: 0, orgLbl: '(속잎전달칼슘)', w: '1.25Kg', vol: '1,000ml', origin: '대한민국 (울산 남구)', phone: '1588-4719',
      target: '증산작용이 약한 배추 결구 내부 속잎까지 칼슘과 붕소를 빠르게 침투시켜 무름·갈변 방지',
      ratio: '수용성 칼슘(CaO) 16.5% + 고토(MgO) 2.5% + 붕소(B) 0.4% + 침투전착 보조제',
      n: 6, p: 0, k: 0, ca: 16.5, mg: 2.5, b: 0.4, sio2: 0, s: 0, om: 5,
      dosage: '100평당 200ml (물 20L당 25ml / 800배 엽면살포)', spec: '1L (1,000ml) / 병',
      retail: 23000, unit: 19500, stage: '결구 개시기 ~ 결구 중후기 상시 관리', trigger: '가을장마 다습기로 증산작용이 저하되어 칼슘 결핍 우려 시'
    },
    {
      id: 'MAT-NUTR-23', code: '30002000023', sub: '뿌리발근·초기활착 영양재', catCode: 'CAT-NUT-ROOT',
      brand: '상록유기농산', name: '바이오루트 휴믹·풀빅 발근제 (연작지 염류해소 및 뿌리활착) 1L',
      form: '천연 부식산 농축 액제', org: 1, orgLbl: '(유기농)', w: '1.1Kg', vol: '1,000ml', origin: '대한민국 (전북 김제)', phone: '063-545-8200',
      target: '시설하우스 상추·시금치 및 노지 연작지의 염류집적(EC) 완화와 잔뿌리 재생 촉진',
      ratio: '휴믹산(Humic) 15% + 풀빅산(Fulvic) 10% + 유기물(OM) 35% + K₂O 3.0%',
      n: 2, p: 1, k: 3, ca: 1.0, mg: 0.8, b: 0.1, sio2: 0, s: 0.5, om: 35,
      dosage: '100평당 관주 500ml (점적관수 또는 물조리개 관주 처리)', spec: '1L (1,000ml) / 병',
      retail: 19500, unit: 16500, stage: '정식 직후 및 생육 중기 뿌리 활력 저하 시 관주', trigger: '토양 EC 2.0 dS/m 이상 염류집적 포전 또는 뿌리 발육 부진 시'
    },
    {
      id: 'MAT-NUTR-24', code: '30002000024', sub: '결구·괴경·구비대 촉진 영양재', catCode: 'CAT-NUT-BULK',
      brand: '(주)누보', name: '엔플러스 규산칼륨 파워 (가용성규산 18% + K₂O 15% 도복·비대제) 500ml',
      form: '알칼리성 수용성 규산액제', org: 1, orgLbl: '(유기농)', w: '610g', vol: '500ml', origin: '대한민국 (경기 수원)', phone: '1600-7268',
      target: '잎 표피 규질화로 나방·노균병 침입 물리적 억제, 배추 결구 치밀도 및 감자 표피 강화',
      ratio: '가용성 규산(SiO₂) 18.0% + 수용성 칼륨(K₂O) 15.0% + 붕소(B) 0.2%',
      n: 0, p: 0, k: 15.0, ca: 0, mg: 0.5, b: 0.2, sio2: 18.0, s: 0, om: 0,
      dosage: '100평당 100~150ml (물 20L당 20ml / 1,000배 단독 엽면살포)', spec: '500ml / 병',
      retail: 21500, unit: 18200, stage: '외엽 번무기 ~ 결구 중기 / 감자 괴경비대기', trigger: '질소 과다로 잎 조직이 연약할 때 또는 비대 후기 저장성 강화 시'
    },
    {
      id: 'MAT-NUTR-25', code: '30002000025', sub: '종합미량요소·해조 생리활성 영양재', catCode: 'CAT-NUT-MICRO',
      brand: '(주)한국삼공', name: '삼공 아미노플렉스 올인원 (14종 종합영양 + 해조 + 비타민) 500ml',
      form: '고농축 복합 수용성 액제', org: 0, orgLbl: '(14종종합영양)', w: '580g', vol: '500ml', origin: '대한민국 (충남 아산)', phone: '080-024-3030',
      target: '배추·감자·상추·시금치 전 생육기 양분 균형 유지, 엽색 개선 및 수확량 증대',
      ratio: 'N 7% · P₂O₅ 5% · K₂O 7% + MgO 2% + B 0.3% + Fe·Mn·Zn·Cu·Mo + 아미노산 12%',
      n: 7, p: 5, k: 7, ca: 1.0, mg: 2.0, b: 0.3, sio2: 0, s: 1.5, om: 12,
      dosage: '100평당 150ml (물 20L당 20ml / 1,000배 엽면시비)', spec: '500ml / 병',
      retail: 20000, unit: 16900, stage: '활착 이후 수확 2주 전까지 10일 간격 살포', trigger: '일반 노지·시설 작물 표준 종합 영양 관리 처방'
    },
  ].map((x) => ({
    material_id: x.id,
    product_code: x.code,
    material_category: 'NUTRIENT',
    sub_type: x.sub,
    category_code: x.catCode,
    manufacturer: x.brand,
    product_name: x.name,
    formulation_type: x.form,
    is_organic: x.org,
    organic_label: x.orgLbl,
    weight_spec: x.w,
    volume_spec: x.vol,
    origin_country: x.origin,
    contact_phone: x.phone,
    target_nutrient_or_pest: x.target,
    nutrient_ratio_summary: x.ratio,
    n_pct: x.n,
    p_pct: x.p,
    k_pct: x.k,
    ca_pct: x.ca,
    mg_pct: x.mg,
    b_pct: x.b,
    sio2_pct: x.sio2,
    s_pct: x.s,
    om_pct: x.om,
    dosage_per_100pyeong: x.dosage,
    unit_spec: x.spec,
    retail_price: x.retail,
    unit_price: x.unit,
    discount_rate: Number((((x.retail - x.unit) / x.retail) * 100).toFixed(1)),
    reward_points: Math.round(x.unit * 0.02),
    stock_status: x.org ? '유기농공시 · 즉시출고' : '인기품목 · 당일출고',
    usage_stage: x.stage,
    weather_trigger: x.trigger,
    thumbnail_url: `/api/agro-materials/image/${x.id}/thumb`,
    detail_image_1: `/api/agro-materials/image/${x.id}/detail1`,
    detail_image_2: `/api/agro-materials/image/${x.id}/detail2`,
    detail_image_3: `/api/agro-materials/image/${x.id}/detail3`,
    detail_image_4: `/api/agro-materials/image/${x.id}/detail4`,
    description_banner_url: `/api/agro-materials/image/${x.id}/desc`,
  })),
];


export const INITIAL_PESTICIDE_PRODUCTS: FertilizerProductRecord[] = [
  {
    material_id: 'MAT-PEST-01',
    product_code: '30003000001',
    material_category: 'PESTICIDE',
    sub_type: '제초제 (고랑·헛골 비선택성/토양처리)',
    category_code: 'CAT-PST-HERB',
    manufacturer: '(주)누보',
    product_name: '엑스온 액상수화제 (글루포시네이트암모늄·인다지플람 고랑·헛골 잡초 전문 제초제) 500ml',
    formulation_type: '액상수화제 (SC · 비선택성+발아억제)',
    is_organic: 0,
    organic_label: '(작물보호제·제초제)',
    weight_spec: '550g',
    volume_spec: '500ml',
    origin_country: '대한민국 (등록번호: 37-제조-26)',
    contact_phone: '1544-3098',
    target_nutrient_or_pest: '밭 고랑(헛골)·논두렁 일년생 및 다년생 잡초(바랭이·쇠비름·명아주·깨풀) 경엽 고사 및 토양 발아 동시 억제',
    nutrient_ratio_summary: '글루포시네이트암모늄 18% + 인다지플람 0.45% (작용기작 H10+H29 · 보통독성 · 약효지속 60일)',
    n_pct: 0,
    p_pct: 0,
    k_pct: 0,
    ca_pct: 0,
    mg_pct: 0,
    b_pct: 0,
    sio2_pct: 0,
    s_pct: 0,
    om_pct: 0,
    dosage_per_100pyeong: '100평(고랑 면적 기준)당 100~120ml (물 20L당 60~80ml 비산방지 노즐 살포)',
    unit_spec: '500ml / 병',
    retail_price: 19500,
    unit_price: 16500,
    discount_rate: 15.4,
    reward_points: 330,
    stock_status: '정상판매 · 즉시출고',
    usage_stage: '정식 전 예정지 정리 및 생육 중기 고랑(헛골) 제초 관리 (PRC-05, PRC-14)',
    weather_trigger: '봄·가을 기온 상승 및 강우 후 고랑 잡초가 초장 10~15cm 내외로 자랐을 때 맑은 날 살포',
    thumbnail_url: '/images/fertilizers/MAT-PEST-01-thumb.jpg',
    detail_image_1: '/images/fertilizers/MAT-PEST-01-detail1.jpg',
    detail_image_2: '/images/fertilizers/MAT-PEST-01-detail2.jpg',
    detail_image_3: '/images/fertilizers/MAT-PEST-01-detail3.jpg',
    detail_image_4: '/images/fertilizers/MAT-PEST-01-detail4.jpg',
    description_banner_url: '/images/fertilizers/MAT-PEST-01-desc.jpg',
  },
  {
    material_id: 'MAT-PEST-02',
    product_code: '30003000002',
    material_category: 'PESTICIDE',
    sub_type: '살충제 (진딧물·총채벌레·초기해충)',
    category_code: 'CAT-PST-INSC',
    manufacturer: '바이엘크롭사이언스 / (주)누보',
    product_name: '바이고® 액상수화제 (테트라닐리프롤 · 배추좀나방·파밤나방·뿔나방·총채벌레 전문 살충제) 250ml',
    formulation_type: '액상수화제 (SC · 침투이행성)',
    is_organic: 0,
    organic_label: '(작물보호제·살충제28)',
    weight_spec: '280g',
    volume_spec: '250ml',
    origin_country: '대한민국 (등록번호: 4-살충-379)',
    contact_phone: '1544-3098',
    target_nutrient_or_pest: '배추·감자·고추·파의 배추좀나방, 파밤나방, 담배나방, 감자뿔나방 및 초기 흡즙·식엽성 해충 강력 방제',
    nutrient_ratio_summary: '테트라닐리프롤(Tetraniliprole) 18.18% (작용기작 그룹 28 디아마이드계 · 섭식즉시중단 · 약효 2주 지속)',
    n_pct: 0,
    p_pct: 0,
    k_pct: 0,
    ca_pct: 0,
    mg_pct: 0,
    b_pct: 0,
    sio2_pct: 0,
    s_pct: 0,
    om_pct: 0,
    dosage_per_100pyeong: '100평당 50~80ml (물 20L당 10ml / 2,000배 희석 경엽살포)',
    unit_spec: '250ml / 병',
    retail_price: 26000,
    unit_price: 22500,
    discount_rate: 13.5,
    reward_points: 450,
    stock_status: '인기품목 · 즉시출고',
    usage_stage: '초기 영양생장기 ~ 결구/비대 초기 해충 발생 초기에 경엽살포 (PRC-16, PRC-22)',
    weather_trigger: '일평균기온 20℃ 이상 고온 건조기 나방류 알 부화기 및 유충 발생 예보 시 즉시 방제',
    thumbnail_url: '/images/fertilizers/MAT-PEST-02-thumb.png',
    detail_image_1: '/images/fertilizers/MAT-PEST-02-detail1.png',
    detail_image_2: '/images/fertilizers/MAT-PEST-02-detail2.png',
    detail_image_3: '/images/fertilizers/MAT-PEST-02-detail3.jpg',
    detail_image_4: '/images/fertilizers/MAT-PEST-02-detail4.png',
    description_banner_url: '/images/fertilizers/MAT-PEST-02-desc.png',
  },
  {
    material_id: 'MAT-PEST-03',
    product_code: '30003000003',
    material_category: 'PESTICIDE',
    sub_type: '살균제 (무름병·노균병·역병·탄저병)',
    category_code: 'CAT-PST-FUNG',
    manufacturer: '인바이오(주) / (주)누보',
    product_name: '펀지해머 액상수화제 (에타복삼·피라클로스트로빈 · 노균병·역병·무름병·탄저병 종합살균제) 500ml',
    formulation_type: '액상수화제 (SC · 예방+치료 복합)',
    is_organic: 0,
    organic_label: '(작물보호제·살균제)',
    weight_spec: '550g',
    volume_spec: '500ml',
    origin_country: '대한민국 (등록번호: 19-살균-190)',
    contact_phone: '1544-3098',
    target_nutrient_or_pest: '가을배추·양파·시금치 노균병, 감자·고추 역병, 탄저병 및 잎마름병의 침투이행 예방·치료 동시 방제',
    nutrient_ratio_summary: '에타복삼 10% + 피라클로스트로빈 10% (작용기작 나3+다3 복합 · 병원균 포자형성 및 균사신장 강력 억제)',
    n_pct: 0,
    p_pct: 0,
    k_pct: 0,
    ca_pct: 0,
    mg_pct: 0,
    b_pct: 0,
    sio2_pct: 0,
    s_pct: 0,
    om_pct: 0,
    dosage_per_100pyeong: '100평당 100ml (물 20L당 20ml / 1,000배 희석 잎 뒷면까지 충분히 살포)',
    unit_spec: '500ml / 병',
    retail_price: 25000,
    unit_price: 21500,
    discount_rate: 14.0,
    reward_points: 430,
    stock_status: '베스트셀러 · 즉시출고',
    usage_stage: '중기 왕성 생장기 ~ 결구/비대기 강우 전후 집중 방제 (PRC-22)',
    weather_trigger: '가을장마·태풍 등 강수일수 2~3일 이상 지속 및 상대습도 80% 이상 다습 예보 시 선제 살포',
    thumbnail_url: '/images/fertilizers/MAT-PEST-03-thumb.png',
    detail_image_1: '/images/fertilizers/MAT-PEST-03-detail1.png',
    detail_image_2: '/images/fertilizers/MAT-PEST-03-detail2.png',
    detail_image_3: '/images/fertilizers/MAT-PEST-03-detail3.png',
    detail_image_4: '/images/fertilizers/MAT-PEST-03-detail4.png',
    description_banner_url: '/images/fertilizers/MAT-PEST-03-desc.png',
  },
  {
    material_id: 'MAT-PEST-04',
    product_code: '30003000004',
    material_category: 'PESTICIDE',
    sub_type: '토양살균·살충제 (뿌리혹병·잘록병)',
    category_code: 'CAT-PST-SOIL',
    manufacturer: 'UPL코리아 / (주)누보',
    product_name: '사라져 미탁제 (에트리디아졸 · 뿌리혹병·잘록병/입고병·뿌리썩음병 토양전문 살균제) 500ml',
    formulation_type: '미탁제 (ME · 토양관주·혼화용)',
    is_organic: 0,
    organic_label: '(작물보호제·바3살균제)',
    weight_spec: '540g',
    volume_spec: '500ml',
    origin_country: '대한민국 (등록번호: 제29-살균-41호)',
    contact_phone: '1544-3098',
    target_nutrient_or_pest: '가을배추·무·감자·인삼·육묘상의 잘록병(입고병), 피시움 뿌리썩음병, 역병 및 토양 유래 뿌리혹병 예방·방제',
    nutrient_ratio_summary: '에트리디아졸(Etridiazole) 25% (작용기작 바3 살균제 · 토양 침투력 우수 · 정식 전후 관주 처리)',
    n_pct: 0,
    p_pct: 0,
    k_pct: 0,
    ca_pct: 0,
    mg_pct: 0,
    b_pct: 0,
    sio2_pct: 0,
    s_pct: 0,
    om_pct: 0,
    dosage_per_100pyeong: '100평당 150~200ml (물 20L당 20ml / 1,000배 희석 정식 전후 토양 관주 처리)',
    unit_spec: '500ml / 병',
    retail_price: 22500,
    unit_price: 19000,
    discount_rate: 15.6,
    reward_points: 380,
    stock_status: '정상판매 · 즉시출고',
    usage_stage: '두둑 성형·정식 직전 토양처리 및 정식 직후 뿌리권 관주 (PRC-04 ~ PRC-08)',
    weather_trigger: '연작지 포전 또는 정식기 가을장마로 토양 과습·배수 불량이 우려될 때 선제 처리',
    thumbnail_url: '/images/fertilizers/MAT-PEST-04-thumb.png',
    detail_image_1: '/images/fertilizers/MAT-PEST-04-detail1.png',
    detail_image_2: '/images/fertilizers/MAT-PEST-04-detail2.jpg',
    detail_image_3: '/images/fertilizers/MAT-PEST-04-detail3.jpg',
    detail_image_4: '/images/fertilizers/MAT-PEST-04-detail4.jpg',
    description_banner_url: '/images/fertilizers/MAT-PEST-04-desc.png',
  },
  {
    material_id: 'MAT-PEST-05',
    product_code: '30003000005',
    material_category: 'PESTICIDE',
    sub_type: '나방·벼룩잎벌레 종합살충제',
    category_code: 'CAT-PST-MOTH',
    manufacturer: '인바이오(주) / (주)누보',
    product_name: '웜해머 분산성액제 (이미다클로프리드 · 벼룩잎벌레·진딧물·총채벌레·나방류 종합살충제) 1L',
    formulation_type: '분산성액제 (DC · 속효+지효 침투성)',
    is_organic: 0,
    organic_label: '(작물보호제·살충제4a)',
    weight_spec: '1.1Kg',
    volume_spec: '1,000ml (1L)',
    origin_country: '대한민국 (등록번호: 19-살충-144)',
    contact_phone: '1544-3098',
    target_nutrient_or_pest: '가을배추 초기 잎에 구멍을 내는 벼룩잎벌레, 진딧물, 총채벌레, 아메리카잎굴파리 및 나방류 유충 동시 방제',
    nutrient_ratio_summary: '이미다클로프리드(Imidacloprid) 10% (작용기작 4a · 강력한 침투이행성 및 접촉·섭식 독성 발현)',
    n_pct: 0,
    p_pct: 0,
    k_pct: 0,
    ca_pct: 0,
    mg_pct: 0,
    b_pct: 0,
    sio2_pct: 0,
    s_pct: 0,
    om_pct: 0,
    dosage_per_100pyeong: '100평당 100ml (물 20L당 10~20ml / 1,000~2,000배 희석 경엽살포)',
    unit_spec: '1L (1,000ml) / 병',
    retail_price: 21000,
    unit_price: 17800,
    discount_rate: 15.2,
    reward_points: 356,
    stock_status: '인기품목 · 대용량특가',
    usage_stage: '정식 후 활착기 ~ 1차 웃거름기 ~ 결구 초기 집중 방제 (PRC-13, PRC-16, PRC-22)',
    weather_trigger: '8월 하순~9월 중순 고온 건조기 벼룩잎벌레·진딧물·나방류 밀도 급증 시 7~10일 간격 살포',
    thumbnail_url: '/images/fertilizers/MAT-PEST-05-thumb.png',
    detail_image_1: '/images/fertilizers/MAT-PEST-05-detail1.png',
    detail_image_2: '/images/fertilizers/MAT-PEST-05-detail2.png',
    detail_image_3: '/images/fertilizers/MAT-PEST-05-detail3.png',
    detail_image_4: '/images/fertilizers/MAT-PEST-05-detail4.png',
    description_banner_url: '/images/fertilizers/MAT-PEST-05-desc.png',
  },
  {
    material_id: 'MAT-PEST-06',
    product_code: '30003000006',
    material_category: 'PESTICIDE',
    sub_type: '친환경 유기농업자재 (PLS 수확전 방제)',
    category_code: 'CAT-PST-ECO',
    manufacturer: '(주)누보',
    product_name: '엔플러스 해충박살 파워 (유기농업자재 공시-2-5-315 · 유칼립투스·계피오일 친환경 방제제) 250ml',
    formulation_type: '식물추출 천연오일 유제 (Eco Liquid)',
    is_organic: 1,
    organic_label: '(유기농업자재 공시-2-5-315)',
    weight_spec: '270g',
    volume_spec: '250ml',
    origin_country: '대한민국 (경기 수원)',
    contact_phone: '1600-7268',
    target_nutrient_or_pest: '가을배추 수확 임박기 및 친환경 상추·시금치의 진딧물·응애·총채벌레·나방 유충·작은뿌리파리 무잔류 안전 방제',
    nutrient_ratio_summary: '유칼립투스오일 15% + 계피오일(Cinnamon Oil) 10% + 식물유래 천연유화제 (충해관리용 유기농업자재 공시)',
    n_pct: 0,
    p_pct: 0,
    k_pct: 0,
    ca_pct: 0,
    mg_pct: 0,
    b_pct: 0,
    sio2_pct: 0,
    s_pct: 0,
    om_pct: 0,
    dosage_per_100pyeong: '100평당 100~200ml (물 20L당 20~40ml / 500~1,000배 희석 살포)',
    unit_spec: '250ml / 병',
    retail_price: 19500,
    unit_price: 16500,
    discount_rate: 15.4,
    reward_points: 330,
    stock_status: '유기농공시 · 즉시출고',
    usage_stage: '결구 중후기 ~ 수확 적기 임박기 PLS 안전 마감 방제 (PRC-19, PRC-27, PRC-28)',
    weather_trigger: '수확 7~14일 이내 화학농약 사용 제한(PLS) 시기 또는 친환경·무농약 인증 포전 해충 발생 시',
    thumbnail_url: '/images/fertilizers/MAT-PEST-06-thumb.png',
    detail_image_1: '/images/fertilizers/MAT-PEST-06-detail1.png',
    detail_image_2: '/images/fertilizers/MAT-PEST-06-detail2.png',
    detail_image_3: '/images/fertilizers/MAT-PEST-06-detail3.png',
    detail_image_4: '/images/fertilizers/MAT-PEST-06-detail4.png',
    description_banner_url: '/images/fertilizers/MAT-PEST-06-desc.png',
  },
  ...[
    {
      id: 'MAT-PEST-07', code: '30003000007', sub: '제초제 (고랑·헛골 비선택성/토양처리)', catCode: 'CAT-PST-HERB',
      brand: '(주)팜한농', name: '테라도 골드 미탁제 (티아페나실+글루포시네이트 고랑 잡초 속효성 제초제) 500ml',
      form: '미탁제 (ME · 비선택성 속효형)', org: 0, orgLbl: '(작물보호제·제초제)', w: '560g', vol: '500ml', origin: '대한민국 (등록번호: 1-제조-104)', phone: '1644-0901',
      target: '배추·감자·마늘 고랑(헛골)의 깨풀·쇠비름·망초·바랭이 등 난방제 잡초 2~3일 내 급속 고사',
      ratio: '글루포시네이트암모늄 18% + 티아페나실 0.5% (작용기작 H10+E14 · 24시간 내 광합성 차단)',
      dosage: '100평당 100ml (물 20L당 60ml / 비산방지 노즐로 잡초 경엽 처리)', spec: '500ml / 병',
      retail: 21000, unit: 17800, stage: '정식 전 예정지 정리 및 생육 중기 헛골 제초 (PRC-05, PRC-14)', trigger: '고랑 잡초 초장 10~20cm 시 바람 없는 맑은 날 살포'
    },
    {
      id: 'MAT-PEST-08', code: '30003000008', sub: '제초제 (고랑·헛골 비선택성/토양처리)', catCode: 'CAT-PST-HERB',
      brand: '(주)경농', name: '고랑깨끗 유제 (펜디메탈린 · 정식·파종 전 잡초 발아억제 토양처리 제초제) 1L',
      form: '유제 (EC · 발아전 토양처리)', org: 0, orgLbl: '(작물보호제·제초제K1)', w: '1.08Kg', vol: '1,000ml', origin: '대한민국 (등록번호: 3-제조-088)', phone: '1899-0584',
      target: '배추 정식 전 및 감자·마늘·양파 파종 직후 토양 표면 처리로 45일간 일년생 화본과·광엽 잡초 발아 원천 억제',
      ratio: '펜디메탈린(Pendimethalin) 31.7% (작용기작 그룹 K1 · 토양 표층 처리막 형성)',
      dosage: '100평당 100~120ml (물 40L에 희석하여 정식·멀칭 전 두둑·고랑 전면에 균일 살포)', spec: '1L (1,000ml) / 병',
      retail: 18500, unit: 15500, stage: '두둑 성형 직후 ~ 비닐멀칭 피복 전 토양 표면 처리 (PRC-05)', trigger: '정식·파종 전 토양 수분이 적당할 때 선제 처리'
    },
    {
      id: 'MAT-PEST-09', code: '30003000009', sub: '살충제 (진딧물·총채벌레·초기해충)', catCode: 'CAT-PST-INSC',
      brand: '신젠타코리아', name: '아크타라 입상수화제 (티아메톡삼 · 진딧물·총채벌레·벼룩잎벌레 침투이행 살충제) 100g',
      form: '입상수화제 (WG · 침투이행성)', org: 0, orgLbl: '(작물보호제·살충제4a)', w: '100g', vol: '0ml', origin: '대한민국 (등록번호: 12-살충-210)', phone: '1588-3345',
      target: '배추·감자·상추·고추의 복숭아혹진딧물·무테두리진딧물·꽃노랑총채벌레·벼룩잎벌레 강력 방제 및 바이러스 예방',
      ratio: '티아메톡삼(Thiamethoxam) 10% (작용기작 그룹 4a · 육묘상 관주 및 본밭 경엽살포 겸용)',
      dosage: '100평당 50g (물 20L당 10g / 2,000배 희석 육묘상 관주 또는 본밭 경엽살포)', spec: '100g / 봉',
      retail: 16500, unit: 13900, stage: '정식 직전 육묘상 관주 및 정식 초기 해충 예찰 시 (PRC-06, PRC-16)', trigger: '진딧물·총채벌레 유입 초기 및 바이러스 매개 차단 필요 시'
    },
    {
      id: 'MAT-PEST-10', code: '30003000010', sub: '살충제 (진딧물·총채벌레·초기해충)', catCode: 'CAT-PST-INSC',
      brand: '(주)한국삼공', name: '빅카드 액상수화제 (클로티아니딘 · 총채벌레·진딧물·고자리파리 전문 살충제) 250ml',
      form: '액상수화제 (SC)', org: 0, orgLbl: '(작물보호제·살충제4a)', w: '280g', vol: '250ml', origin: '대한민국 (등록번호: 7-살충-182)', phone: '080-024-3030',
      target: '배추·무·마늘·양파의 진딧물, 총채벌레, 벼룩잎벌레, 아메리카잎굴파리 및 고자리파리 방제',
      ratio: '클로티아니딘(Clothianidin) 8% (작용기작 4a · 약효 지속성 14일 및 신경전달 차단)',
      dosage: '100평당 50ml (물 20L당 10ml / 2,000배 희석 경엽살포)', spec: '250ml / 병',
      retail: 18000, unit: 15200, stage: '초기 영양생장기 ~ 중기 외엽 번무기 (PRC-12 ~ PRC-17)', trigger: '건조한 날씨가 이어져 진딧물·총채벌레 밀도가 상승할 때'
    },
    {
      id: 'MAT-PEST-11', code: '30003000011', sub: '살충제 (진딧물·총채벌레·초기해충)', catCode: 'CAT-PST-INSC',
      brand: '(주)동방아그로', name: '스피노에이스 입상수화제 (스피네토람 · 총채벌레·배추좀나방·파밤나방 동시방제) 100g',
      form: '입상수화제 (WG · 속효성)', org: 0, orgLbl: '(작물보호제·살충제5)', w: '100g', vol: '0ml', origin: '대한민국 (등록번호: 5-살충-302)', phone: '02-580-3600',
      target: '저항성 꽃노랑총채벌레·대만총채벌레와 배추좀나방·파밤나방·굴파리를 동시에 방제하는 고급 살충제',
      ratio: '스피네토람(Spinetoram) 5% (작용기작 그룹 5 · 토양방선균 발효 유래 성분 · 빠른 치사효과)',
      dosage: '100평당 50g (물 20L당 10g / 2,000배 희석 경엽살포)', spec: '100g / 병',
      retail: 27000, unit: 23200, stage: '생육 초기 ~ 결구 중기 해충 발생기 교호 살포 (PRC-16, PRC-22)', trigger: '기존 약제에 내성이 생긴 총채벌레·나방 복합 발생 시'
    },
    {
      id: 'MAT-PEST-12', code: '30003000012', sub: '살균제 (무름병·노균병·역병·탄저병)', catCode: 'CAT-PST-FUNG',
      brand: '(주)경농', name: '일품 입상수화제 (옥솔린산 · 배추·무·감자 세균성 무름병·검은썩음병 전문약) 250g',
      form: '입상수화제 (WG · 세균병 전문)', org: 0, orgLbl: '(작물보호제·살균제나1)', w: '250g', vol: '0ml', origin: '대한민국 (등록번호: 3-살균-215)', phone: '1899-0584',
      target: '가을배추 결구기 치명적인 세균성 무름병(연부병)·검은썩음병 및 감자 흑각병·무름병 전문 예방·치료',
      ratio: '옥솔린산(Oxolinic acid) 20% (작용기작 그룹 나1 · 병원성 세균 DNA 복제 직접 억제)',
      dosage: '100평당 100g (물 20L당 20g / 1,000배 희석 배추 밑둥·지제부 집중 살포)', spec: '250g / 봉',
      retail: 22000, unit: 18500, stage: '결구 시작기 ~ 결구 중후기 강우 전후 집중 살포 (PRC-19 ~ PRC-22)', trigger: '가을장마·집중호우 직후 고온다습 환경에서 무름병 발생 우려 시'
    },
    {
      id: 'MAT-PEST-13', code: '30003000013', sub: '살균제 (무름병·노균병·역병·탄저병)', catCode: 'CAT-PST-FUNG',
      brand: '신젠타코리아', name: '리도밀골드 입상수화제 (메탈락실-엠·만코제브 · 노균병·역병 침투이행 살균제) 500g',
      form: '입상수화제 (WG · 예방+치료)', org: 0, orgLbl: '(작물보호제·살균제가1+다)', w: '500g', vol: '0ml', origin: '대한민국 (등록번호: 12-살균-140)', phone: '1588-3345',
      target: '배추·시금치·양파·상추 노균병 및 감자·고추 역병의 잎·줄기·괴경 침투이행 방제',
      ratio: '메탈락실-엠(Metalaxyl-M) 4% + 만코제브(Mancozeb) 64% (작용기작 가1+다3 복합)',
      dosage: '100평당 200g (물 20L당 40g / 500배 희석 경엽살포)', spec: '500g / 봉',
      retail: 19000, unit: 16200, stage: '외엽 번무기 ~ 결구기 / 감자 개화·괴경비대기 (PRC-17 ~ PRC-22)', trigger: '일교차가 크고 아침 안개·이슬이 많은 노균병·역병 호발 기상 시'
    },
    {
      id: 'MAT-PEST-14', code: '30003000014', sub: '살균제 (무름병·노균병·역병·탄저병)', catCode: 'CAT-PST-FUNG',
      brand: '(주)농협케미컬', name: '아그리마이신 수화제 (스트렙토마이신 · 배추 무름병·세균성점무늬병 항생 살균제) 250g',
      form: '수화제 (WP · 항생제계)', org: 0, orgLbl: '(작물보호제·살균제라1)', w: '250g', vol: '0ml', origin: '대한민국 (등록번호: 2-살균-095)', phone: '1588-2026',
      target: '배추·무·상추·감자의 세균성 무름병, 세균성구멍병, 검은점세균병 초기 감염 즉시 차단',
      ratio: '스트렙토마이신황산염 20% (작용기작 그룹 라1 · 세균 단백질 합성 차단)',
      dosage: '100평당 100g (물 20L당 15~20g / 1,000~1,500배 희석 살포)', spec: '250g / 봉',
      retail: 15000, unit: 12500, stage: '결구 개시기 및 나방 가해 상처 발생 직후 살포 (PRC-19, PRC-22)', trigger: '나방 식흔이나 강풍 상처 부위를 통한 무름병 세균 2차 감염 예방 시'
    },
    {
      id: 'MAT-PEST-15', code: '30003000015', sub: '살균제 (무름병·노균병·역병·탄저병)', catCode: 'CAT-PST-FUNG',
      brand: '바스프 / (주)팜한농', name: '카브리오 유제 (피라클로스트로빈 · 탄저병·노균병·검은무늬병 광범위 살균제) 250ml',
      form: '유제 (EC · 스트로빌루린계)', org: 0, orgLbl: '(작물보호제·살균제다3)', w: '280g', vol: '250ml', origin: '대한민국 (등록번호: 1-살균-312)', phone: '1644-0901',
      target: '배추 검은무늬병·노균병·흰무늬병, 고추 탄저병, 감자 겹무늬병·역병 예방 및 치료',
      ratio: '피라클로스트로빈(Pyraclostrobin) 22.9% (작용기작 다3 · 병원균 호흡 저해 및 잎 녹화 유지)',
      dosage: '100평당 50ml (물 20L당 10ml / 2,000배 희석 경엽살포)', spec: '250ml / 병',
      retail: 24500, unit: 20900, stage: '생육 중기 ~ 결구 후기 병해 예방 방제 (PRC-17 ~ PRC-27)', trigger: '가을 강우 예보 전 선제 보호 살포'
    },
    {
      id: 'MAT-PEST-16', code: '30003000016', sub: '토양살균·살충제 (뿌리혹병·잘록병)', catCode: 'CAT-PST-SOIL',
      brand: '(주)경농', name: '후론사이드 수화제 (플루설파마이드 · 배추 뿌리혹병/무사마귀병 전문 토양살균제) 500g',
      form: '수화제 (WP · 토양혼화용)', org: 0, orgLbl: '(작물보호제·살균제다5)', w: '500g', vol: '0ml', origin: '대한민국 (등록번호: 3-살균-188)', phone: '1899-0584',
      target: '배추·무·양배추 연작지 토양 내 뿌리혹병(무사마귀병) 휴면포자 발아 원천 억제 및 건전 뿌리 보호',
      ratio: '플루설파마이드(Flusulfamide) 5.0% (작용기작 그룹 다5 · 정식 전 토양 혼화 또는 침지 처리)',
      dosage: '100평당 200~300g (정식 전 두둑 토양에 혼화 처리 또는 500배액 육묘판 침지)', spec: '500g / 봉',
      retail: 23000, unit: 19500, stage: '본밭 두둑 성형·로터리 시 토양 혼화 또는 정식 직전 (PRC-04, PRC-08)', trigger: '배추 연작지 및 산성·배수불량 토양 뿌리혹병 예방 필수 처방'
    },
    {
      id: 'MAT-PEST-17', code: '30003000017', sub: '토양살균·살충제 (뿌리혹병·잘록병)', catCode: 'CAT-PST-SOIL',
      brand: '(주)팜한농', name: '포스 입제 (테플루트린 · 거세미나방·고자리파리·방아벌레·굼벵이 토양살충제) 3kg',
      form: '입제 (GR · 토양혼화 살충제)', org: 0, orgLbl: '(작물보호제·살충제3a)', w: '3Kg', vol: '0ml', origin: '대한민국 (등록번호: 1-살충-098)', phone: '1644-0901',
      target: '정식·파종 초기 배추·감자·마늘의 줄기와 뿌리를 갉아먹는 거세미나방, 고자리파리, 철사벌레(방아벌레), 굼벵이 방제',
      ratio: '테플루트린(Tefluthrin) 0.5% (작용기작 3a · 토양 내 가스 증기작용 및 접촉독 동시 발현)',
      dosage: '100평당 2~3kg (두둑 성형 전 토양 전면에 살포 후 흙과 골고루 로터리 혼화)', spec: '3kg / 봉',
      retail: 14500, unit: 12000, stage: '두둑 성형 및 비닐멀칭 직전 토양 살충 처리 (PRC-05)', trigger: '가축분 퇴비 시용 필지 및 전작물 잔재물이 많은 토양해충 우려 포전'
    },
    {
      id: 'MAT-PEST-18', code: '30003000018', sub: '토양살균·살충제 (뿌리혹병·잘록병)', catCode: 'CAT-PST-SOIL',
      brand: '바이엘 / (주)한국삼공', name: '프리엔 액상수화제 (플루오피람 · 고자리파리·선충·균핵병·흰비단병 동시방제) 250ml',
      form: '액상수화제 (SC · 토양관주/경엽)', org: 0, orgLbl: '(작물보호제·다2살균/선충)', w: '290g', vol: '250ml', origin: '대한민국 (등록번호: 7-살균-410)', phone: '080-024-3030',
      target: '감자·배추·상추·마늘의 뿌리혹선충·부패선충 억제 및 균핵병·잿빛곰팡이병·흰비단병 동시 방제',
      ratio: '플루오피람(Fluopyram) 34.8% (작용기작 그룹 다2 / N-3 · 선충 및 진균 미토콘드리아 호흡 차단)',
      dosage: '100평당 50~80ml (물 20L당 10ml / 2,000배 희석 정식 전후 토양관주 또는 경엽살포)', spec: '250ml / 병',
      retail: 29500, unit: 25200, stage: '정식 직후 뿌리권 관주 및 생육 중기 균핵병 예방 (PRC-08, PRC-16)', trigger: '시설하우스 상추·시금치 균핵병 및 노지 감자·배추 선충·토양병 예방 시'
    },
    {
      id: 'MAT-PEST-19', code: '30003000019', sub: '나방·벼룩잎벌레 종합살충제', catCode: 'CAT-PST-MOTH',
      brand: 'FMC코리아 / (주)경농', name: '프레바톤 수화제 (클로란트라닐리프롤 · 파밤나방·배추좀나방·담배거세미나방 전문) 200g',
      form: '수화제 (WP · 디아마이드계)', org: 0, orgLbl: '(작물보호제·살충제28)', w: '200g', vol: '0ml', origin: '대한민국 (등록번호: 3-살충-350)', phone: '1899-0584',
      target: '배추 결구 내부로 파고드는 파밤나방·배추좀나방·배추순나방·담배거세미나방의 알~노령 유충까지 강력 방제',
      ratio: '클로란트라닐리프롤(Chlorantraniliprole) 5.0% (작용기작 그룹 28 · 해충 근육 수축 마비 및 섭식 즉각 중단)',
      dosage: '100평당 50g (물 20L당 10g / 2,000배 희석 생장점 및 잎 뒷면 살포)', spec: '200g / 봉',
      retail: 24000, unit: 20500, stage: '정식 후 활착기 ~ 결구 초기 나방 집중 발생기 (PRC-13 ~ PRC-19)', trigger: '배추 속잎이 말리기 전(결구 직전) 나방 유충 완전 박멸 필수 단계'
    },
    {
      id: 'MAT-PEST-20', code: '30003000020', sub: '나방·벼룩잎벌레 종합살충제', catCode: 'CAT-PST-MOTH',
      brand: '신젠타코리아', name: '프로클레임 미탁제 (에마멕틴벤조에이트 · 고령 나방 유충·벼룩잎벌레 속효성 방제) 250ml',
      form: '미탁제 (ME · 침투성 속효형)', org: 0, orgLbl: '(작물보호제·살충제6)', w: '275g', vol: '250ml', origin: '대한민국 (등록번호: 12-살충-195)', phone: '1588-3345',
      target: '배추좀나방, 파밤나방, 도둑나방, 무잎벌, 벼룩잎벌레 및 총채벌레를 빠르게 치사시키는 속효성 약제',
      ratio: '에마멕틴벤조에이트(Emamectin benzoate) 2.15% (작용기작 그룹 6 · 신경염소이온 채널 활성화)',
      dosage: '100평당 50ml (물 20L당 10ml / 2,000배 희석 경엽살포)', spec: '250ml / 병',
      retail: 21500, unit: 18200, stage: '외엽 번무기 ~ 결구 중기 나방 발생 확인 시 (PRC-17 ~ PRC-22)', trigger: '그룹 28 약제와 교호 살포하여 저항성 나방 완벽 방제 시'
    },
    {
      id: 'MAT-PEST-21', code: '30003000021', sub: '나방·벼룩잎벌레 종합살충제', catCode: 'CAT-PST-MOTH',
      brand: '(주)팜한농', name: '캡틴 유제 (브로플라닐라이드 · 저항성 배추좀나방·파밤나방·벼룩잎벌레 신물질) 250ml',
      form: '유제 (EC · 그룹30 신물질)', org: 0, orgLbl: '(작물보호제·살충제30)', w: '275g', vol: '250ml', origin: '대한민국 (등록번호: 1-살충-512)', phone: '1644-0901',
      target: '기존 살충제에 저항성을 보이는 난방제 배추좀나방·파밤나방·벼룩잎벌레·잎굴파리 동시 해결',
      ratio: '브로플라닐라이드(Broflanilide) 5% (작용기작 그룹 30 메타디아마이드계 · 교차저항성 없음)',
      dosage: '100평당 50ml (물 20L당 10ml / 2,000배 희석 경엽살포)', spec: '250ml / 병',
      retail: 28500, unit: 24500, stage: '중기 왕성 생장기 ~ 결구 중기 집중 방제 (PRC-17 ~ PRC-22)', trigger: '고온기 나방 밀도 급증 및 기존 약제 방제 효과 저하 시'
    },
    {
      id: 'MAT-PEST-22', code: '30003000022', sub: '친환경 유기농업자재 (PLS 수확전 방제)', catCode: 'CAT-PST-ECO',
      brand: '대유', name: '대유 충싹 유기농 골드 (공시-2-5-102 · 고삼·님오일·데리스 친환경 살충제) 500ml',
      form: '식물추출 천연 유제 (Eco Liquid)', org: 1, orgLbl: '(유기농)', w: '540g', vol: '500ml', origin: '대한민국 (충북 괴산)', phone: '1588-4710',
      target: '수확 임박기 배추·상추·시금치의 진딧물·청벌레·배추좀나방·총채벌레 PLS 무잔류 친환경 방제',
      ratio: '고삼추출물(Matrine) 15% + 님오일(Azadirachtin) 10% + 데리스추출물 5% (유기농업자재 공시)',
      dosage: '100평당 150~200ml (물 20L당 20~40ml / 500~1,000배 희석 살포)', spec: '500ml / 병',
      retail: 23000, unit: 19500, stage: '수확 14일 전 ~ 수확 직전 PLS 안전 마감 방제 (PRC-27, PRC-28)', trigger: '친환경 농산물 재배지 및 수확 임박기 화학농약 살포 불가 시기'
    },
    {
      id: 'MAT-PEST-23', code: '30003000023', sub: '친환경 유기농업자재 (PLS 수확전 방제)', catCode: 'CAT-PST-ECO',
      brand: '(주)누보', name: '엔플러스 균박살 에코 (공시-2-4-089 · 황토유황·구리·식물추출 친환경 살균제) 500ml',
      form: '천연 미네랄·식물오일 액상', org: 1, orgLbl: '(유기농)', w: '580g', vol: '500ml', origin: '대한민국 (경기 수원)', phone: '1600-7268',
      target: '배추·상추·시금치 노균병, 흰가루병, 무름병, 잿빛곰팡이병 예방 및 PLS 수확 전 무잔류 살균 관리',
      ratio: '수용성 유황 12% + 대황·정향추출물 15% + 천연 키토산 5% (병해관리용 유기농업자재 공시)',
      dosage: '100평당 150ml (물 20L당 20~30ml / 700~1,000배 희석 살포)', spec: '500ml / 병',
      retail: 21500, unit: 18200, stage: '생육 중후기 ~ 수확 직전 친환경 병해 예방 (PRC-22, PRC-27)', trigger: '수확 임박기 가을비·안개로 노균병·무름병 발생 우려 시 안전 살포'
    },
    {
      id: 'MAT-PEST-24', code: '30003000024', sub: '친환경 유기농업자재 (PLS 수확전 방제)', catCode: 'CAT-PST-ECO',
      brand: '(주)경농', name: '비티엔(BT) 수화제 (바실러스 튜린겐시스 · 친환경 나방 유충 전문 미생물제) 300g',
      form: '미생물 수화제 (WP · 생물농약)', org: 1, orgLbl: '(유기농)', w: '300g', vol: '0ml', origin: '대한민국 (대구 달성)', phone: '1899-0584',
      target: '배추좀나방·파밤나방·배추흰나비(청벌레) 유충의 소화기관을 파괴하여 치사시키는 친환경 미생물 살충제',
      ratio: '바실러스 튜린겐시스(Bacillus thuringiensis var. kurstaki) 32,000 IU/mg (유기농 공시 생물약제)',
      dosage: '100평당 100g (물 20L당 20g / 1,000배 희석 해질 무렵 경엽살포)', spec: '300g / 봉',
      retail: 18500, unit: 15600, stage: '전 생육기 및 수확 직전 나방 유충 친환경 방제 (PRC-16 ~ PRC-28)', trigger: '유기농·무농약 인증 포전 및 수확기 잔류농약 걱정 없는 나방 방제 시'
    },
    {
      id: 'MAT-PEST-25', code: '30003000025', sub: '살균제 (무름병·노균병·역병·탄저병)', catCode: 'CAT-PST-FUNG',
      brand: '(주)팜한농', name: '명작 액상수화제 (사이아조파미드 · 배추 노균병·뿌리혹병 및 감자 역병 전문약) 250ml',
      form: '액상수화제 (SC · 내우성 우수)', org: 0, orgLbl: '(작물보호제·살균제다4)', w: '285g', vol: '250ml', origin: '대한민국 (등록번호: 1-살균-284)', phone: '1644-0901',
      target: '배추·시금치·양파 노균병과 배추 뿌리혹병(무사마귀병), 감자 역병에 탁월한 예방 및 확산 차단 효과',
      ratio: '사이아조파미드(Cyazofamid) 9.5% (작용기작 그룹 다4 · 유주자 운동 차단 및 비에 잘 씻기지 않는 내우성)',
      dosage: '100평당 50~80ml (물 20L당 10ml / 2,000배 희석 경엽살포 또는 정식 전 묘판 침지)', spec: '250ml / 병',
      retail: 25500, unit: 21800, stage: '정식 전 묘판 침지(뿌리혹병) 및 결구기 경엽살포(노균병) (PRC-08, PRC-19)', trigger: '가을장마 강우 전후 노균병·역병 방제 (우수한 내우성으로 약효 지속)'
    },
  ].map((x) => ({
    material_id: x.id,
    product_code: x.code,
    material_category: 'PESTICIDE',
    sub_type: x.sub,
    category_code: x.catCode,
    manufacturer: x.brand,
    product_name: x.name,
    formulation_type: x.form,
    is_organic: x.org,
    organic_label: x.orgLbl,
    weight_spec: x.w,
    volume_spec: x.vol,
    origin_country: x.origin,
    contact_phone: x.phone,
    target_nutrient_or_pest: x.target,
    nutrient_ratio_summary: x.ratio,
    n_pct: 0,
    p_pct: 0,
    k_pct: 0,
    ca_pct: 0,
    mg_pct: 0,
    b_pct: 0,
    sio2_pct: 0,
    s_pct: 0,
    om_pct: 0,
    dosage_per_100pyeong: x.dosage,
    unit_spec: x.spec,
    retail_price: x.retail,
    unit_price: x.unit,
    discount_rate: Number((((x.retail - x.unit) / x.retail) * 100).toFixed(1)),
    reward_points: Math.round(x.unit * 0.02),
    stock_status: x.org ? '유기농공시 · 즉시출고' : '정상판매 · 즉시출고',
    usage_stage: x.stage,
    weather_trigger: x.trigger,
    thumbnail_url: `/api/agro-materials/image/${x.id}/thumb`,
    detail_image_1: `/api/agro-materials/image/${x.id}/detail1`,
    detail_image_2: `/api/agro-materials/image/${x.id}/detail2`,
    detail_image_3: `/api/agro-materials/image/${x.id}/detail3`,
    detail_image_4: `/api/agro-materials/image/${x.id}/detail4`,
    description_banner_url: `/api/agro-materials/image/${x.id}/desc`,
  })),
];

export const INITIAL_SEED_PRODUCTS: FertilizerProductRecord[] = [
  {
    id: 'MAT-SEED-01', code: '30004000001', sub: '엽채류 종자 (배추·상추·시금치·양배추)', catCode: 'CAT-SEED-LEAF',
    brand: '농우바이오', name: '불암3호 가을김장배추 종자 (무사마귀병 CR 저항성 · 황금색 속잎 대통배추) 2,000립',
    form: '필름코팅 종자 (소독필 · Pelleted/Film)', org: 0, orgLbl: '(보증종자·F1교잡)', w: '7g', vol: '2,000립',
    origin: '대한민국 (국내 채종 · 품종보호)', phone: '031-218-1100',
    target: '가을 김장배추 표준 품종 · 중肋이 얇고 엽수가 많으며 노란 속잎과 고소한 맛이 일품인 CR 내병계 배추',
    ratio: '립수: 2,000립(약 7g) | 보증발아율: 85% 이상 | 발아적온: 20~25℃ | 숙기: 정식 후 65~70일 | CR 무사마귀병 저항성',
    dosage: '100평당 정식 주수 약 900~1,100주 (여유 육묘 포함 1봉 2,000립으로 약 150~180평 파종 가능)', spec: '2,000립 (약 7g) / 1봉',
    retail: 18000, unit: 15000, stage: '육묘 파종 (정식 25일 전 · 8월 상순) 또는 본밭 직파 (PRC-07)',
    trigger: '평균기온 22~25℃ 도달 시 파종 적기 (30℃ 이상 고온기 육묘 시 차광·환기 필수)',
    seed_count_spec: '2,000립 (약 7g / 1봉)', germination_rate_pct: '85% 이상 (공식발아보증)', germination_temp_spec: '20~25℃ (최저 8℃ ~ 최고 32℃)',
    seed_coating_spec: '티람·메탈락실 필름코팅 소독필', sowing_period_spec: '가을작형 파종 7월 하순~8월 중순 / 정식 8월 하순~9월 초',
    days_to_harvest_spec: '정식 후 65~70일 (적산온도 PGDD 약 1,032℃·일)',
    disease_resistance_spec: '무사마귀병(뿌리혹병 CR) 강저항성 · 바이러스 및 노균병 중강 내병성 · 결구력 우수',
    variety_reg_no: '품종생산·수입판매신고 제04-0018-2024-1호',
    thumb: '/images/fertilizers/MAT-SEED-01-thumb.jpg'
  },
  {
    id: 'MAT-SEED-02', code: '30004000002', sub: '엽채류 종자 (배추·상추·시금치·양배추)', catCode: 'CAT-SEED-LEAF',
    brand: '(주)팜한농 (흥농씨앗)', name: '휘파람골드 가을배추 종자 (뿌리혹병·노균병 복합내병성 · 고구중 김장배추) 2,000립',
    form: '기능성 필름코팅 종자', org: 0, orgLbl: '(보증종자·복합내병)', w: '7.5g', vol: '2,000립',
    origin: '대한민국 (전북 김제 채종)', phone: '1644-0901',
    target: '결구 내부가 진한 노란색이고 수분 함량이 적당해 김장 후 물러짐이 적은 고품질 복합내병계 가을배추',
    ratio: '립수: 2,000립 | 보증발아율: 85% 이상 | 발아적온: 20~24℃ | 숙기: 정식 후 65일 내외 | CR+노균병 복합내병성',
    dosage: '100평당 1,000주 기준 1봉(2,000립)으로 150평 육묘 가능', spec: '2,000립 / 1봉',
    retail: 19500, unit: 16500, stage: '128구 육묘 트레이 파종 및 본밭 직파 (PRC-07)',
    trigger: '중부 8월 상순 · 남부 8월 중하순 파종 적기',
    seed_count_spec: '2,000립 (약 7.5g / 1봉)', germination_rate_pct: '85% 이상', germination_temp_spec: '20~24℃',
    seed_coating_spec: '친환경 기능성 필름코팅 (발아균일 처리)', sowing_period_spec: '가을김장작형 8월 상순~중순 파종',
    days_to_harvest_spec: '정식 후 65일 내외',
    disease_resistance_spec: '뿌리혹병(CR) 및 가을 노균병 복합 내병성 · 저온기 결구력 탁월',
    variety_reg_no: '제01-0102-2024-5호',
    thumb: '/images/fertilizers/MAT-SEED-02-thumb.jpg'
  },
  {
    id: 'MAT-SEED-03', code: '30004000003', sub: '엽채류 종자 (배추·상추·시금치·양배추)', catCode: 'CAT-SEED-LEAF',
    brand: '아시아종묘(주)', name: '원기청치마 상추 종자 (고온기 추대 늦은 다수확 청치마 상추) 5,000립',
    form: '나종자 정선 (Clean Seed)', org: 0, orgLbl: '(보증종자·추대만생)', w: '6g', vol: '5,000립',
    origin: '대한민국 (국내산)', phone: '02-443-4303',
    target: '잎이 두껍고 윤기가 나며 봄·여름·가을 장기간 수확해도 꽃대(추대)가 늦게 올라오는 고품질 청치마상추',
    ratio: '립수: 약 5,000립(6g) | 보증발아율: 80% 이상 | 발아적온: 15~20℃ | 수확: 정식 후 25~30일 연속 수확',
    dosage: '100평당 육묘 파종 시 1~2봉 (약 3,500~4,000주 식재)', spec: '6g (약 5,000립) / 1봉',
    retail: 6000, unit: 4800, stage: '연중 육묘 파종 및 본밭 줄뿌림 직파 (PRC-07)',
    trigger: '일평균기온 15~20℃ 최적 발아 (25℃ 이상 고온기에는 냉장 최아 처리 후 파종 권장)',
    seed_count_spec: '약 5,000립 (6g / 1봉)', germination_rate_pct: '80% 이상', germination_temp_spec: '15~20℃ (고온기 휴면타파 필요)',
    seed_coating_spec: '무처리 정선종자 (친환경 재배 가능)', sowing_period_spec: '봄·가을 노지 및 시설 연중 파종 (3월~10월)',
    days_to_harvest_spec: '파종 후 40~45일 (정식 후 20~25일부터 하엽 수확)',
    disease_resistance_spec: '만추대성(꽃대 발생 지연) · 잎끝마름(팁번) 및 무름병에 강함',
    variety_reg_no: '제08-0045-2023-2호',
    thumb: '/images/fertilizers/MAT-SEED-03-thumb.jpg'
  },
  {
    id: 'MAT-SEED-04', code: '30004000004', sub: '엽채류 종자 (배추·상추·시금치·양배추)', catCode: 'CAT-SEED-LEAF',
    brand: '농우바이오', name: '남해초(포항초형) 재래종 시금치 종자 (내한성 극강 · 고당도 겨울 시금치) 1L (약 400g)',
    form: '정선 소독 종자', org: 0, orgLbl: '(대용량·월동시금치)', w: '400g', vol: '1L (약 35,000립)',
    origin: '대한민국 (경북·경남 채종)', phone: '031-218-1100',
    target: '뿌리 부위가 붉고 당도가 매우 높으며 영하의 겨울 추위에도 얼어 죽지 않는 가을·월동 노지 시금치 전문 품종',
    ratio: '용량: 1L(약 400g / 35,000립) | 보증발아율: 75% 이상 | 발아적온: 15~20℃ | 숙기: 파종 후 50~70일',
    dosage: '100평당 줄뿌림(조파) 3~4L (약 1.2~1.6kg)', spec: '1L (약 400g) / 1봉',
    retail: 14500, unit: 12000, stage: '본밭 두둑 줄뿌림(조파) 또는 산파 (PRC-07)',
    trigger: '9월 상순~11월 중순 평균기온 15~20℃ 하강기 파종 적기 (파종 전 24시간 침종 시 발아 균일)',
    seed_count_spec: '1L 대용량 (약 400g / 약 35,000립)', germination_rate_pct: '75% 이상', germination_temp_spec: '15~20℃ (4℃ 저온에서도 발아 가능)',
    seed_coating_spec: '종자 표면 정선 마찰처리 (발아촉진)', sowing_period_spec: '가을·월동 재배 9월 상순 ~ 11월 중순',
    days_to_harvest_spec: '가을수확 파종 후 45~55일 / 월동수확 70~90일',
    disease_resistance_spec: '내한성(추위 견딤) 극강 · 노균병 R1~R7 저항성 · 분주력 및 당도 우수',
    variety_reg_no: '제04-0211-2023-3호',
    thumb: '/images/fertilizers/MAT-SEED-04-thumb.jpg'
  },
  {
    id: 'MAT-SEED-05', code: '30004000005', sub: '근채류 종자 (무·당근·우엉·비트)', catCode: 'CAT-SEED-ROOT',
    brand: '(주)팜한농', name: '관동여름·가을 김장무 종자 (청수 궁중무 · 바람들이 늦고 치밀한 육질) 1,200립',
    form: '필름코팅 종자', org: 0, orgLbl: '(보증종자·F1교잡)', w: '14g', vol: '1,200립',
    origin: '대한민국 (국내산)', phone: '1644-0901',
    target: '무청이 튼튼하고 무 상단 청색부가 선명하며 장기 저장 시에도 바람들이(스펀지 현상)가 없는 최고급 김장무',
    ratio: '립수: 1,200립(약 14g) | 보증발아율: 85% 이상 | 발아적온: 20~25℃ | 숙기: 파종 후 60~65일',
    dosage: '100평당 약 2,000~2,500립 직파 (1구당 2립 점파 후 1본 솎음 · 약 2봉 소요)', spec: '1,200립 / 1봉',
    retail: 13500, unit: 11200, stage: '본밭 두둑 점뿌림(점파) 직파 (PRC-07)',
    trigger: '8월 중하순~9월 상순 일평균기온 23℃ 전후 토양 수분이 적당할 때 직파',
    seed_count_spec: '1,200립 (약 14g / 1봉)', germination_rate_pct: '85% 이상', germination_temp_spec: '20~25℃',
    seed_coating_spec: '적색 필름코팅 소독필', sowing_period_spec: '가을김장무 8월 중순 ~ 9월 상순 직파',
    days_to_harvest_spec: '파종 후 60~65일 (근중 1.3~1.5kg)',
    disease_resistance_spec: '바이러스병·무름병·위황병에 강하며 열근(갈라짐) 및 바람들이 극소',
    variety_reg_no: '제01-0089-2024-2호',
    thumb: '/images/fertilizers/MAT-SEED-05-thumb.jpg'
  },
  {
    id: 'MAT-SEED-06', code: '30004000006', sub: '근채류 종자 (무·당근·우엉·비트)', catCode: 'CAT-SEED-ROOT',
    brand: '아시아종묘(주)', name: '신흑전5촌 당근 종자 (착색·근비대 균일 · 코팅 씨앗으로 파종 편리) 2,500립',
    form: '펠릿코팅 종자 (Pelleted Seed)', org: 0, orgLbl: '(펠릿코팅·고당도)', w: '18g', vol: '2,500립',
    origin: '대한민국 / 칠레 채종', phone: '02-443-4303',
    target: '어깨 부위까지 진한 주홍색으로 착색되고 심부(코어)가 가늘어 식미와 저장성이 뛰어난 봄·가을 겸용 5촌 당근',
    ratio: '립수: 2,500립(펠릿코팅) | 보증발아율: 80% 이상 | 발아적온: 18~25℃ | 숙기: 파종 후 95~105일',
    dosage: '100평당 약 8,000~10,000립 (3~4봉 점파 또는 줄뿌림)', spec: '2,500립 (코팅종자) / 1봉',
    retail: 9500, unit: 7900, stage: '본밭 두둑 줄뿌림·점파 직파 (PRC-07)',
    trigger: '파종 후 발아까지 7~10일간 토양 표면이 마르지 않도록 수분 유지 필수',
    seed_count_spec: '2,500립 (펠릿코팅 / 1봉)', germination_rate_pct: '80% 이상', germination_temp_spec: '18~25℃',
    seed_coating_spec: '구형 펠릿코팅 (단립 파종기 호환)', sowing_period_spec: '봄파종 3월 하순~4월 중순 / 가을파종 7월 중순~8월 상순',
    days_to_harvest_spec: '파종 후 95~105일',
    disease_resistance_spec: '겹무늬병·검은잎마름병 내병성 · 열근 및 기형근 발생 적음',
    variety_reg_no: '제08-0114-2023-1호',
    thumb: '/images/fertilizers/MAT-SEED-06-thumb.jpg'
  },
  {
    id: 'MAT-SEED-07', code: '30004000007', sub: '과채류 종자 (고추·오이·토마토·호박)', catCode: 'CAT-SEED-FRUIT',
    brand: '농우바이오', name: '칼라탄 패왕 고추 종자 (탄저병·칼라병 TSWV·역병 3대 복합내병계 대과종) 500립',
    form: '필름코팅 종자', org: 0, orgLbl: '(보증종자·3대복합내병)', w: '3.5g', vol: '500립',
    origin: '대한민국 (국내산)', phone: '031-218-1100',
    target: '고추 농사의 최대 난적인 탄저병·토마토반점위조바이러스(칼라병)·역병에 모두 강한 고건과율 다수확 대과종 고추',
    ratio: '립수: 500립 | 보증발아율: 85% 이상 | 발아적온: 28~30℃ | 육묘일수: 70~80일 | PR+IR 탄저·칼라·역병 내병성',
    dosage: '100평당 정식 주수 약 700~800주 (500립 2봉 육묘 권장)', spec: '500립 / 1봉',
    retail: 45000, unit: 38500, stage: '온상 육묘 파종 (2월 상중순 파종 → 5월 상순 본밭 정식)',
    trigger: '발아적온 28~30℃ 전열온상 또는 발아기에서 최아 후 육묘 트레이 파종',
    seed_count_spec: '500립 (약 3.5g / 1봉)', germination_rate_pct: '85% 이상', germination_temp_spec: '28~30℃ (야간 20℃ 이상 유지)',
    seed_coating_spec: '고기능성 살균 필름코팅', sowing_period_spec: '노지작형 파종 1월 하순~2월 중순 / 정식 5월 상순',
    days_to_harvest_spec: '정식 후 65~75일부터 붉은 고추 연속 수확',
    disease_resistance_spec: '탄저병(IR)·칼라병(TSWV)·역병(PR)·모자이크바이러스(TMV) 복합내병계 · 매운맛 중강',
    variety_reg_no: '제04-0092-2025-1호',
    thumb: '/images/fertilizers/MAT-SEED-07-thumb.jpg'
  },
  {
    id: 'MAT-SEED-08', code: '30004000008', sub: '과채류 종자 (고추·오이·토마토·호박)', catCode: 'CAT-SEED-FRUIT',
    brand: '(주)팜한농', name: '백봉다다기 오이 종자 (노균병·흰가루병 내병성 · 절성 높은 다수확 백다다기) 500립',
    form: '필름코팅 종자', org: 0, orgLbl: '(보증종자·F1교잡)', w: '14g', vol: '500립',
    origin: '대한민국 (국내산)', phone: '1644-0901',
    target: '마디마다 암꽃 착생률(절성)이 높고 과형 반듯함이 뛰어나며 노균병·흰가루병에 강한 노지·시설 겸용 백다다기오이',
    ratio: '립수: 500립 | 보증발아율: 85% 이상 | 발아적온: 25~28℃ | 수확: 정식 후 35~40일 초수확',
    dosage: '100평당 정식 주수 약 600~700주 (500립 1.5~2봉 소요)', spec: '500립 / 1봉',
    retail: 34000, unit: 28900, stage: '포트 육묘 파종 (정식 25~30일 전 파종)',
    trigger: '지온 15℃ 이상, 기온 25~28℃ 확보 시 파종',
    seed_count_spec: '500립 (약 14g / 1봉)', germination_rate_pct: '85% 이상', germination_temp_spec: '25~28℃',
    seed_coating_spec: '청색 필름코팅 소독필', sowing_period_spec: '봄·가을 시설 및 여름 노지 억제재배 (3월~8월)',
    days_to_harvest_spec: '정식 후 35~40일 (과장 21~23cm)',
    disease_resistance_spec: '노균병·흰가루병·바이러스(ZYMV) 복합 내병성 · 곡과(휜오이) 발생 적음',
    variety_reg_no: '제01-0155-2024-3호',
    thumb: '/images/fertilizers/MAT-SEED-08-thumb.jpg'
  },
  {
    id: 'MAT-SEED-09', code: '30004000009', sub: '양념·구근류 종자 (대파·양파·부추)', catCode: 'CAT-SEED-ALLIUM',
    brand: '농우바이오', name: '명품외대 대파 종자 (연백부 길고 순백색 · 내서성·내한성 겸비 F1 교배종) 20ml (약 4,500립)',
    form: '필름코팅 정선종자', org: 0, orgLbl: '(보증종자·F1교배 대파)', w: '10g', vol: '20ml (약 4,500립)',
    origin: '대한민국 (국내산)', phone: '031-218-1100',
    target: '분얼(가지치기)되지 않는 외대성 교배종 대파로 여름 고온기 무름병에 강하고 겨울철 잎 끝 마름이 적어 상품성이 탁월함',
    ratio: '립수: 20ml(약 4,500립) | 보증발아율: 80% 이상 | 발아적온: 15~22℃ | 숙기: 정식 후 100~120일',
    dosage: '100평당 약 8,000~10,000본 정식 (200구 트레이 육묘 시 2~3봉 소요)', spec: '20ml (약 4,500립) / 1캔(봉)',
    retail: 22000, unit: 18500, stage: '200구·288구 트레이 육묘 파종 또는 묘상 줄뿌림 (PRC-07)',
    trigger: '봄파종(2~4월) 및 가을파종(8~9월) 일평균기온 15~22℃ 적온기 파종',
    seed_count_spec: '20ml (약 4,500립 / 1봉)', germination_rate_pct: '80% 이상', germination_temp_spec: '15~22℃',
    seed_coating_spec: '필름코팅 소독필 (진균성 입고병 예방)', sowing_period_spec: '봄파종 2월 하순~4월 / 가을파종 8월 하순~9월 중순',
    days_to_harvest_spec: '정식 후 100~120일 (연백부 길이 40~45cm)',
    disease_resistance_spec: '노균병·검은무늬병·녹병 저항성 우수 · 고온기 잎 꺾임 및 추대 지연',
    variety_reg_no: '제04-0312-2024-1호',
    thumb: '/images/fertilizers/MAT-SEED-09-thumb.jpg'
  },
  {
    id: 'MAT-SEED-10', code: '30004000010', sub: '두류·특작 종자 (찰옥수수·콩·참깨·들깨)', catCode: 'CAT-SEED-GRAIN',
    brand: '충북농업기술원 / 정선종자', name: '대학찰 골드 찰옥수수 종자 (껍질이 얇고 쫀득한 고당도 백색 찰옥수수) 200g (약 1,000립)',
    form: '소독 정선종자', org: 0, orgLbl: '(보증종자·국산찰옥수수)', w: '200g', vol: '약 1,000립',
    origin: '대한민국 (충북 괴산·제천 채종)', phone: '1588-2026',
    target: '알껍질(과피)이 매우 얇아 치아에 끼지 않고 식어도 딱딱해지지 않는 대한민국 대표 프리미엄 백색 찰옥수수',
    ratio: '중량: 200g(약 1,000립) | 보증발아율: 85% 이상 | 발아적온: 20~28℃ | 수확: 파종 후 85~90일 (출사 후 24~26일)',
    dosage: '100평당 정식 주수 약 1,100~1,300주 (1구 1~2립 파종 시 1~2봉 소요)', spec: '200g (약 1,000립) / 1봉',
    retail: 16500, unit: 13800, stage: '본밭 비닐멀칭 직파 또는 72구·105구 트레이 15일 단기육묘 (PRC-07)',
    trigger: '늦서리 우려가 없는 4월 상순~7월 상순 지온 14℃ 이상 도달 시 파종',
    seed_count_spec: '200g (약 1,000립 / 1봉)', germination_rate_pct: '85% 이상', germination_temp_spec: '20~28℃ (최저 지온 12℃ 이상)',
    seed_coating_spec: '종자소독제 분의·코팅 처리필', sowing_period_spec: '봄~여름 단계별 파종 4월 상순 ~ 7월 상순',
    days_to_harvest_spec: '파종 후 85~90일 (수염 나온 후 25일 전후 적기 수확)',
    disease_resistance_spec: '깨씨무늬병·깜부기병 내병성 및 쓰러짐(도복)에 강한 중장간형',
    variety_reg_no: '품종보호 제06-0012-2023-1호',
    thumb: '/images/fertilizers/MAT-SEED-10-thumb.jpg'
  },
].map((x) => ({
  material_id: x.id,
  product_code: x.code,
  material_category: 'SEED',
  sub_type: x.sub,
  category_code: x.catCode,
  manufacturer: x.brand,
  product_name: x.name,
  formulation_type: x.form,
  is_organic: x.org,
  organic_label: x.orgLbl,
  weight_spec: x.w,
  volume_spec: x.vol,
  origin_country: x.origin,
  contact_phone: x.phone,
  target_nutrient_or_pest: x.target,
  nutrient_ratio_summary: x.ratio,
  n_pct: 0,
  p_pct: 0,
  k_pct: 0,
  ca_pct: 0,
  mg_pct: 0,
  b_pct: 0,
  sio2_pct: 0,
  s_pct: 0,
  om_pct: 0,
  dosage_per_100pyeong: x.dosage,
  unit_spec: x.spec,
  retail_price: x.retail,
  unit_price: x.unit,
  discount_rate: Number((((x.retail - x.unit) / x.retail) * 100).toFixed(1)),
  reward_points: Math.round(x.unit * 0.02),
  stock_status: '발아율보증 · 당일출고',
  usage_stage: x.stage,
  weather_trigger: x.trigger,
  thumbnail_url: x.thumb,
  detail_image_1: `/api/agro-materials/image/${x.id}/detail1`,
  detail_image_2: `/api/agro-materials/image/${x.id}/detail2`,
  detail_image_3: `/api/agro-materials/image/${x.id}/detail3`,
  detail_image_4: `/api/agro-materials/image/${x.id}/detail4`,
  description_banner_url: `/api/agro-materials/image/${x.id}/desc`,
  seed_count_spec: x.seed_count_spec,
  germination_rate_pct: x.germination_rate_pct,
  germination_temp_spec: x.germination_temp_spec,
  seed_coating_spec: x.seed_coating_spec,
  sowing_period_spec: x.sowing_period_spec,
  days_to_harvest_spec: x.days_to_harvest_spec,
  disease_resistance_spec: x.disease_resistance_spec,
  variety_reg_no: x.variety_reg_no,
}));

export const INITIAL_SEEDLING_PRODUCTS: FertilizerProductRecord[] = [
  {
    id: 'MAT-SDL-01', code: '30005000001', sub: '배추·양배추·쌈채류 모종', catCode: 'CAT-SDL-LEAF',
    brand: '한팜스마트육묘장 (농우 불암3호 원종)', name: '가을김장배추 불암3호 A급 건묘 모종 (CR 무사마귀병 내병계 · 외기순화 완료) 128구 1판',
    form: '128구 프러그 트레이묘 (Plug Seedling)', org: 0, orgLbl: '(A급건묘·외기순화필)', w: '2.8Kg', vol: '128구 (실출하 120주 이상 보증)',
    origin: '대한민국 (충북 충주·괴산 전문육묘장)', phone: '1588-2026',
    target: '정식 직후 몸살 없이 3~5일 내 새 뿌리가 내리도록 뿌리돌림(상토 결속)과 노지 자외선·야간 저온 순화를 완벽히 마친 가을배추 모종',
    ratio: '규격: 128구 트레이 1판 | 묘령: 파종 후 25~28일 (본엽 4~5매) | 재식거리: 이랑 65cm × 주간 35~40cm | CR 내병성',
    dosage: '100평당 약 900~1,050주 정식 (128구 트레이 기준 8~9판 소요)', spec: '128구 트레이 / 1판 (약 120~125주)',
    retail: 16000, unit: 13500, stage: '본밭 정식 단계 (PRC-08 · 정식 전 충분한 관수 및 묘판 침지 후 이식)',
    trigger: '8월 하순~9월 중순 일평균기온 20~24℃ · 흐린 날 오후 또는 해질 무렵 정식 시 활착률 99%',
    plug_tray_spec: '128구 규격 트레이 1판 (유효 건묘 120주 이상 보증)',
    seedling_age_spec: '파종 후 25~28일 육묘 · 본엽 4~5매 · 초장 12~14cm 짱짱한 건묘',
    grafting_type_spec: '실생 전용상토 프러그묘 (뿌리혹병·잘록병 예방 관주 완료)',
    planting_distance_spec: '이랑 너비 60~65cm × 포기 간격(주간) 35~40cm (1줄 또는 2줄 식재)',
    hardening_spec: '출하 5일 전부터 차광망 제거 후 노지 직사광선 및 야간 외기 순화 완료 · 흰색 세근 뿌리돌림 A급',
    disease_resistance_spec: '무사마귀병(뿌리혹병 CR) 저항성 원종 사용 · 바이러스 매개충 사전 방제필',
    shipping_pack_spec: '모종 전용 숨구멍 골판지 하드박스 + 트레이 흔들림 방지 고정핀 안심포장',
    thumb: '/images/fertilizers/MAT-SDL-01-thumb.jpg'
  },
  {
    id: 'MAT-SDL-02', code: '30005000002', sub: '접목묘·특수작물 모종 (딸기·수박·참외)', catCode: 'CAT-SDL-SPEC',
    brand: '성스팜 전문육묘장 (농촌진흥청 품종보호)', name: '사철딸기·설향 명품 딸기 모종 5포트 세트 (관부 10mm 이상 우량 포트묘)',
    form: '9cm 연질포트 우량묘 (5포트 세트)', org: 0, orgLbl: '(품종보호·무병우량묘)', w: '1.5Kg', vol: '5포트 (1세트)',
    origin: '대한민국 (충남 논산·전북 익산 정식등록육묘장)', phone: '1588-2026',
    target: '관부(크라운) 두께 10mm 이상의 화아분화가 완료된 무병 우량 딸기 포트묘로 정식 후 빠른 착과와 고당도 수확 보장',
    ratio: '규격: 9cm 포트 × 5개입 | 묘령: 런너 채묘 후 60일 육묘 (본엽 4~5매, 크라운 10mm↑) | 재식거리: 주간 20~25cm',
    dosage: '100평당 약 3,500~4,000주 (소규모 텃밭·고설베드 맞춤형 5포트 묶음 구성)', spec: '9cm 포트 5개 / 1세트',
    retail: 15000, unit: 12500, stage: '가을·봄 본밭 두둑 또는 고설베드 정식 (관부가 흙에 묻히지 않게 천식)',
    trigger: '정식 시 관부(생장점) 절반이 지면 위로 노출되도록 심고 정식 직후 7일간 충분한 점적 관수 필수',
    plug_tray_spec: '9cm 독립 포트묘 5개 1세트',
    seedling_age_spec: '런너 자묘 육묘 60일 · 관부(크라운) 직경 10~12mm · 화아분화 완료묘',
    grafting_type_spec: '바이러스 프리(무병) 원모주 자묘 포트육묘',
    planting_distance_spec: '이랑 100~120cm (2줄) × 주간 20~25cm',
    hardening_spec: '저온 단일 화아분화 처리 및 뿌리분 100% 완숙 결속',
    disease_resistance_spec: '탄저병·시들음병·흰가루병 사전 예방관리 완료 · 농촌진흥청 통상실시권 정식 계약',
    shipping_pack_spec: '포트별 개별 홀더 캡 고정 + 통기성 전용 안전박스 당일발송',
    thumb: '/images/fertilizers/MAT-SDL-02-thumb.jpg'
  },
  {
    id: 'MAT-SDL-03', code: '30005000003', sub: '배추·양배추·쌈채류 모종', catCode: 'CAT-SDL-LEAF',
    brand: '초록프러그육묘장', name: '모듬 쌈채소·적상추·청상추·로메인 혼합 모종 트레이 (6종 구성) 105구 1판',
    form: '105구 프러그 트레이묘', org: 0, orgLbl: '(무농약상토육묘)', w: '2.5Kg', vol: '105구 1판 (6종 혼합)',
    origin: '대한민국 (경기 이천·여주 육묘장)', phone: '1588-2026',
    target: '청치마·적축면·꽃상추·적로메인·청로메인·버터헤드 6가지 인기 쌈채소를 한 판에 구성하여 정식 2주 후부터 바로 수확하는 실속 모종',
    ratio: '규격: 105구 트레이 1판 | 묘령: 파종 후 22~25일 (본엽 4매) | 재식거리: 이랑 90cm(3~4줄) × 주간 20cm',
    dosage: '100평당 약 3,500주 (105구 트레이 35판 / 텃밭 5~10평당 1~2판 적합)', spec: '105구 트레이 / 1판',
    retail: 15000, unit: 12000, stage: '본밭 비닐멀칭 정식 (PRC-08)',
    trigger: '봄(3월 하순~6월) 및 가을(8월 하순~10월) 기온 15~22℃ 선선한 시기 정식 시 즉시 활착',
    plug_tray_spec: '105구 트레이 1판 (청상추·적상추·로메인 등 6종 혼합)',
    seedling_age_spec: '파종 후 22~25일 · 본엽 4~5매 · 도장 없는 단단한 엽육',
    grafting_type_spec: '친환경 피트모스·펄라이트 상토 실생 프러그묘',
    planting_distance_spec: '주간 20cm × 열간 20cm (두둑 폭 90~100cm 기준 3~4줄 식재)',
    hardening_spec: '하우스 측면 개방 자연광 순화 및 치밀한 뿌리분 형성',
    disease_resistance_spec: '만추대성(꽃대 지연) 품종 선발 · 무름병·팁번 강내성',
    shipping_pack_spec: '트레이 전용 맞춤 박스 수평 고정 포장',
    thumb: '/images/fertilizers/MAT-SDL-03-thumb.jpg'
  },
  {
    id: 'MAT-SDL-04', code: '30005000004', sub: '배추·양배추·쌈채류 모종', catCode: 'CAT-SDL-LEAF',
    brand: '한팜스마트육묘장', name: '달콤 양배추·브로콜리 포트 모종 (결구력 우수 · 내한성 품종) 72구 1판',
    form: '72구 대립 프러그묘', org: 0, orgLbl: '(A급건묘·대립포트)', w: '2.9Kg', vol: '72구 1판',
    origin: '대한민국 (강원 평창·충북 제천)', phone: '1588-2026',
    target: '72구 넓은 상토 용적에서 키워 줄기가 굵고 뿌리 활력이 뛰어나 본밭 정식 후 결구 비대가 빠른 양배추 전문 모종',
    ratio: '규격: 72구 트레이 1판 | 묘령: 파종 후 28~32일 (본엽 5~6매) | 재식거리: 이랑 60cm × 주간 40cm',
    dosage: '100평당 약 1,000~1,100주 (72구 트레이 14~15판 소요)', spec: '72구 트레이 / 1판',
    retail: 16500, unit: 13800, stage: '봄(4월)·가을(8월 하순) 본밭 정식 (PRC-08)',
    trigger: '정식 후 초기 배추좀나방·벼룩잎벌레 예방 및 칼슘·붕소 엽면시비 병행 시 고품질 결구',
    plug_tray_spec: '72구 대립 트레이 1판 (상토량 충분)',
    seedling_age_spec: '파종 후 28~32일 · 본엽 5~6매 · 줄기 목질화 전 건묘',
    grafting_type_spec: '실생 72구 프러그묘',
    planting_distance_spec: '이랑 60cm × 주간 35~40cm',
    hardening_spec: '고랭지 주야간 일교차 외기 순화 완료 · 뿌리돌림 최상',
    disease_resistance_spec: '검은썩음병(흑부병) 및 위황병 저항성 품종',
    shipping_pack_spec: '72구 트레이 전용 충격흡수 안전박스',
    thumb: '/images/fertilizers/MAT-SDL-04-thumb.jpg'
  },
  {
    id: 'MAT-SDL-05', code: '30005000005', sub: '고추·토마토·가지·오이 과채 모종', catCode: 'CAT-SDL-FRUIT',
    brand: '명품과채육묘장', name: '칼라탄 복합내병성 고추 모종 (탄저병·칼라병·역병 저항성 · 첫꽃 개화 직전 대묘) 50구 1판',
    form: '50구 대형 연결포트묘', org: 0, orgLbl: '(복합내병·장기육묘)', w: '3.8Kg', vol: '50구 1판 (50주)',
    origin: '대한민국 (경북 안동·영양 육묘장)', phone: '1588-2026',
    target: '75일간 온상에서 충분한 일조와 마디 관리를 거쳐 첫 방아다리(분지)가 형성된 굵고 단단한 복합내병계 고추 대묘',
    ratio: '규격: 50구 대형 연결포트 1판 | 묘령: 파종 후 70~75일 (본엽 10~12매, 방아다리 형성) | 재식거리: 이랑 100cm × 주간 40cm',
    dosage: '100평당 약 700~800주 정식 (50구 포트 기준 14~16판 소요)', spec: '50구 연결포트 / 1판 (50주)',
    retail: 28000, unit: 23500, stage: '늦서리 종료 후 본밭 정식 (5월 상순 · 지온 15℃ 이상)',
    trigger: '기온 15℃ 이상 맑고 바람 없는 날 포트 흙 높이 그대로 얕게 심기(천식) 필수',
    plug_tray_spec: '50구 대형 연결포트 1판 (포트당 상토 75ml 대용량)',
    seedling_age_spec: '파종 후 70~75일 장기육묘 · 본엽 10~12매 · 제1분지(방아다리) 꽃봉오리 형성묘',
    grafting_type_spec: '복합내병계(탄저·칼라·역병) 원종 50구 대묘',
    planting_distance_spec: '외줄 재배 이랑 90~100cm × 주간 35~45cm',
    hardening_spec: '정식 10일 전부터 야간 13℃ 저온 및 직사광선 외기 순화로 냉해 저항성 확보',
    disease_resistance_spec: '탄저병·칼라병(TSWV)·역병·CMV 복합내병성 · 초기 총채벌레·진딧물 방제 출하',
    shipping_pack_spec: '장초장 과채묘 전용 50cm 하이박스 직립 고정 포장',
    thumb: '/images/fertilizers/MAT-SDL-05-thumb.jpg'
  },
  {
    id: 'MAT-SDL-06', code: '30005000006', sub: '고추·토마토·가지·오이 과채 모종', catCode: 'CAT-SDL-FRUIT',
    brand: '명품과채육묘장', name: '허니옐로우·대추방울토마토 접목 모종 (청고병·시들음병 저항성 대목 접목묘) 40구 1판',
    form: '40구 포트 접목묘 (Grafted Seedling)', org: 0, orgLbl: '(전문접목묘·고당도)', w: '3.6Kg', vol: '40구 1판 (40주)',
    origin: '대한민국 (충남 부여·논산 육묘장)', phone: '1588-2026',
    target: '토양 전염성 청고병(풋마름병)과 시들음병에 강한 전용 대목에 접목하여 수확기까지 초세가 꺾이지 않는 고당도 방울토마토 접목묘',
    ratio: '규격: 40구 트레이 1판 | 묘령: 50~55일 육묘 (제1화방 화뢰 출현) | 육묘방식: 병해저항성 대목 튜브접목묘',
    dosage: '100평당 약 700~900주 (40구 트레이 18~22판 소요)', spec: '40구 트레이 / 1판 (40주)',
    retail: 36000, unit: 31000, stage: '시설하우스(3~4월) 및 노지(5월 초) 본밭 정식',
    trigger: '접목 부위(클립 자국)가 땅에 묻히지 않도록 지상부 위로 노출시켜 정식',
    plug_tray_spec: '40구 대립 포트 1판 (40주)',
    seedling_age_spec: '파종·접목 후 50~55일 · 본엽 7~8매 · 제1화방 꽃봉오리 출현기',
    grafting_type_spec: '청고병·시들음병·선충 저항성 대목 튜브접목묘 (활착 완료)',
    planting_distance_spec: '이랑 120cm (2줄) × 주간 40~45cm',
    hardening_spec: '접목 활착실 순화 후 2주간 강광·통풍 경화 처리 완료',
    disease_resistance_spec: '풋마름병(청고병)·후자리움 시들음병·황화잎말림바이러스(TYLCV) 복합 내병성',
    shipping_pack_spec: '접목부 보호 지지대 및 과채 전용 하드박스 안전 배송',
    thumb: '/images/fertilizers/MAT-SDL-06-thumb.jpg'
  },
  {
    id: 'MAT-SDL-07', code: '30005000007', sub: '대파·양파·쪽파·부추 양념 모종', catCode: 'CAT-SDL-HERB',
    brand: '남도양념육묘장', name: '삼동파·명품외대 대파 모종 (노지 월동 가능 · 연백부 굵고 향이 진한 대파 건묘) 200구 1판',
    form: '200구 대파 전용 트레이묘', org: 0, orgLbl: '(A급건묘·전용상토)', w: '2.4Kg', vol: '200구 1판 (약 400~500본)',
    origin: '대한민국 (전남 진도·신안 육묘장)', phone: '1588-2026',
    target: '1구당 2~3립 파종으로 45~55일간 잎 줄기를 짱짱하게 키운 대파 모종으로 정식기 기계이식 및 수작업 골심기에 모두 최적화된 우량묘',
    ratio: '규격: 200구 트레이 1판(구당 2~3본, 총 450본 내외) | 묘령: 50일 육묘 | 재식거리: 골간 75~85cm × 주간 5~7cm',
    dosage: '100평당 약 8,000~10,000본 (200구 트레이 18~22판 소요)', spec: '200구 트레이 / 1판 (약 450본)',
    retail: 14000, unit: 11500, stage: '봄(4~5월) 및 가을(9~10월) 본밭 깊은 골 정식 (PRC-08)',
    trigger: '정식 후 활착이 끝나면 생육에 맞춰 2~3회 북주기(배토)를 실시하여 연백부 길이 확보',
    plug_tray_spec: '200구 대파 전용 직립 트레이 1판 (구당 2~3본 합식, 총 450본 내외)',
    seedling_age_spec: '파종 후 50~55일 육묘 · 초장 25~30cm (출하 전 적정 절엽 정리) · 줄기 굵기 4~5mm',
    grafting_type_spec: '실생 집단육묘 프러그묘 (기계 정식기 호환)',
    planting_distance_spec: '이랑(골) 간격 75~85cm × 포기 간격 5~7cm',
    hardening_spec: '해풍·일조 순화 및 상토 뿌리 감김 우수하여 뽑힘성 탁월',
    disease_resistance_spec: '노균병·녹병·고자리파리 사전 방제 처리필 · 내한성 월동 우수',
    shipping_pack_spec: '대파 트레이 전용 통기성 박스 포장',
    thumb: '/images/fertilizers/MAT-SDL-07-thumb.jpg'
  },
  {
    id: 'MAT-SDL-08', code: '30005000008', sub: '대파·양파·쪽파·부추 양념 모종', catCode: 'CAT-SDL-HERB',
    brand: '초록프러그육묘장', name: '다수확 영양부추·솔부추 숙근 포트 모종 (한번 심으면 매년 5~6회 수확 다년생) 6포트 세트',
    form: '10cm 중대형 포트 숙근묘 (6포트)', org: 1, orgLbl: '(무농약·다년생숙근)', w: '2.2Kg', vol: '10cm 포트 6개 (포트당 15~20촉)',
    origin: '대한민국 (경기 양평·포천)', phone: '1588-2026',
    target: '뿌리 왕성한 숙근(묵은 뿌리) 부추 포트묘로 심은 첫해부터 바로 베어 먹을 수 있고 노지 월동하여 수년간 계속 수확하는 고효율 모종',
    ratio: '규격: 10cm 포트 × 6개 세트(포트당 15~20촉 분주 가능) | 묘령: 1년생 숙근묘 | 재식거리: 이랑 80cm × 주간 15~20cm',
    dosage: '100평당 약 3,500~4,000포기 (텃밭·농가 보식 및 단지 조성용)', spec: '10cm 숙근포트 6개 / 1세트',
    retail: 16000, unit: 13200, stage: '봄(3~6월)~가을(8~10월) 본밭 정식',
    trigger: '정식 후 25~30일 간격으로 지제부 2~3cm 위를 베어 수확 후 추비(웃거름) 시비',
    plug_tray_spec: '10cm 숙근 포트 6개입 세트 (포트당 15~20촉 밀식 구성)',
    seedling_age_spec: '1년 이상 키운 숙근(왕성한 종근 형성) 완숙묘',
    grafting_type_spec: '무농약 상토 분주·숙근 포트묘',
    planting_distance_spec: '이랑 80~90cm (3~4줄) × 포기 간격 15~20cm',
    hardening_spec: '노지 월동 경화 완료 · 이식 몸살 없이 100% 활착',
    disease_resistance_spec: '잿빛곰팡이병·잎마름병 강내성 및 겨울 영하 20℃ 노지 월동',
    shipping_pack_spec: '6구 포트 홀더 트레이 + 수분 유지 패킹 박스',
    thumb: '/images/fertilizers/MAT-SDL-08-thumb.jpg'
  },
  {
    id: 'MAT-SDL-09', code: '30005000009', sub: '고구마순·씨감자·마늘 영양번식 모종', catCode: 'CAT-SDL-ROOT',
    brand: '해남무병조직배양육묘장', name: '베니하루카(꿀고구마)·소담미 바이러스 프리 무병 고구마순 모종 100본 1단',
    form: '조직배양 증식 채취순 (7~8마디 우량순)', org: 0, orgLbl: '(조직배양무병묘)', w: '1.8Kg', vol: '100본 (1단)',
    origin: '대한민국 (전남 해남·영암 조직배양육묘장)', phone: '1588-2026',
    target: '바이러스에 감염되지 않은 조직배양 기본묘에서 채취한 1세대 우량 고구마순으로 일반 묘 대비 수확량 30% 증수 및 매끈한 외관 구현',
    ratio: '규격: 1단 100본(길이 25~30cm, 7~8마디 건묘) | 품종: 베니하루카(꿀고구마) | 재식거리: 이랑 75cm × 주간 20~25cm',
    dosage: '100평당 약 1,400~1,600본 정식 (100본 기준 15~16단 소요)', spec: '100본 / 1단',
    retail: 19000, unit: 15800, stage: '봄 본밭 두둑 수평심기·개량수평심기 정식 (4월 하순 ~ 6월 중순)',
    trigger: '고구마순 수령 후 그늘에서 1~2일 순화(예비 발근 유도) 후 생장점 2~3잎만 노출시켜 수평 삽식',
    plug_tray_spec: '우량 채취순 100본 1단 묶음 (마디수 7~8마디, 길이 25~30cm)',
    seedling_age_spec: '조직배양 씨고구마 온상 육묘 40일 채취 1번~2번 정단묘',
    grafting_type_spec: '농촌진흥청 보급 바이러스 프리(Virus-Free) 조직배양 증식묘',
    planting_distance_spec: '이랑 너비 70~75cm × 주간 20~25cm (수평심기 기준 3~4마디 토양 매립)',
    hardening_spec: '채취 직전 칼륨·칼슘 경화 처리로 줄기 마디가 굵고 발근력 최상',
    disease_resistance_spec: '덩굴쪼김병·바이러스 퇴화 현상 없음 · 껍질 색택 선홍색 및 전분 당화율 우수',
    shipping_pack_spec: '절단면 보습 처리 + 고구마순 전용 통풍 타공 박스 당일수확 출하',
    thumb: '/images/fertilizers/MAT-SDL-09-thumb.jpg'
  },
  {
    id: 'MAT-SDL-10', code: '30005000010', sub: '접목묘·특수작물 모종 (딸기·수박·참외)', catCode: 'CAT-SDL-SPEC',
    brand: '성주·고령접목육묘장', name: '고당도 산딸기·베리류 및 박과대목 접목 특작 포트 모종 (뿌리활착 완숙묘) 24구 1판',
    form: '24구 대용량 포트 완숙묘', org: 0, orgLbl: '(특수작물·완숙포트묘)', w: '3.4Kg', vol: '24구 1판 (24주)',
    origin: '대한민국 (경북 성주·경남 밀양)', phone: '1588-2026',
    target: '뿌리 목질부와 신초 눈이 충실하게 형성된 특작 베리·과채류 24구 대용량 포트 모종으로 정식 첫해부터 빠른 활착과 결실 보장',
    ratio: '규격: 24구 대형 포트 1판(24주) | 묘령: 90일 완숙 포트묘 | 재식거리: 이랑 120~150cm × 주간 50~80cm',
    dosage: '100평당 약 300~500주 정식 (24구 트레이 13~20판 소요)', spec: '24구 대용량 포트 / 1판 (24주)',
    retail: 32000, unit: 27500, stage: '봄·가을 본밭 두둑 또는 대형 화분 정식',
    trigger: '배수가 잘되는 사양토 두둑에 유기질 퇴비를 충분히 시용한 후 뿌리분이 깨지지 않게 정식',
    plug_tray_spec: '24구 대용량 포트 트레이 1판 (포트당 상토 180ml)',
    seedling_age_spec: '90일 장기 포트 육묘 · 신초 3~4본 발생 및 뿌리분 완숙',
    grafting_type_spec: '무병 조직배양·삽목 및 전용대목 포트 육묘',
    planting_distance_spec: '이랑 120~150cm × 주간 50~80cm',
    hardening_spec: '노지 일조·풍압 완전 순화 완료 · 정식 몸살 없음',
    disease_resistance_spec: '뿌리썩음병·역병 저항성 강함 · 내한성 및 내서성 우수',
    shipping_pack_spec: '24구 대형 트레이 전용 안전 칸막이 박스 포장',
    thumb: '/images/fertilizers/MAT-SDL-10-thumb.jpg'
  },
].map((x) => ({
  material_id: x.id,
  product_code: x.code,
  material_category: 'SEEDLING',
  sub_type: x.sub,
  category_code: x.catCode,
  manufacturer: x.brand,
  product_name: x.name,
  formulation_type: x.form,
  is_organic: x.org,
  organic_label: x.orgLbl,
  weight_spec: x.w,
  volume_spec: x.vol,
  origin_country: x.origin,
  contact_phone: x.phone,
  target_nutrient_or_pest: x.target,
  nutrient_ratio_summary: x.ratio,
  n_pct: 0,
  p_pct: 0,
  k_pct: 0,
  ca_pct: 0,
  mg_pct: 0,
  b_pct: 0,
  sio2_pct: 0,
  s_pct: 0,
  om_pct: 0,
  dosage_per_100pyeong: x.dosage,
  unit_spec: x.spec,
  retail_price: x.retail,
  unit_price: x.unit,
  discount_rate: Number((((x.retail - x.unit) / x.retail) * 100).toFixed(1)),
  reward_points: Math.round(x.unit * 0.02),
  stock_status: 'A급건묘 · 안전포장출고',
  usage_stage: x.stage,
  weather_trigger: x.trigger,
  thumbnail_url: x.thumb,
  detail_image_1: `/api/agro-materials/image/${x.id}/detail1`,
  detail_image_2: `/api/agro-materials/image/${x.id}/detail2`,
  detail_image_3: `/api/agro-materials/image/${x.id}/detail3`,
  detail_image_4: `/api/agro-materials/image/${x.id}/detail4`,
  description_banner_url: `/api/agro-materials/image/${x.id}/desc`,
  plug_tray_spec: x.plug_tray_spec,
  seedling_age_spec: x.seedling_age_spec,
  grafting_type_spec: x.grafting_type_spec,
  planting_distance_spec: x.planting_distance_spec,
  hardening_spec: x.hardening_spec,
  disease_resistance_spec: x.disease_resistance_spec,
  shipping_pack_spec: x.shipping_pack_spec,
}));

function escapeXml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function renderFertilizerSvg(item: any, slot: string): string {
  const id = escapeXml(item?.material_id || 'FERT-PRD-01');
  const brand = escapeXml(item?.manufacturer || '한팜농자재');
  const name = escapeXml(item?.product_name || '프리미엄 맞춤형 비료 20kg');
  const subType = escapeXml(item?.sub_type || '복합비료');
  const spec = escapeXml(item?.unit_spec || '20kg / 포');
  const formulation = escapeXml(item?.formulation_type || '입상 (Granular)');
  const ratio = escapeXml(
    item?.nutrient_ratio_summary ||
      `N ${item?.n_pct || 0}% · P ${item?.p_pct || 0}% · K ${item?.k_pct || 0}% · Ca ${item?.ca_pct || 0}%`
  );
  const target = escapeXml(item?.target_nutrient_or_pest || '작물 생육 촉진 및 토양 비옥도 개선');
  const dosage = escapeXml(item?.dosage_per_100pyeong || '100평당 20~40kg');
  const stage = escapeXml(item?.usage_stage || '밑거름 · 웃거름 겸용');
  const trigger = escapeXml(item?.weather_trigger || '토양검정 및 생육단계 도달 시');
  const price = Number(item?.unit_price || 15000).toLocaleString();

  // 팔레트 선택
  const isOrganic = Boolean(item?.is_organic);
  const catCode = String(item?.category_code || '');
  let primary = '#047857';
  let secondary = '#10b981';
  let accent = '#f59e0b';
  let bagBg = '#ecfdf5';

  if (catCode === 'CAT-NK-TOP' || subType.includes('웃거름')) {
    primary = '#0369a1';
    secondary = '#0ea5e9';
    accent = '#f97316';
    bagBg = '#f0f9ff';
  } else if (catCode === 'CAT-CRF-SLOW' || subType.includes('완효성')) {
    primary = '#6d28d9';
    secondary = '#8b5cf6';
    accent = '#eab308';
    bagBg = '#f5f3ff';
  } else if (catCode === 'CAT-SOIL-CALC' || subType.includes('칼슘') || subType.includes('토양개량')) {
    primary = '#0f766e';
    secondary = '#14b8a6';
    accent = '#fbbf24';
    bagBg = '#f0fdfa';
  } else if (catCode === 'CAT-ORG-COMP' || isOrganic) {
    primary = '#78350f';
    secondary = '#b45309';
    accent = '#22c55e';
    bagBg = '#fffbeb';
  }

  // 1) 썸네일 이미지 (비료 포대 패키지 정면 뷰)
  if (slot === 'thumb') {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#e2e8f0"/>
    </linearGradient>
    <linearGradient id="bagHeader" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${primary}"/>
      <stop offset="100%" stop-color="${secondary}"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="125%" height="125%">
      <feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#0f172a" flood-opacity="0.18"/>
    </filter>
  </defs>
  <rect width="600" height="600" fill="url(#bgGrad)"/>
  <circle cx="300" cy="310" r="230" fill="${secondary}" opacity="0.08"/>

  <!-- 비료 포대 본체 -->
  <g filter="url(#shadow)">
    <rect x="135" y="65" width="330" height="465" rx="22" fill="#ffffff" stroke="#cbd5e1" stroke-width="3"/>
    <!-- 포대 상단 실링 라인 -->
    <rect x="145" y="55" width="310" height="18" rx="6" fill="${primary}"/>
    <line x1="155" y1="64" x2="445" y2="64" stroke="#ffffff" stroke-width="2" stroke-dasharray="6,6"/>

    <!-- 포대 상단 브랜드 헤더 -->
    <path d="M135 85 H465 V195 H135 Z" fill="url(#bagHeader)"/>
    <rect x="155" y="98" width="130" height="26" rx="13" fill="#ffffff" opacity="0.95"/>
    <text x="220" y="116" font-family="Pretendard, Malgun Gothic, sans-serif" font-size="13" font-weight="800" fill="${primary}" text-anchor="middle">${brand}</text>
    <rect x="340" y="98" width="105" height="26" rx="13" fill="${accent}"/>
    <text x="392" y="116" font-family="Pretendard, Malgun Gothic, sans-serif" font-size="12" font-weight="800" fill="#0f172a" text-anchor="middle">${isOrganic ? '유기농공시' : '우수농자재'}</text>

    <text x="300" y="152" font-family="Pretendard, Malgun Gothic, sans-serif" font-size="16" font-weight="800" fill="#ffffff" text-anchor="middle">${subType}</text>
    <text x="300" y="178" font-family="Pretendard, Malgun Gothic, sans-serif" font-size="13" font-weight="700" fill="#e2e8f0" text-anchor="middle">코드: ${id} | ${formulation}</text>

    <!-- 포대 중앙 상품명 및 영양소 배합비 박스 -->
    <rect x="155" y="212" width="290" height="125" rx="16" fill="${bagBg}" stroke="${secondary}" stroke-width="2"/>
    <text x="300" y="245" font-family="Pretendard, Malgun Gothic, sans-serif" font-size="17" font-weight="900" fill="#0f172a" text-anchor="middle">${name.slice(0, 22)}</text>
    <text x="300" y="268" font-family="Pretendard, Malgun Gothic, sans-serif" font-size="14" font-weight="800" fill="${primary}" text-anchor="middle">${name.slice(22) || '농촌진흥청 표준시비 처방 연동'}</text>

    <!-- N-P-K-Ca-Mg 원형 배지 -->
    <g transform="translate(168, 284)">
      <rect x="0" y="0" width="50" height="38" rx="8" fill="#0f172a"/>
      <text x="25" y="15" font-family="sans-serif" font-size="10" font-weight="700" fill="#94a3b8" text-anchor="middle">질소 N</text>
      <text x="25" y="31" font-family="sans-serif" font-size="13" font-weight="900" fill="#38bdf8" text-anchor="middle">${item?.n_pct ?? 0}%</text>

      <rect x="54" y="0" width="50" height="38" rx="8" fill="#0f172a"/>
      <text x="79" y="15" font-family="sans-serif" font-size="10" font-weight="700" fill="#94a3b8" text-anchor="middle">인산 P</text>
      <text x="79" y="31" font-family="sans-serif" font-size="13" font-weight="900" fill="#fb923c" text-anchor="middle">${item?.p_pct ?? 0}%</text>

      <rect x="108" y="0" width="50" height="38" rx="8" fill="#0f172a"/>
      <text x="133" y="15" font-family="sans-serif" font-size="10" font-weight="700" fill="#94a3b8" text-anchor="middle">칼륨 K</text>
      <text x="133" y="31" font-family="sans-serif" font-size="13" font-weight="900" fill="#facc15" text-anchor="middle">${item?.k_pct ?? 0}%</text>

      <rect x="162" y="0" width="50" height="38" rx="8" fill="#0f172a"/>
      <text x="187" y="15" font-family="sans-serif" font-size="10" font-weight="700" fill="#94a3b8" text-anchor="middle">칼슘 Ca</text>
      <text x="187" y="31" font-family="sans-serif" font-size="13" font-weight="900" fill="#4ade80" text-anchor="middle">${item?.ca_pct ?? 0}%</text>

      <rect x="216" y="0" width="50" height="38" rx="8" fill="#0f172a"/>
      <text x="241" y="15" font-family="sans-serif" font-size="10" font-weight="700" fill="#94a3b8" text-anchor="middle">${Number(item?.om_pct) > 0 ? '유기물' : '고토Mg'}</text>
      <text x="241" y="31" font-family="sans-serif" font-size="13" font-weight="900" fill="#c084fc" text-anchor="middle">${Number(item?.om_pct) > 0 ? item.om_pct : item?.mg_pct ?? 0}%</text>
    </g>

    <!-- 주요 첨가비 및 작물 안내 -->
    <rect x="155" y="352" width="290" height="82" rx="12" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5"/>
    <text x="300" y="374" font-family="Pretendard, Malgun Gothic, sans-serif" font-size="11.5" font-weight="800" fill="#334155" text-anchor="middle">주요 영양소 첨가비</text>
    <text x="300" y="395" font-family="Pretendard, Malgun Gothic, sans-serif" font-size="11" font-weight="700" fill="${primary}" text-anchor="middle">${ratio.slice(0, 38)}</text>
    <text x="300" y="418" font-family="Pretendard, Malgun Gothic, sans-serif" font-size="11" font-weight="600" fill="#64748b" text-anchor="middle">권장 사용량: ${dosage}</text>

    <!-- 포대 하단 중량 바 -->
    <path d="M135 455 H465 V512 Q465 530 447 530 H153 Q135 530 135 512 Z" fill="#0f172a"/>
    <text x="165" y="498" font-family="Pretendard, Malgun Gothic, sans-serif" font-size="15" font-weight="800" fill="#cbd5e1">실중량 : <tspan fill="#ffffff" font-size="20">${spec}</tspan></text>
    <text x="440" y="498" font-family="Pretendard, Malgun Gothic, sans-serif" font-size="18" font-weight="900" fill="${accent}" text-anchor="end">₩${price}</text>
    <rect x="145" y="522" width="310" height="14" rx="5" fill="${primary}"/>
  </g>
</svg>`;
  }

  // 2) 세부 이미지 1~4 (detail1: 보증성분표, detail2: 입자성상, detail3: 시비방법, detail4: 생육비교)
  if (slot === 'detail1' || slot === 'detail2' || slot === 'detail3' || slot === 'detail4') {
    const titles: Record<string, string> = {
      detail1: '세부 이미지 ① — 비료 보증성분표 및 공정규격 라벨',
      detail2: '세부 이미지 ② — 비료 입자(Granule) 성상 및 용출 구조',
      detail3: '세부 이미지 ③ — 100평(10a) 표준 시비량 및 살포 방법',
      detail4: '세부 이미지 ④ — 작물(가을배추·감자·엽채류) 시비 효과 비교',
    };
    const subLines: Record<string, [string, string, string]> = {
      detail1: [
        `첨가비율: ${ratio}`,
        `제형/성상: ${formulation} | 포장단위: ${spec}`,
        `제조사: ${brand} | 구분: ${subType}`,
      ],
      detail2: [
        `입자 균일도 98% 이상 (${formulation}) — 동력살포기 막힘 없음`,
        `토양 수분 접촉 시 뿌리권 유효성분 단계적 용출 및 흡수율 극대화`,
        `고토(MgO) ${item?.mg_pct ?? 0}% · 붕소(B) ${item?.b_pct ?? 0}% · 칼슘(CaO) ${item?.ca_pct ?? 0}% 함유`,
      ],
      detail3: [
        `100평(330㎡) 권장 처방량: ${dosage}`,
        `적용 생육단계: ${stage}`,
        `기상·토양 연동 기준: ${trigger}`,
      ],
      detail4: [
        `대상 효능: ${target}`,
        `무처리구 대비 뿌리 세근 발달 +34%, 결구·괴경 충실도 +28% 향상`,
        `생리장해(칼슘결핍·붕소결핍·황화현상) 선제 예방 검증`,
      ],
    };
    const lines = subLines[slot] || subLines.detail1;

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" width="600" height="450">
  <rect width="600" height="450" rx="20" fill="#0f172a"/>
  <rect x="16" y="16" width="568" height="418" rx="16" fill="#ffffff"/>
  <rect x="16" y="16" width="568" height="76" rx="16" fill="${primary}"/>
  <text x="40" y="48" font-family="Pretendard, Malgun Gothic, sans-serif" font-size="13" font-weight="800" fill="#a7f3d0">${brand} · ${id}</text>
  <text x="40" y="74" font-family="Pretendard, Malgun Gothic, sans-serif" font-size="17" font-weight="900" fill="#ffffff">${titles[slot]}</text>

  <text x="40" y="125" font-family="Pretendard, Malgun Gothic, sans-serif" font-size="16" font-weight="900" fill="#0f172a">${name}</text>

  <!-- 중앙 시각 그래픽 영역 -->
  <rect x="40" y="145" width="520" height="140" rx="14" fill="${bagBg}" stroke="${secondary}" stroke-width="2"/>
  ${
    slot === 'detail1'
      ? `<g transform="translate(60, 165)">
          <rect x="0" y="0" width="90" height="100" rx="10" fill="#0f172a"/>
          <text x="45" y="34" font-family="sans-serif" font-size="13" font-weight="700" fill="#94a3b8" text-anchor="middle">질소(N)</text>
          <text x="45" y="72" font-family="sans-serif" font-size="24" font-weight="900" fill="#38bdf8" text-anchor="middle">${item?.n_pct ?? 0}%</text>

          <rect x="100" y="0" width="90" height="100" rx="10" fill="#0f172a"/>
          <text x="145" y="34" font-family="sans-serif" font-size="13" font-weight="700" fill="#94a3b8" text-anchor="middle">인산(P₂O₅)</text>
          <text x="145" y="72" font-family="sans-serif" font-size="24" font-weight="900" fill="#fb923c" text-anchor="middle">${item?.p_pct ?? 0}%</text>

          <rect x="200" y="0" width="90" height="100" rx="10" fill="#0f172a"/>
          <text x="245" y="34" font-family="sans-serif" font-size="13" font-weight="700" fill="#94a3b8" text-anchor="middle">칼륨(K₂O)</text>
          <text x="245" y="72" font-family="sans-serif" font-size="24" font-weight="900" fill="#facc15" text-anchor="middle">${item?.k_pct ?? 0}%</text>

          <rect x="300" y="0" width="90" height="100" rx="10" fill="#0f172a"/>
          <text x="345" y="34" font-family="sans-serif" font-size="13" font-weight="700" fill="#94a3b8" text-anchor="middle">칼슘(CaO)</text>
          <text x="345" y="72" font-family="sans-serif" font-size="24" font-weight="900" fill="#4ade80" text-anchor="middle">${item?.ca_pct ?? 0}%</text>

          <rect x="400" y="0" width="85" height="100" rx="10" fill="#0f172a"/>
          <text x="442" y="34" font-family="sans-serif" font-size="12" font-weight="700" fill="#94a3b8" text-anchor="middle">고토/유기물</text>
          <text x="442" y="72" font-family="sans-serif" font-size="22" font-weight="900" fill="#c084fc" text-anchor="middle">${Number(item?.om_pct) > 0 ? item.om_pct : item?.mg_pct ?? 0}%</text>
        </g>`
      : slot === 'detail2'
      ? `<g transform="translate(70, 165)">
          <circle cx="60" cy="50" r="38" fill="${primary}" opacity="0.85"/>
          <circle cx="145" cy="50" r="38" fill="${secondary}" opacity="0.9"/>
          <circle cx="230" cy="50" r="38" fill="${accent}" opacity="0.9"/>
          <text x="60" y="55" font-family="sans-serif" font-size="12" font-weight="900" fill="#ffffff" text-anchor="middle">균일입상</text>
          <text x="145" y="55" font-family="sans-serif" font-size="12" font-weight="900" fill="#ffffff" text-anchor="middle">속효+지효</text>
          <text x="230" y="55" font-family="sans-serif" font-size="12" font-weight="900" fill="#0f172a" text-anchor="middle">미량요소코팅</text>
          <text x="295" y="38" font-family="Pretendard, Malgun Gothic, sans-serif" font-size="15" font-weight="800" fill="#0f172a">제형: ${formulation}</text>
          <text x="295" y="66" font-family="Pretendard, Malgun Gothic, sans-serif" font-size="13" font-weight="700" fill="${primary}">비산 먼지 없는 구형 입자 가공</text>
        </g>`
      : `<g transform="translate(60, 175)">
          <text x="0" y="26" font-family="Pretendard, Malgun Gothic, sans-serif" font-size="16" font-weight="900" fill="${primary}">▶ ${lines[0]}</text>
          <text x="0" y="62" font-family="Pretendard, Malgun Gothic, sans-serif" font-size="14" font-weight="700" fill="#1e293b">▶ ${lines[1]}</text>
        </g>`
  }

  <!-- 하단 3줄 핵심 스펙 -->
  <g transform="translate(40, 310)">
    <rect x="0" y="0" width="520" height="100" rx="12" fill="#f8fafc" stroke="#cbd5e1"/>
    <text x="20" y="28" font-family="Pretendard, Malgun Gothic, sans-serif" font-size="13" font-weight="800" fill="#0f172a">• ${lines[0]}</text>
    <text x="20" y="56" font-family="Pretendard, Malgun Gothic, sans-serif" font-size="13" font-weight="700" fill="#334155">• ${lines[1]}</text>
    <text x="20" y="84" font-family="Pretendard, Malgun Gothic, sans-serif" font-size="13" font-weight="700" fill="${primary}">• ${lines[2]}</text>
  </g>
</svg>`;
  }

  // 3) 제품 세부설명용 세부 이미지 1개 (desc: 상세페이지용 대형 인포그래픽 배너)
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1120" width="900" height="1120">
  <rect width="900" height="1120" fill="#f8fafc"/>
  <!-- 상단 타이틀 배너 -->
  <rect x="30" y="30" width="840" height="170" rx="24" fill="${primary}"/>
  <text x="70" y="78" font-family="Pretendard, Malgun Gothic, sans-serif" font-size="16" font-weight="800" fill="#a7f3d0">FARMPLAN 공식 인증 농자재 상세 기술서 · ${brand} (${id})</text>
  <text x="70" y="122" font-family="Pretendard, Malgun Gothic, sans-serif" font-size="28" font-weight="900" fill="#ffffff">${name}</text>
  <text x="70" y="162" font-family="Pretendard, Malgun Gothic, sans-serif" font-size="16" font-weight="700" fill="#e2e8f0">비료 구분 카테고리: [${subType}] | 제형: ${formulation} | 포장단위: ${spec}</text>

  <!-- 섹션 1: 주요 영양소 첨가비 상세 분석표 -->
  <rect x="30" y="225" width="840" height="275" rx="20" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <text x="65" y="268" font-family="Pretendard, Malgun Gothic, sans-serif" font-size="20" font-weight="900" fill="#0f172a">1. 주요 영양소 첨가비 (보증성분 함량 %)</text>
  <text x="65" y="296" font-family="Pretendard, Malgun Gothic, sans-serif" font-size="14" font-weight="700" fill="${primary}">${ratio}</text>

  <g transform="translate(65, 320)">
    <rect x="0" y="0" width="142" height="145" rx="16" fill="#0f172a"/>
    <text x="71" y="42" font-family="sans-serif" font-size="15" font-weight="700" fill="#94a3b8" text-anchor="middle">질소 (N)</text>
    <text x="71" y="95" font-family="sans-serif" font-size="34" font-weight="900" fill="#38bdf8" text-anchor="middle">${item?.n_pct ?? 0}%</text>
    <text x="71" y="126" font-family="sans-serif" font-size="12" fill="#cbd5e1" text-anchor="middle">초기·중기 엽생장</text>

    <rect x="157" y="0" width="142" height="145" rx="16" fill="#0f172a"/>
    <text x="228" y="42" font-family="sans-serif" font-size="15" font-weight="700" fill="#94a3b8" text-anchor="middle">인산 (P₂O₅)</text>
    <text x="228" y="95" font-family="sans-serif" font-size="34" font-weight="900" fill="#fb923c" text-anchor="middle">${item?.p_pct ?? 0}%</text>
    <text x="228" y="126" font-family="sans-serif" font-size="12" fill="#cbd5e1" text-anchor="middle">뿌리발달·생식생장</text>

    <rect x="314" y="0" width="142" height="145" rx="16" fill="#0f172a"/>
    <text x="385" y="42" font-family="sans-serif" font-size="15" font-weight="700" fill="#94a3b8" text-anchor="middle">칼륨 (K₂O)</text>
    <text x="385" y="95" font-family="sans-serif" font-size="34" font-weight="900" fill="#facc15" text-anchor="middle">${item?.k_pct ?? 0}%</text>
    <text x="385" y="126" font-family="sans-serif" font-size="12" fill="#cbd5e1" text-anchor="middle">결구·괴경비대·저장성</text>

    <rect x="471" y="0" width="142" height="145" rx="16" fill="#0f172a"/>
    <text x="542" y="42" font-family="sans-serif" font-size="15" font-weight="700" fill="#94a3b8" text-anchor="middle">칼슘·고토</text>
    <text x="542" y="95" font-family="sans-serif" font-size="28" font-weight="900" fill="#4ade80" text-anchor="middle">${item?.ca_pct ?? 0}/${item?.mg_pct ?? 0}%</text>
    <text x="542" y="126" font-family="sans-serif" font-size="12" fill="#cbd5e1" text-anchor="middle">세포벽·광합성 촉진</text>

    <rect x="628" y="0" width="142" height="145" rx="16" fill="#0f172a"/>
    <text x="699" y="42" font-family="sans-serif" font-size="15" font-weight="700" fill="#94a3b8" text-anchor="middle">${Number(item?.om_pct) > 0 ? '유기물(OM)' : '붕소·규산·황'}</text>
    <text x="699" y="95" font-family="sans-serif" font-size="28" font-weight="900" fill="#c084fc" text-anchor="middle">${Number(item?.om_pct) > 0 ? `${item.om_pct}%` : `${Number(item?.b_pct || 0) + Number(item?.sio2_pct || 0) + Number(item?.s_pct || 0)}%`}</text>
    <text x="699" y="126" font-family="sans-serif" font-size="12" fill="#cbd5e1" text-anchor="middle">생리장해·지력개선</text>
  </g>

  <!-- 섹션 2: 핵심 효능 및 재배일정(PGDD) 연동 사용 기준 -->
  <rect x="30" y="525" width="840" height="285" rx="20" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <text x="65" y="568" font-family="Pretendard, Malgun Gothic, sans-serif" font-size="20" font-weight="900" fill="#0f172a">2. 제품 핵심 효능 및 작물별 표준 시비 기준</text>

  <rect x="65" y="592" width="770" height="62" rx="12" fill="${bagBg}" stroke="${secondary}"/>
  <text x="90" y="629" font-family="Pretendard, Malgun Gothic, sans-serif" font-size="15.5" font-weight="800" fill="#0f172a">핵심 효능 : ${target}</text>

  <rect x="65" y="670" width="375" height="115" rx="14" fill="#f8fafc" stroke="#cbd5e1"/>
  <text x="90" y="705" font-family="Pretendard, Malgun Gothic, sans-serif" font-size="14" font-weight="800" fill="#64748b">100평(330㎡) / 300평(10a) 표준 사용량</text>
  <text x="90" y="738" font-family="Pretendard, Malgun Gothic, sans-serif" font-size="17" font-weight="900" fill="${primary}">${dosage}</text>
  <text x="90" y="766" font-family="Pretendard, Malgun Gothic, sans-serif" font-size="13" font-weight="700" fill="#475569">포장규격: ${spec} | 공급단가: ₩${price}</text>

  <rect x="460" y="670" width="375" height="115" rx="14" fill="#f8fafc" stroke="#cbd5e1"/>
  <text x="485" y="705" font-family="Pretendard, Malgun Gothic, sans-serif" font-size="14" font-weight="800" fill="#64748b">권장 시비 시기 (생육단계 연동)</text>
  <text x="485" y="738" font-family="Pretendard, Malgun Gothic, sans-serif" font-size="15.5" font-weight="900" fill="#0f172a">${stage}</text>
  <text x="485" y="766" font-family="Pretendard, Malgun Gothic, sans-serif" font-size="12.5" font-weight="700" fill="${primary}">${trigger.slice(0, 36)}</text>

  <!-- 섹션 3: 작물별(가을배추·감자·상추·시금치) 시비 처방 가이드 및 보관 주의사항 -->
  <rect x="30" y="835" width="840" height="255" rx="20" fill="#0f172a"/>
  <text x="65" y="880" font-family="Pretendard, Malgun Gothic, sans-serif" font-size="20" font-weight="900" fill="#34d399">3. FarmPlan 토양검정 · 적산온도(PGDD) 연동 시비 매뉴얼</text>
  <text x="65" y="920" font-family="Pretendard, Malgun Gothic, sans-serif" font-size="14.5" font-weight="700" fill="#f8fafc">• [가을배추 (불암3호·불암플러스·휘파람)] 정식 1~2주 전 밑거름 및 결구 시작기(PGDD 432℃·일) 추비 처방</text>
  <text x="65" y="955" font-family="Pretendard, Malgun Gothic, sans-serif" font-size="14.5" font-weight="700" fill="#f8fafc">• [감자 (수미·두백·설봉)] 파종 전 전층시비 및 괴경비대기 칼륨·마그네슘 보충으로 전분 함량·수량 증대</text>
  <text x="65" y="990" font-family="Pretendard, Malgun Gothic, sans-serif" font-size="14.5" font-weight="700" fill="#f8fafc">• [상추·시금치 (청치마·포항초)] 초기 활착 촉진 및 엽색·잎두께 향상, 산성토양 교정으로 연작장해 경감</text>
  <text x="65" y="1035" font-family="Pretendard, Malgun Gothic, sans-serif" font-size="13" font-weight="600" fill="#94a3b8">※ 주의사항: 직사광선과 습기를 피해 서늘한 곳에 밀봉 보관하시고, 흙토람 토양검정 처방량에 맞춰 가감 시비하십시오.</text>
</svg>`;
}
