import React, { useEffect, useState } from 'react';
import { Link } from '../router.tsx';
import {
  Sprout,
  Calendar,
  FileEdit,
  FlaskConical,
  ShieldAlert,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  MapPin,
  Thermometer,
  CloudSun,
  CloudRain,
  Droplets,
  Search,
  User,
  ArrowUpRight,
  Layers,
  Sparkles,
  Bell,
  Home,
  ShoppingBag,
  ShoppingCart,
  Package,
  PackageCheck,
  Truck,
  CreditCard,
  Plus,
  Minus,
  Cpu,
  RotateCcw,
  Trash2,
  Check,
  X,
} from 'lucide-react';

interface OverviewData {
  kpi: {
    totalCropGroups: number;
    totalCrops: number;
    totalCultivars: number;
    totalCroppingSystems: number;
    totalRequests: number;
    climateAlertsCount: number;
    avgModelMaeDays: number;
  };
  groups: any[];
  crops: any[];
  cultivars: any[];
  requests: any[];
  growthTypeCodes?: any[];
  fertilizerCategoryCodes?: any[];
  nutrientCategoryCodes?: any[];
  pesticideCategoryCodes?: any[];
  seedCategoryCodes?: any[];
  seedlingCategoryCodes?: any[];
}

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

function getWeekdayNameFromYmd(ymd?: string): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return '';
  return WEEKDAY_KO[dt.getDay()];
}

function formatYmdWithWeekday(ymd?: string): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd || '-';
  const wk = getWeekdayNameFromYmd(ymd);
  return wk ? `${ymd} (${wk})` : ymd;
}

function formatShortMdWithWeekday(ymd?: string): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd || '-';
  const [, m, d] = ymd.split('-').map(Number);
  const wk = getWeekdayNameFromYmd(ymd);
  return `${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')} (${wk})`;
}

function formatKoreanMdWithWeekday(ymd?: string): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd || '-';
  const [, m, d] = ymd.split('-').map(Number);
  const wk = getWeekdayNameFromYmd(ymd);
  return `${m}월 ${d}일 (${wk})`;
}

function addDaysToYmd(ymd: string, deltaDays: number): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  const ny = dt.getFullYear();
  const nm = String(dt.getMonth() + 1).padStart(2, '0');
  const nd = String(dt.getDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

function diffDaysBetweenYmd(startYmd: string, endYmd: string): number {
  if (!startYmd || !endYmd) return 0;
  const [sy, sm, sd] = startYmd.split('-').map(Number);
  const [ey, em, ed] = endYmd.split('-').map(Number);
  const s = new Date(sy, sm - 1, sd).getTime();
  const e = new Date(ey, em - 1, ed).getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return 0;
  return Math.round((e - s) / 86400000);
}

export default function UserIntroPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [activeMenu, setActiveMenu] = useState<string>('홈');
  const [loggedInUser, setLoggedInUser] = useState<{
    id: string;
    email: string;
    name: string;
    nickname: string;
    gender: string;
    birth_date: string;
    age: number;
    road_address: string;
    road_address_detail: string;
    postal_code: string;
    phone: string;
    signup_type: 'EMAIL' | 'GOOGLE_GMAIL';
    farmTitle: string;
    isLoggedIn: boolean;
  }>(() => {
    const baseUser = {
      id: '배철민',
      email: 'CloudBae@naver.com',
      name: '배철민',
      nickname: 'CloudBae',
      gender: '남성',
      birth_date: '1978-05-15',
      age: 48,
      road_address: '충청북도 충주시 충원대로 268 (단월동)',
      road_address_detail: '한팜스마트농원 101호',
      postal_code: '27481',
      phone: '010-2026-0109',
      signup_type: 'EMAIL' as const,
      farmTitle: '배철민 님의 농장',
      isLoggedIn: false,
    };
    try {
      const saved = localStorage.getItem('hanfarm_auth_session_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return { ...baseUser, ...parsed };
        }
      }
    } catch {
      // ignore
    }
    return baseUser;
  });

  // ==================== 로그인 / 회원가입 (이메일 · Google Gmail) / 비밀번호 찾기 & 마이페이지 상태 ====================
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalTab, setAuthModalTab] = useState<'LOGIN' | 'SIGNUP' | 'FIND_PASSWORD'>('LOGIN');
  const [authNoticeMsg, setAuthNoticeMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 로그인 폼 (기본값 CloudBae@naver.com / 1234)
  const [loginForm, setLoginForm] = useState({
    email: 'CloudBae@naver.com',
    password: '1234',
    gmailAccount: 'cloudbae.farm@gmail.com',
  });
  const [showGmailPicker, setShowGmailPicker] = useState<boolean>(false);

  // 회원가입 폼 (이메일 중복검사, 비밀번호, 이름, 성별, 출생년월일, 나이, 주소(도로명))
  const [signupForm, setSignupForm] = useState<{
    signup_type: 'EMAIL' | 'GOOGLE_GMAIL';
    email: string;
    emailChecked: boolean;
    emailCheckMsg: string;
    password: string;
    passwordConfirm: string;
    name: string;
    gender: '남성' | '여성';
    birth_date: string;
    age: number;
    road_address: string;
    road_address_detail: string;
    postal_code: string;
    phone: string;
  }>({
    signup_type: 'EMAIL',
    email: '',
    emailChecked: false,
    emailCheckMsg: '',
    password: '',
    passwordConfirm: '',
    name: '',
    gender: '남성',
    birth_date: '1980-05-15',
    age: 46,
    road_address: '',
    road_address_detail: '',
    postal_code: '27481',
    phone: '010-2026-0109',
  });

  // 도로명 주소 검색 상태 (회원가입 & 프로필 수정용)
  const [roadSearchKeyword, setRoadSearchKeyword] = useState<string>('충원대로');
  const [roadSearchResults, setRoadSearchResults] = useState<any[]>([]);
  const [isRoadSearching, setIsRoadSearching] = useState<boolean>(false);
  const [showRoadSearchBox, setShowRoadSearchBox] = useState<boolean>(false);

  // 비밀번호 찾기 상태
  const [findPwForm, setFindPwForm] = useState({
    email: 'CloudBae@naver.com',
    name: '배철민',
    birth_date: '1978-05-15',
    verified: false,
    verifiedMsg: '',
    new_password: '',
    new_password_confirm: '',
  });

  // 마이페이지 데이터 상태 (재배지 등록, 재배작물 등록, 작물재배현황 및 진행율, 농자재 구매현황)
  const [myPageTab, setMyPageTab] = useState<
    'ALL' | 'FARMLAND' | 'CROPS' | 'PROGRESS' | 'ORDERS' | 'PROFILE'
  >('FARMLAND');
  const [isMobileGnbDrawerOpen, setIsMobileGnbDrawerOpen] = useState<boolean>(false);
  const [isMyPageMobileDrawerOpen, setIsMyPageMobileDrawerOpen] = useState<boolean>(false);
  const [myFarmlands, setMyFarmlands] = useState<any[]>([]);
  const [myCropPlans, setMyCropPlans] = useState<any[]>([]);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [myPageToast, setMyPageToast] = useState<string>('');

  // 관리자 페이지 재배지 관리 DB (cultivation_address: 시도, 시군구, 읍면동) 검색 연동 상태
  const [adminAddrMeta, setAdminAddrMeta] = useState<{
    sidos: string[];
    sigungusBySido: Record<string, string[]>;
  }>({ sidos: [], sigungusBySido: {} });
  const [farmlandSearchSido, setFarmlandSearchSido] = useState<string>('충청북도');
  const [farmlandSearchSigungu, setFarmlandSearchSigungu] = useState<string>('충주시');
  const [farmlandSearchQuery, setFarmlandSearchQuery] = useState<string>('');
  const [adminDbAddresses, setAdminDbAddresses] = useState<any[]>([]);
  const [newFarmlandForm, setNewFarmlandForm] = useState({
    sido: '충청북도',
    sigungu: '충주시',
    eupmyeondong: '단월동',
    bjd_code: '4313010700',
    farmland_title: '충주 단월 제3배추밭',
    detail_jibun: '425-1번지 일원',
    area_pyeong: 350,
    soil_ph: 6.3,
    soil_ec: 1.1,
  });

  // 마이페이지 재배작물 등록 폼 (복수 등록 가능)
  const [newCropPlanForm, setNewCropPlanForm] = useState({
    farmland_id: 'LAND-CB-01',
    sido: '충청북도',
    sigungu: '충주시',
    eupmyeondong: '단월동',
    crop_name: '가을배추',
    cultivar_name: '불암3호',
    planting_type: '모종',
    area_pyeong: 300,
    planting_date: '2026-08-25',
    progress_pct: 35,
  });

  // 재배일정 확인 (회원 CloudBae 기준) 상태
  const [provisionData, setProvisionData] = useState<any>(null);
  const [isProvisionLoading, setIsProvisionLoading] = useState<boolean>(false);
  const [selectedRequestNo, setSelectedRequestNo] = useState<string>('REQ-20261106-009');
  const [expandedScheduleRequestNo, setExpandedScheduleRequestNo] = useState<string | null>(null);
  const [selectedStageItem, setSelectedStageItem] = useState<any>(null);
  const [editDetailForm, setEditDetailForm] = useState<any>(null);
  const [isSavingDetailItem, setIsSavingDetailItem] = useState<boolean>(false);
  const [detailSaveMessage, setDetailSaveMessage] = useState<string>('');

  // 모바일 단계 전환: 'list' (1단계 작물재배 리스트) -> 'detail' (2·3단계 선택 작물 상세)
  const [mobileScheduleStep, setMobileScheduleStep] = useState<'list' | 'detail'>('list');

  // 3가지 일정 보기 탭: 'timeline' (타임라인) | 'calendar' (달력) | 'stages' (생육단계)
  const [scheduleViewMode, setScheduleViewMode] = useState<'timeline' | 'calendar' | 'stages'>('timeline');
  const [calendarYearMonth, setCalendarYearMonth] = useState<{ year: number; month: number }>({
    year: 2026,
    month: 9,
  });
  const [expandedStageGroupCode, setExpandedStageGroupCode] = useState<string>('ALL');

  // PC 하단 연간 타임라인 보기 모드 & 특허 A/B/C/D 탭
  const [pcTimelineMode, setPcTimelineMode] = useState<'calendar' | 'diagram'>('calendar');
  const [patentActiveTab, setPatentActiveTab] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [patentGddMode, setPatentGddMode] = useState<'effective' | 'raw'>('effective');

  // 관리자 페이지와 동일한 생육과정 클릭/오버 풍선(말풍선) 설명영역 및 [세부 정보 보기 ›] 모달리스 폼 상태
  const [hoveredProvisionItem, setHoveredProvisionItem] = useState<any>(null);
  const [clickedProvisionItem, setClickedProvisionItem] = useState<any>(null);
  const [detailModalPos, setDetailModalPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingDetailModal, setIsDraggingDetailModal] = useState<boolean>(false);
  const detailDragStartRef = React.useRef<{
    mouseX: number;
    mouseY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const [hoverAnchorPos, setHoverAnchorPos] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
    showAbove: boolean;
  }>({
    top: 120,
    left: 240,
    width: 220,
    height: 36,
    showAbove: false,
  });
  const hoverCloseTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInsideHoverBubbleRef = React.useRef<boolean>(false);
  const isInsideGrowthItemRef = React.useRef<boolean>(false);
  const isBubbleLockedByClickRef = React.useRef<boolean>(false);
  const [selectedCatalogMatId, setSelectedCatalogMatId] = useState<string>('FERT-PRD-01');
  const [newCustomMatForm, setNewCustomMatForm] = useState<{
    sub_type: string;
    manufacturer: string;
    product_name: string;
    unit_spec: string;
    nutrient_ratio_summary: string;
    recommended_for_area: string;
    unit_price: number;
  }>({
    sub_type: '복합비료',
    manufacturer: '누보',
    product_name: '',
    unit_spec: '20kg/포',
    nutrient_ratio_summary: '',
    recommended_for_area: '',
    unit_price: 18000,
  });

  const cancelHoverBubbleClose = () => {
    if (hoverCloseTimerRef.current) {
      clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  };

  const scheduleHoverBubbleClose = (delayMs = 110) => {
    cancelHoverBubbleClose();
    hoverCloseTimerRef.current = setTimeout(() => {
      if (isBubbleLockedByClickRef.current) return;
      if (!isInsideHoverBubbleRef.current && !isInsideGrowthItemRef.current) {
        setHoveredProvisionItem(null);
      }
    }, delayMs);
  };

  const handleStartDetailModalDrag = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, select, input, a, textarea, label')) {
      return;
    }
    e.preventDefault();
    setIsDraggingDetailModal(true);
    detailDragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: detailModalPos.x,
      startY: detailModalPos.y,
    };
  };

  useEffect(() => {
    if (!isDraggingDetailModal) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingDetailModal && detailDragStartRef.current) {
        const dx = e.clientX - detailDragStartRef.current.mouseX;
        const dy = e.clientY - detailDragStartRef.current.mouseY;
        setDetailModalPos({
          x: detailDragStartRef.current.startX + dx,
          y: detailDragStartRef.current.startY + dy,
        });
      }
    };
    const handleMouseUp = () => {
      setIsDraggingDetailModal(false);
      detailDragStartRef.current = null;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingDetailModal]);

  useEffect(() => {
    setHoveredProvisionItem(null);
    setClickedProvisionItem(null);
  }, [selectedRequestNo, activeMenu]);

  // 오늘 할 일 체크리스트 상태
  const [todayTasks, setTodayTasks] = useState([
    {
      id: 'todo-1',
      title: '배추 병해충 예찰',
      desc: '잎 뒷면과 결구부의 병징·충해 확인',
      status: '예정',
      done: false,
    },
    {
      id: 'todo-2',
      title: '관수·배수 상태 확인',
      desc: '생육 적온(18~20℃) 유지 및 고랑 배수 점검',
      status: '예정',
      done: false,
    },
  ]);

  const [prescriptions, setPrescriptions] = useState<any>({ materials: [] });
  const [isScheduleReqModelessOpen, setIsScheduleReqModelessOpen] = useState<boolean>(false);
  const [scheduleReqModalPos, setScheduleReqModalPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingScheduleReqModal, setIsDraggingScheduleReqModal] = useState<boolean>(false);
  const scheduleReqDragStartRef = React.useRef<{
    mouseX: number;
    mouseY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const [selectedReqDetailCrop, setSelectedReqDetailCrop] = useState<any | null>(null);
  const [reqDetailModalPos, setReqDetailModalPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingReqDetailModal, setIsDraggingReqDetailModal] = useState<boolean>(false);
  const reqDetailDragStartRef = React.useRef<{
    mouseX: number;
    mouseY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const [localAddedCropRequests, setLocalAddedCropRequests] = useState<any[]>([]);
  const [reqFormSubmitted, setReqFormSubmitted] = useState<boolean>(false);
  const [reqForm, setReqForm] = useState({
    farmland_id: 'LAND-CB-01',
    sido: '충청북도',
    sigungu: '충주시',
    eupmyeondong: '단월동',
    crop_name: '가을배추',
    cultivar_name: '불암3호',
    planting_type: '모종',
    planting_date: '2026-08-25',
    area_pyeong: 300,
    soil_ph: 6.2,
    soil_ec: 1.1,
  });

  const handleStartScheduleReqModalDrag = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, select, input, a, textarea, label')) {
      return;
    }
    e.preventDefault();
    setIsDraggingScheduleReqModal(true);
    scheduleReqDragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: scheduleReqModalPos.x,
      startY: scheduleReqModalPos.y,
    };
  };

  useEffect(() => {
    if (!isDraggingScheduleReqModal) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingScheduleReqModal && scheduleReqDragStartRef.current) {
        const dx = e.clientX - scheduleReqDragStartRef.current.mouseX;
        const dy = e.clientY - scheduleReqDragStartRef.current.mouseY;
        setScheduleReqModalPos({
          x: scheduleReqDragStartRef.current.startX + dx,
          y: scheduleReqDragStartRef.current.startY + dy,
        });
      }
    };
    const handleMouseUp = () => {
      setIsDraggingScheduleReqModal(false);
      scheduleReqDragStartRef.current = null;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingScheduleReqModal]);

  const handleStartReqDetailModalDrag = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, select, input, a, textarea, label')) {
      return;
    }
    e.preventDefault();
    setIsDraggingReqDetailModal(true);
    reqDetailDragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: reqDetailModalPos.x,
      startY: reqDetailModalPos.y,
    };
  };

  useEffect(() => {
    if (!isDraggingReqDetailModal) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingReqDetailModal && reqDetailDragStartRef.current) {
        const dx = e.clientX - reqDetailDragStartRef.current.mouseX;
        const dy = e.clientY - reqDetailDragStartRef.current.mouseY;
        setReqDetailModalPos({
          x: reqDetailDragStartRef.current.startX + dx,
          y: reqDetailDragStartRef.current.startY + dy,
        });
      }
    };
    const handleMouseUp = () => {
      setIsDraggingReqDetailModal(false);
      reqDetailDragStartRef.current = null;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingReqDetailModal]);

  const userMenus = ['홈', '재배일정 요청', '재배일정 확인', '농작물 구매', '마이페이지'];

  // CloudBae@naver.com (배철민) 회원의 전체 등록 재배작물 리스트 (관리자 페이지의 재배일정 요청 9건 & 제공 일정 데이터와 1:1 매칭)
  const defaultCloudBaeCropList = [
    {
      crop_plan_id: 'CPLAN-CB-01',
      request_no: 'REQ-20261106-009',
      crop_title: '가을배추 (불암3호)',
      crop_short: '가을배추',
      cultivar_name: '불암3호',
      badge: '노지 정식(모종)',
      region: '충청북도 충주시 단월동',
      area_pyeong: 1000,
      planting_type: '모종',
      planting_label: '정식 2026.08.25 (화)',
      planting_date: '2026-08-25',
      expected_harvest_date: '2026-11-15',
      current_stage_name: '04. 생육 관리 (2차 웃거름·결구중기)',
      progress_pct: 60,
      status_text: '생육 확인 필요 · 결구 진행중',
      temp_avg: '18.5°C',
      rain_mm: '5mm',
      next_task_dday: '2일 후',
      opt_temp: '18~20℃ 적온',
      thumb_gradient: 'from-emerald-700 via-green-600 to-teal-800',
    },
    {
      crop_plan_id: 'CPLAN-CB-02',
      request_no: 'REQ-20261106-008',
      crop_title: '시금치 (포항초)',
      crop_short: '시금치',
      cultivar_name: '포항초 (재래종)',
      badge: '노지 직파(씨)',
      region: '제주특별자치도 서귀포시 성산읍',
      area_pyeong: 3500,
      planting_type: '씨 (적정발아 20℃)',
      planting_label: '파종 2026.09.25 (금)',
      planting_date: '2026-09-25',
      expected_harvest_date: '2026-12-20',
      current_stage_name: '04. 생육 관리 (초기 생육·추비관리)',
      progress_pct: 55,
      status_text: '생육 양호 · 적기 관수중',
      temp_avg: '19.2°C',
      rain_mm: '3mm',
      next_task_dday: '3일 후',
      opt_temp: '15~20℃ 적온',
      thumb_gradient: 'from-green-700 via-emerald-600 to-lime-800',
    },
    {
      crop_plan_id: 'CPLAN-CB-03',
      request_no: 'REQ-20261105-007',
      crop_title: '감자 (두백)',
      crop_short: '감자',
      cultivar_name: '두백',
      badge: '노지 직파(종서)',
      region: '경상남도 밀양시 하남읍',
      area_pyeong: 1800,
      planting_type: '씨 (종서파종)',
      planting_label: '파종 2026.03.10 (화)',
      planting_date: '2026-03-10',
      expected_harvest_date: '2026-06-25',
      current_stage_name: '06. 수확 완료',
      progress_pct: 100,
      status_text: '수확 완료 · 이력 반영',
      temp_avg: '17.4°C',
      rain_mm: '0mm',
      next_task_dday: '완료',
      opt_temp: '15~18℃ 적온',
      thumb_gradient: 'from-teal-700 via-emerald-600 to-cyan-800',
    },
    {
      crop_plan_id: 'CPLAN-CB-04',
      request_no: 'REQ-20261104-006',
      crop_title: '감자 (설봉)',
      crop_short: '감자',
      cultivar_name: '설봉',
      badge: '노지 직파(종서)',
      region: '경기도 이천시 장호원읍',
      area_pyeong: 1500,
      planting_type: '씨 (종서파종)',
      planting_label: '파종 2026.08.15 (토)',
      planting_date: '2026-08-15',
      expected_harvest_date: '2026-11-10',
      current_stage_name: '05. 병해충 예찰 (결구·비대후기 방제)',
      progress_pct: 75,
      status_text: '비대 진행 양호',
      temp_avg: '18.0°C',
      rain_mm: '2mm',
      next_task_dday: '4일 후',
      opt_temp: '16~20℃ 적온',
      thumb_gradient: 'from-emerald-700 via-green-600 to-teal-800',
    },
    {
      crop_plan_id: 'CPLAN-CB-05',
      request_no: 'REQ-20261104-005',
      crop_title: '상추 (청치마상추)',
      crop_short: '상추',
      cultivar_name: '청치마상추',
      badge: '시설 정식(모종)',
      region: '충청남도 논산시 연무읍',
      area_pyeong: 600,
      planting_type: '모종',
      planting_label: '정식 2026.09.05 (토)',
      planting_date: '2026-09-05',
      expected_harvest_date: '2026-10-25',
      current_stage_name: '06. 수확 완료',
      progress_pct: 100,
      status_text: '수확 완료 · 출하 완료',
      temp_avg: '18.8°C',
      rain_mm: '0mm',
      next_task_dday: '완료',
      opt_temp: '15~20℃ 적온',
      thumb_gradient: 'from-green-700 via-emerald-600 to-lime-800',
    },
    {
      crop_plan_id: 'CPLAN-CB-06',
      request_no: 'REQ-20261103-004',
      crop_title: '가을배추 (휘파람골드)',
      crop_short: '가을배추',
      cultivar_name: '휘파람골드',
      badge: '노지 정식(모종)',
      region: '경상북도 안동시 풍산읍',
      area_pyeong: 850,
      planting_type: '모종',
      planting_label: '정식 2026.08.28 (금)',
      planting_date: '2026-08-28',
      expected_harvest_date: '2026-11-15',
      current_stage_name: '05. 병해충 예찰 (결구기 칼슘·살균방제)',
      progress_pct: 72,
      status_text: '결구 진행 양호',
      temp_avg: '17.9°C',
      rain_mm: '4mm',
      next_task_dday: '3일 후',
      opt_temp: '18~20℃ 적온',
      thumb_gradient: 'from-teal-700 via-emerald-600 to-cyan-800',
    },
    {
      crop_plan_id: 'CPLAN-CB-07',
      request_no: 'REQ-20261102-003',
      crop_title: '감자 (수미)',
      crop_short: '감자',
      cultivar_name: '수미 (Superior)',
      badge: '고랭지 직파(종서)',
      region: '강원특별자치도 평창군 대관령면',
      area_pyeong: 3000,
      planting_type: '씨 (종서파종)',
      planting_label: '파종 2026.04.15 (수)',
      planting_date: '2026-04-15',
      expected_harvest_date: '2026-07-28',
      current_stage_name: '06. 수확 완료',
      progress_pct: 100,
      status_text: '수확 완료 · 이력 반영',
      temp_avg: '16.5°C',
      rain_mm: '0mm',
      next_task_dday: '완료',
      opt_temp: '15~18℃ 적온',
      thumb_gradient: 'from-emerald-700 via-green-600 to-teal-800',
    },
    {
      crop_plan_id: 'CPLAN-CB-08',
      request_no: 'REQ-20261102-002',
      crop_title: '가을배추 (휘파람)',
      crop_short: '가을배추',
      cultivar_name: '휘파람',
      badge: '유기농 정식(모종)',
      region: '전라남도 해남군 옥천면',
      area_pyeong: 2500,
      planting_type: '모종',
      planting_label: '정식 2026.09.05 (토)',
      planting_date: '2026-09-05',
      expected_harvest_date: '2026-12-05',
      current_stage_name: '04. 생육 관리 (친환경 유박 추비기)',
      progress_pct: 58,
      status_text: '친환경 생육 관리중',
      temp_avg: '19.0°C',
      rain_mm: '5mm',
      next_task_dday: '2일 후',
      opt_temp: '18~20℃ 적온',
      thumb_gradient: 'from-green-700 via-emerald-600 to-lime-800',
    },
    {
      crop_plan_id: 'CPLAN-CB-09',
      request_no: 'REQ-20261101-001',
      crop_title: '가을배추 (불암플러스)',
      crop_short: '가을배추',
      cultivar_name: '불암플러스',
      badge: '노지 정식(모종)',
      region: '충청북도 충주시 산척면',
      area_pyeong: 1200,
      planting_type: '모종',
      planting_label: '정식 2026.08.25 (화)',
      planting_date: '2026-08-25',
      expected_harvest_date: '2026-11-16',
      current_stage_name: '05. 병해충 예찰 (결구후기 수확대비)',
      progress_pct: 80,
      status_text: '수확 예정 대기중',
      temp_avg: '18.3°C',
      rain_mm: '4mm',
      next_task_dday: '3일 후',
      opt_temp: '18~20℃ 적온',
      thumb_gradient: 'from-teal-700 via-emerald-600 to-cyan-800',
    },
  ];

  const baseCropList =
    myCropPlans.length > 0
      ? myCropPlans.map((cp: any, idx: number) => {
          const isSeed = String(cp.planting_type || '').includes('씨');
          const wk = getWeekdayNameFromYmd(cp.planting_date);
          const dateDot = String(cp.planting_date || '2026-08-25').replace(/-/g, '.');
          const gradients = [
            'from-emerald-700 via-green-600 to-teal-800',
            'from-green-700 via-emerald-600 to-lime-800',
            'from-teal-700 via-emerald-600 to-cyan-800',
          ];
          return {
            crop_plan_id: cp.crop_plan_id,
            request_no: cp.request_no || 'REQ-20261106-009',
            crop_title: `${cp.crop_name} (${cp.cultivar_name})`,
            crop_short: cp.crop_name,
            cultivar_name: cp.cultivar_name,
            badge: isSeed ? '노지 직파(씨)' : '노지 정식(모종)',
            region: `${cp.sido} ${cp.sigungu} ${cp.eupmyeondong}`,
            area_pyeong: Number(cp.area_pyeong || 300),
            planting_type: isSeed ? '씨 (적정발아 20℃)' : '모종',
            planting_label: `${isSeed ? '파종' : '정식'} ${dateDot}${wk ? ` (${wk})` : ''}`,
            planting_date: cp.planting_date || '2026-08-25',
            expected_harvest_date: cp.expected_harvest_date || '2026-11-15',
            current_stage_name: cp.current_stage_name || '04. 생육 관리',
            progress_pct: Number(cp.progress_pct ?? 60),
            status_text: cp.status_text || '생육 확인 필요',
            temp_avg: '18.5°C',
            rain_mm: '5mm',
            next_task_dday: Number(cp.progress_pct) >= 100 ? '완료' : '2일 후',
            opt_temp: '18~20℃ 적온',
            thumb_gradient: gradients[idx % gradients.length],
          };
        })
      : defaultCloudBaeCropList;

  // 삭제된 재배일정 요청/플랜 키 영구 추적 상태 (재배일정 요청 · 재배일정 확인 · 마이페이지 동기화)
  const [deletedScheduleKeys, setDeletedScheduleKeys] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('hanfarm_deleted_schedule_keys_v1') || '[]');
    } catch {
      return [];
    }
  });

  const cloudBaeCropList = [
    ...localAddedCropRequests.filter(
      (loc) => !baseCropList.some((b) => b.crop_plan_id === loc.crop_plan_id)
    ),
    ...baseCropList,
  ].filter((crop: any) => {
    const keysToCheck = [
      crop.crop_plan_id,
      crop.request_no,
      crop.display_request_no,
    ].filter(Boolean);
    return !keysToCheck.some((k) => deletedScheduleKeys.includes(String(k)));
  });

  // 재배일정 요청 및 재배일정 리스트 통합 연쇄 삭제 핸들러 (요청 + 16개 생육과정 일정 + 추천 제품·근거 + 이력 모두 삭제)
  const handleDeleteScheduleAndCascade = async (crop: any, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (!crop) return;

    const displayReqNo = crop.display_request_no || crop.request_no || crop.crop_plan_id;
    const cropTitle = crop.crop_title || `${crop.crop_short || '작물'} (${crop.cultivar_name || ''})`;

    const confirmed = window.confirm(
      `[${cropTitle} · ${displayReqNo}] 항목을 삭제하시겠습니까?\n\n삭제 시 연관된 아래 저장 데이터가 모두 함께 삭제됩니다:\n• 재배일정 요청 및 재배작물 플랜 데이터\n• 생육과정 정밀 일정(16개 공정) 및 기후 조정 데이터\n• 생육과정별 맞춤 추천 제품(1종) 및 개조식 추천 근거 데이터\n• 선택된 농자재 장바구니 및 생육 이력 데이터`
    );
    if (!confirmed) return;

    const keysToDelete = Array.from(
      new Set([crop.crop_plan_id, crop.request_no, crop.display_request_no].filter(Boolean))
    ) as string[];

    // 1. 프론트엔드 삭제 상태 및 localStorage 연관 데이터 즉시 제거
    setDeletedScheduleKeys((prev) => {
      const next = Array.from(new Set([...prev, ...keysToDelete]));
      try {
        localStorage.setItem('hanfarm_deleted_schedule_keys_v1', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });

    try {
      const recDbKey = 'hanfarm_schedule_stage_recommendations_db_v1';
      const recDb = JSON.parse(localStorage.getItem(recDbKey) || '{}');
      keysToDelete.forEach((k) => {
        delete recDb[k];
      });
      localStorage.setItem(recDbKey, JSON.stringify(recDb));

      const customKey = 'hanfarm_custom_schedule_items_v1';
      const customDb = JSON.parse(localStorage.getItem(customKey) || '{}');
      keysToDelete.forEach((k) => {
        delete customDb[k];
      });
      localStorage.setItem(customKey, JSON.stringify(customDb));
    } catch {
      // ignore
    }

    setLocalAddedCropRequests((prev) =>
      prev.filter(
        (it) =>
          !keysToDelete.includes(it.crop_plan_id) &&
          !keysToDelete.includes(it.request_no) &&
          !keysToDelete.includes(it.display_request_no)
      )
    );
    setMyCropPlans((prev) =>
      prev.filter(
        (cp: any) =>
          !keysToDelete.includes(cp.crop_plan_id) && !keysToDelete.includes(cp.request_no)
      )
    );

    // 2. 열려 있는 상세 아코디언·세부보기 모달·추천 제품 선택 상태 초기화
    if (
      selectedReqDetailCrop &&
      keysToDelete.some(
        (k) =>
          k === selectedReqDetailCrop.crop_plan_id ||
          k === selectedReqDetailCrop.request_no ||
          k === selectedReqDetailCrop.display_request_no
      )
    ) {
      setSelectedReqDetailCrop(null);
    }

    if (expandedScheduleRequestNo && keysToDelete.includes(expandedScheduleRequestNo)) {
      setExpandedScheduleRequestNo(null);
      setHoveredProvisionItem(null);
      setClickedProvisionItem(null);
      setSelectedStageItem(null);
    }

    if (keysToDelete.includes(selectedRequestNo)) {
      const remaining = cloudBaeCropList.filter(
        (c: any) =>
          !keysToDelete.includes(c.crop_plan_id) &&
          !keysToDelete.includes(c.request_no) &&
          !keysToDelete.includes(c.display_request_no)
      );
      setPurchaseSelectionMap({});
      if (remaining[0]?.request_no) {
        setSelectedRequestNo(remaining[0].request_no);
      } else {
        setSelectedRequestNo('');
        setProvisionData(null);
      }
    }

    // 3. 백엔드 DB (member_schedule_request, member_crop_plan, schedule_provision_custom_item, schedule_stage_recommendation_log, cultivation_history_log, schedule_request) 연쇄 삭제 호출
    try {
      await fetch('/api/member-schedule-requests/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loggedInUser.email || 'CloudBae@naver.com',
          request_no: crop.request_no,
          crop_plan_id: crop.crop_plan_id,
          display_request_no: crop.display_request_no,
        }),
      });
    } catch {
      // ignore
    }

    try {
      const r = await fetch('/api/mypage/crops/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loggedInUser.email || 'CloudBae@naver.com',
          crop_plan_id: crop.crop_plan_id,
          request_no: crop.request_no,
          display_request_no: crop.display_request_no,
        }),
      });
      const res = await r.json();
      if (res?.ok) {
        applyMyPagePayload(res);
      }
    } catch {
      // ignore
    }

    const msg = `[${cropTitle} · ${displayReqNo}] 재배일정 요청과 연관된 생육과정 일정 데이터 및 맞춤 추천 제품·근거 데이터가 모두 삭제되었습니다.`;
    setOrderSuccessToast(msg);
    setMyPageToast(msg);
    setTimeout(() => {
      setOrderSuccessToast('');
      setMyPageToast('');
    }, 4000);
  };

  const handleSubmitScheduleReqForm = async () => {
    const isSeed = String(reqForm.planting_type || '').includes('씨');
    const pDate = reqForm.planting_date || '2026-08-25';
    const wk = getWeekdayNameFromYmd(pDate);
    const dateDot = pDate.replace(/-/g, '.');
    const harvestYmd = addDaysToYmd(pDate, 82);
    const nextIdx = cloudBaeCropList.length + 1;
    const newPlanId = `CPLAN-REQ-${Date.now()}`;
    const newReqDisplayNo = `REQ-20261111-${String(nextIdx).padStart(3, '0')}`;

    const newItem = {
      crop_plan_id: newPlanId,
      request_no: newReqDisplayNo,
      display_request_no: newReqDisplayNo,
      crop_title: `${reqForm.crop_name} (${reqForm.cultivar_name})`,
      crop_short: reqForm.crop_name,
      cultivar_name: reqForm.cultivar_name,
      badge: isSeed ? '노지 직파(씨)' : '노지 정식(모종)',
      region: `${reqForm.sido} ${reqForm.sigungu} ${reqForm.eupmyeondong}`,
      area_pyeong: Number(reqForm.area_pyeong || 300),
      planting_type: isSeed ? '씨 (적정발아 20℃)' : '모종',
      planting_label: `${isSeed ? '파종' : '정식'} ${dateDot}${wk ? ` (${wk})` : ''}`,
      planting_date: pDate,
      expected_harvest_date: harvestYmd,
      current_stage_name: '01. 토양 준비 및 밑거름 (신규 산출 완료)',
      progress_pct: 15,
      status_text: '맞춤 일정 산출 완료 · 생육 준비',
      temp_avg: '18.5°C',
      rain_mm: '2mm',
      next_task_dday: '추천 진행일 대기',
      opt_temp: '18~20℃ 적온',
      thumb_gradient: 'from-emerald-700 via-green-600 to-teal-800',
      requested_at: '2026-11-11',
      soil_ph: reqForm.soil_ph,
      soil_ec: reqForm.soil_ec,
    };

    setLocalAddedCropRequests((prev) => [newItem, ...prev]);
    setSelectedRequestNo(newReqDisplayNo);
    setReqFormSubmitted(true);

    try {
      await fetch('/api/member-schedule-requests/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_no: newReqDisplayNo,
          crop_plan_id: newPlanId,
          sido: reqForm.sido,
          sigungu: reqForm.sigungu,
          eupmyeondong: reqForm.eupmyeondong,
          crop_name: reqForm.crop_name,
          item_name_3rd: reqForm.cultivar_name,
          planting_method: isSeed ? '노지 직파(씨)' : '노지 정식(모종)',
          area_pyeong: Number(reqForm.area_pyeong || 300),
          desired_start_date: pDate,
          expected_harvest_date: harvestYmd,
        }),
      });
    } catch {
      // ignore
    }

    try {
      const r = await fetch('/api/mypage/crops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loggedInUser.email || 'CloudBae@naver.com',
          crop_plan_id: newPlanId,
          request_no: newReqDisplayNo,
          farmland_id: reqForm.farmland_id || 'LAND-CB-01',
          sido: reqForm.sido,
          sigungu: reqForm.sigungu,
          eupmyeondong: reqForm.eupmyeondong,
          crop_name: reqForm.crop_name,
          cultivar_name: reqForm.cultivar_name,
          planting_type: reqForm.planting_type,
          area_pyeong: Number(reqForm.area_pyeong || 300),
          planting_date: pDate,
          progress_pct: 15,
        }),
      });
      const res = await r.json();
      if (res?.ok) {
        applyMyPagePayload(res);
      }
    } catch {
      // ignore
    }
  };

  const activeCropCard =
    cloudBaeCropList.find((c) => c.request_no === selectedRequestNo) || cloudBaeCropList[0];

  // 출생년월일 기준 나이 자동 계산 헬퍼
  const calcAgeFromBirthDate = (birthYmd: string): number => {
    if (!birthYmd || !/^\d{4}-\d{2}-\d{2}$/.test(birthYmd)) return 46;
    const birthYear = Number(birthYmd.slice(0, 4));
    const currentYear = 2026;
    return Math.max(1, Math.min(110, currentYear - birthYear));
  };

  // 마이페이지 통합 데이터 로드 (markLoggedIn이 true일 때만 로그인 상태로 전환)
  const applyMyPagePayload = (res: any, markLoggedIn?: boolean) => {
    if (!res) return;
    if (res.member) {
      const resolvedName =
        res.member.name && res.member.name !== '배클라우드' ? res.member.name : '배철민';
      setLoggedInUser((prev) => {
        const nextUser = {
          id: resolvedName,
          email: res.member.email || 'CloudBae@naver.com',
          name: resolvedName,
          nickname: res.member.nickname || 'CloudBae',
          gender: res.member.gender || '남성',
          birth_date: res.member.birth_date || '1978-05-15',
          age: Number(res.member.age || 48),
          road_address: res.member.road_address || '충청북도 충주시 충원대로 268 (단월동)',
          road_address_detail: res.member.road_address_detail || '한팜스마트농원 101호',
          postal_code: res.member.postal_code || '27481',
          phone: res.member.phone || '010-2026-0109',
          signup_type: (res.member.signup_type === 'GOOGLE_GMAIL' ? 'GOOGLE_GMAIL' : 'EMAIL') as
            | 'EMAIL'
            | 'GOOGLE_GMAIL',
          farmTitle: `${resolvedName} 님의 농장`,
          isLoggedIn: markLoggedIn !== undefined ? markLoggedIn : prev.isLoggedIn,
        };
        if (nextUser.isLoggedIn) {
          try {
            localStorage.setItem('hanfarm_auth_session_v1', JSON.stringify(nextUser));
          } catch {
            // ignore
          }
        }
        return nextUser;
      });
    }
    if (Array.isArray(res.farmlands)) setMyFarmlands(res.farmlands);
    if (Array.isArray(res.cropPlans)) setMyCropPlans(res.cropPlans);
    if (Array.isArray(res.orders)) setMyOrders(res.orders);
  };

  const loadMyPageData = async (targetEmail?: string, markLoggedIn = false) => {
    const emailToFetch = targetEmail || loggedInUser.email || 'CloudBae@naver.com';
    try {
      const r = await fetch(`/api/mypage?email=${encodeURIComponent(emailToFetch)}`);
      const res = await r.json();
      if (res?.ok) {
        applyMyPagePayload(res, markLoggedIn);
      }
    } catch {
      // ignore
    }
  };

  // 관리자 페이지 재배지 관리 DB (cultivation_address: 시도, 시군구, 읍면동) 검색
  const searchAdminCultivationDb = async (opts?: {
    sido?: string;
    sigungu?: string;
    q?: string;
  }) => {
    const s = opts?.sido !== undefined ? opts.sido : farmlandSearchSido;
    const sg = opts?.sigungu !== undefined ? opts.sigungu : farmlandSearchSigungu;
    const q = opts?.q !== undefined ? opts.q : farmlandSearchQuery;
    try {
      const params = new URLSearchParams({ pageSize: '50' });
      if (s && s !== 'ALL') params.set('sido', s);
      if (sg && sg !== 'ALL') params.set('sigungu', sg);
      if (q.trim()) params.set('q', q.trim());
      const r = await fetch(`/api/addresses?${params.toString()}`);
      const res = await r.json();
      setAdminDbAddresses(res?.items || []);
    } catch {
      // ignore
    }
  };

  // 회원가입/프로필 도로명 주소 DB 검색
  const handleSearchRoadAddress = async (keywordInput?: string) => {
    const kw = (keywordInput !== undefined ? keywordInput : roadSearchKeyword).trim();
    if (!kw) return;
    setIsRoadSearching(true);
    try {
      const r = await fetch(`/api/member-address/search?q=${encodeURIComponent(kw)}&limit=25`);
      const res = await r.json();
      setRoadSearchResults(res?.items || []);
      setShowRoadSearchBox(true);
    } catch {
      // ignore
    } finally {
      setIsRoadSearching(false);
    }
  };

  // 1. 이메일 중복검사 핸들러
  const handleCheckEmailDuplicate = async () => {
    const email = signupForm.email.trim();
    if (!email || !email.includes('@')) {
      setSignupForm((prev) => ({
        ...prev,
        emailChecked: false,
        emailCheckMsg: '올바른 이메일 주소(예: user@naver.com)를 입력해 주세요.',
      }));
      return;
    }
    try {
      const r = await fetch(`/api/auth/check-email?email=${encodeURIComponent(email)}`);
      const res = await r.json();
      setSignupForm((prev) => ({
        ...prev,
        emailChecked: Boolean(res?.available),
        emailCheckMsg: res?.message || (res?.available ? '사용 가능한 이메일입니다.' : '이미 사용 중인 이메일입니다.'),
      }));
    } catch {
      setSignupForm((prev) => ({
        ...prev,
        emailChecked: false,
        emailCheckMsg: '중복검사 중 오류가 발생했습니다.',
      }));
    }
  };

  // 2. 이메일 로그인 핸들러 (CloudBae@naver.com / 1234 지원)
  const handleEmailLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthNoticeMsg(null);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login_type: 'EMAIL',
          email: loginForm.email.trim(),
          password: loginForm.password.trim(),
        }),
      });
      const res = await r.json();
      if (!r.ok || !res?.ok) {
        setAuthNoticeMsg({
          type: 'error',
          text: res?.message || '이메일 또는 비밀번호를 확인해 주세요.',
        });
        return;
      }
      applyMyPagePayload(res, true);
      setIsAuthModalOpen(false);
      setMyPageToast(`${res?.member?.name || '배철민'} (${res?.member?.email || loginForm.email}) 님으로 로그인되었습니다.`);
      setTimeout(() => setMyPageToast(''), 3500);
    } catch {
      setAuthNoticeMsg({ type: 'error', text: '로그인 처리 중 오류가 발생했습니다.' });
    }
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('hanfarm_auth_session_v1');
    } catch {
      // ignore
    }
    setLoggedInUser((prev) => ({
      ...prev,
      isLoggedIn: false,
    }));
    if (activeMenu === '마이페이지') {
      setActiveMenu('홈');
    }
  };

  // 3. Google Gmail 간편 로그인 / 가입 연동 핸들러
  const handleGoogleGmailAuth = async (gmailAddress: string) => {
    const cleanGmail = gmailAddress.trim() || 'cloudbae.farm@gmail.com';
    setAuthNoticeMsg(null);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login_type: 'GOOGLE_GMAIL',
          email: cleanGmail,
        }),
      });
      const res = await r.json();
      if (res?.needSignup) {
        // 아직 가입되지 않은 Google Gmail 계정이면 회원가입 탭으로 전환하고 Google Gmail 이메일 자동 세팅 및 중복검사 통과 처리
        setSignupForm((prev) => ({
          ...prev,
          signup_type: 'GOOGLE_GMAIL',
          email: cleanGmail,
          emailChecked: true,
          emailCheckMsg: 'Google Gmail 계정 인증 및 중복검사 완료 (사용 가능)',
          password: prev.password || 'google1234',
          passwordConfirm: prev.passwordConfirm || 'google1234',
          name: prev.name || cleanGmail.split('@')[0],
          road_address:
            prev.road_address || '충청북도 충주시 충원대로 268 (단월동)',
        }));
        setShowGmailPicker(false);
        setAuthModalTab('SIGNUP');
        setAuthNoticeMsg({
          type: 'success',
          text: `Google 계정(${cleanGmail})이 연동되었습니다. 성별·생년월일·도로명주소를 확인 후 가입을 완료해 주세요.`,
        });
        return;
      }
      if (res?.ok && res?.member) {
        applyMyPagePayload(res, true);
        setShowGmailPicker(false);
        setIsAuthModalOpen(false);
        setMyPageToast(`Google Gmail 계정(${res.member.email})으로 로그인되었습니다.`);
        setTimeout(() => setMyPageToast(''), 3500);
      }
    } catch {
      setAuthNoticeMsg({ type: 'error', text: 'Google 계정 연동 중 오류가 발생했습니다.' });
    }
  };

  // 4. 회원가입 완료 핸들러 (이메일 가입 & Google Gmail 가입 공통)
  const handleSignupSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthNoticeMsg(null);
    if (!signupForm.email.trim() || !signupForm.email.includes('@')) {
      setAuthNoticeMsg({ type: 'error', text: '이메일 주소를 입력해 주세요.' });
      return;
    }
    if (!signupForm.emailChecked) {
      setAuthNoticeMsg({ type: 'error', text: '이메일 [중복검사] 버튼을 눌러 사용 가능 여부를 확인해 주세요.' });
      return;
    }
    if (!signupForm.password || signupForm.password.length < 4) {
      setAuthNoticeMsg({ type: 'error', text: '비밀번호를 4자리 이상 입력해 주세요.' });
      return;
    }
    if (signupForm.password !== signupForm.passwordConfirm) {
      setAuthNoticeMsg({ type: 'error', text: '비밀번호와 비밀번호 확인이 일치하지 않습니다.' });
      return;
    }
    if (!signupForm.name.trim()) {
      setAuthNoticeMsg({ type: 'error', text: '이름을 입력해 주세요.' });
      return;
    }
    if (!signupForm.road_address.trim()) {
      setAuthNoticeMsg({ type: 'error', text: '주소(도로명)를 검색하거나 입력해 주세요.' });
      return;
    }

    try {
      const r = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signupForm),
      });
      const res = await r.json();
      if (!r.ok || !res?.ok) {
        setAuthNoticeMsg({
          type: 'error',
          text: res?.message || '회원가입 처리 중 오류가 발생했습니다.',
        });
        return;
      }
      applyMyPagePayload(res, true);
      setIsAuthModalOpen(false);
      setActiveMenu('마이페이지');
      setMyPageToast(`환영합니다! ${res.member?.name} (${res.member?.email}) 님의 회원가입이 완료되었습니다.`);
      setTimeout(() => setMyPageToast(''), 4000);
    } catch {
      setAuthNoticeMsg({ type: 'error', text: '회원가입 요청 중 오류가 발생했습니다.' });
    }
  };

  // 5. 비밀번호 찾기 (본인확인 & 새 비밀번호 재설정) 핸들러
  const handleFindPasswordVerify = async () => {
    setAuthNoticeMsg(null);
    try {
      const r = await fetch('/api/auth/find-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'VERIFY',
          email: findPwForm.email.trim(),
          name: findPwForm.name.trim(),
          birth_date: findPwForm.birth_date.trim(),
        }),
      });
      const res = await r.json();
      if (!r.ok || !res?.ok) {
        setAuthNoticeMsg({
          type: 'error',
          text: res?.message || '일치하는 회원 정보를 찾을 수 없습니다.',
        });
        return;
      }
      setFindPwForm((prev) => ({
        ...prev,
        verified: true,
        verifiedMsg: `${res.email} 계정의 본인 확인이 완료되었습니다. (기존 비밀번호 힌트: ${res.currentPasswordHint})`,
      }));
      setAuthNoticeMsg({ type: 'success', text: res.message });
    } catch {
      setAuthNoticeMsg({ type: 'error', text: '본인 확인 중 오류가 발생했습니다.' });
    }
  };

  const handleFindPasswordReset = async () => {
    setAuthNoticeMsg(null);
    if (!findPwForm.new_password || findPwForm.new_password.length < 4) {
      setAuthNoticeMsg({ type: 'error', text: '새 비밀번호를 4자리 이상 입력해 주세요.' });
      return;
    }
    if (findPwForm.new_password !== findPwForm.new_password_confirm) {
      setAuthNoticeMsg({ type: 'error', text: '새 비밀번호와 비밀번호 확인이 일치하지 않습니다.' });
      return;
    }
    try {
      const r = await fetch('/api/auth/find-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'RESET',
          email: findPwForm.email.trim(),
          name: findPwForm.name.trim(),
          birth_date: findPwForm.birth_date.trim(),
          new_password: findPwForm.new_password.trim(),
        }),
      });
      const res = await r.json();
      if (!r.ok || !res?.ok) {
        setAuthNoticeMsg({ type: 'error', text: res?.message || '비밀번호 변경에 실패했습니다.' });
        return;
      }
      setLoginForm((prev) => ({
        ...prev,
        email: res.email || findPwForm.email,
        password: findPwForm.new_password.trim(),
      }));
      setFindPwForm((prev) => ({
        ...prev,
        verified: false,
        new_password: '',
        new_password_confirm: '',
      }));
      setAuthModalTab('LOGIN');
      setAuthNoticeMsg({
        type: 'success',
        text: res.message || '비밀번호가 성공적으로 재설정되었습니다. 로그인해 주세요.',
      });
    } catch {
      setAuthNoticeMsg({ type: 'error', text: '비밀번호 재설정 중 오류가 발생했습니다.' });
    }
  };

  // 마이페이지: 재배지 등록 / 삭제 핸들러 (관리자 페이지 재배지 관리 DB 연동)
  const handleAddFarmland = async () => {
    try {
      const r = await fetch('/api/mypage/farmlands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loggedInUser.email,
          ...newFarmlandForm,
        }),
      });
      const res = await r.json();
      if (res?.ok) {
        applyMyPagePayload(res);
        setMyPageToast(
          `[${newFarmlandForm.sido} ${newFarmlandForm.sigungu} ${newFarmlandForm.eupmyeondong}] ${newFarmlandForm.farmland_title} 재배지가 등록되었습니다.`
        );
        setTimeout(() => setMyPageToast(''), 3500);
      }
    } catch {
      // ignore
    }
  };

  const handleDeleteFarmland = async (farmlandId: string) => {
    try {
      const r = await fetch('/api/mypage/farmlands/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loggedInUser.email, farmland_id: farmlandId }),
      });
      const res = await r.json();
      if (res?.ok) applyMyPagePayload(res);
    } catch {
      // ignore
    }
  };

  // 마이페이지: 재배작물 등록(복수 가능) / 진행율 변경 / 삭제 핸들러
  const handleAddCropPlan = async () => {
    try {
      const r = await fetch('/api/mypage/crops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loggedInUser.email,
          ...newCropPlanForm,
        }),
      });
      const res = await r.json();
      if (res?.ok) {
        applyMyPagePayload(res);
        setMyPageToast(
          `[${newCropPlanForm.sido} ${newCropPlanForm.sigungu} ${newCropPlanForm.eupmyeondong}] ${newCropPlanForm.crop_name}(${newCropPlanForm.cultivar_name}) 작물이 내 재배작물 리스트에 추가되었습니다.`
        );
        setTimeout(() => setMyPageToast(''), 3500);
      }
    } catch {
      // ignore
    }
  };

  const handleUpdateCropProgress = async (cropPlanId: string, nextPct: number) => {
    try {
      const r = await fetch('/api/mypage/crops/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loggedInUser.email,
          crop_plan_id: cropPlanId,
          progress_pct: nextPct,
        }),
      });
      const res = await r.json();
      if (res?.ok) applyMyPagePayload(res);
    } catch {
      // ignore
    }
  };

  const handleDeleteCropPlan = async (cropPlanId: string) => {
    try {
      const r = await fetch('/api/mypage/crops/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loggedInUser.email, crop_plan_id: cropPlanId }),
      });
      const res = await r.json();
      if (res?.ok) applyMyPagePayload(res);
    } catch {
      // ignore
    }
  };

  const handleSaveMemberProfile = async () => {
    try {
      const r = await fetch('/api/mypage/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loggedInUser.email,
          name: loggedInUser.name,
          gender: loggedInUser.gender,
          birth_date: loggedInUser.birth_date,
          age: loggedInUser.age,
          road_address: loggedInUser.road_address,
          road_address_detail: loggedInUser.road_address_detail,
          postal_code: loggedInUser.postal_code,
          phone: loggedInUser.phone,
        }),
      });
      const res = await r.json();
      if (res?.ok) {
        applyMyPagePayload(res);
        setMyPageToast('회원 기본정보(이름, 성별, 출생년월일, 나이, 도로명주소)가 저장되었습니다.');
        setTimeout(() => setMyPageToast(''), 3500);
      }
    } catch {
      // ignore
    }
  };

  // 생육 단계별 추천 농자재 리스트 & CloudBae 회원 일괄 구매 모듈 상태
  const [selectedPurchaseStageFilter, setSelectedPurchaseStageFilter] = useState<string>('ALL');
  const [purchaseSelectionMap, setPurchaseSelectionMap] = useState<
    Record<string, { checked: boolean; qty: number }>
  >({});
  const [purchaseDeliveryOption, setPurchaseDeliveryOption] = useState<
    'STAGE_SCHEDULED' | 'ALL_AT_ONCE'
  >('STAGE_SCHEDULED');
  const [purchasePaymentMethod, setPurchasePaymentMethod] = useState<
    'NONGHYUP_CARD' | 'BANK_TRANSFER' | 'KOK_PAY'
  >('NONGHYUP_CARD');
  const [primaryBankAccount, setPrimaryBankAccount] = useState<any>({
    bank_name: 'NH농협은행',
    account_number: '301-0348-9120-81',
    account_holder: '(주)한팜',
  });
  const [purchaseOrderReceipt, setPurchaseOrderReceipt] = useState<any>(null);
  const [purchaseToastMessage, setPurchaseToastMessage] = useState<string>('');

  // ==================== 유저 페이지: 비료 / 영양제 / 병해충관리제 (관리자 페이지 등록 농자재 DB + 다중 검색 필터 + 20개씩 페이징 연동) ====================
  const USER_AGRO_PAGE_SIZE = 20;
  const [userAgroPage, setUserAgroPage] = useState<number>(1);
  const [userAgroMainTypeFilter, setUserAgroMainTypeFilter] = useState<string>('ALL');
  const [userAgroSubTypeFilter, setUserAgroSubTypeFilter] = useState<string>('ALL');
  const [userAgroOrganicFilter, setUserAgroOrganicFilter] = useState<string>('ALL');
  const [userAgroKeyword, setUserAgroKeyword] = useState<string>('');
  const [isUserAgroLoading, setIsUserAgroLoading] = useState<boolean>(false);
  const [selectedUserAgroDetail, setSelectedUserAgroDetail] = useState<any | null>(null);
  const [activeUserAgroGalleryImg, setActiveUserAgroGalleryImg] = useState<string>('');
  const [userAgroOrderToast, setUserAgroOrderToast] = useState<string>('');
  const [mobileAgroCategoryTab, setMobileAgroCategoryTab] = useState<
    'ALL' | 'SEED' | 'SEEDLING' | 'FERTILIZER' | 'NUTRIENT' | 'PESTICIDE'
  >('FERTILIZER');
  const [showMobileAgroSearch, setShowMobileAgroSearch] = useState<boolean>(false);

  const formatMobileProductName = (rawName?: string | null): string => {
    let s = String(rawName || '');
    let prev = '';
    while (s !== prev) {
      prev = s;
      s = s.replace(/\s*[\(\（][^\(\)\（\）]*[\)\）]/g, ' ');
    }
    return s.replace(/\s+/g, ' ').trim();
  };

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

  const [userAgroResult, setUserAgroResult] = useState<{
    items: any[];
    total: number;
    summary: any;
    subTypes: string[];
    fertilizerCategories: Array<{ code: string; name: string; desc: string; main_type?: string }>;
    nutrientCategories: Array<{ code: string; name: string; desc: string }>;
    pesticideCategories: Array<{ code: string; name: string; desc: string }>;
    seedCategories: Array<{ code: string; name: string; desc: string }>;
    seedlingCategories: Array<{ code: string; name: string; desc: string }>;
  }>({
    items: [],
    total: 0,
    summary: null,
    subTypes: [],
    fertilizerCategories: [
      { code: 'CAT-ORG-COMP', name: '유기질·퇴비', desc: '토양 유기물(OM) 함량 증진, 떼알구조 형성 및 미생물 활성화를 위한 발효 유박·퇴비 (부산물비료)', main_type: '천연비료' },
      { code: 'CAT-SOIL-CALC', name: '토양개량·칼슘비료', desc: '산성토양(pH) 교정, 석회·고토·규산 보충 및 배추 무사마귀병·칼슘결핍 예방 비료 (산도교정)', main_type: '천연비료' },
      { code: 'CAT-NPK-COMP', name: '복합비료', desc: '질소·인산·칼륨 3요소에 고토·붕소·칼슘을 복합 처방한 본밭 밑거름 표준 비료 (원예·기비전용)', main_type: '화학비료' },
      { code: 'CAT-NK-TOP', name: '웃거름비료', desc: '초기 활착 이후 생육 중기·결구기·비대기에 빠르게 흡수되는 속효성 NK 추비 비료 (NK추비전용)', main_type: '화학비료' },
      { code: 'CAT-CRF-SLOW', name: '완효성비료', desc: '온도·수분에 따라 60~100일간 양분이 서서히 용출되어 웃거름 노동력을 절감하는 코팅 비료 (코팅지효성)', main_type: '화학비료' },
      { code: 'CAT-SINGLE-K', name: '단비·칼륨전용비료', desc: '토양검정 결과 특정 부족 성분(칼륨·질소·인산)을 정밀 보충하기 위한 맞춤형 단비 (황산가리·요소)', main_type: '화학비료' },
    ],
    nutrientCategories: [
      { code: 'CAT-NUT-PHOTO', name: '광합성·냉해/스트레스 회복 영양재', desc: '일조량 부족·장마·저온 냉해·고온 위조 등 이상기후 스트레스 발생 시 광합성 효율과 수세를 급속 회복시키는 기능성 영양재' },
      { code: 'CAT-NUT-CALC', name: '칼슘·붕소 결핍예방 영양재', desc: '배추 결구기 꿀통배추(내엽갈변·팁번), 무·감자 속빈현상 및 세포벽 약화를 예방하는 고흡수 아미노산 킬레이트 액상칼슘·붕소제' },
      { code: 'CAT-NUT-ROOT', name: '뿌리발근·초기활착 영양재', desc: '본밭 정식 직후 새 흰색 잔뿌리(세근) 발근을 촉진하고 정식 몸살·활착 지연을 빠르게 극복시키는 고농도 아미노산 발근제' },
      { code: 'CAT-NUT-BULK', name: '결구·괴경·구비대 촉진 영양재', desc: '가을배추 결구 비대기·감자 괴경비대기·마늘 구비대기에 인산·가리·규산을 집중 공급하여 무게감과 저장성을 높이는 비대제' },
      { code: 'CAT-NUT-MICRO', name: '종합미량요소·해조 생리활성 영양재', desc: '철·아연·망간·몰리브덴·붕소·고토 등 12종 종합미량요소와 해조추출물을 배합해 엽색·잎두께 및 생리활성을 강화하는 종합영양제' },
    ],
    pesticideCategories: [
      { code: 'CAT-PST-HERB', name: '제초제 (고랑·헛골 비선택성/토양처리)', desc: '작물 이랑 사이 고랑(헛골) 및 논밭 두렁의 일년생·다년생 난방제 잡초를 뿌리까지 빠르게 고사시키는 전문 제초제' },
      { code: 'CAT-PST-INSC', name: '살충제 (진딧물·총채벌레·초기해충)', desc: '바이러스 매개충인 진딧물·총채벌레·가루이 및 배추좀나방·감자뿔나방을 침투이행 작용으로 방제하는 전문 살충제' },
      { code: 'CAT-PST-FUNG', name: '살균제 (무름병·노균병·역병·탄저병)', desc: '장마·가을 강우 및 다습 환경에서 급증하는 배추 무름병·노균병, 감자 역병, 고추 탄저병을 예방·치료하는 광범위 살균제' },
      { code: 'CAT-PST-SOIL', name: '토양살균·살충제 (뿌리혹병·잘록병)', desc: '정식·파종 전후 토양 처리 및 관주 처리로 배추 뿌리혹병(무사마귀병), 입고병(잘록병), 고자리파리 등 토양병해충을 방제하는 약제' },
      { code: 'CAT-PST-MOTH', name: '나방·벼룩잎벌레 종합살충제', desc: '생육 초기~결구기에 잎과 생장점을 가해하는 파밤나방·배추좀나방·담배거세미나방·벼룩잎벌레를 동시 방제하는 살충제' },
      { code: 'CAT-PST-ECO', name: '친환경 유기농업자재 (PLS 수확전 방제)', desc: '님(Neem)·유칼립투스·계피 등 식물유래 천연추출물 기반으로 수확 임박기 PLS 잔류농약 걱정 없이 사용하는 유기농업자재 공시 제품' },
    ],
    seedCategories: [
      { code: 'CAT-SEED-LEAF', name: '엽채류 종자 (배추·상추·시금치·양배추)', desc: '가을·봄·월동배추, 시금치, 상추, 양배추 등 엽채류 F1 코팅종자 및 재래종 씨앗' },
      { code: 'CAT-SEED-ROOT', name: '근채류 종자 (무·당근·우엉·비트)', desc: '김장무, 알타리무(총각무), 봄·가을 당근, 우엉 등 근채류 정밀 선별 종자' },
      { code: 'CAT-SEED-FRUIT', name: '과채류 종자 (고추·오이·토마토·호박)', desc: '복합내병성 고추, 백다다기오이, 대추방울토마토, 애호박 등 고품질 과채류 종자' },
      { code: 'CAT-SEED-ALLIUM', name: '양념·구근류 종자 (대파·양파·부추)', desc: '교배종 외대파, 중만생종 저장양파, 다수확 부추 등 양념채소 전문 종자' },
      { code: 'CAT-SEED-GRAIN', name: '두류·특작 종자 (찰옥수수·콩·참깨·들깨)', desc: '초당·찰옥수수, 대원콩·서리태, 수지참깨·들깨 등 식량·특용작물 보급종 및 육종 종자' },
    ],
    seedlingCategories: [
      { code: 'CAT-SDL-LEAF', name: '배추·양배추·쌈채류 모종', desc: '105구·128구 트레이에서 뿌리돌림과 외기 순화(Hardening)를 완료한 배추·양배추·브로콜리·상추 우량 프러그묘' },
      { code: 'CAT-SDL-FRUIT', name: '고추·토마토·가지·오이 과채 모종', desc: '탄저병·칼라병(TSWV)·역병 복합내병성 고추 모종 및 토마토·오이·가지·호박 포트 육묘 모종' },
      { code: 'CAT-SDL-HERB', name: '대파·양파·쪽파·부추 양념 모종', desc: '200구·288구 트레이 육묘 대파·양파 모종 및 조기 정식용 쪽파·부추 영양묘' },
      { code: 'CAT-SDL-ROOT', name: '고구마순·씨감자·마늘 영양번식 모종', desc: '무병 조직배양 고구마순(꿀고구마·호박고구마), 정부 보급종 씨감자(수미·두백), 종구용 마늘·생강' },
      { code: 'CAT-SDL-SPEC', name: '접목묘·특수작물 모종 (딸기·수박·참외)', desc: '토양 전염성 덩굴쪼김병·역병 저항성 대목에 접목한 수박·참외·오이·토마토 전문 접목묘 및 설향 딸기 우량묘' },
    ],
  });

  const getUserAgroCategoryFromMenu = (
    menuName: string
  ): 'ALL' | 'FERTILIZER' | 'NUTRIENT' | 'PESTICIDE' | 'SEED' | 'SEEDLING' => {
    if (menuName === '농작물 구매' || menuName === '농자재 판매') return 'FERTILIZER';
    if (menuName === '영양제') return 'NUTRIENT';
    if (menuName === '병해충관리제' || menuName === '병해충방지제') return 'PESTICIDE';
    if (menuName === '씨') return 'SEED';
    if (menuName === '모종') return 'SEEDLING';
    return 'FERTILIZER';
  };

  // 기초코드 관리(씨 분류 기초 코드 / 모종 분류 기초 코드 / 비료·영양제·병해충 기초 코드) 데이터 실시간 바인딩
  const resolvedUserFertilizerCategories = (
    Array.isArray(data?.fertilizerCategoryCodes) && data.fertilizerCategoryCodes.length > 0
      ? data.fertilizerCategoryCodes
      : userAgroResult.fertilizerCategories || []
  )
    .map((c: any, idx: number) => {
      const code = String(c.category_code || c.code || `CAT-FERT-0${idx + 1}`).trim();
      const name = String(c.category_name || c.sub_type_name || c.name || code).trim();
      const desc = String(c.description ?? c.desc ?? '').trim();
      return {
        ...c,
        code,
        name,
        desc,
        category_code: code,
        category_name: name,
        description: desc,
        main_type: resolveFertilizerMainType(name || code, c.main_type),
        sort_order: Number(c.sort_order) || idx + 1,
      };
    })
    .sort((a: any, b: any) => Number(a.sort_order || 99) - Number(b.sort_order || 99));

  const resolvedUserNutrientCategories = (
    Array.isArray(data?.nutrientCategoryCodes) && data.nutrientCategoryCodes.length > 0
      ? data.nutrientCategoryCodes
      : userAgroResult.nutrientCategories || []
  )
    .map((c: any, idx: number) => {
      const code = String(c.category_code || c.code || `CAT-NUT-0${idx + 1}`).trim();
      const name = String(c.category_name || c.name || code).trim();
      const desc = String(c.description ?? c.desc ?? '').trim();
      return {
        ...c,
        code,
        name,
        desc,
        category_code: code,
        category_name: name,
        description: desc,
        sort_order: Number(c.sort_order) || idx + 1,
      };
    })
    .sort((a: any, b: any) => Number(a.sort_order || 99) - Number(b.sort_order || 99));

  const resolvedUserPesticideCategories = (
    Array.isArray(data?.pesticideCategoryCodes) && data.pesticideCategoryCodes.length > 0
      ? data.pesticideCategoryCodes
      : userAgroResult.pesticideCategories || []
  )
    .map((c: any, idx: number) => {
      const code = String(c.category_code || c.code || `CAT-PST-0${idx + 1}`).trim();
      const name = String(c.category_name || c.name || code).trim();
      const desc = String(c.description ?? c.desc ?? '').trim();
      return {
        ...c,
        code,
        name,
        desc,
        category_code: code,
        category_name: name,
        description: desc,
        sort_order: Number(c.sort_order) || idx + 1,
      };
    })
    .sort((a: any, b: any) => Number(a.sort_order || 99) - Number(b.sort_order || 99));

  const resolvedUserSeedCategories = (
    Array.isArray(data?.seedCategoryCodes) && data.seedCategoryCodes.length > 0
      ? data.seedCategoryCodes
      : userAgroResult.seedCategories || []
  )
    .map((c: any, idx: number) => {
      const code = String(c.category_code || c.code || `CAT-SEED-0${idx + 1}`).trim();
      const name = String(c.category_name || c.name || code).trim();
      const desc = String(c.description ?? c.desc ?? '').trim();
      return {
        ...c,
        code,
        name,
        desc,
        category_code: code,
        category_name: name,
        description: desc,
        sort_order: Number(c.sort_order) || idx + 1,
      };
    })
    .sort((a: any, b: any) => Number(a.sort_order || 99) - Number(b.sort_order || 99));

  const resolvedUserSeedlingCategories = (
    Array.isArray(data?.seedlingCategoryCodes) && data.seedlingCategoryCodes.length > 0
      ? data.seedlingCategoryCodes
      : userAgroResult.seedlingCategories || []
  )
    .map((c: any, idx: number) => {
      const code = String(c.category_code || c.code || `CAT-SDL-0${idx + 1}`).trim();
      const name = String(c.category_name || c.name || code).trim();
      const desc = String(c.description ?? c.desc ?? '').trim();
      return {
        ...c,
        code,
        name,
        desc,
        category_code: code,
        category_name: name,
        description: desc,
        sort_order: Number(c.sort_order) || idx + 1,
      };
    })
    .sort((a: any, b: any) => Number(a.sort_order || 99) - Number(b.sort_order || 99));

  const executeUserAgroMaterialSearch = async (override?: {
    category?: string;
    main_type?: string;
    sub_type?: string;
    is_organic?: string;
    q?: string;
    page?: number;
  }) => {
    setIsUserAgroLoading(true);
    try {
      const cat = override?.category ?? getUserAgroCategoryFromMenu(activeMenu);
      const nextPage = override?.page ?? 1;
      setUserAgroPage(nextPage);
      const params = new URLSearchParams({
        category: cat,
        main_type: override?.main_type ?? userAgroMainTypeFilter,
        sub_type: override?.sub_type ?? userAgroSubTypeFilter,
        is_organic: override?.is_organic ?? userAgroOrganicFilter,
        q: (override?.q ?? userAgroKeyword).trim(),
      });
      const res = await fetch(`/api/agro-materials?${params.toString()}`).then((r) => r.json());
      const allItems = res.allItems || res.items || [];
      setUserAgroResult((prev) => ({
        items: allItems,
        total: res.total ?? allItems.length,
        summary: res.summary || null,
        subTypes: res.subTypes || [],
        fertilizerCategories: res.fertilizerCategories || prev.fertilizerCategories,
        nutrientCategories: res.nutrientCategories || prev.nutrientCategories,
        pesticideCategories: res.pesticideCategories || prev.pesticideCategories,
        seedCategories: res.seedCategories || prev.seedCategories,
        seedlingCategories: res.seedlingCategories || prev.seedlingCategories,
      }));
      setData((prev) =>
        prev
          ? {
              ...prev,
              fertilizerCategoryCodes: res.fertilizerCategories || prev.fertilizerCategoryCodes,
              nutrientCategoryCodes: res.nutrientCategories || prev.nutrientCategoryCodes,
              pesticideCategoryCodes: res.pesticideCategories || prev.pesticideCategoryCodes,
              seedCategoryCodes: res.seedCategories || prev.seedCategoryCodes,
              seedlingCategoryCodes: res.seedlingCategories || prev.seedlingCategoryCodes,
            }
          : prev
      );
    } catch {
      // ignore
    } finally {
      setIsUserAgroLoading(false);
    }
  };

  const handleQuickBuyAgroMaterial = async (item: any) => {
    const unitPrice = Number(item.unit_price || 21500);
    try {
      const r = await fetch('/api/mypage/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loggedInUser.email,
          crop_name: `${activeCropCard?.crop_name || '배추'} (${activeCropCard?.cultivar_name || '불암3호'})`,
          region_text: `${loggedInUser.road_address} ${loggedInUser.road_address_detail}`.trim(),
          total_item_count: 1,
          total_quantity: 1,
          total_amount: unitPrice,
          discount_amount: Math.max(0, Number(item.retail_price || unitPrice) - unitPrice),
          final_amount: unitPrice,
          payment_method_label: 'NH농협카드 간편결제',
          delivery_option_label: '즉시 출고 택배발송',
          order_status: '결제완료 · 출고준비중',
          items: [
            {
              stageName: item.usage_stage || activeMenu,
              material_id: item.material_id,
              product_name: item.product_name,
              category_label: item.sub_type || activeMenu,
              unit_spec: item.unit_spec || item.weight_spec || '1포',
              qty: 1,
              unit_price: unitPrice,
              subtotal: unitPrice,
            },
          ],
        }),
      });
      const res = await r.json();
      if (res?.ok) {
        applyMyPagePayload(res);
      }
    } catch {
      // ignore
    }
    setUserAgroOrderToast(
      `${loggedInUser.name} 님 계정으로 [${item.manufacturer || '대유'} ${item.product_name}] (₩${unitPrice.toLocaleString()}) 주문이 접수되었습니다. (마이페이지 > 농자재 구매현황 연동)`
    );
    setTimeout(() => setUserAgroOrderToast(''), 4500);
  };

  const parseRecommendedQuantity = (matOrText?: any, areaPyeong = 300): number => {
    const safeArea = Math.max(10, Number(areaPyeong || 300));
    if (matOrText && typeof matOrText === 'object') {
      if (
        Number(matOrText.recommended_qty) > 0 &&
        (!matOrText.area_pyeong || Number(matOrText.area_pyeong) === safeArea)
      ) {
        return Number(matOrText.recommended_qty);
      }
      if (Number(matOrText.base_units_per_100pyeong) > 0) {
        return Math.max(
          1,
          Math.ceil((safeArea / 100) * Number(matOrText.base_units_per_100pyeong))
        );
      }
      const cat = String(matOrText.material_category || '').toUpperCase();
      const fallbackRate = cat === 'FERTILIZER' ? 1.5 : 0.5;
      if (matOrText.recommended_for_area) {
        const text = String(matOrText.recommended_for_area);
        const totalMatch =
          text.match(/총\s*(\d+)\s*(포|병|봉|판|통|박스|개|롤|팩)/) ||
          text.match(/권장(?:\s*구매)?\s*(\d+)\s*(포|병|봉|판|통|박스|개|롤|팩)/);
        if (totalMatch && Number(totalMatch[1]) > 0) {
          return Number(totalMatch[1]);
        }
      }
      return Math.max(1, Math.ceil((safeArea / 100) * fallbackRate));
    }
    if (matOrText) {
      const text = String(matOrText);
      const totalMatch =
        text.match(/총\s*(\d+)\s*(포|병|봉|판|통|박스|개|롤|팩)/) ||
        text.match(/권장(?:\s*구매)?\s*(\d+)\s*(포|병|봉|판|통|박스|개|롤|팩)/) ||
        text.match(/(\d+)\s*(포|병|봉|판|통|박스|개|롤|팩)/);
      if (totalMatch && Number(totalMatch[1]) > 0 && Number(totalMatch[1]) <= 200) {
        return Number(totalMatch[1]);
      }
    }
    return Math.max(1, Math.ceil((safeArea / 100) * 1.0));
  };

  const buildStageRationaleBullets = (mat: any, stageTitle: string, areaPyeong = 300): string[] => {
    if (Array.isArray(mat?.rationale_bullets) && mat.rationale_bullets.length > 0) {
      return mat.rationale_bullets;
    }
    const safeArea = Math.max(10, Number(areaPyeong || 300));
    const qty = parseRecommendedQuantity(mat, safeArea);
    const unitSpec = String(mat?.unit_spec || '1개');
    const unitMatch = unitSpec.match(/(포|병|봉|통|팩|판|박스|개|롤)/);
    const unitLabel = unitMatch ? unitMatch[1] : '개';
    const baseRate =
      Number(mat?.base_units_per_100pyeong) ||
      (String(mat?.material_category || '').toUpperCase() === 'FERTILIZER' ? 1.5 : 0.5);
    const areaRatio = Number((safeArea / 100).toFixed(2));
    const rawUnits = Number(((safeArea / 100) * baseRate).toFixed(2));
    const score = Number(mat?.match_score || 96);

    const bullets: string[] = [
      `• [최고 추천점수 1종 선정 (${score}점)] '${stageTitle}' 생육과정 후보 제품 중 추천 적합도 최고점(${score}점 / 1위)으로 선정된 핵심 1종 제품입니다.`,
    ];
    if (mat?.rationale_stage) {
      bullets.push(`• [생육과정 필수 요구성분·기능 부합] ${mat.rationale_stage}`);
    } else if (mat?.selection_rationale) {
      bullets.push(`• [생육과정 필수 요구성분·기능 부합] ${String(mat.selection_rationale).split('\n')[0].replace(/^•\s*/, '')}`);
    }
    if (mat?.rationale_soil) {
      bullets.push(`• [토양검정 화학성 맞춤 보정] ${mat.rationale_soil}`);
    }
    if (mat?.rationale_climate) {
      bullets.push(`• [지역 기후·PLS 안전기준 적합성] ${mat.rationale_climate}`);
    }
    bullets.push(
      `• [재배지 평수(${safeArea.toLocaleString()}평) 기반 필요 갯수 산출] 100평당 기준량(${baseRate}${unitLabel}) × 면적비율(${safeArea.toLocaleString()}평 ÷ 100평 = ${areaRatio}배) = ${rawUnits}${unitLabel} 산출 → 포장단위 올림 총 ${qty}${unitLabel}(${unitSpec}) 추천`
    );
    return bullets;
  };

  const loadScheduleProvision = async (
    reqNo: string,
    opts?: { gdd_mode?: 'effective' | 'raw'; override_start_date?: string; preserveItemId?: string }
  ) => {
    setIsProvisionLoading(true);
    try {
      const params = new URLSearchParams({ request_no: reqNo });
      if (opts?.gdd_mode) params.set('gdd_mode', opts.gdd_mode);
      if (opts?.override_start_date) params.set('override_start_date', opts.override_start_date);
      const r = await fetch(`/api/schedule-provision?${params.toString()}`);
      const res = await r.json();
      setProvisionData(res);
      if (res?.stageGroups?.length > 0) {
        const areaPyeong = Number(res?.activeRequest?.area_pyeong || 300);
        const initSelection: Record<string, { checked: boolean; qty: number }> = {};
        res.stageGroups.forEach((group: any, gIdx: number) => {
          const stageId =
            group.stage_group_code ||
            group.stage_group_id ||
            group.stage_group_name ||
            `STG-${gIdx + 1}`;
          (group.items || []).forEach((it: any) => {
            const topMats = [...(it.materials || [])]
              .sort((a: any, b: any) => Number(b?.match_score || 0) - Number(a?.match_score || 0))
              .slice(0, 1);
            topMats.forEach((mat: any) => {
              const matKey = `${stageId}__${it.item_id || ''}__${mat.material_id || mat.product_name}`;
              if (!initSelection[matKey]) {
                initSelection[matKey] = {
                  checked: true,
                  qty: parseRecommendedQuantity(mat, areaPyeong),
                };
              }
            });
          });
        });
        setPurchaseSelectionMap(initSelection);
        setSelectedPurchaseStageFilter('ALL');
      }
      if (res?.scheduleItems?.length > 0) {
        const targetId = opts?.preserveItemId;
        const matchedTarget = targetId
          ? res.scheduleItems.find((it: any) => it.item_id === targetId)
          : null;
        const plantingItem =
          matchedTarget ||
          res.scheduleItems.find(
            (it: any) =>
              String(it.sub_item_name || '').includes('정식') ||
              String(it.sub_item_name || '').includes('아주심기')
          ) ||
          res.scheduleItems[0];
        setSelectedStageItem(plantingItem);
        setEditDetailForm({ ...plantingItem });
        if (matchedTarget && clickedProvisionItem) {
          setClickedProvisionItem(matchedTarget);
        }
      }
      if (res?.availableMaterialsCatalog?.length > 0 && !selectedCatalogMatId) {
        setSelectedCatalogMatId(res.availableMaterialsCatalog[0].material_id);
      }
    } catch {
      // ignore
    } finally {
      setIsProvisionLoading(false);
    }
  };

  useEffect(() => {
    fetch('/api/overview')
      .then((r) => r.json())
      .then((res) => setData(res))
      .catch(() => {});

    fetch('/api/prescriptions')
      .then((r) => r.json())
      .then((res) => setPrescriptions(res))
      .catch(() => {});

    fetch('/api/payment-bank-accounts')
      .then((r) => r.json())
      .then((res) => {
        const list = res?.items || res?.accounts || [];
        const primary = list.find((a: any) => a.is_primary) || list[0];
        if (primary) setPrimaryBankAccount(primary);
      })
      .catch(() => {});

    loadMyPageData('CloudBae@naver.com');

    fetch('/api/addresses/meta')
      .then((r) => r.json())
      .then((res) => {
        if (res?.sidos) {
          setAdminAddrMeta({
            sidos: res.sidos || [],
            sigungusBySido: res.sigungusBySido || {},
          });
        }
      })
      .catch(() => {});

    searchAdminCultivationDb({ sido: '충청북도', sigungu: '충주시', q: '' });
  }, []);

  useEffect(() => {
    loadScheduleProvision(selectedRequestNo, { gdd_mode: patentGddMode });
  }, [selectedRequestNo]);

  useEffect(() => {
    if (
      activeMenu === '농작물 구매' ||
      activeMenu === '농자재 판매' ||
      activeMenu === '비료' ||
      activeMenu === '영양제' ||
      activeMenu === '병해충관리제' ||
      activeMenu === '병해충방지제' ||
      activeMenu === '씨' ||
      activeMenu === '모종'
    ) {
      fetch('/api/overview')
        .then((r) => r.json())
        .then((res) => setData(res))
        .catch(() => {});
      const cat =
        activeMenu === '농작물 구매' || activeMenu === '농자재 판매'
          ? mobileAgroCategoryTab
          : getUserAgroCategoryFromMenu(activeMenu);
      setMobileAgroCategoryTab(cat);
      setUserAgroMainTypeFilter('ALL');
      setUserAgroSubTypeFilter('ALL');
      setUserAgroOrganicFilter('ALL');
      setUserAgroKeyword('');
      setSelectedUserAgroDetail(null);
      executeUserAgroMaterialSearch({
        category: cat,
        main_type: 'ALL',
        sub_type: 'ALL',
        is_organic: 'ALL',
        q: '',
      });
    }
  }, [activeMenu]);

  useEffect(() => {
    const syncCategoriesOnFocus = () => {
      fetch('/api/overview')
        .then((r) => r.json())
        .then((res) => setData(res))
        .catch(() => {});
    };
    const syncCategoriesOnStorage = (e: StorageEvent) => {
      if (e.key === 'hanfarm_static_overview_v1' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object') {
            setData((prev) => (prev ? { ...prev, ...parsed } : parsed));
          }
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('focus', syncCategoriesOnFocus);
    window.addEventListener('storage', syncCategoriesOnStorage);
    return () => {
      window.removeEventListener('focus', syncCategoriesOnFocus);
      window.removeEventListener('storage', syncCategoriesOnStorage);
    };
  }, []);

  const handleSelectStageItem = (item: any) => {
    setSelectedStageItem(item);
    setEditDetailForm({ ...item });
    setDetailSaveMessage('');
    if (item?.start_date && /^\d{4}-\d{2}-\d{2}$/.test(item.start_date)) {
      const [y, m] = item.start_date.split('-').map(Number);
      setCalendarYearMonth({ year: y, month: m });
    }
  };

  const recentRecommendations = [
    {
      request_no: 'REQ-20261106-009',
      region: '충청북도 충주시 단월동',
      stage: '정식',
      crop: '가을배추 (불암3호)',
      planting_type: '모종',
      opt_temp: '18~20℃ 적온',
      recommended_date: '2026-08-25',
      status: '정식 적기 추천',
    },
    {
      request_no: 'REQ-20261106-008',
      region: '충청북도 충주시 단월동',
      stage: '파종',
      crop: '가을배추 (청명가을)',
      planting_type: '씨 (발아 20℃↑)',
      opt_temp: '18~21℃ 적온',
      recommended_date: '2026-08-05',
      status: '최적 발아기후',
    },
    {
      request_no: 'REQ-20261106-005',
      region: '강원특별자치도 평창군 방림면',
      stage: '정식',
      crop: '봄배추 (춘광)',
      planting_type: '모종',
      opt_temp: '15~18℃ 적온',
      recommended_date: '2026-05-12',
      status: '한계온도 회피',
    },
    {
      request_no: 'REQ-20261106-003',
      region: '전라남도 해남군 산이면',
      stage: '정식',
      crop: '월동배추 (해남1호)',
      planting_type: '모종',
      opt_temp: '16~20℃ 적온',
      recommended_date: '2026-09-10',
      status: '정식 적기 추천',
    },
  ];

  const recommendedMaterials = [
    {
      id: 'MAT-01',
      name: '맞춤 슈퍼배추 밑거름 특호 (완효성)',
      category: '비료',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      stageBadge: '밑거름 · 정식전',
      stageColor: 'bg-teal-50 text-teal-700 border-teal-200',
      dosage: '20kg / 300평 기준 3포',
      price: '18,500원',
    },
    {
      id: 'MAT-02',
      name: '칼슘·붕소 결구강화 액상 영양제',
      category: '영양제',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
      stageBadge: '결구초기 · 생육관리',
      stageColor: 'bg-purple-50 text-purple-700 border-purple-200',
      dosage: '500ml (1,000배 희석)',
      price: '22,000원',
    },
    {
      id: 'MAT-03',
      name: '엔케이(NK) 추비 전용 웃거름 비료',
      category: '비료',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      stageBadge: '1·2차 웃거름',
      stageColor: 'bg-sky-50 text-sky-700 border-sky-200',
      dosage: '20kg / 300평 기준 2포',
      price: '16,800원',
    },
    {
      id: 'MAT-04',
      name: '배추 무름병·뿌리혹병 예방 입제',
      category: '병해충관리제',
      badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
      stageBadge: '강우예보 전후 방제',
      stageColor: 'bg-rose-50 text-rose-700 border-rose-200',
      dosage: '3kg / 토양 혼화 처리',
      price: '19,500원',
    },
  ];

  // ==================== 기후 연동 후속 생육과정 자동 재산출 계산 (관리자 세부 폼과 100% 동일 로직) ====================
  const detailItem = editDetailForm || selectedStageItem;
  const origStart = selectedStageItem?.start_date || '2026-08-25';
  const origEnd = selectedStageItem?.end_date || origStart;
  const curStart = detailItem?.start_date || origStart;
  const origDurationSpan = Math.max(0, diffDaysBetweenYmd(origStart, origEnd));
  const curEnd = addDaysToYmd(curStart, origDurationSpan);
  const cascadeDeltaDays = diffDaysBetweenYmd(origStart, curStart);

  const cropMinT = Number(
    provisionData?.croppingSystem?.crop_min_temp ?? provisionData?.croppingSystem?.limit_temp_min ?? 5
  );
  const cropMaxT = Number(
    provisionData?.croppingSystem?.crop_max_temp ?? provisionData?.croppingSystem?.upper_limit_temp ?? 26
  );
  const optMinT = Number(provisionData?.croppingSystem?.opt_temp_min ?? 18);
  const optMaxT = Number(provisionData?.croppingSystem?.opt_temp_max ?? 20);
  const optMidT = Number(((optMinT + optMaxT) / 2).toFixed(1));
  const cropOptTempText = String(provisionData?.croppingSystem?.crop_opt_temp || `${optMinT}~${optMaxT}℃`);

  const dailyClimateList: any[] = Array.isArray(provisionData?.climateOverview?.daily_climate_365)
    ? provisionData.climateOverview.daily_climate_365
    : [];
  const climateByYmd = new Map<string, any>();
  const climateByMmDd = new Map<string, any>();
  for (const dc of dailyClimateList) {
    if (dc?.date) {
      climateByYmd.set(dc.date, dc);
      climateByMmDd.set(dc.date.slice(5, 10), dc);
    }
  }

  const getDayClimate = (ymd: string) => {
    const found = climateByYmd.get(ymd) || climateByMmDd.get(String(ymd || '').slice(5, 10));
    if (found) return found;
    const fallbackAvg = Number(detailItem?.climate_stats?.avg_temp ?? 18.5);
    return {
      date: ymd,
      weekday: getWeekdayNameFromYmd(ymd),
      temp_avg: fallbackAvg,
      temp_min: Number((fallbackAvg - 4.2).toFixed(1)),
      temp_max: Number((fallbackAvg + 4.2).toFixed(1)),
      effective_temp_avg: Number((fallbackAvg + 1.5).toFixed(1)),
      past_temp_avg: fallbackAvg,
      forecast_temp_avg: fallbackAvg,
      humidity_avg: 65,
      precipitation_mm: 0,
      daily_pgdd: 11.5,
      is_within_crop_limits: fallbackAvg >= cropMinT && fallbackAvg <= cropMaxT,
      is_within_opt_temp: fallbackAvg >= optMinT && fallbackAvg <= optMaxT,
    };
  };

  const findClimateRecommendedSingleDate = (
    candidateBaseYmd: string,
    minAllowedYmd: string,
    stageSlotKey: string
  ) => {
    const safeBaseYmd = candidateBaseYmd < minAllowedYmd ? minAllowedYmd : candidateBaseYmd;
    let bestYmd = safeBaseYmd;
    let bestScore = -99999;
    let bestShiftFromBase = 0;

    for (let offset = -4; offset <= 7; offset++) {
      const candYmd = addDaysToYmd(safeBaseYmd, offset);
      if (candYmd < minAllowedYmd) continue;
      const c = getDayClimate(candYmd);
      const tAvg = Number(c.temp_avg ?? 18);
      const effT = Number(c.effective_temp_avg ?? tAvg);
      const pastT = Number(c.past_temp_avg ?? tAvg);
      const precip = Number(c.precipitation_mm ?? 0);
      const hum = Number(c.humidity_avg ?? 65);

      let score = 100 - Math.abs(offset) * 2.5;
      if (tAvg < cropMinT || tAvg > cropMaxT || pastT < cropMinT || pastT > cropMaxT) {
        score -= 150;
      } else {
        score += 35;
      }

      if (effT >= optMinT && effT <= optMaxT) {
        score += 50;
      } else if (tAvg >= optMinT && tAvg <= optMaxT) {
        score += 42;
      } else {
        score -= Math.abs(effT - optMidT) * 5.5;
      }

      if (stageSlotKey === 'STG-HARVEST') {
        if (precip === 0) score += 25;
        else if (precip >= 3) score -= 65;
        if (hum <= 70) score += 12;
      } else {
        if (precip >= 10) score -= 60;
        else if (precip <= 2) score += 18;
        if (hum >= 55 && hum <= 78) score += 10;
      }

      if (score > bestScore) {
        bestScore = score;
        bestYmd = candYmd;
        bestShiftFromBase = diffDaysBetweenYmd(safeBaseYmd, candYmd);
      }
    }

    const chosenC = getDayClimate(bestYmd);
    const isOptMatched =
      (Number(chosenC.effective_temp_avg) >= optMinT && Number(chosenC.effective_temp_avg) <= optMaxT) ||
      (Number(chosenC.temp_avg) >= optMinT && Number(chosenC.temp_avg) <= optMaxT);

    const climateBadge = isOptMatched
      ? `최적온도(${cropOptTempText}) 일치 추천`
      : `한계온도(${cropMinT}~${cropMaxT}℃) 안전·적정기후 추천`;

    const climateDetailText = `기온 ${chosenC.temp_avg}℃ · 습도 ${chosenC.humidity_avg}% · 강수 ${chosenC.precipitation_mm}mm`;

    return {
      recommendedDate: bestYmd,
      recommendedWithWeekday: formatYmdWithWeekday(bestYmd),
      shiftFromBase: bestShiftFromBase,
      dayClimate: chosenC,
      climateBadge,
      climateDetailText,
    };
  };

  const curDayClimate = getDayClimate(curStart);
  const subsequentItems = (provisionData?.scheduleItems || []).filter(
    (it: any) => Number(it.step_order) > Number(selectedStageItem?.step_order ?? 0)
  );

  let prevRecommendedYmd = curStart;
  const cascadedSubsequentPreview = subsequentItems.map((sub: any) => {
    const subOrigSpan = Math.max(0, diffDaysBetweenYmd(sub.start_date, sub.end_date));
    const baseShiftedYmd = addDaysToYmd(sub.start_date, cascadeDeltaDays);
    const minAllowedForSub =
      sub.stage_slot_key === 'STG-PEST' ? addDaysToYmd(curStart, -10) : prevRecommendedYmd;
    const rec = findClimateRecommendedSingleDate(
      baseShiftedYmd,
      minAllowedForSub,
      sub.stage_slot_key || sub.stage_group_id
    );
    if (sub.stage_slot_key !== 'STG-PEST' && rec.recommendedDate > prevRecommendedYmd) {
      prevRecommendedYmd = rec.recommendedDate;
    }
    const newStartYmd = rec.recommendedDate;
    const newEndYmd = addDaysToYmd(newStartYmd, subOrigSpan);
    const totalDiffDays = diffDaysBetweenYmd(sub.start_date, newStartYmd);

    return {
      ...sub,
      prev_start_date: sub.start_date,
      prev_date_with_weekday: formatYmdWithWeekday(sub.start_date),
      start_date: newStartYmd,
      end_date: newEndYmd,
      recommended_date: newStartYmd,
      recommended_date_with_weekday: rec.recommendedWithWeekday,
      total_shift_days: totalDiffDays,
      climate_badge: rec.climateBadge,
      climate_detail_text: rec.climateDetailText,
      day_climate: rec.dayClimate,
    };
  });

  const handleSaveUserScheduleCascade = async () => {
    if (!editDetailForm || !selectedStageItem) return;
    setIsSavingDetailItem(true);
    setDetailSaveMessage('');
    try {
      const updatedCurrent = {
        ...editDetailForm,
        start_date: curStart,
        end_date: curEnd,
        recommended_date: curStart,
        recommended_date_with_weekday: formatYmdWithWeekday(curStart),
      };
      const itemsToSave = [
        updatedCurrent,
        ...(cascadeDeltaDays !== 0 ? cascadedSubsequentPreview : []),
      ];

      const res = await fetch('/api/schedule-provision/update-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_no: provisionData?.activeRequest?.request_no || selectedRequestNo,
          cultivar_id: provisionData?.activeRequest?.cultivar_id || 'CV-BRM3',
          updated_item: updatedCurrent,
          cascaded_items: cascadeDeltaDays !== 0 ? cascadedSubsequentPreview : [],
          items_to_save: itemsToSave,
        }),
      });
      const json = await res.json();

      await loadScheduleProvision(selectedRequestNo, {
        gdd_mode: patentGddMode,
        preserveItemId: updatedCurrent.item_id,
      });
      setDetailSaveMessage(
        cascadeDeltaDays !== 0
          ? `추천 진행일(${formatYmdWithWeekday(curStart)}) 승인 완료! 이후 ${subsequentItems.length}개 생육과정이 기후 조건(최저·최고온도 회피 및 적정온도 추천)에 맞춘 새 일정으로 업데이트되었습니다.`
          : json.message || '생육과정 세부 정보가 저장되었습니다.'
      );
    } catch {
      setDetailSaveMessage('일정 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSavingDetailItem(false);
    }
  };

  const handleResetUserSchedule = async () => {
    setIsSavingDetailItem(true);
    try {
      await fetch('/api/schedule-provision/update-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_no: selectedRequestNo,
          reset_request: true,
        }),
      });
      await loadScheduleProvision(selectedRequestNo, {
        gdd_mode: patentGddMode,
        preserveItemId: selectedStageItem?.item_id,
      });
      setDetailSaveMessage('초기 AI 365일 기후 산출 일정으로 복원되었습니다.');
    } finally {
      setIsSavingDetailItem(false);
    }
  };

  // 월간 달력 렌더링 데이터 생성
  const buildCalendarDays = (year: number, month: number) => {
    const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
    const lastDate = new Date(year, month, 0).getDate();
    const cells: Array<{ day: number | null; ymd: string; items: any[] }> = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({ day: null, ymd: '', items: [] });
    }
    const allItems = provisionData?.scheduleItems || [];
    for (let d = 1; d <= lastDate; d++) {
      const ymd = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const matched = allItems.filter((it: any) => it.start_date === ymd);
      cells.push({ day: d, ymd, items: matched });
    }
    return cells;
  };

  const calendarCells = buildCalendarDays(calendarYearMonth.year, calendarYearMonth.month);
  const monthScheduledItems = (provisionData?.scheduleItems || []).filter((it: any) =>
    String(it.start_date || '').startsWith(
      `${calendarYearMonth.year}-${String(calendarYearMonth.month).padStart(2, '0')}`
    )
  );

  // 안드로이드 APK(WebView) 환경에서 시스템 상태표시줄(시계·배터리 영역) 및 하단 내비게이션 바와 겹치지 않도록 안전 여백 감지
  const isLegacyAndroidWebView =
    typeof navigator !== 'undefined' &&
    /Android/i.test(navigator.userAgent) &&
    (/;\s*wv\)/i.test(navigator.userAgent) || /Version\/\d+\.\d+\s+Chrome/i.test(navigator.userAgent)) &&
    !/FarmPlanSafeInset/i.test(navigator.userAgent);

  // 재배일정 확인 / 재배일정 요청 양방향 전환용 상단 폴더형 카드 탭 (농작물 구매 페이지와 동일한 구조)
  const renderScheduleNavigationTabs = () => {
    const isCheckTab = activeMenu === '재배일정 확인';
    const isRequestTab = activeMenu === '재배일정 요청';

    return (
      <>
        {/* ==================== [모바일 전용: 초슬림 상단 고정 화이트 플로팅 2분할 폴더/카드 탭] ==================== */}
        <div
          className={`lg:hidden sticky z-20 -mx-4 -mt-5 px-3 pt-1.5 pb-1.5 bg-[#F4F6F5]/95 backdrop-blur-md border-b border-slate-200/80 shadow-[0_2px_8px_rgba(15,23,42,0.04)] space-y-1.5 ${
            isLegacyAndroidWebView
              ? 'top-[calc(max(34px,env(safe-area-inset-top,34px))+3.8rem)] sm:top-[calc(max(34px,env(safe-area-inset-top,34px))+5.3rem)]'
              : 'top-[calc(env(safe-area-inset-top,0px)+3.8rem)] sm:top-[calc(env(safe-area-inset-top,0px)+5.3rem)]'
          }`}
        >
          {/* 상단 타이틀 & 빠른 일정 요청 버튼 (컴팩트 높이) */}
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-1.5">
              <h2 className="text-[17px] font-black tracking-tight text-slate-900 leading-none">
                재배일정
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-[#DDF5E8] text-[11px] font-extrabold text-[#11643C] leading-none">
                총 {cloudBaeCropList.length}건
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setReqFormSubmitted(false);
                setScheduleReqModalPos({ x: 0, y: 0 });
                setIsScheduleReqModelessOpen(true);
              }}
              className="px-2.5 py-1 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-extrabold shadow-xs shadow-emerald-600/20 transition cursor-pointer inline-flex items-center gap-1 leading-none"
            >
              <FileEdit className="w-3 h-3" />
              <span>+ 일정 요청</span>
            </button>
          </div>

          {/* 일체형 화이트 플로팅 카드 (재배일정 요청 / 재배일정 확인 좌측 정렬 초슬림 탭) */}
          <div className="bg-white rounded-2xl p-1.5 shadow-[0_4px_16px_rgba(15,23,42,0.06)] border border-slate-200/85">
            <div className="flex items-stretch justify-start gap-1.5">
              {[
                {
                  key: '재배일정 요청' as const,
                  label: '재배일정 요청',
                  active: isRequestTab,
                  renderIcon: (active: boolean) => (
                    <svg viewBox="0 0 36 36" className="w-5 h-5 shrink-0" fill="none">
                      <rect
                        x="7"
                        y="6.5"
                        width="18"
                        height="23"
                        rx="3.5"
                        fill={active ? '#ffffff' : '#E2E8F0'}
                        fillOpacity={active ? '0.2' : '0.65'}
                        stroke={active ? '#ffffff' : '#334155'}
                        strokeWidth="2.2"
                      />
                      <path
                        d="M11.5 13h9M11.5 17.5h6"
                        stroke={active ? '#ffffff' : '#334155'}
                        strokeWidth="2.1"
                        strokeLinecap="round"
                      />
                      <circle
                        cx="24.5"
                        cy="23.5"
                        r="5.5"
                        fill={active ? '#A7F3D0' : '#5BB89A'}
                        stroke={active ? '#ffffff' : '#334155'}
                        strokeWidth="2"
                      />
                      <path
                        d="M24.5 20.8v5.4M21.8 23.5h5.4"
                        stroke={active ? '#059669' : '#ffffff'}
                        strokeWidth="2.3"
                        strokeLinecap="round"
                      />
                    </svg>
                  ),
                },
                {
                  key: '재배일정 확인' as const,
                  label: '재배일정 확인',
                  active: isCheckTab,
                  renderIcon: (active: boolean) => (
                    <svg viewBox="0 0 36 36" className="w-5 h-5 shrink-0" fill="none">
                      <rect
                        x="6.5"
                        y="8.5"
                        width="23"
                        height="21"
                        rx="4"
                        fill={active ? '#ffffff' : '#E2E8F0'}
                        fillOpacity={active ? '0.2' : '0.65'}
                        stroke={active ? '#ffffff' : '#334155'}
                        strokeWidth="2.2"
                      />
                      <path
                        d="M6.5 14.5h23M12.5 5.5v5M23.5 5.5v5"
                        stroke={active ? '#ffffff' : '#334155'}
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                      <circle
                        cx="18"
                        cy="22"
                        r="5.2"
                        fill={active ? '#A7F3D0' : '#5BB89A'}
                        stroke={active ? '#ffffff' : '#334155'}
                        strokeWidth="1.9"
                      />
                      <path
                        d="M15.8 22l1.6 1.6 3.2-3.2"
                        stroke={active ? '#059669' : '#ffffff'}
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ),
                },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setActiveMenu(tab.key);
                    if (tab.key === '재배일정 확인') {
                      setMobileScheduleStep('list');
                    }
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`w-[32%] max-w-[118px] relative flex flex-col items-center justify-center py-1 px-1.5 rounded-xl transition-all duration-150 cursor-pointer shrink-0 ${
                    tab.active
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-600 shadow-xs shadow-emerald-600/20'
                      : 'bg-white hover:bg-slate-50 text-slate-900 border border-slate-200/95'
                  }`}
                >
                  <div className="h-5 flex items-center justify-center mb-0.5">
                    {tab.renderIcon(tab.active)}
                  </div>
                  <span
                    className={`flex items-center justify-center text-center tracking-tighter text-[13.5px] min-[390px]:text-[14.5px] sm:text-[15.5px] leading-tight font-black whitespace-nowrap ${
                      tab.active ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ==================== [PC 전용 (lg 이상): 3D 와이드 배너 + 좌측 정렬 1/3 폭 초슬림 폴더형 탭] ==================== */}
        <div className="hidden lg:block space-y-4">
          <section className="rounded-3xl overflow-hidden border border-slate-200/80 shadow-xs bg-sky-100">
            <div className="relative w-full">
              <img
                src={
                  isRequestTab
                    ? '/images/user-schedule-request-3d-banner.jpg?v=20261109'
                    : '/images/user-schedule-check-3d-banner.jpg?v=20261109'
                }
                alt={
                  isRequestTab
                    ? '모종·씨앗과 토양센서로 맞춤형 재배일정을 요청하는 3D 농부 캐릭터 배너'
                    : '생육과정 타임라인과 기온을 확인하며 재배일정을 점검하는 3D 농부 캐릭터 배너'
                }
                className="w-full h-auto min-h-[140px] object-cover object-center block"
              />
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-2 shadow-xs">
            <div className="bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 flex items-stretch justify-start gap-2">
              {[
                {
                  menu: '재배일정 요청' as const,
                  label: '재배일정 요청',
                  icon: FileEdit,
                },
                {
                  menu: '재배일정 확인' as const,
                  label: '재배일정 확인',
                  icon: Calendar,
                },
              ].map((tabItem) => {
                const TabIcon = tabItem.icon;
                const isCurrentTab = activeMenu === tabItem.menu;
                return (
                  <button
                    key={tabItem.menu}
                    type="button"
                    onClick={() => {
                      setActiveMenu(tabItem.menu);
                      if (tabItem.menu === '재배일정 확인') {
                        setMobileScheduleStep('list');
                      }
                    }}
                    className={`w-[190px] xl:w-[210px] shrink-0 group relative rounded-lg px-3.5 py-2 text-left transition-all duration-150 cursor-pointer flex items-center gap-2.5 ${
                      isCurrentTab
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-600 shadow-xs shadow-emerald-600/20'
                        : 'bg-white/85 hover:bg-white text-slate-700 border border-slate-200/70 hover:border-emerald-300 shadow-2xs'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition ${
                        isCurrentTab
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 text-emerald-700 group-hover:bg-emerald-50'
                      }`}
                    >
                      <TabIcon className="w-4 h-4" />
                    </div>
                    <span
                      className={`text-[15px] font-extrabold tracking-tight truncate ${
                        isCurrentTab ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      {tabItem.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </>
    );
  };

  return (
    <div
      className={`min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col break-keep ${
        isLegacyAndroidWebView ? 'pb-12' : ''
      }`}
      style={{
        paddingBottom: isLegacyAndroidWebView
          ? 'max(48px, env(safe-area-inset-bottom, 0px))'
          : 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* ==================== MODULE 1: 상단 와이드 GNB 헤더 바 ==================== */}
      <header
        className="bg-white/95 backdrop-blur-md border-b border-emerald-100 sticky top-0 z-30 shadow-[0_4px_20px_-4px_rgba(16,185,129,0.08)]"
        style={{
          paddingTop: isLegacyAndroidWebView
            ? 'max(34px, env(safe-area-inset-top, 34px))'
            : 'env(safe-area-inset-top, 0px)',
        }}
      >
        <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600" />
        <div className="max-w-[1600px] w-full mx-auto px-2.5 sm:px-8 xl:px-10 h-14 sm:h-20 flex items-center justify-between gap-1.5 sm:gap-4">
          {/* 좌측: 모바일 좌측 슬라이드 메뉴 버튼 + 로고 + PC 전용 가로 메뉴 독(Dock) */}
          <div className="flex items-center gap-1.5 sm:gap-5 xl:gap-8 min-w-0">
            {/* 모바일 환경 전용: 좌측에서 나오는 슬라이드 메뉴 열기 버튼 (고령자 친화 38px 균일 높이 & 굵은 폰트) */}
            <button
              type="button"
              onClick={() => setIsMobileGnbDrawerOpen(true)}
              aria-label="전체 메뉴 열기"
              className="lg:hidden inline-flex items-center justify-center gap-1 px-2.5 min-[390px]:px-3 h-[38px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[13px] min-[390px]:text-[13.5px] font-black leading-none whitespace-nowrap shadow-xs cursor-pointer transition shrink-0"
            >
              <span className="flex flex-col gap-1 w-3.5" aria-hidden="true">
                <span className="block h-0.5 w-full bg-white rounded-full" />
                <span className="block h-0.5 w-full bg-white rounded-full" />
                <span className="block h-0.5 w-full bg-white rounded-full" />
              </span>
              <span>메뉴</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMenu('홈')}
              className="h-[38px] sm:h-auto flex items-center gap-1.5 sm:gap-2.5 min-w-0 shrink-0 cursor-pointer group text-left whitespace-nowrap"
            >
              <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white shadow-xs shadow-emerald-600/25 ring-1 sm:ring-2 ring-emerald-100 group-hover:from-emerald-400 group-hover:to-emerald-600 transition shrink-0">
                <Sprout className="w-4 h-4 sm:w-6 sm:h-6 stroke-[2.3]" />
              </div>
              <div className="flex flex-col justify-center">
                <div className="flex items-center gap-1">
                  <span className="font-black text-[16px] min-[380px]:text-[17px] sm:text-[24px] tracking-tight block leading-none whitespace-nowrap">
                    <span className="text-[#063820] group-hover:text-emerald-800 transition">Farm</span>
                    <span className="text-[#059669] group-hover:text-emerald-500 transition">Plan</span>
                  </span>
                  <span className="hidden xl:inline-flex px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[10px] font-extrabold text-emerald-700 leading-none">
                    한팜
                  </span>
                </div>
                <span className="text-[10.5px] text-emerald-800/75 font-bold hidden sm:inline whitespace-nowrap mt-0.5">
                  나의 맞춤형 재배관리
                </span>
              </div>
            </button>

            {/* 태블릿(md) 상단 현재 선택 메뉴 배지 (모바일 소형 화면에서는 로고 잘림 방지를 위해 숨김) */}
            <span className="hidden md:inline-flex lg:hidden px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-extrabold whitespace-nowrap truncate max-w-[140px]">
              {activeMenu}
            </span>

            {/* PC 버전 상단 가로 캡슐형 메뉴 바 */}
            <nav className="hidden lg:flex items-center gap-1 bg-slate-50/95 border border-slate-200/80 p-1.5 rounded-2xl shadow-2xs overflow-x-auto no-scrollbar">
              {userMenus.map((menu) => {
                const isAgroMenu =
                  activeMenu === '농작물 구매' ||
                  activeMenu === '농자재 판매' ||
                  activeMenu === '비료' ||
                  activeMenu === '영양제' ||
                  activeMenu === '병해충관리제' ||
                  activeMenu === '병해충방지제' ||
                  activeMenu === '씨' ||
                  activeMenu === '모종';
                const isActive = menu === '농작물 구매' ? isAgroMenu : activeMenu === menu;
                const menuIconMap: Record<string, any> = {
                  홈: Home,
                  '재배일정 요청': FileEdit,
                  '재배일정 확인': Calendar,
                  '농작물 구매': ShoppingBag,
                  마이페이지: User,
                };
                const MenuIcon = menuIconMap[menu] || Sprout;
                const showDividerBefore = menu === '농작물 구매' || menu === '마이페이지';
                return (
                  <React.Fragment key={menu}>
                    {showDividerBefore && (
                      <span className="h-5 w-px bg-slate-200/90 mx-0.5 shrink-0" aria-hidden="true" />
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (menu === '농작물 구매') {
                          setMobileAgroCategoryTab('FERTILIZER');
                          setActiveMenu('비료');
                        } else {
                          setActiveMenu(menu);
                        }
                        if (menu === '재배일정 확인') {
                          setMobileScheduleStep('list');
                        }
                      }}
                      className={`px-3 xl:px-4 py-2 rounded-xl inline-flex items-center gap-1.5 text-[14px] xl:text-[15px] font-extrabold whitespace-nowrap transition-all duration-150 cursor-pointer tracking-tight ${
                        isActive
                          ? 'bg-emerald-600 text-white shadow-xs shadow-emerald-600/25'
                          : 'text-slate-700 hover:text-emerald-800 hover:bg-emerald-50/90'
                      }`}
                    >
                      <MenuIcon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-white' : 'text-emerald-600/85'
                        }`}
                      />
                      <span>{menu}</span>
                    </button>
                  </React.Fragment>
                );
              })}
            </nav>
          </div>

          {/* 우측: 로그인 전에는 [로그인] / [회원가입]만 표시, 로그인 후에만 회원 이름(배철민 님) 배지 표시 (모바일 38px 균일 높이 & 고령자 친화 폰트) */}
          <div className="flex items-center gap-1 min-[390px]:gap-1.5 sm:gap-2 shrink-0">
            {loggedInUser.isLoggedIn ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setActiveMenu('마이페이지');
                    setMyPageTab('FARMLAND');
                  }}
                  className="h-[38px] sm:h-10 px-2.5 sm:px-4 rounded-xl border border-emerald-300 bg-emerald-50/90 hover:bg-emerald-100 text-slate-900 font-black text-[13px] min-[390px]:text-[13.5px] sm:text-sm leading-none inline-flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap transition cursor-pointer shadow-2xs"
                >
                  <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-emerald-600 text-white inline-flex items-center justify-center text-[11px] sm:text-xs font-extrabold shrink-0">
                    {loggedInUser.name.slice(0, 1)}
                  </span>
                  <span className="font-black text-emerald-950 whitespace-nowrap">
                    {loggedInUser.name} 님
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="h-[38px] sm:h-10 px-2.5 min-[390px]:px-3 sm:px-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-black text-[13px] min-[390px]:text-[13.5px] sm:text-sm leading-none inline-flex items-center justify-center whitespace-nowrap transition cursor-pointer shadow-2xs"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setAuthNoticeMsg(null);
                    setShowGmailPicker(false);
                    setAuthModalTab('LOGIN');
                    setIsAuthModalOpen(true);
                  }}
                  className="h-[38px] sm:h-10 px-2.5 min-[390px]:px-3 sm:px-4 rounded-xl border-2 border-emerald-600 bg-white hover:bg-emerald-50 text-emerald-700 font-black text-[13px] min-[390px]:text-[13.5px] sm:text-sm leading-none inline-flex items-center justify-center whitespace-nowrap transition cursor-pointer shadow-2xs"
                >
                  로그인
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAuthNoticeMsg(null);
                    setShowRoadSearchBox(false);
                    setAuthModalTab('SIGNUP');
                    setIsAuthModalOpen(true);
                  }}
                  className="h-[38px] sm:h-10 px-2.5 min-[390px]:px-3 sm:px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[13px] min-[390px]:text-[13.5px] sm:text-sm leading-none inline-flex items-center justify-center whitespace-nowrap transition cursor-pointer shadow-xs shadow-emerald-600/20"
                >
                  회원가입
                </button>
              </>
            )}
            <Link
              to="/admin"
              className="hidden sm:inline-flex items-center justify-center gap-1 h-10 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs whitespace-nowrap transition"
            >
              <span>관리자</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ==================== 모바일 전용 좌측 슬라이드 PC버전 전체 메뉴 드로어 ==================== */}
      {isMobileGnbDrawerOpen && (
        <div
          onClick={() => setIsMobileGnbDrawerOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/45 backdrop-blur-[1px] lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[300px] sm:w-[320px] max-w-[86vw] bg-white shadow-2xl border-r border-slate-200 flex flex-col transition-transform duration-300 ease-in-out lg:hidden ${
          isMobileGnbDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          paddingTop: isLegacyAndroidWebView
            ? 'max(34px, env(safe-area-inset-top, 34px))'
            : 'env(safe-area-inset-top, 0px)',
          paddingBottom: isLegacyAndroidWebView
            ? 'max(48px, env(safe-area-inset-bottom, 0px))'
            : 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* 드로어 상단 헤더 */}
        <div className="px-4 py-4 bg-[#E9F7F1] border-b border-emerald-200 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-xs">
              <Sprout className="w-5 h-5" />
            </div>
            <div>
              <div className="font-extrabold text-base text-slate-900 leading-none">
                FarmPlan 전체 메뉴
              </div>
              <div className="text-[11px] font-semibold text-emerald-800 mt-1">
                나의 맞춤형 재배일정 · 농자재 처방
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileGnbDrawerOpen(false)}
            aria-label="전체 메뉴 닫기"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-extrabold cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>닫기</span>
          </button>
        </div>

        {/* 드로어 본문: 주요 서비스 메뉴 리스트 */}
        <div className="p-4 flex-1 overflow-y-auto space-y-2">
          <div className="px-2 pb-1 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
            주요 서비스 메뉴 ({userMenus.length}개)
          </div>
          {[
            {
              menu: '홈',
              desc: '맞춤형 영농 브리핑 및 핵심 기능 안내',
              badge: '메인',
              icon: Home,
            },
            {
              menu: '재배일정 요청',
              desc: '내 아이디 요청 이력 조회 및 신규 일정 요청',
              badge: `${cloudBaeCropList.length}건`,
              icon: FileEdit,
            },
            {
              menu: '재배일정 확인',
              desc: '48주 정밀 생육과정 타임라인 및 원클릭 구매',
              badge: '타임라인',
              icon: Calendar,
            },
            {
              menu: '농작물 구매',
              desc: '비료 · 영양제 · 병해충방지제 · 씨 · 모종 통합 마켓',
              badge: '5대 카테고리',
              icon: ShoppingBag,
            },
            {
              menu: '마이페이지',
              desc: '내 재배지 · 재배작물 · 진행율 · 구매현황 관리',
              badge: '내 농장',
              icon: User,
            },
          ].map((item) => {
            const IconComp = item.icon;
            const isAgroMenu =
              activeMenu === '농작물 구매' ||
              activeMenu === '농자재 판매' ||
              activeMenu === '비료' ||
              activeMenu === '영양제' ||
              activeMenu === '병해충관리제' ||
              activeMenu === '병해충방지제' ||
              activeMenu === '씨' ||
              activeMenu === '모종';
            const isSelected = item.menu === '농작물 구매' ? isAgroMenu : activeMenu === item.menu;
            return (
              <button
                key={item.menu}
                type="button"
                onClick={() => {
                  if (item.menu === '농작물 구매') {
                    setMobileAgroCategoryTab('FERTILIZER');
                    setActiveMenu('농작물 구매');
                  } else {
                    setActiveMenu(item.menu);
                  }
                  if (item.menu === '재배일정 확인') {
                    setMobileScheduleStep('list');
                  }
                  if (item.menu === '마이페이지') {
                    setMyPageTab('FARMLAND');
                  }
                  setIsMobileGnbDrawerOpen(false);
                }}
                className={`w-full text-left px-3.5 py-4 min-h-[72px] rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-slate-50/70 hover:bg-emerald-50/60 text-slate-800 border-slate-200/80'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-white text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    <IconComp className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div
                      className={`text-sm font-extrabold truncate ${
                        isSelected ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      {item.menu}
                    </div>
                    <div
                      className={`text-[11px] truncate mt-0.5 ${
                        isSelected ? 'text-emerald-100 font-medium' : 'text-slate-500 font-medium'
                      }`}
                    >
                      {item.desc}
                    </div>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold shrink-0 ${
                    isSelected ? 'bg-white text-emerald-800' : 'bg-white border border-slate-200 text-slate-700'
                  }`}
                >
                  {item.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* 드로어 하단: 관리자 콘솔 바로가기 */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 shrink-0">
          <Link
            to="/admin"
            onClick={() => setIsMobileGnbDrawerOpen(false)}
            className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold flex items-center justify-between transition"
          >
            <span>관리자 콘솔 (/admin) 바로가기</span>
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </aside>

      {/* ==================== 메인 컨테이너 (1600px 와이드 반응형) ==================== */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-3.5 sm:px-10 py-3.5 sm:py-6 space-y-3.5 sm:space-y-6">
        {/* ==================== [탭 1: 홈 (인트로 페이지)] ==================== */}
        {activeMenu === '홈' && (
          <>
            {/* MODULE 2: 분리된 3D 농부 캐릭터 와이드 배너 */}
            <section className="rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-200/80 shadow-xs bg-sky-100">
              <div className="relative w-full">
                <img
                  src="/images/user-intro-3d-farmers-banner.jpg?v=20261109-panoramic"
                  alt="풍작을 기뻐하는 3인의 3D 농부 캐릭터와 멀리 배추밭에서 일하는 농부들"
                  className="w-full h-auto min-h-[115px] sm:min-h-[140px] object-cover object-center block"
                />
              </div>
            </section>

            {/* MODULE 3-A: 다크 에메랄드 SMART FARM ENGINE 3단계 핵심 강점 도식 카드 (모바일 고령자 친화 대형 가독성 폰트 & PC 실시간 브리핑 동시 제공) */}
            <section className="rounded-[26px] sm:rounded-3xl bg-gradient-to-b from-[#084227] via-[#063820] to-[#042816] border border-[#155E3A] px-3.5 py-5 sm:p-7 lg:p-8 shadow-[0_10px_28px_rgba(4,40,22,0.2)] relative overflow-hidden">
              {/* 은은한 배경 빛 효과 */}
              <div
                className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-72 lg:w-[520px] h-36 lg:h-48 rounded-full bg-emerald-400/15 blur-2xl"
                aria-hidden="true"
              />

              {/* 상단 SMART FARM ENGINE 배지 & 메인 헤드라인 */}
              <div className="relative z-10 flex flex-col items-center lg:items-start text-center lg:text-left">
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
                  <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-[#22C55E] text-[#032211] font-black text-[13px] sm:text-xs tracking-wider uppercase shadow-xs">
                    SMART FARM ENGINE
                  </span>
                  <span className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-emerald-400/30 text-emerald-200 text-xs font-extrabold">
                    <span>📍 기후 빅데이터 · 적산온도(GDD/PGDD) · 토양검정 통합 알고리즘</span>
                  </span>
                </div>
                <div className="w-full flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mt-3">
                  <h1 className="text-[21px] min-[390px]:text-[22.5px] sm:text-3xl lg:text-[32px] font-black text-white tracking-tight leading-[1.35] break-keep">
                    <span className="block">기후 데이터로 세우고,</span>
                    <span className="block">실시간 날씨로 고치고, 맞춤 농자재까지!</span>
                  </h1>
                  <p className="hidden lg:block text-emerald-100/90 text-sm font-semibold max-w-xl leading-relaxed break-keep">
                    작년 실측 기후와 올해 6개월 예측 기상 데이터를 결합해 최저·최고 한계온도를 회피한 최적 파종·정식일을 산출하고,
                    생육과정별 적산온도 도달 시점에 맞춰 비료·영양제·병해충방지제를 정밀 처방합니다.
                  </p>
                </div>
              </div>

              <div className="relative z-10 mt-4.5 sm:mt-6 grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-7 items-stretch">
                {/* 3단계 타임라인 도식 (STEP 01 ~ STEP 03) */}
                <div className="lg:col-span-7 relative space-y-3 sm:space-y-3.5 flex flex-col justify-between">
                  {/* 좌측 수직 연결 라인 */}
                  <div
                    className="pointer-events-none absolute left-[9px] sm:left-[15px] top-[38px] bottom-[38px] w-[2px] bg-gradient-to-b from-[#34D399] via-[#10B981] to-[#34D399]"
                    aria-hidden="true"
                  />

                  {/* STEP 01 */}
                  <div className="flex items-center gap-2 sm:gap-3.5">
                    <div className="relative z-10 w-5 h-5 sm:w-8 sm:h-8 rounded-full bg-[#10B981]/25 border border-[#34D399]/60 flex items-center justify-center shrink-0">
                      <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#4ADE80] shadow-[0_0_8px_#4ADE80]" />
                    </div>
                    <div className="flex-1 min-w-0 rounded-2xl bg-[#0D4A2E]/90 border border-[#2A7A54]/85 px-3.5 py-3.5 sm:px-5 sm:py-4 flex items-center justify-between gap-2.5 shadow-inner">
                      <div className="min-w-0">
                        <div className="text-[14.5px] min-[390px]:text-[15.5px] sm:text-base font-black text-[#4ADE80] tracking-tight leading-snug break-keep">
                          STEP 01 · 스마트 데이터 일정 수립
                        </div>
                        <div className="text-[17.5px] min-[390px]:text-[18.5px] sm:text-xl font-black text-white tracking-tight leading-[1.3] mt-1 break-keep">
                          기후 빅데이터 · 적산온도(GDD) 맞춤 산출
                        </div>
                        <div className="hidden lg:flex flex-wrap items-center gap-1.5 mt-1.5">
                          <span className="px-2 py-0.5 rounded-md bg-white/10 text-emerald-200 text-[11px] font-bold">
                            모종: 한계온도 회피 · 최적온도 정식
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-white/10 text-emerald-200 text-[11px] font-bold">
                            씨: 발아적온 이상 조기 파종일 산출
                          </span>
                        </div>
                      </div>
                      {/* 위성 + 새싹 3D 일러스트 아이콘 */}
                      <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 flex items-center justify-center">
                        <svg viewBox="0 0 56 56" className="w-12 h-12 sm:w-14 sm:h-14" fill="none">
                          {/* 토양 둔덕 */}
                          <ellipse cx="26" cy="46" rx="16" ry="4.5" fill="#78350F" />
                          <ellipse cx="26" cy="45" rx="13" ry="3.2" fill="#92400E" />
                          {/* 새싹 */}
                          <path d="M26 45V35" stroke="#4ADE80" strokeWidth="2.4" strokeLinecap="round" />
                          <path
                            d="M26 38c0-4.2 3.5-7 7.5-7 0 4.2-3.5 7-7.5 7z"
                            fill="#4ADE80"
                          />
                          <path
                            d="M26 40c0-3.2-2.8-5.5-6-5.5 0 3.2 2.8 5.5 6 5.5z"
                            fill="#86EFAC"
                          />
                          {/* 전파 빔 */}
                          <path
                            d="M32 25c-2.5 1.8-5.5 1.8-8 0M34.5 29c-4 2.8-8.8 2.8-12.8 0"
                            stroke="#FDE047"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeDasharray="2 2"
                          />
                          {/* 위성 날개 및 본체 */}
                          <g transform="rotate(-28 32 16)">
                            <rect x="17" y="13" width="9" height="6" rx="1" fill="#38BDF8" stroke="#E0F2FE" strokeWidth="1" />
                            <rect x="36" y="13" width="9" height="6" rx="1" fill="#0284C7" stroke="#E0F2FE" strokeWidth="1" />
                            <rect x="27.5" y="11.5" width="7" height="9" rx="2" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1.2" />
                            <circle cx="31" cy="22" r="2" fill="#FACC15" />
                          </g>
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* STEP 02 */}
                  <div className="flex items-center gap-2 sm:gap-3.5">
                    <div className="relative z-10 w-5 h-5 sm:w-8 sm:h-8 rounded-full bg-[#10B981]/25 border border-[#34D399]/60 flex items-center justify-center shrink-0">
                      <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#4ADE80] shadow-[0_0_8px_#4ADE80]" />
                    </div>
                    <div className="flex-1 min-w-0 rounded-2xl bg-[#0D4A2E]/90 border border-[#2A7A54]/85 px-3.5 py-3.5 sm:px-5 sm:py-4 flex items-center justify-between gap-2.5 shadow-inner">
                      <div className="min-w-0">
                        <div className="text-[14.5px] min-[390px]:text-[15.5px] sm:text-base font-black text-[#4ADE80] tracking-tight leading-snug break-keep">
                          STEP 02 · 실시간 기후 변동 자동 업데이트
                        </div>
                        <div className="text-[17.5px] min-[390px]:text-[18.5px] sm:text-xl font-black text-white tracking-tight leading-[1.3] mt-1 break-keep">
                          이상기후 감지 · 작업일 실시간 보정
                        </div>
                        <div className="hidden lg:flex flex-wrap items-center gap-1.5 mt-1.5">
                          <span className="px-2 py-0.5 rounded-md bg-white/10 text-emerald-200 text-[11px] font-bold">
                            강우·폭염·한파 감지 시 후속 일정 연쇄 보정
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-white/10 text-emerald-200 text-[11px] font-bold">
                            요일 포함 단일 추천 진행일 제시
                          </span>
                        </div>
                      </div>
                      {/* 기상 레이더 3D 일러스트 아이콘 */}
                      <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 flex items-center justify-center">
                        <svg viewBox="0 0 56 56" className="w-12 h-12 sm:w-14 sm:h-14" fill="none">
                          <circle cx="28" cy="28" r="20" fill="#064E3B" stroke="#34D399" strokeWidth="2" />
                          <circle cx="28" cy="28" r="14" stroke="#10B981" strokeWidth="1.2" strokeDasharray="3 2" />
                          <circle cx="28" cy="28" r="7.5" stroke="#10B981" strokeWidth="1.2" />
                          {/* 레이더 스윕 */}
                          <path d="M28 28L42 16A20 20 0 0028 8v20z" fill="#34D399" fillOpacity="0.35" />
                          {/* 기상 히트 스팟 */}
                          <circle cx="24" cy="23" r="4.5" fill="#F97316" fillOpacity="0.85" />
                          <circle cx="24" cy="23" r="2" fill="#FDE047" />
                          {/* 우측 상단 해/구름 미니 배지 */}
                          <circle cx="41" cy="14" r="4" fill="#FACC15" />
                          <path
                            d="M36 18.5h8.5a3 3 0 000-6 4 4 0 00-7.6-1.2A3 3 0 0036 18.5z"
                            fill="#F8FAFC"
                          />
                          {/* 우측 하단 강우 센서 배지 */}
                          <circle cx="40" cy="40" r="6" fill="#2563EB" stroke="#93C5FD" strokeWidth="1.2" />
                          <path d="M40 36.5c0 0 2.5 2.8 2.5 4.3a2.5 2.5 0 01-5 0c0-1.5 2.5-4.3 2.5-4.3z" fill="#BAE6FD" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* STEP 03 */}
                  <div className="flex items-center gap-2 sm:gap-3.5">
                    <div className="relative z-10 w-5 h-5 sm:w-8 sm:h-8 rounded-full bg-[#10B981]/25 border border-[#34D399]/60 flex items-center justify-center shrink-0">
                      <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#4ADE80] shadow-[0_0_8px_#4ADE80]" />
                    </div>
                    <div className="flex-1 min-w-0 rounded-2xl bg-[#0D4A2E]/90 border border-[#2A7A54]/85 px-3.5 py-3.5 sm:px-5 sm:py-4 flex items-center justify-between gap-2.5 shadow-inner">
                      <div className="min-w-0">
                        <div className="text-[14.5px] min-[390px]:text-[15.5px] sm:text-base font-black text-[#4ADE80] tracking-tight leading-snug break-keep">
                          STEP 03 · 과정별 맞춤 농자재 추천
                        </div>
                        <div className="text-[17.5px] min-[390px]:text-[18.5px] sm:text-xl font-black text-white tracking-tight leading-[1.3] mt-1 break-keep">
                          생육단계별 비료·영양제·방제 처방
                        </div>
                        <div className="hidden lg:flex flex-wrap items-center gap-1.5 mt-1.5">
                          <span className="px-2 py-0.5 rounded-md bg-white/10 text-emerald-200 text-[11px] font-bold">
                            비료 · 영양제 · 병해충방지제 · 씨 · 모종 5대 자재
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-white/10 text-emerald-200 text-[11px] font-bold">
                            재배 평수별 권장 물량 자동 계산
                          </span>
                        </div>
                      </div>
                      {/* 새싹 + 맞춤 농자재 보틀 3D 일러스트 아이콘 */}
                      <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 flex items-center justify-center">
                        <svg viewBox="0 0 56 56" className="w-12 h-12 sm:w-14 sm:h-14" fill="none">
                          {/* 화분/토양 */}
                          <rect x="10" y="34" width="16" height="12" rx="3" fill="#A16207" />
                          {/* 줄기 및 큰 새싹 */}
                          <path d="M22 35V18" stroke="#4ADE80" strokeWidth="2.8" strokeLinecap="round" />
                          <path
                            d="M22 22c0-6 5.5-9.5 11.5-9.5 0 6-5.5 9.5-11.5 9.5z"
                            fill="#4ADE80"
                          />
                          <path
                            d="M22 25c0-4.8-4.5-7.8-9.5-7.8 0 4.8 4.5 7.8 9.5 7.8z"
                            fill="#86EFAC"
                          />
                          {/* 영양제/비료 보틀 */}
                          <rect x="31" y="25" width="15" height="21" rx="3.5" fill="#FDE68A" stroke="#F59E0B" strokeWidth="1.4" />
                          <rect x="34" y="21" width="9" height="4" rx="1.5" fill="#15803D" />
                          <rect x="33" y="31" width="11" height="9" rx="1.5" fill="#16A34A" />
                          <circle cx="38.5" cy="35.5" r="2.2" fill="#BBF7D0" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                {/* PC 전용 우측: 실시간 내 농지 맞춤 재배일정 & 기후·자재 브리핑 요약 카드 */}
                <div className="hidden lg:flex lg:col-span-5 flex-col justify-between rounded-2xl bg-white/95 backdrop-blur-xs border border-emerald-200/90 p-5 text-slate-900 shadow-lg space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        <span>실시간 대표 포전 맞춤 브리핑</span>
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                        {loggedInUser.isLoggedIn ? `${loggedInUser.name} 님 농장 (300평)` : '충주 단월동 표준 포전 (300평)'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-lg font-black text-slate-900">
                      <MapPin className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span className="truncate">충청북도 충주시 단월동 · 가을배추 (불암3호)</span>
                    </div>

                    <div className="rounded-xl bg-[#F0FDF4] border border-emerald-200 p-3.5 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-emerald-800">
                          기후 빅데이터 산출 정식(아주심기) 추천일
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[11px] font-extrabold">
                          생육적온 18~20℃ 일치
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-2xl font-black text-emerald-950 tracking-tight">
                          2026-08-25 (화)
                        </span>
                        <span className="text-xs font-bold text-emerald-700">
                          목표 적산온도 1,180 GDD · 수확예정 11/05 (목)
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-2.5">
                        <div className="text-[11px] font-bold text-slate-500">한계온도 회피</div>
                        <div className="text-sm font-black text-slate-900 mt-0.5">5~26℃ 안전</div>
                      </div>
                      <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-2.5">
                        <div className="text-[11px] font-bold text-slate-500">토양검정 상태</div>
                        <div className="text-sm font-black text-sky-700 mt-0.5">pH 6.2 · 적정</div>
                      </div>
                      <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-2.5">
                        <div className="text-[11px] font-bold text-slate-500">단계별 추천 자재</div>
                        <div className="text-sm font-black text-emerald-700 mt-0.5">5대 자재 10종</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRequestNo('REQ-20261106-009');
                        setExpandedScheduleRequestNo('REQ-20261106-009');
                        setActiveMenu('재배일정 확인');
                        setMobileScheduleStep('detail');
                      }}
                      className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                    >
                      <Calendar className="w-4 h-4" />
                      <span>48주 상세 재배일정 보기</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveMenu('재배일정 요청')}
                      className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <FileEdit className="w-4 h-4" />
                      <span>신규 재배일정 산출 요청</span>
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* MODULE 3-B: 주요 서비스 바로가기 카드 (모바일 1개당 1라인 / 데스크톱 2열 매트릭스 + PC 상세 키워드) */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
              {/* 1. 재배일정 요청 */}
              <button
                type="button"
                onClick={() => setActiveMenu('재배일정 요청')}
                className="w-full bg-white hover:bg-emerald-50/40 active:scale-[0.99] rounded-[22px] px-4 py-3.5 sm:px-5 sm:py-4 border border-slate-200/85 shadow-[0_4px_14px_rgba(15,23,42,0.05)] flex items-center justify-between gap-3.5 text-left transition cursor-pointer group"
              >
                <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 flex items-center justify-center">
                  <svg viewBox="0 0 64 64" className="w-14 h-14 sm:w-16 sm:h-16" fill="none">
                    <g transform="rotate(-6 32 32)">
                      <rect x="10" y="14" width="44" height="40" rx="9" fill="#CBD5E1" />
                      <rect x="10" y="11" width="44" height="40" rx="9" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="1.5" />
                      <path d="M10 20a9 9 0 019-9h26a9 9 0 019 9v5H10v-5z" fill="#EF4444" />
                      <rect x="20" y="7" width="4.5" height="9" rx="2.2" fill="#DC2626" />
                      <rect x="39.5" y="7" width="4.5" height="9" rx="2.2" fill="#DC2626" />
                      {/* 달력 그리드 셀 */}
                      <rect x="16" y="30" width="6" height="5" rx="1.5" fill="#94A3B8" />
                      <rect x="25" y="30" width="6" height="5" rx="1.5" fill="#CBD5E1" />
                      <rect x="34" y="30" width="6" height="5" rx="1.5" fill="#CBD5E1" />
                      <rect x="43" y="30" width="5" height="5" rx="1.5" fill="#CBD5E1" />
                      <rect x="16" y="38" width="6" height="5" rx="1.5" fill="#CBD5E1" />
                      <rect x="25" y="38" width="6" height="5" rx="1.5" fill="#10B981" />
                      <rect x="34" y="38" width="6" height="5" rx="1.5" fill="#CBD5E1" />
                      <rect x="43" y="38" width="5" height="5" rx="1.5" fill="#CBD5E1" />
                    </g>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-[18.5px] sm:text-[21px] font-black text-slate-900 tracking-tight leading-tight">
                      재배일정 요청
                    </div>
                    <span className="hidden lg:inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-extrabold">
                      지역·작물·파종구분 맞춤
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-[#DDF5E8] text-[#0E6B40] text-[12.5px] sm:text-[13px] font-extrabold tracking-tight">
                      #기후연동 산출
                    </span>
                    <span className="hidden lg:inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-bold">
                      #적산온도(GDD) 목표 분석
                    </span>
                    <span className="hidden lg:inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-bold">
                      #한계온도 구간 자동 제외
                    </span>
                  </div>
                  <p className="text-[14px] sm:text-[15px] font-bold text-slate-700 mt-1 leading-snug break-keep">
                    씨 · 모종 최적 파종·정식일 자동 산출
                  </p>
                </div>
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#E8ECEA] group-hover:bg-emerald-600 text-[#0F6E43] group-hover:text-white flex items-center justify-center shrink-0 transition">
                  <ChevronRight className="w-5 h-5 stroke-[2.6]" />
                </div>
              </button>

              {/* 2. 재배일정 확인 */}
              <button
                type="button"
                onClick={() => {
                  setActiveMenu('재배일정 확인');
                  setMobileScheduleStep('list');
                }}
                className="w-full bg-white hover:bg-emerald-50/40 active:scale-[0.99] rounded-[22px] px-4 py-3.5 sm:px-5 sm:py-4 border border-slate-200/85 shadow-[0_4px_14px_rgba(15,23,42,0.05)] flex items-center justify-between gap-3.5 text-left transition cursor-pointer group"
              >
                <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 flex items-center justify-center">
                  <svg viewBox="0 0 64 64" className="w-14 h-14 sm:w-16 sm:h-16" fill="none">
                    <g transform="rotate(5 32 32)">
                      <rect x="13" y="11" width="38" height="45" rx="7" fill="#34D399" stroke="#059669" strokeWidth="1.5" />
                      <rect x="17" y="16" width="30" height="36" rx="4" fill="#F8FAFC" />
                      <rect x="24" y="8" width="16" height="6" rx="3" fill="#A7F3D0" stroke="#059669" strokeWidth="1.5" />
                      {/* 체크라인 1 */}
                      <path d="M21 24.5l2.2 2.2 4.2-4.2" stroke="#10B981" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      <rect x="30" y="23" width="12" height="3.2" rx="1.6" fill="#94A3B8" />
                      {/* 체크라인 2 */}
                      <path d="M21 33.5l2.2 2.2 4.2-4.2" stroke="#10B981" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      <rect x="30" y="32" width="12" height="3.2" rx="1.6" fill="#94A3B8" />
                      {/* 체크라인 3 */}
                      <path d="M21 42.5l2.2 2.2 4.2-4.2" stroke="#10B981" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      <rect x="30" y="41" width="10" height="3.2" rx="1.6" fill="#94A3B8" />
                    </g>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-[18.5px] sm:text-[21px] font-black text-slate-900 tracking-tight leading-tight">
                      재배일정 확인
                    </div>
                    <span className="hidden lg:inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-extrabold">
                      내 일정 {cloudBaeCropList.length}건 관리중
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-[#DDF5E8] text-[#0E6B40] text-[12.5px] sm:text-[13px] font-extrabold tracking-tight">
                      #48주 타임라인
                    </span>
                    <span className="hidden lg:inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-bold">
                      #후속 일정 자동 연쇄보정
                    </span>
                    <span className="hidden lg:inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-bold">
                      #단계별 자재 원클릭 구매
                    </span>
                  </div>
                  <p className="text-[14px] sm:text-[15px] font-bold text-slate-700 mt-1 leading-snug break-keep">
                    실시간 기온 반영 생육과정별 작업일
                  </p>
                </div>
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#E8ECEA] group-hover:bg-emerald-600 text-[#0F6E43] group-hover:text-white flex items-center justify-center shrink-0 transition">
                  <ChevronRight className="w-5 h-5 stroke-[2.6]" />
                </div>
              </button>

              {/* 3. 비료 · 영양제 구매 */}
              <button
                type="button"
                onClick={() => {
                  setMobileAgroCategoryTab('FERTILIZER');
                  setActiveMenu('비료');
                }}
                className="w-full bg-white hover:bg-emerald-50/40 active:scale-[0.99] rounded-[22px] px-4 py-3.5 sm:px-5 sm:py-4 border border-slate-200/85 shadow-[0_4px_14px_rgba(15,23,42,0.05)] flex items-center justify-between gap-3.5 text-left transition cursor-pointer group"
              >
                <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 flex items-center justify-center">
                  <svg viewBox="0 0 64 64" className="w-14 h-14 sm:w-16 sm:h-16" fill="none">
                    {/* 비료 포대 본체 */}
                    <path
                      d="M18 14h28l3 6v30a5 5 0 01-5 5H20a5 5 0 01-5-5V20l3-6z"
                      fill="#C8A97E"
                      stroke="#9A7B56"
                      strokeWidth="1.5"
                    />
                    <path d="M16 14h32" stroke="#B08D63" strokeWidth="3.5" strokeLinecap="round" />
                    {/* 중앙 그린 라벨 밴드 */}
                    <rect x="15.5" y="25" width="33" height="17" fill="#4ADE80" fillOpacity="0.85" />
                    <path
                      d="M32 38c0-5 4.2-8.2 8.5-8.2 0 5-4.2 8.2-8.5 8.2z"
                      fill="#ECFDF5"
                    />
                    <path
                      d="M32 38c0-3.8-3.4-6.4-7-6.4 0 3.8 3.4 6.4 7 6.4z"
                      fill="#A7F3D0"
                    />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-[18.5px] sm:text-[21px] font-black text-slate-900 tracking-tight leading-tight">
                      비료 · 영양제 구매
                    </div>
                    <span className="hidden lg:inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-extrabold">
                      밑거름 · 웃거름 · 기능성 영양제
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-[#DDF5E8] text-[#0E6B40] text-[12.5px] sm:text-[13px] font-extrabold tracking-tight">
                      #맞춤 시비처방
                    </span>
                    <span className="hidden lg:inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-bold">
                      #토양검정 pH·유기물 연동
                    </span>
                    <span className="hidden lg:inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-bold">
                      #300평 기준 자동 물량산출
                    </span>
                  </div>
                  <p className="text-[14px] sm:text-[15px] font-bold text-slate-700 mt-1 leading-snug break-keep">
                    평수별 권장량 자동 계산 맞춤 자재
                  </p>
                </div>
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#E8ECEA] group-hover:bg-emerald-600 text-[#0F6E43] group-hover:text-white flex items-center justify-center shrink-0 transition">
                  <ChevronRight className="w-5 h-5 stroke-[2.6]" />
                </div>
              </button>

              {/* 4. 병해충방지제 구매 */}
              <button
                type="button"
                onClick={() => {
                  setMobileAgroCategoryTab('PESTICIDE');
                  setActiveMenu('병해충관리제');
                }}
                className="w-full bg-white hover:bg-emerald-50/40 active:scale-[0.99] rounded-[22px] px-4 py-3.5 sm:px-5 sm:py-4 border border-slate-200/85 shadow-[0_4px_14px_rgba(15,23,42,0.05)] flex items-center justify-between gap-3.5 text-left transition cursor-pointer group"
              >
                <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 flex items-center justify-center">
                  <svg viewBox="0 0 64 64" className="w-14 h-14 sm:w-16 sm:h-16" fill="none">
                    {/* 방제 분사 물방울 */}
                    <circle cx="13" cy="18" r="2" fill="#60A5FA" />
                    <circle cx="18" cy="14" r="1.6" fill="#93C5FD" />
                    <circle cx="15" cy="24" r="1.6" fill="#93C5FD" />
                    {/* 보호 방패 */}
                    <path
                      d="M34 11l17 6.5v13c0 11.5-7.4 20.5-17 24-9.6-3.5-17-12.5-17-24v-13L34 11z"
                      fill="#4ADE80"
                      stroke="#94A3B8"
                      strokeWidth="3"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M34 14l14 5.3v11c0 9.4-6 17-14 20"
                      fill="#22C55E"
                      fillOpacity="0.45"
                    />
                    {/* 무당벌레 심볼 */}
                    <circle cx="34" cy="27" r="3.2" fill="#1E293B" />
                    <ellipse cx="34" cy="34" rx="6.5" ry="7.5" fill="#EF4444" />
                    <path d="M34 26.5v15" stroke="#1E293B" strokeWidth="1.5" />
                    <circle cx="31.5" cy="32" r="1.2" fill="#1E293B" />
                    <circle cx="36.5" cy="32" r="1.2" fill="#1E293B" />
                    <circle cx="32" cy="36.5" r="1.2" fill="#1E293B" />
                    <circle cx="36" cy="36.5" r="1.2" fill="#1E293B" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-[18.5px] sm:text-[21px] font-black text-slate-900 tracking-tight leading-tight">
                      병해충방지제 구매
                    </div>
                    <span className="hidden lg:inline-flex items-center px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-extrabold">
                      살균 · 살충 · 유기농자재
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-[#DDF5E8] text-[#0E6B40] text-[12.5px] sm:text-[13px] font-extrabold tracking-tight">
                      #적기 방제
                    </span>
                    <span className="hidden lg:inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-bold">
                      #강우·고온다습 예보 연동
                    </span>
                    <span className="hidden lg:inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-bold">
                      #무름병·진딧물 사전예방
                    </span>
                  </div>
                  <p className="text-[14px] sm:text-[15px] font-bold text-slate-700 mt-1 leading-snug break-keep">
                    날씨 연동 예방 및 친환경 방제
                  </p>
                </div>
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#E8ECEA] group-hover:bg-emerald-600 text-[#0F6E43] group-hover:text-white flex items-center justify-center shrink-0 transition">
                  <ChevronRight className="w-5 h-5 stroke-[2.6]" />
                </div>
              </button>

              {/* 5. 씨 · 모종 구매 */}
              <button
                type="button"
                onClick={() => {
                  setMobileAgroCategoryTab('SEED');
                  setActiveMenu('씨');
                }}
                className="w-full bg-white hover:bg-emerald-50/40 active:scale-[0.99] rounded-[22px] px-4 py-3.5 sm:px-5 sm:py-4 border border-slate-200/85 shadow-[0_4px_14px_rgba(15,23,42,0.05)] flex items-center justify-between gap-3.5 text-left transition cursor-pointer group"
              >
                <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 flex items-center justify-center">
                  <svg viewBox="0 0 64 64" className="w-14 h-14 sm:w-16 sm:h-16" fill="none">
                    {/* 종자 봉투 */}
                    <g transform="rotate(8 42 28)">
                      <rect x="30" y="13" width="22" height="28" rx="3" fill="#DEC397" stroke="#A6895B" strokeWidth="1.5" />
                      <path
                        d="M41 31c0-4.2 3.5-7 7-7 0 4.2-3.5 7-7 7z"
                        fill="#16A34A"
                      />
                      <path
                        d="M41 32c0-3.2-2.8-5.5-5.5-5.5 0 3.2 2.8 5.5 5.5 5.5z"
                        fill="#4ADE80"
                      />
                    </g>
                    {/* 육묘 트레이 */}
                    <rect x="9" y="38" width="38" height="14" rx="3" fill="#78350F" stroke="#5C280B" strokeWidth="1.5" />
                    <path d="M21 38v14M34 38v14" stroke="#5C280B" strokeWidth="1.5" />
                    {/* 트레이 위 모종 새싹 */}
                    <path d="M18 38V28" stroke="#16A34A" strokeWidth="2.4" strokeLinecap="round" />
                    <path d="M18 31c0-4 3.5-6.5 7-6.5 0 4-3.5 6.5-7 6.5z" fill="#22C55E" />
                    <path d="M18 32c0-3.2-3-5.2-6-5.2 0 3.2 3 5.2 6 5.2z" fill="#4ADE80" />
                    <path d="M30 38V30" stroke="#16A34A" strokeWidth="2.2" strokeLinecap="round" />
                    <path d="M30 33c0-3.5 3-5.5 6-5.5 0 3.5-3 5.5-6 5.5z" fill="#22C55E" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-[18.5px] sm:text-[21px] font-black text-slate-900 tracking-tight leading-tight">
                      씨 · 모종 구매
                    </div>
                    <span className="hidden lg:inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-extrabold">
                      인증 종자 · 규격 트레이묘
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-[#DDF5E8] text-[#0E6B40] text-[12.5px] sm:text-[13px] font-extrabold tracking-tight">
                      #우량 종자·육묘
                    </span>
                    <span className="hidden lg:inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-bold">
                      #지역별 파종·정식 적기 품종
                    </span>
                    <span className="hidden lg:inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-bold">
                      #내병성·고수량 검증
                    </span>
                  </div>
                  <p className="text-[14px] sm:text-[15px] font-bold text-slate-700 mt-1 leading-snug break-keep">
                    발아보증 종자 및 트레이 규격 모종
                  </p>
                </div>
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#E8ECEA] group-hover:bg-emerald-600 text-[#0F6E43] group-hover:text-white flex items-center justify-center shrink-0 transition">
                  <ChevronRight className="w-5 h-5 stroke-[2.6]" />
                </div>
              </button>

              {/* 6. 데스크톱(PC) 2열 균형용: 마이페이지 · 내 농장 관리 (모바일에서는 시안과 동일하게 5종만 노출) */}
              <button
                type="button"
                onClick={() => {
                  setActiveMenu('마이페이지');
                  setMyPageTab('FARMLAND');
                }}
                className="hidden lg:flex w-full bg-white hover:bg-emerald-50/40 active:scale-[0.99] rounded-[22px] px-4 py-3.5 sm:px-5 sm:py-4 border border-slate-200/85 shadow-[0_4px_14px_rgba(15,23,42,0.05)] items-center justify-between gap-3.5 text-left transition cursor-pointer group"
              >
                <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 flex items-center justify-center">
                  <svg viewBox="0 0 64 64" className="w-14 h-14 sm:w-16 sm:h-16" fill="none">
                    <rect x="11" y="13" width="42" height="38" rx="10" fill="#E0F2FE" stroke="#7DD3FC" strokeWidth="1.5" />
                    <circle cx="32" cy="27" r="7" fill="#0284C7" />
                    <path d="M20 45c2.2-6 6.8-9 12-9s9.8 3 12 9" stroke="#0284C7" strokeWidth="4" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-[18.5px] sm:text-[21px] font-black text-slate-900 tracking-tight leading-tight">
                      마이페이지 · 내 농장
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-sky-800 text-[11px] font-extrabold">
                      통합 영농 대시보드
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-[#DDF5E8] text-[#0E6B40] text-[12.5px] sm:text-[13px] font-extrabold tracking-tight">
                      #농지·주문관리
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-bold">
                      #작물별 생육 진행율
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-bold">
                      #자재 장바구니·결제내역
                    </span>
                  </div>
                  <p className="text-[14px] sm:text-[15px] font-bold text-slate-700 mt-1 leading-snug break-keep">
                    내 재배지 · 진행율 · 자재 구매현황 통합 관리
                  </p>
                </div>
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#E8ECEA] group-hover:bg-emerald-600 text-[#0F6E43] group-hover:text-white flex items-center justify-center shrink-0 transition">
                  <ChevronRight className="w-5 h-5 stroke-[2.6]" />
                </div>
              </button>
            </section>

            {/* ==================== MODULE 4-A (PC 전용): 생육과정별 상세 재배일정 제공 & 지역별 추천 일정 현황 ==================== */}
            <section className="hidden lg:block bg-white rounded-3xl border border-slate-200/90 p-7 shadow-2xs space-y-6">
              {/* 상단 헤더 */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                        맞춤형 재배일정 제공 상세 브리핑
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold">
                        작년 실측 + 올해 6개월 예측 기후 · 적산온도(GDD) 기반
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 font-semibold mt-0.5">
                      지역별 한계온도(최저·최고) 구간을 제외하고, 생육단계별 목표 적산온도 도달 시점과 연계 농자재 투입 적기를 단일 추천 진행일(요일 포함)로 제공합니다.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setActiveMenu('재배일정 요청')}
                    className="px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-extrabold inline-flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <FileEdit className="w-4 h-4" />
                    <span>내 농지 재배일정 요청</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMenu('재배일정 확인');
                      setMobileScheduleStep('list');
                    }}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                  >
                    <span>48주 전체 재배일정 확인</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 파트 1: 대표 포전 6단계 생육과정별 세부 진행일정 타임라인 카드 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                    <h3 className="text-base font-black text-slate-900">
                      생육과정별 6단계 표준 진행일정 및 연계 처방 (충청북도 충주시 단월동 · 가을배추 불암3호 · 300평)
                    </h3>
                  </div>
                  <span className="text-xs font-bold text-slate-500">
                    ※ 각 단계 카드를 클릭하면 48주 타임라인 세부 일정으로 이동합니다
                  </span>
                </div>

                <div className="grid grid-cols-6 gap-3">
                  {[
                    {
                      step: 'STEP 01',
                      stageName: '토양준비 · 밑거름',
                      date: '2026-08-15 (토)',
                      gdd: '누적 0 GDD (정식 10일전)',
                      climate: '평균 24.8℃ · 강수 0mm',
                      task: '경운·정지 및 완효성 밑거름·토양살충제 혼화',
                      material: '맞춤 슈퍼배추 밑거름 특호 (3포)',
                      matBadge: '비료 · 밑거름',
                      badgeCls: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                    },
                    {
                      step: 'STEP 02',
                      stageName: '모종 정식 (아주심기)',
                      date: '2026-08-25 (화)',
                      gdd: '누적 120 GDD 도달',
                      climate: '평균 19.2℃ · 적온(18~20℃) 일치',
                      task: '고온 한계온도(26℃↑) 종료 직후 규격 건묘 정식',
                      material: '불암3호 105구 트레이 규격 건묘 (10판)',
                      matBadge: '모종 · 정식적기',
                      badgeCls: 'bg-green-50 text-green-800 border-green-200',
                    },
                    {
                      step: 'STEP 03',
                      stageName: '활착기 · 1차 웃거름',
                      date: '2026-09-08 (화)',
                      gdd: '누적 340 GDD 도달',
                      climate: '평균 18.6℃ · 습도 64%',
                      task: '정식 후 14일차 초기 뿌리활착 및 1차 추비 시비',
                      material: '엔케이(NK) 추비 전용 웃거름 (2포)',
                      matBadge: '비료 · 1차추비',
                      badgeCls: 'bg-teal-50 text-teal-800 border-teal-200',
                    },
                    {
                      step: 'STEP 04',
                      stageName: '결구초기 · 영양관리',
                      date: '2026-09-24 (목)',
                      gdd: '누적 620 GDD 도달',
                      climate: '평균 17.4℃ · 일조 양호',
                      task: '속잎 결구 시작기 칼슘·붕소 엽면시비 (꿀통배추 예방)',
                      material: '칼슘·붕소 결구강화 액상 영양제 (500ml)',
                      matBadge: '영양제 · 결구강화',
                      badgeCls: 'bg-amber-50 text-amber-800 border-amber-200',
                    },
                    {
                      step: 'STEP 05',
                      stageName: '병해충 집중 예방·방제',
                      date: '2026-10-10 (토)',
                      gdd: '누적 890 GDD 도달',
                      climate: '평균 15.1℃ · 강우예보 3일전',
                      task: '가을 강우 전후 무름병·뿌리혹병 및 진딧물 적기 방제',
                      material: '배추 무름병·뿌리혹병 예방 입제 (3kg)',
                      matBadge: '병해충방지제 · 예방',
                      badgeCls: 'bg-rose-50 text-rose-800 border-rose-200',
                    },
                    {
                      step: 'STEP 06',
                      stageName: '결구완료 · 적기 수확',
                      date: '2026-11-05 (목)',
                      gdd: '목표 1,180 GDD 100% 도달',
                      climate: '평균 11.2℃ · 서리 피해 전',
                      task: '최저 한계온도(5℃ 미만) 도래 전 상품성 최상 수확',
                      material: '결구 충실도 98% · 300평 수확 완료',
                      matBadge: '수확적기 도달',
                      badgeCls: 'bg-sky-50 text-sky-800 border-sky-200',
                    },
                  ].map((st, idx) => (
                    <button
                      key={st.step}
                      type="button"
                      onClick={() => {
                        setSelectedRequestNo('REQ-20261106-009');
                        setExpandedScheduleRequestNo('REQ-20261106-009');
                        setActiveMenu('재배일정 확인');
                        setMobileScheduleStep('detail');
                      }}
                      className="group relative rounded-2xl bg-slate-50/80 hover:bg-emerald-50/50 border border-slate-200/90 hover:border-emerald-400 p-4 text-left flex flex-col justify-between transition cursor-pointer shadow-2xs"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-1">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white font-black text-[11px]">
                            {st.step}
                          </span>
                          <span className="text-[11px] font-bold text-slate-400">
                            {idx < 5 ? '다음 단계 ➔' : '최종 완료'}
                          </span>
                        </div>
                        <div className="text-base font-black text-slate-900 group-hover:text-emerald-800 leading-snug">
                          {st.stageName}
                        </div>
                        <div className="rounded-lg bg-white border border-slate-200/80 px-2.5 py-1.5">
                          <div className="text-xs font-black text-emerald-700 font-mono">
                            {st.date}
                          </div>
                          <div className="text-[11px] font-bold text-slate-500 mt-0.5">
                            {st.gdd}
                          </div>
                        </div>
                        <div className="text-xs font-bold text-slate-700 leading-relaxed break-keep">
                          {st.task}
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-200/80 space-y-1.5">
                        <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                          <CloudSun className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate">{st.climate}</span>
                        </div>
                        <div className={`px-2 py-1 rounded-lg border text-[11px] font-extrabold truncate ${st.badgeCls}`}>
                          💊 {st.material}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 파트 2: 지역별 · 작물별 기후연동 추천 재배일정 상세 비교 테이블 */}
              <div className="space-y-2.5 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                    <h3 className="text-base font-black text-slate-900">
                      지역별 · 작물별 기후 빅데이터 추천 진행일 현황 (시도 · 시군구 · 읍면동 정밀 분석)
                    </h3>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    기후 데이터 규칙: 모종(최저·최고 한계온도 제외 최적온도) · 씨(발아적온 이상 조기 파종)
                  </span>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold text-xs">
                        <th className="py-3.5 px-4">지역 (시도·시군구·읍면동)</th>
                        <th className="py-3.5 px-3">작물 · 품종명</th>
                        <th className="py-3.5 px-3">구분 · 온도 기준</th>
                        <th className="py-3.5 px-3">핵심 생육단계</th>
                        <th className="py-3.5 px-3">추천 진행일 (요일)</th>
                        <th className="py-3.5 px-3">기후 분석 상태</th>
                        <th className="py-3.5 px-4 text-right">일정 · 처방 상세</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recentRecommendations.map((item, idx) => (
                        <tr key={idx} className="hover:bg-emerald-50/30 transition">
                          <td className="py-3.5 px-4 font-extrabold text-slate-900">{item.region}</td>
                          <td className="py-3.5 px-3 font-bold text-slate-900">{item.crop}</td>
                          <td className="py-3.5 px-3">
                            <span className="font-bold text-slate-700">{item.planting_type}</span>
                            <span className="ml-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-bold">
                              {item.opt_temp}
                            </span>
                          </td>
                          <td className="py-3.5 px-3">
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-extrabold text-xs">
                              {item.stage}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 font-mono font-black text-emerald-700 text-base">
                            {formatYmdWithWeekday(item.recommended_date)}
                          </td>
                          <td className="py-3.5 px-3">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#DDF5E8] text-[#0E6B40] text-xs font-extrabold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{item.status}</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedRequestNo(item.request_no);
                                setExpandedScheduleRequestNo(item.request_no);
                                setActiveMenu('재배일정 확인');
                                setMobileScheduleStep('detail');
                              }}
                              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition cursor-pointer shadow-2xs"
                            >
                              타임라인 · 자재 보기 ›
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* ==================== MODULE 4-B (PC 전용): 생육단계 · 기후 연동 5대 농자재 카테고리별 맞춤 추천 ==================== */}
            <section className="hidden lg:block bg-white rounded-3xl border border-slate-200/90 p-7 shadow-2xs space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <ShoppingBag className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                        생육단계 · 기후 연동 5대 농자재 맞춤 추천
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#DDF5E8] text-[#0E6B40] text-xs font-extrabold">
                        비료 · 영양제 · 병해충방지제 · 씨(종자) · 모종 전 카테고리 처방
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 font-semibold mt-0.5">
                      재배일정의 각 생육과정(파종·밑거름·정식·웃거름·결구·방제)과 토양검정·기상예보에 맞춘 카테고리별 핵심 추천 농자재입니다.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMobileAgroCategoryTab('FERTILIZER');
                    setActiveMenu('농작물 구매');
                  }}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <span>농자재 통합 마켓 전체보기</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* 5대 농자재 카테고리별 상세 추천 그리드 (5열 구성 · 실물 제품 이미지 포함) */}
              <div className="grid grid-cols-5 gap-4">
                {[
                  {
                    catKey: 'FERTILIZER' as const,
                    menuName: '비료',
                    title: '맞춤 비료 추천',
                    subtitle: '밑거름 · 1·2차 웃거름',
                    headerBg: 'bg-emerald-50 border-emerald-200 text-emerald-900',
                    badgeCls: 'bg-emerald-100 text-emerald-800',
                    items: [
                      {
                        img: '/images/fertilizers/FERT-PRD-01-thumb.png',
                        brand: '남해화학(주)',
                        name: '슈퍼원예복합 밑거름 특호 20kg',
                        stage: '정식 10일전 밑거름',
                        spec: '완효성 N-P-K + 고토·붕소 함유',
                        dosage: '300평 기준 20kg × 3포',
                        price: '21,500원',
                        match: '토양적합 99%',
                      },
                      {
                        img: '/images/fertilizers/FERT-PRD-02-thumb.png',
                        brand: '(주)누보',
                        name: '엔케이(NK) 마그네슘 추비특호 20kg',
                        stage: '정식 후 14·30일 웃거름',
                        spec: '속효성 질소·칼륨 생육·결구 촉진',
                        dosage: '300평 기준 20kg × 2포',
                        price: '19,800원',
                        match: '생육적합 98%',
                      },
                    ],
                  },
                  {
                    catKey: 'NUTRIENT' as const,
                    menuName: '영양제',
                    subtitle: '결구강화 · 뿌리발근 · 활력',
                    title: '기능성 영양제 추천',
                    headerBg: 'bg-teal-50 border-teal-200 text-teal-900',
                    badgeCls: 'bg-teal-100 text-teal-800',
                    items: [
                      {
                        img: '/images/fertilizers/MAT-NUTR-02-thumb.png',
                        brand: '(주)누보',
                        name: '엔플러스 튼튼칼슘 결구강화제',
                        stage: '결구초기 · 엽면시비',
                        spec: '꿀통배추·석회결핍(팁번) 예방',
                        dosage: '500ml (500~1,000배 희석)',
                        price: '16,800원',
                        match: '결구필수 99%',
                      },
                      {
                        img: '/images/fertilizers/MAT-NUTR-03-thumb.png',
                        brand: '(주)누보',
                        name: '엔플러스 참편한 아미노 발근제',
                        stage: '정식 직후 · 초기활착기',
                        spec: '세근 발달 및 고온 스트레스 완화',
                        dosage: '500ml (관주·육묘침지 겸용)',
                        price: '15,900원',
                        match: '활착강화 98%',
                      },
                    ],
                  },
                  {
                    catKey: 'PESTICIDE' as const,
                    menuName: '병해충관리제',
                    title: '병해충방지제 추천',
                    subtitle: '무름병 · 뿌리혹병 · 충해 방제',
                    headerBg: 'bg-rose-50 border-rose-200 text-rose-900',
                    badgeCls: 'bg-rose-100 text-rose-800',
                    items: [
                      {
                        img: '/images/fertilizers/MAT-PEST-03-thumb.png',
                        brand: '인바이오 / 누보',
                        name: '펀지해머 무름병·노균병 살균제',
                        stage: '결구기 · 강우전후 방제',
                        spec: '고온다습·강우 예보 연동 예방·치료',
                        dosage: '500ml (1,000배 경엽살포)',
                        price: '21,500원',
                        match: '기상연동 99%',
                      },
                      {
                        img: '/images/fertilizers/MAT-PEST-06-thumb.png',
                        brand: '(주)누보',
                        name: '엔플러스 해충박살 친환경제',
                        stage: '생육중후기 · PLS 안전방제',
                        spec: '유기농업자재 공시 · 나방·진딧물 방제',
                        dosage: '250ml (500~1,000배 경엽처리)',
                        price: '16,500원',
                        match: '안전방제 98%',
                      },
                    ],
                  },
                  {
                    catKey: 'SEED' as const,
                    menuName: '씨',
                    title: '우량 씨(종자) 추천',
                    subtitle: '발아보증 · 내병성 품종',
                    headerBg: 'bg-amber-50 border-amber-200 text-amber-900',
                    badgeCls: 'bg-amber-100 text-amber-800',
                    items: [
                      {
                        img: '/images/fertilizers/MAT-SEED-01-thumb.jpg',
                        brand: '농우바이오',
                        name: '가을배추 불암3호 코팅종자',
                        stage: '파종적온 20~25℃ 맞춤',
                        spec: 'CR 무사마귀병 내병계 · 결구력 우수',
                        dosage: '2,000립 (약 7g / 1봉)',
                        price: '15,000원',
                        match: '지역추천 99%',
                      },
                      {
                        img: '/images/fertilizers/MAT-SEED-02-thumb.jpg',
                        brand: '팜한농 (흥농씨앗)',
                        name: '휘파람골드 고품질 배추종자',
                        stage: '중부·남부 8월초 파종적기',
                        spec: '뿌리혹병·노균병 복합내병성 대통배추',
                        dosage: '2,000립 (발아보증 / 1봉)',
                        price: '16,500원',
                        match: '품종인기 98%',
                      },
                    ],
                  },
                  {
                    catKey: 'SEEDLING' as const,
                    menuName: '모종',
                    title: '규격 모종 추천',
                    subtitle: '128구·72구 트레이 · 건묘 예약',
                    headerBg: 'bg-green-50 border-green-200 text-green-900',
                    badgeCls: 'bg-green-100 text-green-800',
                    items: [
                      {
                        img: '/images/fertilizers/MAT-SDL-01-thumb.jpg',
                        brand: '한팜스마트육묘장',
                        name: '불암3호 128구 트레이 건묘',
                        stage: '08/25(화) 정식일 맞춤출하',
                        spec: '25일 표준 육묘 · 외기순화 · 뿌리활착 최상',
                        dosage: '128구 트레이 / 1판 (120주↑)',
                        price: '13,500원/판',
                        match: '정식일연동 99%',
                      },
                      {
                        img: '/images/fertilizers/MAT-SDL-04-thumb.jpg',
                        brand: '한팜스마트육묘장',
                        name: '달콤 양배추·배추 규격모종',
                        stage: '09/10(목) 남부 정식 맞춤',
                        spec: '내한성 강화 · 대립포트 무병 건묘',
                        dosage: '72구 대립 트레이 / 1판',
                        price: '13,800원/판',
                        match: '건묘보증 98%',
                      },
                    ],
                  },
                ].map((catGroup) => (
                  <div
                    key={catGroup.catKey}
                    className="rounded-2xl border border-slate-200/90 bg-slate-50/60 flex flex-col justify-between overflow-hidden shadow-2xs"
                  >
                    <div>
                      {/* 카테고리 상단 헤더 */}
                      <div className={`px-4 py-3 border-b flex items-center justify-between ${catGroup.headerBg}`}>
                        <div>
                          <div className="text-base font-black tracking-tight">{catGroup.title}</div>
                          <div className="text-[11px] font-bold opacity-80 mt-0.5">{catGroup.subtitle}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setMobileAgroCategoryTab(catGroup.catKey);
                            setActiveMenu(catGroup.menuName);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white/90 hover:bg-white text-slate-800 text-[11px] font-extrabold border border-slate-200/80 transition cursor-pointer shrink-0"
                        >
                          더보기 ›
                        </button>
                      </div>

                      {/* 카테고리별 추천 상품 2종 리스트 (실물 제품 썸네일 이미지 포함) */}
                      <div className="p-3.5 space-y-3">
                        {catGroup.items.map((prod, pIdx) => (
                          <div
                            key={pIdx}
                            onClick={() => {
                              setMobileAgroCategoryTab(catGroup.catKey);
                              setActiveMenu(catGroup.menuName);
                            }}
                            className="group rounded-xl bg-white hover:bg-emerald-50/40 border border-slate-200/85 hover:border-emerald-300 p-3 space-y-2.5 transition cursor-pointer shadow-2xs"
                          >
                            {/* 상단 생육단계 & 매칭율 배지 */}
                            <div className="flex items-center justify-between gap-1.5">
                              <span className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold ${catGroup.badgeCls}`}>
                                {prod.stage}
                              </span>
                              <span className="text-[11px] font-extrabold text-emerald-700">
                                {prod.match}
                              </span>
                            </div>

                            {/* 제품 실물 썸네일 이미지 박스 */}
                            <div className="relative w-full h-36 rounded-xl bg-white border border-slate-100 group-hover:border-emerald-200 overflow-hidden flex items-center justify-center p-2">
                              <img
                                src={prod.img}
                                alt={prod.name}
                                className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                              />
                              <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-md bg-slate-900/75 backdrop-blur-xs text-white text-[10px] font-bold">
                                {prod.brand}
                              </span>
                            </div>

                            {/* 제품명 및 핵심 스펙 */}
                            <div className="space-y-1">
                              <div className="text-[14.5px] font-black text-slate-900 leading-snug break-keep group-hover:text-emerald-800 transition-colors">
                                {prod.name}
                              </div>
                              <div className="text-xs font-semibold text-slate-600 leading-snug break-keep">
                                {prod.spec}
                              </div>
                            </div>

                            {/* 하단 권장량 및 단가 */}
                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                              <span className="text-[11px] font-bold text-slate-500 truncate">
                                {prod.dosage}
                              </span>
                              <span className="text-sm font-black text-emerald-700 font-mono shrink-0">
                                {prod.price}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="px-3.5 pb-3.5">
                      <button
                        type="button"
                        onClick={() => {
                          setMobileAgroCategoryTab(catGroup.catKey);
                          setActiveMenu(catGroup.menuName);
                        }}
                        className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-1 transition cursor-pointer shadow-2xs"
                      >
                        <span>{catGroup.menuName} 추천 자재 구매하기</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* ==================== [탭 2: 재배일정 확인 (회원 ID: CloudBae 전용 반응형 PC & 모바일 뷰)] ==================== */}
        {activeMenu === '재배일정 확인' && (
          <div className="space-y-4 sm:space-y-6">
            {renderScheduleNavigationTabs()}

            {/* ---------- 1단계: CloudBae 님의 작물재배 리스트 (항목 클릭 시 바로 아래 아코디언 형태로 48주 타임라인 & 추천 농자재 구매 영역 열림/닫힘) ---------- */}
            <section
              className="block bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-extrabold shrink-0">
                    <Sprout className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-[18px] sm:text-[22px] font-black text-slate-900 whitespace-nowrap truncate">
                        {loggedInUser.isLoggedIn ? `${loggedInUser.name} 님의 내 작물재배 리스트` : '표준 작물재배 일정 리스트'} ({cloudBaeCropList.length}건)
                      </h2>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[13px] sm:text-sm font-extrabold whitespace-nowrap shrink-0">
                        회원 맞춤형 재배관리
                      </span>
                    </div>
                    <p className="text-[14px] sm:text-[15.5px] font-semibold text-slate-600 break-keep mt-1">
                      조회할 재배 작물을 터치(클릭)하면 기상·오늘 할 일·3가지 일정 보기 및 생육과정 세부 일정이 표시됩니다.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveMenu('재배일정 요청')}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-emerald-50 hover:border-emerald-300 text-slate-900 font-extrabold text-[15px] sm:text-base whitespace-nowrap transition cursor-pointer shrink-0"
                >
                  + 새 재배일정 요청
                </button>
              </div>

              {/* 작물재배 리스트 (한 라인에 1개씩 표시 + 클릭 시 바로 아래 아코디언 형태로 48주 타임라인 & 추천 농자재 구매 영역 열림/닫힘) */}
              <div className="space-y-3.5">
                {cloudBaeCropList.map((crop, idx) => {
                  const isSelected = crop.request_no === selectedRequestNo;
                  const isExpanded = expandedScheduleRequestNo === crop.request_no;
                  const toggleCropAccordion = () => {
                    if (expandedScheduleRequestNo === crop.request_no) {
                      setExpandedScheduleRequestNo(null);
                      setHoveredProvisionItem(null);
                      setClickedProvisionItem(null);
                    } else {
                      setSelectedRequestNo(crop.request_no);
                      setExpandedScheduleRequestNo(crop.request_no);
                      setMobileScheduleStep('detail');
                    }
                  };
                  return (
                    <div key={crop.request_no} className="space-y-4">
                      <div
                        onClick={toggleCropAccordion}
                        className={`w-full rounded-2xl px-4 sm:px-6 py-4 border-2 transition cursor-pointer flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                          isExpanded
                            ? 'border-emerald-600 bg-[#F2FBF7] shadow-xs'
                            : isSelected
                            ? 'border-emerald-400 bg-emerald-50/30'
                            : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-slate-50/70'
                        }`}
                      >
                        {/* 좌측: 순번 + 썸네일 + 작물명·품종 + 재배구분 배지 */}
                        <div className="flex items-center gap-3.5 min-w-0 lg:w-[31%] shrink-0">
                          <span
                            className={`w-8 h-8 rounded-xl text-sm sm:text-base font-mono font-black inline-flex items-center justify-center shrink-0 ${
                              isExpanded || isSelected
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {idx + 1}
                          </span>

                          <div
                            className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br ${crop.thumb_gradient} text-white flex flex-col items-center justify-center shrink-0 shadow-xs border border-white/20`}
                          >
                            <Sprout className="w-6 h-6 sm:w-7 sm:h-7" />
                            <span className="text-[11px] sm:text-xs font-black mt-0.5">{crop.crop_short}</span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 font-extrabold text-[13px] sm:text-sm">
                                {crop.badge}
                              </span>
                              {isExpanded && (
                                <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white font-extrabold text-[12.5px] sm:text-[13px]">
                                  상세 타임라인 열림
                                </span>
                              )}
                              {!isExpanded && isSelected && (
                                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-extrabold text-[12.5px] sm:text-[13px]">
                                  현재 선택됨
                                </span>
                              )}
                            </div>
                            <h3 className="text-[19px] sm:text-[22px] font-black text-slate-950 mt-1 truncate leading-snug">
                              {crop.crop_title}
                            </h3>
                          </div>
                        </div>

                        {/* 중앙 1: 재배 지역 · 평수 · 정식(파종)일 */}
                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 sm:gap-6 lg:w-[32%] border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-200/70">
                          <div className="min-w-0">
                            <div className="text-[13px] sm:text-sm font-extrabold text-slate-500">재배지 · 면적</div>
                            <div className="text-[16px] sm:text-[18px] font-black text-slate-900 truncate mt-0.5">
                              {crop.region} · <span className="text-emerald-700">{crop.area_pyeong}평</span>
                            </div>
                          </div>
                          <div className="shrink-0">
                            <div className="text-[13px] sm:text-sm font-extrabold text-slate-500">기준 정식일</div>
                            <div className="text-[16px] sm:text-[18px] font-mono font-black text-emerald-700 mt-0.5">
                              {crop.planting_label}
                            </div>
                          </div>
                        </div>

                        {/* 중앙 2: 기상 요약 및 재배 진행상태 프로그레스 바 */}
                        <div className="lg:w-[23%] space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[15px] sm:text-base font-extrabold text-slate-800">
                              기온 {crop.temp_c}°C · 다음작업 {crop.next_work_dday}
                            </span>
                            <span className="text-[16px] sm:text-lg font-black text-emerald-700">
                              {crop.progress_pct}%
                            </span>
                          </div>
                          <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden">
                            <div
                              style={{ width: `${crop.progress_pct}%` }}
                              className="h-full rounded-full bg-emerald-600 transition-all"
                            />
                          </div>
                          <div className="text-[14.5px] sm:text-[15.5px] font-bold text-slate-600 truncate">
                            진행상태: <strong className="text-slate-900 font-black">{crop.status_text}</strong>
                          </div>
                        </div>

                        {/* 우측: 일정 상세 열기/접기 + 삭제 액션 버튼 */}
                        <div className="lg:w-auto shrink-0 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCropAccordion();
                            }}
                            className={`flex-1 lg:flex-none px-4 py-3 rounded-xl font-black text-[15px] sm:text-base transition cursor-pointer inline-flex items-center justify-center gap-1.5 ${
                              isExpanded
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'border border-slate-300 bg-white hover:bg-emerald-600 hover:text-white hover:border-emerald-600 text-slate-900'
                            }`}
                          >
                            <span>{isExpanded ? '일정 상세 접기' : '일정 상세 보기'}</span>
                            <ChevronRight
                              className={`w-4 h-4 transition-transform duration-200 ${
                                isExpanded ? 'rotate-90' : ''
                              }`}
                            />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleDeleteScheduleAndCascade(crop, e)}
                            title="해당 재배일정 및 연관된 생육공정 일정·추천제품 데이터 모두 삭제"
                            className="px-3.5 py-3 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 hover:border-rose-300 text-rose-600 font-black text-[15px] sm:text-base transition cursor-pointer inline-flex items-center justify-center gap-1 shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>삭제</span>
                          </button>
                        </div>
                      </div>

                      {/* ==================== [리스트 항목 바로 아래 아코디언 확장 영역: ① 생육과정 정밀 타임라인(48주) & ② 전 생육과정 추천 농자재 단계별 리스트 & 단번에 구매하기] ==================== */}
                      {isExpanded && provisionData && (
                        <div className="pl-2 sm:pl-4 border-l-4 border-emerald-500 space-y-5 pt-1 pb-2">
                          {/* ①-M [모바일 환경 전용 (lg:hidden)]: 첨부 이미지 1~5번 방식 생육과정 정밀 타임라인 구성 */}
                          <div className="lg:hidden space-y-4">
                            {/* [모바일 카드 1 (첨부 이미지 1번)]: 한팜 내 재배작물 요약 + 진행 막대 + 기온·강수·다음작업 3열 카드 */}
                            <section className="bg-white rounded-3xl border border-slate-200 p-4 shadow-xs space-y-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-11 h-11 rounded-2xl bg-[#E9F7F1] text-emerald-700 flex items-center justify-center shrink-0">
                                    <Sprout className="w-6 h-6" />
                                  </div>
                                  <div>
                                    <div className="font-black text-[18px] text-slate-900 leading-tight">
                                      한팜
                                    </div>
                                    <div className="text-[14px] text-slate-600 font-bold">
                                      나의 맞춤형 재배관리
                                    </div>
                                  </div>
                                </div>
                                <Bell className="w-6 h-6 text-slate-500" />
                              </div>

                              {/* 기온 · 강수 · 다음 작업 3열 미니 카드 */}
                              <div className="grid grid-cols-3 gap-2.5">
                                <div className="rounded-2xl border border-slate-200 bg-white p-3.5 text-center space-y-1">
                                  <Thermometer className="w-5 h-5 text-slate-500 mx-auto" />
                                  <div className="text-[14px] text-slate-600 font-bold">기온</div>
                                  <div className="text-[18px] font-black text-slate-900">
                                    {curDayClimate?.temp_avg ?? crop.temp_c ?? '18.5'}°C
                                  </div>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-white p-3.5 text-center space-y-1">
                                  <CloudRain className="w-5 h-5 text-slate-500 mx-auto" />
                                  <div className="text-[14px] text-slate-600 font-bold">강수</div>
                                  <div className="text-[18px] font-black text-slate-900">
                                    {curDayClimate?.precipitation_mm !== undefined
                                      ? `${curDayClimate.precipitation_mm}mm`
                                      : crop.rain_mm || '5mm'}
                                  </div>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-white p-3.5 text-center space-y-1">
                                  <Calendar className="w-5 h-5 text-slate-500 mx-auto" />
                                  <div className="text-[14px] text-slate-600 font-bold">다음 작업</div>
                                  <div className="text-[18px] font-black text-slate-900">
                                    {crop.next_work_dday || crop.next_task_dday || '2일 후'}
                                  </div>
                                </div>
                              </div>
                            </section>

                            {/* [모바일 카드 2 (첨부 이미지 2번)]: 오늘 할 일 & 예정된 농작업 */}
                            <section className="bg-white rounded-3xl border border-slate-200 p-4 shadow-xs space-y-5">
                              {/* 오늘 할 일 */}
                              <div className="space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-[19px] font-black text-slate-900">오늘 할 일</h4>
                                  <span className="text-[14px] font-extrabold text-slate-600">
                                    작업 {todayTasks.length}개
                                  </span>
                                </div>
                                <div className="rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden bg-white">
                                  {todayTasks.map((task) => (
                                    <div
                                      key={task.id}
                                      onClick={() =>
                                        setTodayTasks((prev) =>
                                          prev.map((t) =>
                                            t.id === task.id
                                              ? {
                                                  ...t,
                                                  done: !t.done,
                                                  status: !t.done ? '완료' : '예정',
                                                }
                                              : t
                                          )
                                        )
                                      }
                                      className="p-4 flex items-start justify-between gap-3 hover:bg-slate-50 transition cursor-pointer"
                                    >
                                      <div className="flex items-start gap-3">
                                        <span
                                          className={`w-6 h-6 rounded-full border flex items-center justify-center mt-0.5 shrink-0 transition ${
                                            task.done
                                              ? 'bg-emerald-600 border-emerald-600 text-white'
                                              : 'border-slate-300 bg-white'
                                          }`}
                                        >
                                          {task.done && <Check className="w-4 h-4" />}
                                        </span>
                                        <div>
                                          <div
                                            className={`font-black text-[17px] ${
                                              task.done
                                                ? 'line-through text-slate-400'
                                                : 'text-slate-950'
                                            }`}
                                          >
                                            {task.title}
                                          </div>
                                          <p className="text-[14.5px] font-semibold text-slate-600 mt-0.5">
                                            {task.desc}
                                          </p>
                                        </div>
                                      </div>
                                      <span
                                        className={`px-3 py-1 rounded-full text-[13px] font-extrabold shrink-0 ${
                                          task.done
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : 'bg-slate-100 text-slate-700'
                                        }`}
                                      >
                                        {task.status}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* 오늘 처리할 일정 이후에 진행될 일정 (예정된 농작업 심플 리스트 & 선택 시 관련 정보 + 추천상품 1개 인라인 표시) */}
                              <div className="space-y-2.5">
                                <div className="flex items-center justify-between gap-2">
                                  <div>
                                    <h4 className="text-[19px] font-black text-slate-900">
                                      예정된 농작업 (이후 진행 일정)
                                    </h4>
                                    <p className="text-[13.5px] font-semibold text-slate-600 mt-0.5">
                                      항목을 선택하면 상세 생육정보와 맞춤 추천상품(1종)이 표시됩니다.
                                    </p>
                                  </div>
                                  <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[13.5px] font-extrabold shrink-0">
                                    총 {(provisionData.scheduleItems || []).length}개 공정
                                  </span>
                                </div>

                                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden bg-white">
                                  {(provisionData.scheduleItems || []).map((item: any, idx: number) => {
                                    const cleanName = String(item.sub_item_name || '')
                                      .replace(/\s*\([^)]*\)/g, '')
                                      .trim();
                                    const shortMd = item.start_date
                                      ? `${item.start_date.slice(5, 7)}/${item.start_date.slice(8, 10)}`
                                      : '-';
                                    const isSelected = selectedStageItem?.item_id === item.item_id;
                                    const topMat = [...(item.materials || [])].sort(
                                      (a: any, b: any) =>
                                        Number(b?.match_score || 0) - Number(a?.match_score || 0)
                                    )[0];
                                    const stageId =
                                      item.stage_group_code ||
                                      item.stage_group_id ||
                                      item.stage_group_name ||
                                      'STG-1';
                                    const matCode =
                                      topMat?.material_id || topMat?.product_name || 'MAT-1';
                                    const selKey = `${stageId}__${item.item_id || ''}__${matCode}`;
                                    const areaPyeongVal = Number(
                                      provisionData.activeRequest?.area_pyeong ||
                                        crop.area_pyeong ||
                                        300
                                    );
                                    const defaultQty = topMat
                                      ? parseRecommendedQuantity(topMat, areaPyeongVal)
                                      : 1;
                                    const isChecked =
                                      (purchaseSelectionMap[selKey]?.checked ?? true) === true;

                                    return (
                                      <div key={`mob-up-${item.item_id || idx}`} className="bg-white">
                                        {/* 심플 리스트 행 */}
                                        <div
                                          onClick={() => {
                                            if (isSelected) {
                                              setSelectedStageItem(null);
                                            } else {
                                              handleSelectStageItem(item);
                                            }
                                          }}
                                          className={`p-3.5 flex items-center justify-between gap-3 transition cursor-pointer ${
                                            isSelected
                                              ? 'bg-emerald-50/80'
                                              : 'hover:bg-slate-50'
                                          }`}
                                        >
                                          <div className="flex items-center gap-3 min-w-0">
                                            <span
                                              className={`px-3.5 py-2 rounded-xl font-mono font-black text-[15px] shrink-0 ${
                                                isSelected
                                                  ? 'bg-emerald-600 text-white'
                                                  : 'bg-[#F4F6F8] text-slate-900'
                                              }`}
                                            >
                                              {shortMd}
                                            </span>
                                            <div className="min-w-0">
                                              <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="font-black text-[17px] text-slate-950 truncate">
                                                  {cleanName}
                                                </span>
                                                {item.stage_group_name && (
                                                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[12.5px] font-extrabold shrink-0">
                                                    {item.stage_group_name}
                                                  </span>
                                                )}
                                              </div>
                                              <div className="text-[14.5px] font-semibold text-slate-600 truncate mt-0.5">
                                                {item.work_content ||
                                                  item.work_description ||
                                                  '생육상태 및 기온 확인 후 진행'}
                                              </div>
                                            </div>
                                          </div>
                                          <ChevronRight
                                            className={`w-5 h-5 shrink-0 transition-transform duration-200 ${
                                              isSelected
                                                ? 'rotate-90 text-emerald-700'
                                                : 'text-slate-400'
                                            }`}
                                          />
                                        </div>

                                        {/* 리스트 항목 선택 시 열리는 관련 정보 + 생육과정별 추천상품 1개 (제품이미지 + 제품명 + 선택된 체크박스) */}
                                        {isSelected && (
                                          <div className="px-3.5 pb-3.5 pt-2 bg-emerald-50/40 border-t border-emerald-100 space-y-3">
                                            {/* 1. 관련된 생육과정 상세 정보 */}
                                            <div className="rounded-xl bg-white border border-emerald-200/80 p-3.5 space-y-2.5">
                                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                                <span className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-900 text-[13px] font-extrabold">
                                                  {item.stage_group_name || '생육공정'} ·{' '}
                                                  {item.process_code || `SCH-0${idx + 1}`}
                                                </span>
                                                <span className="font-mono text-[14.5px] font-black text-emerald-700">
                                                  추천 진행일: {formatYmdWithWeekday(item.start_date)}
                                                </span>
                                              </div>

                                              <div className="grid grid-cols-2 gap-2 text-[13.5px]">
                                                <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200/70 flex items-center justify-between">
                                                  <span className="text-slate-600 font-bold">목표 적산온도</span>
                                                  <span className="font-mono font-black text-slate-900">
                                                    PGDD {item.target_pgdd || 0}℃
                                                  </span>
                                                </div>
                                                <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200/70 flex items-center justify-between">
                                                  <span className="text-slate-600 font-bold">예상 평균기온</span>
                                                  <span className="font-mono font-black text-emerald-700">
                                                    {item.recommended_day_climate?.temp_avg ??
                                                      item.climate_stats?.avg_temp ??
                                                      18.5}
                                                    ℃
                                                  </span>
                                                </div>
                                              </div>

                                              <div className="text-[15px] text-slate-800 leading-relaxed bg-slate-50/80 rounded-lg p-3 border border-slate-100 font-semibold">
                                                <div className="font-black text-slate-950 mb-1">
                                                  📋 핵심 작업내용
                                                </div>
                                                <div>
                                                  {item.work_content ||
                                                    item.work_description ||
                                                    '토양 수분 및 생육 상태를 점검하고 적정량을 살포합니다.'}
                                                </div>
                                                {(item.climate_rule || item.usage_tip) && (
                                                  <div className="mt-2 pt-2 border-t border-slate-200/70 text-[13.5px] text-emerald-800 font-bold">
                                                    💡 {item.climate_rule || item.usage_tip}
                                                  </div>
                                                )}
                                              </div>
                                            </div>

                                            {/* 2. 해당 생육과정별 추천상품 1개 (체크박스 선택된 상태 + 제품이미지 + 제품명) */}
                                            {topMat && (
                                              <div className="rounded-xl bg-white border-2 border-emerald-500/80 p-3.5 shadow-2xs space-y-2.5">
                                                <div className="flex items-center justify-between">
                                                  <span className="text-[13.5px] font-black text-emerald-800 flex items-center gap-1">
                                                    <Package className="w-4 h-4 text-emerald-600" />
                                                    해당 생육과정 맞춤 추천상품 (1종)
                                                  </span>
                                                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[12.5px] font-extrabold">
                                                    추천점수 {topMat.match_score || 95}점
                                                  </span>
                                                </div>

                                                <label
                                                  onClick={(e) => e.stopPropagation()}
                                                  className="flex items-center gap-3.5 cursor-pointer select-none pt-0.5"
                                                >
                                                  <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() =>
                                                      handleToggleMaterialCheck(selKey, defaultQty)
                                                    }
                                                    className="w-6 h-6 rounded accent-emerald-600 cursor-pointer shrink-0"
                                                  />
                                                  <img
                                                    src={
                                                      topMat.thumbnail_url ||
                                                      '/api/agro-materials/image/FERT-PRD-01/thumb'
                                                    }
                                                    alt={topMat.product_name}
                                                    className="w-16 h-16 rounded-xl object-contain border border-slate-200 bg-white shrink-0"
                                                  />
                                                  <div className="min-w-0 flex-1">
                                                    <div className="font-black text-[16.5px] text-slate-950 leading-snug break-keep">
                                                      {topMat.product_name}
                                                    </div>
                                                    <div className="text-[13.5px] font-semibold text-slate-600 mt-0.5 truncate">
                                                      {topMat.core_Spec ||
                                                        topMat.core_spec ||
                                                        topMat.material_category_name ||
                                                        '맞춤 농자재'}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                      <span className="px-2.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[12.5px] font-extrabold">
                                                        {areaPyeongVal.toLocaleString()}평 기준 권장{' '}
                                                        {defaultQty}
                                                        {topMat.unit_label || '개'}
                                                      </span>
                                                      <span className="font-mono text-[16px] font-black text-slate-950">
                                                        {Number(
                                                          topMat.unit_price || 15000
                                                        ).toLocaleString()}
                                                        원
                                                      </span>
                                                    </div>
                                                  </div>
                                                </label>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </section>

                            {/* [모바일 카드 3 (첨부 이미지 3, 4, 5번)]: 재배일정 3가지 보기 방식 (타임라인 | 달력 | 생육단계) */}
                            <section className="bg-white rounded-3xl border border-slate-200 p-4 shadow-xs space-y-4">
                              {/* 상단 3분할 탭 스위치 (타임라인 | 달력 | 생육단계) */}
                              <div className="grid grid-cols-3 gap-1 p-1 rounded-full bg-slate-100/70 text-[16px] font-black">
                                {[
                                  { id: 'timeline', label: '타임라인' },
                                  { id: 'calendar', label: '달력' },
                                  { id: 'stages', label: '생육단계' },
                                ].map((t) => (
                                  <button
                                    key={t.id}
                                    type="button"
                                    onClick={() =>
                                      setScheduleViewMode(
                                        t.id as 'timeline' | 'calendar' | 'stages'
                                      )
                                    }
                                    className={`py-2.5 rounded-full transition cursor-pointer ${
                                      scheduleViewMode === t.id
                                        ? 'bg-[#EAECEF] text-slate-950 font-black shadow-2xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                  >
                                    {t.label}
                                  </button>
                                ))}
                              </div>

                              {/* [탭 1: 타임라인 — 첨부 이미지 3번 '농작업 타임라인'] */}
                              {scheduleViewMode === 'timeline' && (
                                <div className="rounded-2xl border border-slate-200 p-4 space-y-4">
                                  <h4 className="text-[19px] font-black text-slate-900">
                                    농작업 타임라인
                                  </h4>
                                  <div className="space-y-3.5">
                                    {(provisionData.scheduleItems || []).map(
                                      (item: any, idx: number) => {
                                        const cleanName = String(item.sub_item_name || '')
                                          .replace(/\s*\([^)]*\)/g, '')
                                          .trim();
                                        const mNum = Number(
                                          String(item.start_date || '').slice(5, 7)
                                        );
                                        const dNum = Number(
                                          String(item.start_date || '').slice(8, 10)
                                        );
                                        const koreanDateLabel =
                                          mNum && dNum
                                            ? `${mNum}월 ${dNum}일`
                                            : item.start_date || '-';
                                        const isSelected =
                                          selectedStageItem?.item_id === item.item_id;
                                        return (
                                          <div
                                            key={`mob-tl-${item.item_id}`}
                                            onClick={() => {
                                              handleSelectStageItem(item);
                                            }}
                                            className={`flex items-start gap-3.5 rounded-xl p-2 transition cursor-pointer ${
                                              isSelected
                                                ? 'bg-emerald-50/80 ring-1 ring-emerald-300'
                                                : 'hover:bg-slate-50'
                                            }`}
                                          >
                                            <div className="flex flex-col items-center w-6 shrink-0 pt-0.5">
                                              <span
                                                className={`text-[16px] font-black leading-none ${
                                                  isSelected
                                                    ? 'text-emerald-700 font-black'
                                                    : 'text-slate-800'
                                                }`}
                                              >
                                                {idx + 1}
                                              </span>
                                              {idx <
                                                (provisionData.scheduleItems?.length || 0) - 1 && (
                                                <div className="w-px h-9 bg-slate-200 mt-1.5" />
                                              )}
                                            </div>
                                            <div className="min-w-0 flex-1 pb-1">
                                              <div className="font-black text-[17.5px] text-slate-950 leading-snug">
                                                {koreanDateLabel} · {cleanName}
                                              </div>
                                              <div className="text-[14.5px] font-semibold text-slate-600 mt-1 line-clamp-2">
                                                {item.work_content ||
                                                  item.work_description ||
                                                  '토양검정과 생육상태 확인 후 진행'}
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      }
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* [탭 2: 달력 — 첨부 이미지 4번 '2026년 9월' 월간 달력] */}
                              {scheduleViewMode === 'calendar' && (
                                <div className="rounded-2xl border border-slate-200 p-4 space-y-3.5">
                                  <div className="flex items-center justify-between">
                                    <h4 className="text-[20px] font-black text-slate-900">
                                      {calendarYearMonth.year}년 {calendarYearMonth.month}월
                                    </h4>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setCalendarYearMonth((prev) =>
                                            prev.month === 1
                                              ? { year: prev.year - 1, month: 12 }
                                              : { year: prev.year, month: prev.month - 1 }
                                          )
                                        }
                                        className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer"
                                      >
                                        <ChevronLeft className="w-5 h-5 text-slate-700" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setCalendarYearMonth((prev) =>
                                            prev.month === 12
                                              ? { year: prev.year + 1, month: 1 }
                                              : { year: prev.year, month: prev.month + 1 }
                                          )
                                        }
                                        className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer"
                                      >
                                        <ChevronRight className="w-5 h-5 text-slate-700" />
                                      </button>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-7 gap-1.5 text-center text-sm">
                                    {WEEKDAY_KO.map((w) => (
                                      <div key={w} className="py-1 text-slate-600 font-extrabold">
                                        {w}
                                      </div>
                                    ))}
                                    {calendarCells.map((cell, cIdx) => {
                                      if (!cell.day) {
                                        return (
                                          <div
                                            key={cIdx}
                                            className="h-12 rounded-xl bg-[#F4F6F8]/60"
                                          />
                                        );
                                      }
                                      const hasTask = cell.items.length > 0;
                                      const isSelectedDay =
                                        selectedStageItem?.start_date === cell.ymd;
                                      return (
                                        <button
                                          key={cIdx}
                                          type="button"
                                          onClick={() => {
                                            if (cell.items[0]) {
                                              handleSelectStageItem(cell.items[0]);
                                            }
                                          }}
                                          className={`h-12 rounded-xl flex flex-col items-center justify-center text-[15px] font-bold transition cursor-pointer ${
                                            isSelectedDay
                                              ? 'bg-emerald-600 text-white font-black shadow-2xs'
                                              : hasTask
                                              ? 'bg-[#DDF3E8] text-slate-950 font-black'
                                              : 'bg-[#F4F6F8] text-slate-800 hover:bg-slate-200/70'
                                          }`}
                                        >
                                          <span>{cell.day}</span>
                                          {hasTask && (
                                            <span
                                              className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                                                isSelectedDay ? 'bg-white' : 'bg-[#22A559]'
                                              }`}
                                            />
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>

                                  <div className="pt-2 text-[14.5px] text-slate-700 font-bold leading-relaxed">
                                    {monthScheduledItems.length > 0
                                      ? monthScheduledItems
                                          .map(
                                            (it: any) =>
                                              `${Number(it.start_date.slice(5, 7))}/${Number(
                                                it.start_date.slice(8, 10)
                                              )} ${String(it.sub_item_name || '')
                                                .replace(/\s*\([^)]*\)/g, '')
                                                .trim()}`
                                          )
                                          .join(' · ')
                                      : '이 달에 예정된 농작업이 없습니다. 상단 화살표(< >)로 월을 이동해 보세요.'}
                                  </div>
                                </div>
                              )}

                              {/* [탭 3: 생육단계 — 첨부 이미지 5번 '배추 생육단계'] */}
                              {scheduleViewMode === 'stages' && (
                                <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                                  <h4 className="text-[19px] font-black text-slate-900">
                                    {crop.crop_short || '배추'} 생육단계
                                  </h4>
                                  <div className="space-y-2.5">
                                    {(provisionData.stageGroups || []).map((grp: any) => {
                                      const isStageOpen =
                                        expandedStageGroupCode === grp.stage_group_id;
                                      const isHarvestStage =
                                        String(grp.stage_group_name || '').includes('수확') ||
                                        String(grp.stage_slot_key || '').includes('HARVEST');
                                      const subNamesSummary = (grp.items || [])
                                        .map((i: any) =>
                                          String(i.sub_item_name || '')
                                            .replace(/\s*\([^)]*\)/g, '')
                                            .trim()
                                        )
                                        .join('·');
                                      return (
                                        <div
                                          key={`mob-stg-${grp.stage_group_id}`}
                                          className="space-y-2"
                                        >
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setExpandedStageGroupCode((prev) =>
                                                prev === grp.stage_group_id
                                                  ? ''
                                                  : grp.stage_group_id
                                              )
                                            }
                                            className="w-full py-2 flex items-center justify-between gap-3 text-left cursor-pointer"
                                          >
                                            <div className="flex items-center gap-3.5 min-w-0">
                                              <span className="w-11 h-11 rounded-2xl bg-[#F4F6F8] text-slate-700 flex items-center justify-center shrink-0">
                                                {isHarvestStage ? (
                                                  <PackageCheck className="w-5 h-5 text-slate-700" />
                                                ) : (
                                                  <Sprout className="w-5 h-5 text-slate-700" />
                                                )}
                                              </span>
                                              <div className="min-w-0">
                                                <div className="font-black text-[17.5px] text-slate-950 truncate">
                                                  {grp.stage_group_name}
                                                </div>
                                                <div className="text-[14.5px] font-semibold text-slate-600 truncate mt-0.5">
                                                  {subNamesSummary}
                                                </div>
                                              </div>
                                            </div>
                                            <ChevronRight
                                              className={`w-5 h-5 text-slate-400 shrink-0 transition-transform ${
                                                isStageOpen ? 'rotate-90' : ''
                                              }`}
                                            />
                                          </button>

                                          {isStageOpen && (
                                            <div className="pl-12 space-y-2 pb-1">
                                              {(grp.items || []).map((it: any) => {
                                                const cleanSub = String(it.sub_item_name || '')
                                                  .replace(/\s*\([^)]*\)/g, '')
                                                  .trim();
                                                const isSel =
                                                  selectedStageItem?.item_id === it.item_id;
                                                return (
                                                  <button
                                                    key={`mob-stg-it-${it.item_id}`}
                                                    type="button"
                                                    onClick={() => {
                                                      handleSelectStageItem(it);
                                                    }}
                                                    className={`w-full text-left px-3.5 py-3 rounded-xl border text-[15px] flex items-center justify-between transition cursor-pointer ${
                                                      isSel
                                                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-black'
                                                        : 'bg-slate-50 border-slate-200/80 text-slate-800 font-bold hover:bg-slate-100'
                                                    }`}
                                                  >
                                                    <span>{cleanSub}</span>
                                                    <span className="font-mono text-emerald-700 font-black">
                                                      {formatYmdWithWeekday(it.start_date)}
                                                    </span>
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* 모바일 하단: 선택한 생육과정 관련 정보 + 추천상품 1종(이미지·상품명·체크박스) + 추천 진행일 조정 */}
                              {detailItem && (() => {
                                const dTopMat = [...(detailItem.materials || [])].sort(
                                  (a: any, b: any) =>
                                    Number(b?.match_score || 0) - Number(a?.match_score || 0)
                                )[0];
                                const dStageId =
                                  detailItem.stage_group_code ||
                                  detailItem.stage_group_id ||
                                  detailItem.stage_group_name ||
                                  'STG-1';
                                const dMatCode =
                                  dTopMat?.material_id || dTopMat?.product_name || 'MAT-1';
                                const dSelKey = `${dStageId}__${detailItem.item_id || ''}__${dMatCode}`;
                                const dAreaPyeong = Number(
                                  provisionData.activeRequest?.area_pyeong ||
                                    crop.area_pyeong ||
                                    300
                                );
                                const dDefaultQty = dTopMat
                                  ? parseRecommendedQuantity(dTopMat, dAreaPyeong)
                                  : 1;
                                const dIsChecked =
                                  (purchaseSelectionMap[dSelKey]?.checked ?? true) === true;

                                return (
                                  <div className="rounded-2xl bg-[#E9F7F1] border border-emerald-200 p-3.5 space-y-3">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-[15px] font-black text-emerald-950">
                                        선택 공정:{' '}
                                        {String(detailItem.sub_item_name || '')
                                          .replace(/\s*\([^)]*\)/g, '')
                                          .trim()}
                                      </span>
                                      <span className="px-2.5 py-0.5 rounded bg-white text-emerald-800 border border-emerald-200 text-[12.5px] font-extrabold">
                                        PGDD {detailItem.target_pgdd || 0}℃
                                      </span>
                                    </div>

                                    <div className="text-[14.5px] font-semibold text-slate-800 bg-white/90 rounded-xl p-3 border border-emerald-200/70 leading-relaxed">
                                      {detailItem.work_content ||
                                        detailItem.work_description ||
                                        '생육상태 및 기온을 확인하여 적기 작업을 진행합니다.'}
                                    </div>

                                    {dTopMat && (
                                      <label className="rounded-xl bg-white border border-emerald-300 p-2.5 flex items-center gap-3 cursor-pointer select-none">
                                        <input
                                          type="checkbox"
                                          checked={dIsChecked}
                                          onChange={() =>
                                            handleToggleMaterialCheck(dSelKey, dDefaultQty)
                                          }
                                          className="w-5 h-5 rounded accent-emerald-600 cursor-pointer shrink-0"
                                        />
                                        <img
                                          src={
                                            dTopMat.thumbnail_url ||
                                            '/api/agro-materials/image/FERT-PRD-01/thumb'
                                          }
                                          alt={dTopMat.product_name}
                                          className="w-12 h-12 rounded-xl object-cover border border-slate-200 bg-slate-50 shrink-0"
                                        />
                                        <div className="min-w-0 flex-1">
                                          <div className="font-extrabold text-xs text-slate-900 truncate">
                                            {dTopMat.product_name}
                                          </div>
                                          <div className="text-[11px] text-emerald-800 font-bold mt-0.5">
                                            권장 {dDefaultQty}
                                            {dTopMat.unit_label || '개'} ·{' '}
                                            {Number(dTopMat.unit_price || 15000).toLocaleString()}원
                                          </div>
                                        </div>
                                      </label>
                                    )}

                                    <div className="flex items-center justify-between gap-2">
                                      <input
                                        type="date"
                                        value={curStart}
                                        onChange={(e) =>
                                          setEditDetailForm((prev: any) => ({
                                            ...prev,
                                            start_date: e.target.value,
                                          }))
                                        }
                                        className="px-3 py-1.5 rounded-xl border border-emerald-300 bg-white font-mono font-extrabold text-xs text-slate-900"
                                      />
                                      <span className="font-mono font-extrabold text-xs text-emerald-900">
                                        {formatYmdWithWeekday(curStart)}
                                      </span>
                                    </div>
                                    {cascadeDeltaDays !== 0 && (
                                      <button
                                        type="button"
                                        disabled={isSavingDetailItem}
                                        onClick={handleSaveUserScheduleCascade}
                                        className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-extrabold text-xs shadow-xs cursor-pointer"
                                      >
                                        ✅ 새 일정 승인 및 후속 {subsequentItems.length}개 공정 반영
                                      </button>
                                    )}
                                  </div>
                                );
                              })()}
                            </section>
                          </div>

                          {/* ①-PC [PC 환경 전용 (hidden lg:block)]: 생육과정 정밀 타임라인 (1~12월 · 48주) & 기후 연동 추천 진행일 조정기 */}
                          <section className="hidden lg:block bg-white rounded-3xl border-2 border-emerald-200 p-4 sm:p-7 shadow-xs space-y-6">
                            {/* 상단 타이틀 & 보기 전환 */}
                            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-extrabold">
                                    상세 관제 · 관리자 재배일정 세부폼 전체 연동
                                  </span>
                                  <span className="font-mono text-xs text-slate-500">
                                    [{provisionData.activeRequest?.request_no}]
                                  </span>
                                </div>
                                <h3 className="text-base sm:text-xl font-extrabold text-slate-900 mt-1">
                                  생육과정 정밀 타임라인 (1~12월 · 48주) &amp; 기후 연동 추천 진행일 조정기
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  아래 연간 타임라인에서 생육과정을 클릭하여 추천 진행일(요일 포함)을 변경하면, 이후 모든 생육과정이 최저·최고 한계온도를 피하고 적정온도에 맞춰 자동 재산출됩니다.
                                </p>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setPcTimelineMode('calendar')}
                                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition cursor-pointer ${
                                    pcTimelineMode === 'calendar'
                                      ? 'bg-emerald-600 text-white border-emerald-600'
                                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                                  }`}
                                >
                                  실기후 월·일 정밀 매칭 (1~12월)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPcTimelineMode('diagram')}
                                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition cursor-pointer ${
                                    pcTimelineMode === 'diagram'
                                      ? 'bg-emerald-600 text-white border-emerald-600'
                                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                                  }`}
                                >
                                  월·주 칸 단위 격자 (48주)
                                </button>
                                <button
                                  type="button"
                                  onClick={handleResetUserSchedule}
                                  className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>초기 일정 복원</span>
                                </button>
                              </div>
                            </div>

                            {/* 연간 1월~12월 (48주) 와이드 간트 테이블 */}
                            <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto shadow-2xs">
                              <table className="w-full border-collapse table-fixed min-w-[1260px]">
                                <colgroup>
                                  <col className="w-[150px]" />
                                  <col className="w-[195px]" />
                                  <col className="w-[165px]" />
                                  <col />
                                </colgroup>
                                <thead>
                                  <tr className="bg-slate-50 text-slate-800 border-b border-slate-200">
                                    <th className="py-3 px-2 text-center border-r border-slate-200 font-extrabold text-xs">
                                      단계 (관리명칭)
                                    </th>
                                    <th className="py-3 px-3 text-center border-r border-slate-200 font-extrabold text-xs">
                                      생육 과정명
                                    </th>
                                    <th className="py-3 px-2.5 text-center border-r border-slate-200 font-extrabold text-xs text-emerald-700">
                                      추천 진행일 (요일 포함)
                                    </th>
                                    <th className="p-0 align-top">
                                      <div
                                        style={{ gridTemplateColumns: 'repeat(48, minmax(0, 1fr))' }}
                                        className="grid w-full bg-slate-100/80 border-b border-slate-200"
                                      >
                                        {Array.from({ length: 12 }, (_, mIdx) => {
                                          const m = mIdx + 1;
                                          return (
                                            <div
                                              key={m}
                                              style={{ gridColumn: 'span 4 / span 4' }}
                                              className={`py-2 px-1 text-center font-extrabold text-xs text-slate-800 ${
                                                m === 12 ? '' : 'border-r border-slate-300'
                                              }`}
                                            >
                                              {m}월
                                            </div>
                                          );
                                        })}
                                      </div>
                                      <div
                                        style={{ gridTemplateColumns: 'repeat(48, minmax(0, 1fr))' }}
                                        className="grid w-full bg-slate-50 text-slate-500 text-[10px]"
                                      >
                                        {Array.from({ length: 48 }, (_, colIdx) => {
                                          const weekNum = (colIdx % 4) + 1;
                                          const isMonthEnd = weekNum === 4;
                                          const isLastCol = colIdx === 47;
                                          return (
                                            <div
                                              key={colIdx}
                                              className={`py-1 text-center font-semibold ${
                                                isLastCol
                                                  ? ''
                                                  : isMonthEnd
                                                  ? 'border-r border-slate-300'
                                                  : 'border-r border-slate-200/70'
                                              }`}
                                            >
                                              {weekNum}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(provisionData.stageGroups || []).map((group: any) => {
                                    const groupItems = group.items || [];
                                    const stageColor = group.stage_color || '#16a34a';
                                    return groupItems.map((item: any, idxInGroup: number) => {
                                      const enrichedItem = {
                                        ...item,
                                        stage_group_name: group.stage_group_name,
                                        stage_color: stageColor,
                                      };
                                      const isSelectedStage = selectedStageItem?.item_id === item.item_id;
                                      const isHovered = hoveredProvisionItem?.item_id === item.item_id;
                                      const isClickedOpen = clickedProvisionItem?.item_id === item.item_id;
                                      const isLastInGroup = idxInGroup === groupItems.length - 1;
                                      const leftPct =
                                        pcTimelineMode === 'calendar'
                                          ? Number(item.calendar_left_pct ?? 50)
                                          : Number(item.diagram_left_pct ?? 50);
                                      const widthPct = Math.max(
                                        3.5,
                                        pcTimelineMode === 'calendar'
                                          ? Number(item.calendar_width_pct ?? 4)
                                          : Number(item.diagram_width_pct ?? 4)
                                      );
                                      return (
                                        <tr
                                          key={item.item_id}
                                          data-growth-trigger="true"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const barEl = e.currentTarget.querySelector(
                                              '[data-gantt-bar="true"]'
                                            ) as HTMLElement | null;
                                            const targetEl = barEl || e.currentTarget;
                                            const rect = targetEl.getBoundingClientRect();
                                            setHoverAnchorPos({
                                              top: rect.top,
                                              left: rect.left,
                                              width: rect.width,
                                              height: rect.height,
                                              showAbove: rect.top > 240,
                                            });
                                            setHoveredProvisionItem(enrichedItem);
                                            handleSelectStageItem(enrichedItem);
                                          }}
                                          className={`cursor-pointer transition ${
                                            isLastInGroup ? 'border-b-2 border-slate-200' : 'border-b border-slate-100'
                                          } ${
                                            isClickedOpen || isHovered || isSelectedStage
                                              ? 'bg-emerald-50/85'
                                              : 'bg-white hover:bg-slate-50/90'
                                          }`}
                                        >
                                          {idxInGroup === 0 && (
                                            <td
                                              rowSpan={groupItems.length}
                                              className="p-2 border-r border-slate-200 align-middle bg-slate-50/40"
                                            >
                                              <div
                                                style={{ backgroundColor: stageColor }}
                                                className="w-full min-h-[68px] rounded-xl px-2.5 py-2 flex items-center justify-center text-white font-extrabold text-xs shadow-2xs"
                                              >
                                                {group.stage_group_name}
                                              </div>
                                            </td>
                                          )}
                                          <td className="py-2.5 px-3 border-r border-slate-200 font-bold text-xs text-slate-900">
                                            <div className="flex items-center justify-between gap-1.5">
                                              <span
                                                className={
                                                  isClickedOpen || isHovered || isSelectedStage
                                                    ? 'text-emerald-700 font-extrabold'
                                                    : ''
                                                }
                                              >
                                                {String(item.sub_item_name || '').replace(/\s*\([^)]*\)/g, '').trim()}
                                              </span>
                                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                                요약보기 ›
                                              </span>
                                            </div>
                                          </td>
                                          <td className="py-2.5 px-2.5 border-r border-slate-200 text-center font-mono font-extrabold text-xs text-emerald-700">
                                            {formatYmdWithWeekday(item.start_date)}
                                          </td>
                                          <td className="p-0 relative h-[36px] align-middle">
                                            <div
                                              style={{ gridTemplateColumns: 'repeat(48, minmax(0, 1fr))' }}
                                              className="absolute inset-0 grid w-full pointer-events-none"
                                            >
                                              {Array.from({ length: 48 }, (_, cIdx) => {
                                                const isMonthBorder = (cIdx + 1) % 4 === 0;
                                                const isLastCol = cIdx === 47;
                                                return (
                                                  <div
                                                    key={cIdx}
                                                    className={`h-full ${
                                                      isLastCol
                                                        ? ''
                                                        : isMonthBorder
                                                        ? 'border-r border-slate-300'
                                                        : 'border-r border-slate-100'
                                                    }`}
                                                  />
                                                );
                                              })}
                                            </div>
                                            <div
                                              data-gantt-bar="true"
                                              style={{
                                                left: `${leftPct}%`,
                                                width: `${widthPct}%`,
                                                backgroundColor: stageColor,
                                                clipPath:
                                                  'polygon(5px 0%, calc(100% - 8px) 0%, 100% 50%, calc(100% - 8px) 100%, 5px 100%, 0% 50%)',
                                              }}
                                              className={`relative z-10 h-[23px] my-[6px] flex items-center justify-center px-2.5 text-white font-extrabold text-[11px] whitespace-nowrap overflow-hidden shadow-2xs transition-transform ${
                                                isHovered || isClickedOpen ? 'scale-[1.03] ring-2 ring-emerald-700/40' : ''
                                              }`}
                                            >
                                              <span className="truncate">{item.bar_label || item.sub_item_name}</span>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    });
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </section>

                          {/* ② 전 생육과정 추천 농자재 단계별 리스트 & 단번에 구매하기 */}
                          <section
                            id="stage-materials-bulk-purchase-section"
                            className="bg-white rounded-3xl border-2 border-emerald-200 p-4 sm:p-6 shadow-xs space-y-5 relative"
                          >
                            {(() => {
                              const areaPyeong = Number(
                                provisionData.activeRequest?.area_pyeong || activeCropCard.area_pyeong || 300
                              );

                              const defaultStageNames = [
                                '재배 준비',
                                '파종·육묘',
                                '정식·활착',
                                '생육 관리',
                                '병해충 예찰',
                                '수확',
                              ];
                              const stageBundles = (provisionData.stageGroups || []).map(
                                (group: any, gIdx: number) => {
                                  const stageId =
                                    group.stage_group_code ||
                                    group.stage_group_id ||
                                    group.stage_group_name ||
                                    `STG-${gIdx + 1}`;
                                  const stageName =
                                    group.stage_group_name ||
                                    group.stage_name ||
                                    defaultStageNames[gIdx] ||
                                    `단계 ${gIdx + 1}`;
                                  const groupItems = group.items || [];

                                  const validStarts = groupItems
                                    .map((it: any) => it.start_date)
                                    .filter((d: any) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d))
                                    .sort();
                                  const validEnds = groupItems
                                    .map((it: any) => it.end_date)
                                    .filter((d: any) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d))
                                    .sort();
                                  const stageStartDate = validStarts[0] || '';
                                  const stageEndDate = validEnds[validEnds.length - 1] || '';

                                  const mergedMaterialsMap = new Map<string, any>();
                                  groupItems.forEach((it: any) => {
                                    const cleanSubName = String(it.sub_item_name || '')
                                      .replace(/\s*\([^)]*\)/g, '')
                                      .trim();
                                    // 각 생육과정(SCH-01~SCH-16)별 최고 추천점수 1종(Top 1) 제품만 선정
                                    const topMats = [...(it.materials || [])]
                                      .sort(
                                        (a: any, b: any) =>
                                          Number(b?.match_score || 0) - Number(a?.match_score || 0)
                                      )
                                      .slice(0, 1);
                                    topMats.forEach((mat: any) => {
                                      const matCode = mat.material_id || mat.product_name;
                                      const selKey = `${stageId}__${it.item_id || ''}__${matCode}`;
                                      const calcQty = parseRecommendedQuantity(mat, areaPyeong);
                                      const unitSpecStr = String(mat.unit_spec || '1포/기본단위');
                                      const unitMatch = unitSpecStr.match(
                                        /(포|병|봉|통|팩|판|박스|개|롤)/
                                      );
                                      const unitLabel = unitMatch ? unitMatch[1] : '개';
                                      const baseRate =
                                        Number(mat.base_units_per_100pyeong) ||
                                        (String(mat.material_category || '').toUpperCase() ===
                                        'FERTILIZER'
                                          ? 1.5
                                          : 0.5);
                                      const areaRatio = Number((areaPyeong / 100).toFixed(2));
                                      const rawUnits = Number(
                                        ((areaPyeong / 100) * baseRate).toFixed(2)
                                      );
                                      const bullets = buildStageRationaleBullets(
                                        mat,
                                        cleanSubName || stageName,
                                        areaPyeong
                                      );

                                      mergedMaterialsMap.set(selKey, {
                                        selKey,
                                        stageId,
                                        stageName,
                                        stageStartDate,
                                        item_id: it.item_id,
                                        process_code: it.process_code,
                                        sub_item_name: cleanSubName,
                                        material_id: mat.material_id || matCode,
                                        material_category: mat.material_category || '',
                                        product_name: mat.product_name || '맞춤 처방 농자재',
                                        sub_type: mat.sub_type || '맞춤 농자재',
                                        manufacturer: mat.manufacturer || '한팜인증',
                                        unit_spec: unitSpecStr,
                                        unit_label: unitLabel,
                                        unit_price: Number(mat.unit_price || 18000),
                                        match_score: Number(mat.match_score || 96),
                                        category_spec_badge: mat.category_spec_badge || '',
                                        selection_rationale:
                                          mat.selection_rationale || bullets.join('\n'),
                                        rationale_bullets: bullets,
                                        rationale_stage: mat.rationale_stage || '',
                                        rationale_soil: mat.rationale_soil || '',
                                        rationale_climate: mat.rationale_climate || '',
                                        rationale_dosage: mat.rationale_dosage || '',
                                        quantity_calc_formula:
                                          mat.quantity_calc_formula ||
                                          `재배지 ${areaPyeong.toLocaleString()}평 ÷ 100평(${areaRatio}배) × 100평당 기준 ${baseRate}${unitLabel} = ${rawUnits}${unitLabel} 산출 → 포장단위 올림 총 ${calcQty}${unitLabel}(${unitSpecStr}) 필요`,
                                        recommended_for_area:
                                          mat.recommended_for_area ||
                                          `재배지 ${areaPyeong.toLocaleString()}평 계산: 총 ${calcQty}${unitLabel}(${unitSpecStr}) 필요 (100평당 ${baseRate}${unitLabel} × ${areaRatio}배 산출 · 권장 구매 ${calcQty}개)`,
                                        nutrient_ratio_summary: mat.nutrient_ratio_summary || '',
                                        thumbnail_url:
                                          mat.thumbnail_url ||
                                          '/api/agro-materials/image/FERT-PRD-01/thumb',
                                        defaultQty: calcQty,
                                        subProcesses: [
                                          {
                                            item_id: it.item_id,
                                            process_code: it.process_code,
                                            name: cleanSubName,
                                            start_date: it.start_date,
                                            end_date: it.end_date,
                                          },
                                        ],
                                      });
                                    });
                                  });

                                  const materials = Array.from(mergedMaterialsMap.values());
                                  const checkedMaterials = materials.filter(
                                    (m: any) => (purchaseSelectionMap[m.selKey]?.checked ?? true) === true
                                  );
                                  const isAllStageChecked =
                                    materials.length > 0 && checkedMaterials.length === materials.length;
                                  const stageSubtotal = materials.reduce((sum: number, m: any) => {
                                    const state = purchaseSelectionMap[m.selKey] || {
                                      checked: true,
                                      qty: m.defaultQty,
                                    };
                                    return state.checked ? sum + m.unit_price * state.qty : sum;
                                  }, 0);

                                  return {
                                    stageIndex: gIdx + 1,
                                    stageId,
                                    stageName,
                                    stageStartDate,
                                    stageEndDate,
                                    subProcessNames: groupItems.map((it: any) =>
                                      String(it.sub_item_name || '')
                                        .replace(/\s*\([^)]*\)/g, '')
                                        .trim()
                                    ),
                                    materials,
                                    checkedCount: checkedMaterials.length,
                                    isAllStageChecked,
                                    stageSubtotal,
                                  };
                                }
                              );

                              const allStageMaterials = stageBundles.flatMap((sb: any) => sb.materials);
                              const selectedMaterials = allStageMaterials.filter(
                                (m: any) => (purchaseSelectionMap[m.selKey]?.checked ?? true) === true
                              );
                              const totalSelectedTypesCount = selectedMaterials.length;
                              const totalSelectedUnitsCount = selectedMaterials.reduce(
                                (acc: number, m: any) => {
                                  const st = purchaseSelectionMap[m.selKey] || {
                                    checked: true,
                                    qty: m.defaultQty,
                                  };
                                  return acc + (st.checked ? st.qty : 0);
                                },
                                0
                              );
                              const rawTotalAmount = selectedMaterials.reduce((acc: number, m: any) => {
                                const st = purchaseSelectionMap[m.selKey] || {
                                  checked: true,
                                  qty: m.defaultQty,
                                };
                                return acc + (st.checked ? m.unit_price * st.qty : 0);
                              }, 0);
                              const memberDiscountAmount = Math.round((rawTotalAmount * 0.05) / 10) * 10;
                              const finalPayableAmount = Math.max(0, rawTotalAmount - memberDiscountAmount);

                              const visibleStageBundles =
                                selectedPurchaseStageFilter === 'ALL'
                                  ? stageBundles
                                  : stageBundles.filter(
                                      (sb: any) => sb.stageId === selectedPurchaseStageFilter
                                    );

                              const handleToggleMaterialCheck = (selKey: string, defaultQty: number) => {
                                setPurchaseSelectionMap((prev) => {
                                  const cur = prev[selKey] || { checked: true, qty: defaultQty };
                                  return {
                                    ...prev,
                                    [selKey]: { ...cur, checked: !cur.checked },
                                  };
                                });
                              };

                              const handleChangeMaterialQty = (
                                selKey: string,
                                defaultQty: number,
                                delta: number
                              ) => {
                                setPurchaseSelectionMap((prev) => {
                                  const cur = prev[selKey] || { checked: true, qty: defaultQty };
                                  const nextQty = Math.max(1, Math.min(99, cur.qty + delta));
                                  return {
                                    ...prev,
                                    [selKey]: { checked: true, qty: nextQty },
                                  };
                                });
                              };

                              const handleToggleStageAll = (stageBundle: any, forceCheck?: boolean) => {
                                const targetChecked =
                                  typeof forceCheck === 'boolean'
                                    ? forceCheck
                                    : !stageBundle.isAllStageChecked;
                                setPurchaseSelectionMap((prev) => {
                                  const next = { ...prev };
                                  stageBundle.materials.forEach((m: any) => {
                                    const cur = next[m.selKey] || { checked: true, qty: m.defaultQty };
                                    next[m.selKey] = { ...cur, checked: targetChecked };
                                  });
                                  return next;
                                });
                              };

                              const handleSelectAllStages = (checked: boolean) => {
                                setPurchaseSelectionMap((prev) => {
                                  const next = { ...prev };
                                  allStageMaterials.forEach((m: any) => {
                                    const cur = next[m.selKey] || { checked: true, qty: m.defaultQty };
                                    next[m.selKey] = {
                                      checked,
                                      qty: checked ? cur.qty || m.defaultQty : cur.qty,
                                    };
                                  });
                                  return next;
                                });
                              };

                              const handleExecuteOneClickPurchase = (mode: 'SELECTED' | 'ALL_PACKAGE' | 'SINGLE_STAGE', targetStage?: any) => {
                                let itemsToBuy = selectedMaterials;
                                if (mode === 'ALL_PACKAGE') {
                                  handleSelectAllStages(true);
                                  itemsToBuy = allStageMaterials;
                                } else if (mode === 'SINGLE_STAGE' && targetStage) {
                                  itemsToBuy = targetStage.materials;
                                }

                                if (itemsToBuy.length === 0) {
                                  setPurchaseToastMessage('구매할 농자재를 1개 이상 선택해 주세요.');
                                  setTimeout(() => setPurchaseToastMessage(''), 3000);
                                  return;
                                }

                                const orderItems = itemsToBuy.map((m: any) => {
                                  const st = purchaseSelectionMap[m.selKey] || {
                                    checked: true,
                                    qty: m.defaultQty,
                                  };
                                  const qty = mode === 'ALL_PACKAGE' || mode === 'SINGLE_STAGE' ? st.qty || m.defaultQty : st.qty;
                                  return {
                                    ...m,
                                    qty,
                                    subtotal: m.unit_price * qty,
                                    scheduledDeliveryDate: m.stageStartDate
                                      ? addDaysToYmd(m.stageStartDate, -3)
                                      : '2026-08-01',
                                  };
                                });

                                const orderRawTotal = orderItems.reduce(
                                  (s: number, it: any) => s + it.subtotal,
                                  0
                                );
                                const orderDiscount = Math.round((orderRawTotal * 0.05) / 10) * 10;
                                const orderFinalTotal = Math.max(0, orderRawTotal - orderDiscount);

                                const now = new Date();
                                const orderNo = `ORD-${now.getFullYear()}${String(
                                  now.getMonth() + 1
                                ).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-CB${String(
                                  Math.floor(100 + Math.random() * 900)
                                )}`;

                                const receiptData = {
                                  orderNo,
                                  orderedAt: `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(
                                    2,
                                    '0'
                                  )}.${String(now.getDate()).padStart(2, '0')} ${String(
                                    now.getHours()
                                  ).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
                                  memberId: loggedInUser.email,
                                  memberName: `${loggedInUser.name} (${loggedInUser.email})`,
                                  memberPhone: loggedInUser.phone || '010-2026-0109',
                                  cropTitle: activeCropCard.crop_title,
                                  regionAddress: `${activeCropCard.region} 412-5번지 일원 (${loggedInUser.name} 농장)`,
                                  areaPyeong,
                                  deliveryOption: purchaseDeliveryOption,
                                  paymentMethod: purchasePaymentMethod,
                                  bankAccount: primaryBankAccount,
                                  orderItems,
                                  orderRawTotal,
                                  orderDiscount,
                                  orderFinalTotal,
                                  rewardPoints: Math.round(orderFinalTotal * 0.02),
                                  purchaseTitle:
                                    mode === 'SINGLE_STAGE' && targetStage
                                      ? `${targetStage.stageName} 단계 맞춤 농자재 패키지`
                                      : mode === 'ALL_PACKAGE'
                                      ? '전 생육단계 추천 농자재 올인원 패키지'
                                      : '생육단계별 선택 농자재 일괄 구매',
                                };

                                setPurchaseOrderReceipt(receiptData);

                                fetch('/api/mypage/orders', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    email: loggedInUser.email,
                                    ...receiptData,
                                  }),
                                })
                                  .then((r) => r.json())
                                  .then((res) => {
                                    if (res?.ok) applyMyPagePayload(res);
                                  })
                                  .catch(() => {});
                              };

                              const stageAccentStyles = [
                                {
                                  badgeBg: 'bg-emerald-600 text-white',
                                  headerBg: 'bg-emerald-50/80 border-emerald-200',
                                  pillActive: 'bg-emerald-700 text-white border-emerald-700',
                                  tagBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                                },
                                {
                                  badgeBg: 'bg-teal-600 text-white',
                                  headerBg: 'bg-teal-50/80 border-teal-200',
                                  pillActive: 'bg-teal-700 text-white border-teal-700',
                                  tagBg: 'bg-teal-50 text-teal-800 border-emerald-200',
                                },
                                {
                                  badgeBg: 'bg-cyan-600 text-white',
                                  headerBg: 'bg-cyan-50/80 border-cyan-200',
                                  pillActive: 'bg-cyan-700 text-white border-cyan-700',
                                  tagBg: 'bg-cyan-50 text-cyan-800 border-cyan-200',
                                },
                                {
                                  badgeBg: 'bg-blue-600 text-white',
                                  headerBg: 'bg-blue-50/80 border-blue-200',
                                  pillActive: 'bg-blue-700 text-white border-blue-700',
                                  tagBg: 'bg-blue-50 text-blue-800 border-blue-200',
                                },
                                {
                                  badgeBg: 'bg-amber-600 text-white',
                                  headerBg: 'bg-amber-50/80 border-amber-200',
                                  pillActive: 'bg-amber-600 text-white border-amber-600',
                                  tagBg: 'bg-amber-50 text-amber-900 border-amber-200',
                                },
                                {
                                  badgeBg: 'bg-purple-600 text-white',
                                  headerBg: 'bg-purple-50/80 border-purple-200',
                                  pillActive: 'bg-purple-700 text-white border-purple-700',
                                  tagBg: 'bg-purple-50 text-purple-800 border-purple-200',
                                },
                              ];

                              return (
                                <>
                                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                                    <div className="space-y-1.5">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-700 text-white text-[11px] font-extrabold shadow-2xs">
                                          <ShoppingCart className="w-3.5 h-3.5" />
                                          생육 단계별 추천 농자재 원스톱 구매 모듈
                                        </span>
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-extrabold">
                                          <User className="w-3 h-3 text-emerald-700" />
                                          {loggedInUser.isLoggedIn
                                            ? `${loggedInUser.name} (${loggedInUser.email}) 회원 로그인됨 (인증농가 5% 즉시할인 · 무료배송)`
                                            : '인증농가 회원 로그인 시 5% 즉시할인 · 무료배송'}
                                        </span>
                                        <span className="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold">
                                          {activeCropCard.crop_title} · {areaPyeong.toLocaleString()}평 맞춤 물량 자동산출
                                        </span>
                                      </div>
                                      <h3 className="text-base sm:text-xl font-extrabold text-slate-900 tracking-tight">
                                        전 생육과정 추천 농자재 단계별 리스트 &amp; 단번에 구매하기
                                      </h3>
                                      <p className="text-xs text-slate-600">
                                        재배 준비부터 파종·육묘, 정식·활착, 생육 관리, 병해충 예찰, 수확까지 추천된 모든 농자재를 단계별로 확인하고 한 번에 구매할 수 있습니다.
                                      </p>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleSelectAllStages(
                                            totalSelectedTypesCount < allStageMaterials.length
                                          )
                                        }
                                        className="px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-extrabold text-slate-700 cursor-pointer transition"
                                      >
                                        {totalSelectedTypesCount === allStageMaterials.length
                                          ? '전체 선택해제'
                                          : `전체 단계 모두선택 (${allStageMaterials.length}종)`}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleExecuteOneClickPurchase('ALL_PACKAGE')}
                                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-extrabold shadow-sm cursor-pointer transition"
                                      >
                                        <PackageCheck className="w-4 h-4" />
                                        전 생육단계 패키지 한번에 구매 ({finalPayableAmount.toLocaleString()}원)
                                      </button>
                                    </div>
                                  </div>

                                  {purchaseToastMessage && (
                                    <div className="rounded-xl bg-amber-50 border border-amber-300 px-4 py-2.5 text-xs font-bold text-amber-900 flex items-center justify-between">
                                      <span>{purchaseToastMessage}</span>
                                      <button
                                        type="button"
                                        onClick={() => setPurchaseToastMessage('')}
                                        className="text-amber-700 hover:text-amber-900 font-extrabold cursor-pointer"
                                      >
                                        닫기
                                      </button>
                                    </div>
                                  )}

                                  <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedPurchaseStageFilter('ALL')}
                                      className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border shrink-0 transition cursor-pointer flex items-center gap-1.5 ${
                                        selectedPurchaseStageFilter === 'ALL'
                                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                      }`}
                                    >
                                      <span>전체 생육단계</span>
                                      <span
                                        className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                                          selectedPurchaseStageFilter === 'ALL'
                                            ? 'bg-emerald-500 text-white'
                                            : 'bg-slate-200 text-slate-700'
                                        }`}
                                      >
                                        {allStageMaterials.length}종
                                      </span>
                                    </button>

                                    {stageBundles.map((sb: any, sIdx: number) => {
                                      const accent = stageAccentStyles[sIdx % stageAccentStyles.length];
                                      const isActive = selectedPurchaseStageFilter === sb.stageId;
                                      return (
                                        <button
                                          key={sb.stageId}
                                          type="button"
                                          onClick={() => setSelectedPurchaseStageFilter(sb.stageId)}
                                          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border shrink-0 transition cursor-pointer flex items-center gap-1.5 ${
                                            isActive
                                              ? `${accent.pillActive} shadow-2xs`
                                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                          }`}
                                        >
                                          <span>
                                            0{sb.stageIndex}. {sb.stageName}
                                          </span>
                                          <span
                                            className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                              isActive
                                                ? 'bg-white/25 text-white'
                                                : 'bg-slate-100 text-slate-600'
                                            }`}
                                          >
                                            {sb.materials.length}종
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>

                                  <div className="space-y-4">
                                    {visibleStageBundles.map((sb: any) => {
                                      const accent =
                                        stageAccentStyles[(sb.stageIndex - 1) % stageAccentStyles.length];
                                      return (
                                        <div
                                          key={sb.stageId}
                                          className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-2xs"
                                        >
                                          <div
                                            className={`px-3.5 sm:px-5 py-3 border-b ${accent.headerBg} flex flex-col sm:flex-row sm:items-center justify-between gap-2.5`}
                                          >
                                            <div className="flex items-start sm:items-center gap-2.5 flex-wrap">
                                              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                                                <input
                                                  type="checkbox"
                                                  checked={sb.isAllStageChecked}
                                                  onChange={() => handleToggleStageAll(sb)}
                                                  className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
                                                />
                                                <span
                                                  className={`px-2.5 py-0.5 rounded-lg text-xs font-extrabold ${accent.badgeBg}`}
                                                >
                                                  0{sb.stageIndex}. {sb.stageName}
                                                </span>
                                              </label>

                                              {sb.stageStartDate && (
                                                <span className="text-[11px] sm:text-xs font-bold text-slate-700 bg-white/80 px-2.5 py-0.5 rounded-md border border-slate-200">
                                                  추천 일정: {formatShortMdWithWeekday(sb.stageStartDate)} ~{' '}
                                                  {formatShortMdWithWeekday(sb.stageEndDate)}
                                                </span>
                                              )}

                                              <div className="flex items-center gap-1 flex-wrap">
                                                {sb.subProcessNames.map((spName: string, spIdx: number) => (
                                                  <span
                                                    key={`${sb.stageId}-sp-${spIdx}`}
                                                    className="px-2 py-0.5 rounded bg-white/90 border border-slate-200 text-[10px] font-bold text-slate-600"
                                                  >
                                                    #{spName}
                                                  </span>
                                                ))}
                                              </div>
                                            </div>

                                            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 border-t sm:border-t-0 border-slate-200/70 pt-2 sm:pt-0">
                                              <div className="text-xs font-bold text-slate-700">
                                                선택{' '}
                                                <span className="font-extrabold text-emerald-700">
                                                  {sb.checkedCount}/{sb.materials.length}종
                                                </span>{' '}
                                                · 단계 합계{' '}
                                                <span className="font-extrabold text-slate-900">
                                                  {sb.stageSubtotal.toLocaleString()}원
                                                </span>
                                              </div>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  handleExecuteOneClickPurchase('SINGLE_STAGE', sb)
                                                }
                                                className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-extrabold cursor-pointer transition shrink-0"
                                              >
                                                이 단계만 바로구매
                                              </button>
                                            </div>
                                          </div>

                                          <div className="p-3 sm:p-4 space-y-2">
                                            {sb.materials.map((mat: any) => {
                                              const itemState = purchaseSelectionMap[mat.selKey] || {
                                                checked: true,
                                                qty: mat.defaultQty,
                                              };
                                              const itemSubtotal = mat.unit_price * itemState.qty;
                                              const simpleTraitInfo =
                                                mat.category_spec_badge ||
                                                mat.nutrient_ratio_summary ||
                                                `${mat.sub_type} · ${mat.manufacturer} · 포장단위 ${mat.unit_spec}`;
                                              const procInfo = mat.subProcesses?.[0];

                                              return (
                                                <div
                                                  key={mat.selKey}
                                                  className={`rounded-xl border px-3.5 py-2.5 transition flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${
                                                    itemState.checked
                                                      ? 'border-emerald-300 bg-emerald-50/20 shadow-2xs'
                                                      : 'border-slate-200 bg-slate-50/50 opacity-75'
                                                  }`}
                                                >
                                                  {/* 좌측: 체크박스 + 생육과정 구분 + 제품 썸네일 + 제품 제목 및 간단한 특성 정보 (한 줄에 1개 구성) */}
                                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                                    <input
                                                      type="checkbox"
                                                      checked={itemState.checked}
                                                      onChange={() =>
                                                        handleToggleMaterialCheck(mat.selKey, mat.defaultQty)
                                                      }
                                                      className="w-4 h-4 rounded accent-emerald-600 cursor-pointer shrink-0"
                                                    />

                                                    {/* 생육과정 구분 배지 */}
                                                    <div className="w-36 sm:w-44 shrink-0">
                                                      <span
                                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-extrabold truncate max-w-full ${accent.tagBg}`}
                                                      >
                                                        <span className="truncate">
                                                          {procInfo?.name || mat.sub_item_name || sb.stageName}
                                                        </span>
                                                      </span>
                                                      {procInfo?.start_date && (
                                                        <div className="text-[10px] font-mono text-slate-500 font-semibold mt-0.5 pl-1">
                                                          추천일: {procInfo.start_date.slice(5).replace('-', '/')}
                                                        </div>
                                                      )}
                                                    </div>

                                                    {/* 제품 썸네일 */}
                                                    <img
                                                      src={mat.thumbnail_url}
                                                      alt={mat.product_name}
                                                      onClick={() =>
                                                        handleToggleMaterialCheck(mat.selKey, mat.defaultQty)
                                                      }
                                                      className="w-11 h-11 rounded-lg object-cover border border-slate-200 bg-white shrink-0 cursor-pointer"
                                                    />

                                                    {/* 농자재 제품 제목 + 간단한 특성 정보 */}
                                                    <div className="min-w-0 flex-1">
                                                      <div className="flex items-center gap-2 flex-wrap">
                                                        <span
                                                          onClick={() =>
                                                            handleToggleMaterialCheck(mat.selKey, mat.defaultQty)
                                                          }
                                                          className="font-extrabold text-slate-900 text-xs sm:text-sm leading-snug cursor-pointer hover:text-emerald-700 truncate"
                                                        >
                                                          {mat.product_name}
                                                        </span>
                                                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold shrink-0">
                                                          {mat.sub_type}
                                                        </span>
                                                        <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-extrabold shrink-0">
                                                          권장 {mat.defaultQty}
                                                          {mat.unit_label || '개'} ({mat.unit_spec})
                                                        </span>
                                                      </div>
                                                      <div className="text-xs text-slate-600 font-medium truncate mt-0.5">
                                                        {simpleTraitInfo}
                                                      </div>
                                                    </div>
                                                  </div>

                                                  {/* 우측: 단가 · 수량 조절 · 합계금액 */}
                                                  <div className="flex items-center justify-end gap-3 shrink-0 border-t lg:border-t-0 pt-2 lg:pt-0 border-slate-200/70">
                                                    <div className="text-xs text-slate-500 font-semibold">
                                                      단가{' '}
                                                      <span className="font-bold text-slate-800">
                                                        {mat.unit_price.toLocaleString()}원
                                                      </span>
                                                    </div>

                                                    <div className="inline-flex items-center rounded-lg border border-slate-300 bg-white overflow-hidden">
                                                      <button
                                                        type="button"
                                                        onClick={() =>
                                                          handleChangeMaterialQty(
                                                            mat.selKey,
                                                            mat.defaultQty,
                                                            -1
                                                          )
                                                        }
                                                        className="w-7 h-7 flex items-center justify-center text-slate-700 hover:bg-slate-100 cursor-pointer"
                                                        title="수량 감소"
                                                      >
                                                        <Minus className="w-3.5 h-3.5" />
                                                      </button>
                                                      <span className="px-2.5 text-xs font-extrabold text-slate-900 min-w-[2rem] text-center">
                                                        {itemState.qty}
                                                      </span>
                                                      <button
                                                        type="button"
                                                        onClick={() =>
                                                          handleChangeMaterialQty(
                                                            mat.selKey,
                                                            mat.defaultQty,
                                                            1
                                                          )
                                                        }
                                                        className="w-7 h-7 flex items-center justify-center text-slate-700 hover:bg-slate-100 cursor-pointer"
                                                        title="수량 증가"
                                                      >
                                                        <Plus className="w-3.5 h-3.5" />
                                                      </button>
                                                    </div>

                                                    <div className="text-right min-w-[5.5rem]">
                                                      <div className="text-xs sm:text-sm font-extrabold text-emerald-800">
                                                        {itemSubtotal.toLocaleString()}원
                                                      </div>
                                                    </div>
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>

                                  <div className="rounded-2xl border-2 border-emerald-600 bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/50 p-4 sm:p-6 shadow-sm space-y-5">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200 pb-3.5">
                                      <div className="flex items-center gap-2.5">
                                        <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-extrabold shadow-2xs shrink-0">
                                          <ShoppingBag className="w-5 h-5" />
                                        </div>
                                        <div>
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-extrabold text-slate-900 text-sm sm:text-base">
                                              {loggedInUser.isLoggedIn ? `${loggedInUser.name} 님의 ` : ''}생육단계별 농자재 원클릭 구매 계산서
                                            </span>
                                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-extrabold">
                                              {loggedInUser.isLoggedIn ? '회원 로그인 연동 완료' : '원클릭 간편 주문 지원'}
                                            </span>
                                          </div>
                                          <p className="text-xs text-slate-600">
                                            {loggedInUser.isLoggedIn
                                              ? `등록된 ${loggedInUser.name} (${loggedInUser.email}) 회원 농지 주소와 결제수단으로 복잡한 입력 없이 단번에 주문됩니다.`
                                              : '등록된 농지 주소와 결제수단으로 복잡한 입력 없이 단번에 주문됩니다.'}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="text-xs font-bold text-emerald-800 bg-white px-3 py-1.5 rounded-xl border border-emerald-200 self-start sm:self-center">
                                        수령지: {activeCropCard.region} {activeCropCard.lot_addr || '412-5'} {loggedInUser.isLoggedIn ? `(${loggedInUser.name} 농장)` : ''}
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                      <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2.5">
                                        <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
                                          <Truck className="w-4 h-4 text-emerald-600" />
                                          <span>① 농장 맞춤 배송 방식 선택</span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                          <button
                                            type="button"
                                            onClick={() => setPurchaseDeliveryOption('STAGE_SCHEDULED')}
                                            className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                                              purchaseDeliveryOption === 'STAGE_SCHEDULED'
                                                ? 'border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600'
                                                : 'border-slate-200 bg-slate-50/60 hover:bg-slate-50'
                                            }`}
                                          >
                                            <div className="flex items-center justify-between">
                                              <span className="text-xs font-extrabold text-slate-900">
                                                생육단계별 적기 맞춤 배송
                                              </span>
                                              <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-extrabold">
                                                추천
                                              </span>
                                            </div>
                                            <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                                              각 생육단계 작업 시작 3일 전에 맞춰 농장으로 신선하게 자동 분할 배송 (배송비 전액 무료)
                                            </p>
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => setPurchaseDeliveryOption('ALL_AT_ONCE')}
                                            className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                                              purchaseDeliveryOption === 'ALL_AT_ONCE'
                                                ? 'border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600'
                                                : 'border-slate-200 bg-slate-50/60 hover:bg-slate-50'
                                            }`}
                                          >
                                            <div className="flex items-center justify-between">
                                              <span className="text-xs font-extrabold text-slate-900">
                                                전 단계 물량 한번에 일괄배송
                                              </span>
                                              <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-bold">
                                                즉시출고
                                              </span>
                                            </div>
                                            <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                                              선택한 전 생육단계 농자재를 한 번에 묶어 농장 창고로 즉시 일괄 발송
                                            </p>
                                          </button>
                                        </div>
                                      </div>

                                      <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2.5">
                                        <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
                                          <CreditCard className="w-4 h-4 text-emerald-600" />
                                          <span>② {loggedInUser.id} 회원 등록 결제수단 선택</span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                          <button
                                            type="button"
                                            onClick={() => setPurchasePaymentMethod('NONGHYUP_CARD')}
                                            className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                                              purchasePaymentMethod === 'NONGHYUP_CARD'
                                                ? 'border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600'
                                                : 'border-slate-200 bg-slate-50/60 hover:bg-slate-50'
                                            }`}
                                          >
                                            <div className="text-xs font-extrabold text-slate-900">
                                              NH농협 영농카드 간편결제
                                            </div>
                                            <div className="text-[10px] text-slate-600 mt-0.5">
                                              CloudBae 등록카드 (4812-****)
                                            </div>
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => setPurchasePaymentMethod('BANK_TRANSFER')}
                                            className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                                              purchasePaymentMethod === 'BANK_TRANSFER'
                                                ? 'border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600'
                                                : 'border-slate-200 bg-slate-50/60 hover:bg-slate-50'
                                            }`}
                                          >
                                            <div className="text-xs font-extrabold text-slate-900">
                                              법인계좌 무통장입금
                                            </div>
                                            <div className="text-[10px] text-slate-600 mt-0.5 truncate">
                                              {primaryBankAccount.bank_name} {primaryBankAccount.account_number}
                                            </div>
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => setPurchasePaymentMethod('KOK_PAY')}
                                            className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                                              purchasePaymentMethod === 'KOK_PAY'
                                                ? 'border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600'
                                                : 'border-slate-200 bg-slate-50/60 hover:bg-slate-50'
                                            }`}
                                          >
                                            <div className="text-xs font-extrabold text-slate-900">
                                              농협 콕뱅크 · 지역사랑페이
                                            </div>
                                            <div className="text-[10px] text-slate-600 mt-0.5">
                                              영농자재 바우처 연동
                                            </div>
                                          </button>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="rounded-2xl bg-slate-900 text-white p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
                                        <div>
                                          <div className="text-[11px] text-slate-400">선택 품목 · 총 수량</div>
                                          <div className="text-sm sm:text-base font-extrabold text-white mt-0.5">
                                            {totalSelectedTypesCount}종 · {totalSelectedUnitsCount}개
                                          </div>
                                        </div>
                                        <div>
                                          <div className="text-[11px] text-slate-400">농자재 총 상품금액</div>
                                          <div className="text-sm sm:text-base font-bold text-slate-200 mt-0.5">
                                            {rawTotalAmount.toLocaleString()}원
                                          </div>
                                        </div>
                                        <div>
                                          <div className="text-[11px] text-emerald-300">
                                            {loggedInUser.isLoggedIn ? `${loggedInUser.name} 회원 ` : '회원 '}5% 할인 · 무료배송
                                          </div>
                                          <div className="text-sm sm:text-base font-extrabold text-emerald-400 mt-0.5">
                                            -{memberDiscountAmount.toLocaleString()}원
                                          </div>
                                        </div>
                                        <div>
                                          <div className="text-[11px] text-amber-300">최종 결제 예정 금액</div>
                                          <div className="text-base sm:text-xl font-extrabold text-amber-300 mt-0.5">
                                            {finalPayableAmount.toLocaleString()}원
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => handleExecuteOneClickPurchase('SELECTED')}
                                          className="px-5 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm sm:text-base shadow-md cursor-pointer transition flex items-center justify-center gap-2"
                                        >
                                          <CheckCircle2 className="w-5 h-5" />
                                          <span>
                                            선택 농자재 ({totalSelectedTypesCount}종) 한번에 구매하기
                                          </span>
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </>
                              );
                            })()}
                          </section>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ---------- 2단계 & 3단계: 선택한 작물 상세 화면 (모바일에서는 리스트 클릭 시 표시, PC에서는 상시 3열+하단 전폭으로 표시) ---------- */}
            <div className={`${mobileScheduleStep === 'list' ? 'hidden lg:block' : 'block'} space-y-6`}>
              {/* 모바일 전용 상단 뒤로가기 바 (리스트로 돌아가기) */}
              <div className="flex lg:hidden items-center justify-between bg-white rounded-2xl border border-slate-200 px-4 py-3 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setMobileScheduleStep('list')}
                  className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-800 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4 text-emerald-600" />
                  <span>내 작물재배 리스트 ({cloudBaeCropList.length}건)</span>
                </button>
                <span className="text-xs font-bold text-emerald-700">{loggedInUser.id} 님의 농장</span>
              </div>

              {/* 상단 3열 핵심 브리핑 모듈 (모바일 샘플 이미지 1~5번 디자인 100% 반영) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* [열 1: 내 재배작물 요약 + 기온·강수·다음작업 3종 미니 카드 (샘플 이미지 1번)] */}
                <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
                        <Sprout className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-extrabold text-base text-slate-900 leading-tight">한팜 · FarmPlan</div>
                        <div className="text-[11px] text-slate-500">나의 맞춤형 재배관리 ({loggedInUser.id})</div>
                      </div>
                    </div>
                    <Bell className="w-5 h-5 text-slate-400" />
                  </div>

                  {/* 내 재배작물 그레이/민트 박스 */}
                  <div className="rounded-2xl bg-[#F4F6F8] p-4 space-y-3.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-500">내 재배작물</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-200/80 text-slate-700 font-bold text-[11px]">
                        {activeCropCard.badge}
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      <div
                        className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${activeCropCard.thumb_gradient} text-white flex flex-col items-center justify-center shrink-0 shadow-sm`}
                      >
                        <Sprout className="w-9 h-9" />
                        <span className="text-[11px] font-extrabold mt-0.5">{activeCropCard.crop_short}</span>
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
                          {activeCropCard.crop_title}
                        </h3>
                        <p className="text-xs sm:text-sm font-semibold text-slate-700 mt-0.5">
                          {activeCropCard.region} · {activeCropCard.area_pyeong}평
                        </p>
                        <p className="text-xs font-mono text-slate-500 mt-1">
                          {activeCropCard.planting_label}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-extrabold text-slate-800">재배 진행상태</span>
                        <span className="font-semibold text-slate-500">{activeCropCard.status_text}</span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          style={{ width: `${activeCropCard.progress_pct}%` }}
                          className="h-full rounded-full bg-emerald-600 transition-all"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed pt-0.5">
                        적산온도(PGDD) 및 현장 작업 실행 기록을 기반으로 산출된 진행 상태입니다.
                      </p>
                    </div>
                  </div>

                  {/* 기온 · 강수 · 다음 작업 3열 미니 카드 */}
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="rounded-2xl border border-slate-200 bg-white p-3.5 text-center space-y-1">
                      <Thermometer className="w-4 h-4 text-slate-500 mx-auto" />
                      <div className="text-[11px] text-slate-500 font-semibold">기온</div>
                      <div className="text-base sm:text-lg font-extrabold text-slate-900">
                        {curDayClimate?.temp_avg ?? 18.5}°C
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-3.5 text-center space-y-1">
                      <CloudRain className="w-4 h-4 text-slate-500 mx-auto" />
                      <div className="text-[11px] text-slate-500 font-semibold">강수</div>
                      <div className="text-base sm:text-lg font-extrabold text-slate-900">
                        {curDayClimate?.precipitation_mm ?? 5}mm
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-3.5 text-center space-y-1">
                      <Calendar className="w-4 h-4 text-slate-500 mx-auto" />
                      <div className="text-[11px] text-slate-500 font-semibold">다음 작업</div>
                      <div className="text-base sm:text-lg font-extrabold text-slate-900">
                        {activeCropCard.next_task_dday}
                      </div>
                    </div>
                  </div>
                </div>

                {/* [열 2: 오늘 할 일 & 예정된 농작업 (샘플 이미지 2번)] */}
                <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-5">
                  {/* 오늘 할 일 */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-extrabold text-slate-900">오늘 할 일</h3>
                      <span className="text-xs font-bold text-slate-500">작업 {todayTasks.length}개</span>
                    </div>

                    <div className="rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                      {todayTasks.map((task) => (
                        <div
                          key={task.id}
                          onClick={() =>
                            setTodayTasks((prev) =>
                              prev.map((t) =>
                                t.id === task.id
                                  ? { ...t, done: !t.done, status: !t.done ? '완료' : '예정' }
                                  : t
                              )
                            )
                          }
                          className="p-4 flex items-start justify-between gap-3 hover:bg-slate-50 transition cursor-pointer"
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 shrink-0 transition ${
                                task.done
                                  ? 'bg-emerald-600 border-emerald-600 text-white'
                                  : 'border-slate-300 bg-white'
                              }`}
                            >
                              {task.done && <Check className="w-3.5 h-3.5" />}
                            </span>
                            <div>
                              <div
                                className={`font-extrabold text-sm ${
                                  task.done ? 'line-through text-slate-400' : 'text-slate-900'
                                }`}
                              >
                                {task.title}
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">{task.desc}</p>
                            </div>
                          </div>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                              task.done
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {task.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 예정된 농작업 */}
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-extrabold text-slate-900">예정된 농작업</h3>
                      <button
                        type="button"
                        onClick={() => setScheduleViewMode('timeline')}
                        className="text-xs font-bold text-slate-500 hover:text-emerald-700 cursor-pointer"
                      >
                        전체 일정
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {(provisionData?.scheduleItems || []).slice(0, 4).map((item: any) => {
                        const isSelected = selectedStageItem?.item_id === item.item_id;
                        return (
                          <div
                            key={item.item_id}
                            onClick={() => handleSelectStageItem(item)}
                            className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition cursor-pointer ${
                              isSelected
                                ? 'border-emerald-500 bg-emerald-50/50'
                                : 'border-slate-100 bg-slate-50/60 hover:bg-slate-100/80'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="px-3 py-2 rounded-xl bg-white border border-slate-200/80 font-mono font-extrabold text-xs text-slate-900 shrink-0">
                                {formatShortMdWithWeekday(item.start_date)}
                              </span>
                              <div className="min-w-0">
                                <div className="font-extrabold text-sm text-slate-900 truncate">
                                  {item.sub_item_name}
                                </div>
                                <div className="text-xs text-slate-500 truncate mt-0.5">
                                  {item.work_description || '기온·생육상태 확인 후 진행'}
                                </div>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* [열 3: 재배일정은 세 가지 보기 방식 제공 — 타임라인 | 달력 | 생육단계 (샘플 이미지 3, 4, 5번)] */}
                <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                      재배일정 3가지 보기
                    </h3>
                    <span className="text-[11px] font-bold text-emerald-700">
                      단일 추천 진행일(요일 포함)
                    </span>
                  </div>

                  {/* 세그먼트 탭 스위치: [ 타임라인 | 달력 | 생육단계 ] */}
                  <div className="grid grid-cols-3 bg-slate-100 p-1 rounded-2xl text-xs sm:text-sm font-bold">
                    {[
                      { id: 'timeline', label: '타임라인' },
                      { id: 'calendar', label: '달력' },
                      { id: 'stages', label: '생육단계' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setScheduleViewMode(t.id as 'timeline' | 'calendar' | 'stages')}
                        className={`py-2 rounded-xl transition cursor-pointer ${
                          scheduleViewMode === t.id
                            ? 'bg-white text-slate-900 font-extrabold shadow-2xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* 보기 1: 농작업 타임라인 (샘플 이미지 3번) */}
                  {scheduleViewMode === 'timeline' && (
                    <div className="rounded-2xl border border-slate-200 p-4 space-y-3 max-h-[380px] overflow-y-auto">
                      <div className="font-extrabold text-base text-slate-900">농작업 타임라인</div>
                      <div className="space-y-3">
                        {(provisionData?.scheduleItems || []).map((item: any, idx: number) => {
                          const isSelected = selectedStageItem?.item_id === item.item_id;
                          return (
                            <div
                              key={item.item_id}
                              onClick={() => handleSelectStageItem(item)}
                              className={`flex items-start gap-3 p-2.5 rounded-xl transition cursor-pointer ${
                                isSelected ? 'bg-emerald-50 border border-emerald-200' : 'hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex flex-col items-center">
                                <span
                                  className={`w-6 h-6 rounded-full text-xs font-extrabold flex items-center justify-center ${
                                    isSelected
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {idx + 1}
                                </span>
                                {idx < (provisionData?.scheduleItems?.length || 0) - 1 && (
                                  <div className="w-px h-7 bg-slate-200 mt-1" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-extrabold text-sm text-slate-900">
                                  {formatKoreanMdWithWeekday(item.start_date)} · {item.sub_item_name}
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                                  {item.work_description || item.action_tip || '기온 및 토양 수분 확인 후 작업 진행'}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 보기 2: 월간 달력 보기 (샘플 이미지 4번) */}
                  {scheduleViewMode === 'calendar' && (
                    <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-extrabold text-base text-slate-900">
                          {calendarYearMonth.year}년 {calendarYearMonth.month}월
                        </h4>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setCalendarYearMonth((prev) =>
                                prev.month === 1
                                  ? { year: prev.year - 1, month: 12 }
                                  : { year: prev.year, month: prev.month - 1 }
                              )
                            }
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setCalendarYearMonth((prev) =>
                                prev.month === 12
                                  ? { year: prev.year + 1, month: 1 }
                                  : { year: prev.year, month: prev.month + 1 }
                              )
                            }
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-7 gap-1.5 text-center text-xs">
                        {WEEKDAY_KO.map((w) => (
                          <div key={w} className="py-1 text-slate-400 font-bold">
                            {w}
                          </div>
                        ))}
                        {calendarCells.map((cell, cIdx) => {
                          if (!cell.day) {
                            return <div key={cIdx} className="h-10 rounded-lg bg-slate-50/50" />;
                          }
                          const hasTask = cell.items.length > 0;
                          const isSelectedDay = selectedStageItem?.start_date === cell.ymd;
                          return (
                            <button
                              key={cIdx}
                              type="button"
                              onClick={() => {
                                if (cell.items[0]) handleSelectStageItem(cell.items[0]);
                              }}
                              className={`h-10 rounded-lg flex flex-col items-center justify-center text-xs font-bold transition cursor-pointer ${
                                isSelectedDay
                                  ? 'bg-emerald-600 text-white shadow-2xs'
                                  : hasTask
                                  ? 'bg-[#DDF3E8] text-emerald-950 font-extrabold'
                                  : 'bg-slate-100/70 text-slate-700 hover:bg-slate-200/60'
                              }`}
                            >
                              <span>{cell.day}</span>
                              {hasTask && (
                                <span
                                  className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                                    isSelectedDay ? 'bg-white' : 'bg-emerald-600'
                                  }`}
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <div className="pt-2 border-t border-slate-100 text-xs text-slate-600 font-semibold">
                        {monthScheduledItems.length > 0
                          ? monthScheduledItems
                              .map(
                                (it: any) =>
                                  `${Number(it.start_date.slice(5, 7))}/${Number(
                                    it.start_date.slice(8, 10)
                                  )}(${getWeekdayNameFromYmd(it.start_date)}) ${it.sub_item_name}`
                              )
                              .join(' · ')
                          : '이 달에 예정된 추천 농작업이 없습니다. (8~11월 이동 가능)'}
                      </div>
                    </div>
                  )}

                  {/* 보기 3: 배추 생육단계 보기 (샘플 이미지 5번) */}
                  {scheduleViewMode === 'stages' && (
                    <div className="rounded-2xl border border-slate-200 p-4 space-y-2.5 max-h-[380px] overflow-y-auto">
                      <div className="font-extrabold text-base text-slate-900">
                        {activeCropCard.crop_short} 생육단계
                      </div>
                      <div className="divide-y divide-slate-100">
                        {(provisionData?.stageGroups || []).map((grp: any) => {
                          const isExpanded =
                            expandedStageGroupCode === 'ALL' ||
                            expandedStageGroupCode === grp.stage_group_id;
                          return (
                            <div key={grp.stage_group_id} className="py-2.5 space-y-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedStageGroupCode((prev) =>
                                    prev === grp.stage_group_id ? 'ALL' : grp.stage_group_id
                                  )
                                }
                                className="w-full flex items-center justify-between gap-3 text-left cursor-pointer"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                                    <Sprout className="w-4 h-4 text-emerald-600" />
                                  </span>
                                  <div>
                                    <div className="font-extrabold text-sm text-slate-900">
                                      {grp.stage_group_name}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                      {(grp.items || []).map((i: any) => i.sub_item_name).join(' · ')}
                                    </div>
                                  </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                              </button>

                              {isExpanded && (
                                <div className="pl-12 space-y-1.5">
                                  {(grp.items || []).map((it: any) => (
                                    <button
                                      key={it.item_id}
                                      type="button"
                                      onClick={() => handleSelectStageItem(it)}
                                      className={`w-full text-left px-3 py-2 rounded-xl border text-xs flex items-center justify-between transition cursor-pointer ${
                                        selectedStageItem?.item_id === it.item_id
                                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-extrabold'
                                          : 'bg-slate-50 border-slate-200/70 text-slate-700 hover:bg-slate-100'
                                      }`}
                                    >
                                      <span>{it.sub_item_name}</span>
                                      <span className="font-mono text-emerald-700 font-bold">
                                        {formatYmdWithWeekday(it.start_date)}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ---------- 모바일 전용: 선택한 생육과정 핵심 요약 & 추천 진행일 조정 카드 (lg:hidden) ---------- */}
              {detailItem && (
                <div className="block lg:hidden bg-white rounded-3xl border-2 border-emerald-500/70 p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold">
                      {detailItem.stage_group_name || '생육단계 핵심 정보'}
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-700">
                      목표 PGDD {detailItem.target_pgdd}℃
                    </span>
                  </div>
                  <div>
                    <h4 className="text-lg font-extrabold text-slate-900">{detailItem.sub_item_name}</h4>
                    <p className="text-xs text-slate-600 mt-1">
                      {detailItem.work_description || '기온 및 토양 조건에 맞춰 작업을 진행합니다.'}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-[#E9F7F1] border border-emerald-200 p-3.5 space-y-2">
                    <div className="text-xs font-bold text-emerald-800">📅 추천 진행일 (요일 포함 · 변경 가능)</div>
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="date"
                        value={curStart}
                        onChange={(e) =>
                          setEditDetailForm((prev: any) => ({ ...prev, start_date: e.target.value }))
                        }
                        className="px-3 py-2 rounded-xl border border-emerald-300 bg-white font-mono font-extrabold text-xs text-slate-900"
                      />
                      <span className="font-mono font-extrabold text-sm text-emerald-900">
                        {formatYmdWithWeekday(curStart)}
                      </span>
                    </div>
                    {cascadeDeltaDays !== 0 && (
                      <button
                        type="button"
                        disabled={isSavingDetailItem}
                        onClick={handleSaveUserScheduleCascade}
                        className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-extrabold text-xs shadow-xs cursor-pointer"
                      >
                        ✅ 새 일정 승인 및 후속 {subsequentItems.length}개 공정 반영
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ==================== 3단계(A): 생육 과정 클릭 시 [생육 과정 기간] 풍선(말풍선) 설명영역 (관리자 페이지와 100% 동일) ==================== */}
              {hoveredProvisionItem && (() => {
                    const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1280;
                    const viewportH = typeof window !== 'undefined' ? window.innerHeight : 900;
                    const bubbleWidth = 400;
                    const centerX = hoverAnchorPos.left + hoverAnchorPos.width / 2;
                    const clampedLeft = Math.max(
                      16,
                      Math.min(viewportW - bubbleWidth - 16, centerX - bubbleWidth / 2)
                    );

                    const positionStyle: React.CSSProperties = hoverAnchorPos.showAbove
                      ? {
                          bottom: `${Math.max(12, viewportH - hoverAnchorPos.top)}px`,
                          paddingBottom: '10px',
                        }
                      : {
                          top: `${Math.min(viewportH - 160, hoverAnchorPos.top + hoverAnchorPos.height)}px`,
                          paddingTop: '10px',
                        };

                    return (
                      <div
                        data-growth-bubble="true"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          zIndex: 9999,
                          left: `${clampedLeft}px`,
                          width: `${bubbleWidth}px`,
                          ...positionStyle,
                        }}
                        className="fixed pointer-events-auto transition-all duration-75"
                      >
                        <div className="relative rounded-2xl bg-white border-2 border-emerald-500 text-slate-900 px-4 py-3.5 shadow-[0_18px_45px_rgba(15,23,42,0.22)] ring-1 ring-emerald-500/20">
                          {/* 상단: 좌측(단계 배지 + 생육과정명) / 우측([세부 정보 보기] 버튼 + 닫기 아이콘 버튼) */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                style={{ backgroundColor: hoveredProvisionItem.stage_color || '#16a34a' }}
                                className="px-2 py-0.5 rounded-md text-[11px] font-extrabold text-white shrink-0"
                              >
                                {hoveredProvisionItem.stage_group_name}
                              </span>
                              <span className="font-extrabold text-xs text-slate-900 truncate">
                                {hoveredProvisionItem.sub_item_name}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const targetItem = hoveredProvisionItem;
                                  setHoveredProvisionItem(null);
                                  setDetailModalPos({ x: 0, y: 0 });
                                  handleSelectStageItem(targetItem);
                                  setClickedProvisionItem(targetItem);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[11px] shadow-xs transition cursor-pointer shrink-0 inline-flex items-center gap-1"
                              >
                                <span>세부 정보 보기</span>
                                <span className="text-xs leading-none">›</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setHoveredProvisionItem(null);
                                }}
                                title="풍선말 닫기"
                                aria-label="풍선말 닫기"
                                className="w-6 h-6 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-300 inline-flex items-center justify-center transition cursor-pointer shrink-0"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* 중단 핵심: 생육 과정의 추천 진행일(요일 포함) 강조 */}
                          <div className="mt-2.5 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
                            <div className="text-[11px] font-bold text-emerald-800 flex items-center justify-between">
                              <span>📅 추천 진행일 (요일 포함)</span>
                              <span className="font-mono font-extrabold text-emerald-700">
                                {hoveredProvisionItem.start_week_label} · 1일 추천
                              </span>
                            </div>
                            <div className="font-mono font-extrabold text-sm text-slate-900 mt-0.5 tracking-tight">
                              {formatYmdWithWeekday(hoveredProvisionItem.start_date)}
                            </div>
                          </div>

                          {/* 하단: 기온·적산온도 요약 */}
                          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-600">
                            <span>
                              목표 PGDD {hoveredProvisionItem.target_pgdd}℃ · 당일 기온{' '}
                              {hoveredProvisionItem.recommended_day_climate?.temp_avg ??
                                hoveredProvisionItem.climate_stats?.avg_temp}
                              ℃
                            </span>
                            <span className="text-emerald-700 font-semibold">
                              우측 상단 [세부 정보 보기] 클릭
                            </span>
                          </div>

                          {/* 말풍선 꼬리 화살표 (Speech Bubble Tail) */}
                          <div
                            style={{
                              left: `${Math.max(24, Math.min(bubbleWidth - 28, centerX - clampedLeft))}px`,
                            }}
                            className={`w-3.5 h-3.5 bg-white border-emerald-500 rotate-45 absolute -translate-x-1/2 pointer-events-none ${
                              hoverAnchorPos.showAbove
                                ? '-bottom-2 border-r-2 border-b-2'
                                : '-top-2 border-l-2 border-t-2'
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  {/* ==================== 3단계(B): 풍선 설명영역 내 [세부 정보 보기 ›] 클릭 시 열리는 세부정보 모달리스 폼 (조회 전용 뷰어) ==================== */}
                  {clickedProvisionItem && (() => {
                    const viewItem = clickedProvisionItem;
                    const viewDate = viewItem.start_date || curStart;
                    const viewDayClimate = getDayClimate(viewDate);
                    return (
                      <div
                        style={{
                          zIndex: 9990,
                          top: '50%',
                          left: '50%',
                          transform: `translate3d(calc(-50% + ${detailModalPos.x}px), calc(-50% + ${detailModalPos.y}px), 0)`,
                        }}
                        className={`fixed pointer-events-auto w-[96vw] max-w-5xl bg-white rounded-2xl border-2 border-emerald-500 shadow-[0_30px_90px_rgba(15,23,42,0.28)] ring-2 ring-emerald-500/20 overflow-hidden flex flex-col max-h-[84vh] ${
                          isDraggingDetailModal ? 'ring-2 ring-emerald-400' : ''
                        }`}
                      >
                        {/* 세부 정보 모달리스 창 헤더 (밝은 소프트 민트 테마 · 드래그 이동 가능) */}
                        <div
                          onMouseDown={handleStartDetailModalDrag}
                          onDoubleClick={() => setDetailModalPos({ x: 0, y: 0 })}
                          title="마우스로 드래그하여 세부 정보 창 위치를 이동할 수 있습니다"
                          className="relative bg-[#E9F7F1] text-slate-900 pl-5 pr-24 py-3.5 flex flex-wrap items-center justify-between gap-2 shrink-0 border-b border-emerald-200 cursor-move"
                        >
                          <div className="flex flex-col gap-1 min-w-0">
                            <div className="text-[11px] font-bold text-emerald-700 truncate">
                              {provisionData.activeRequest?.group_name} &gt;{' '}
                              {provisionData.activeRequest?.crop_name === '배추'
                                ? '가을배추'
                                : provisionData.activeRequest?.crop_name}{' '}
                              &gt; {provisionData.activeRequest?.item_name_3rd} /{' '}
                              {[
                                provisionData.activeRequest?.sido,
                                provisionData.activeRequest?.sigungu,
                                provisionData.activeRequest?.eupmyeondong,
                                provisionData.activeRequest?.detail_address,
                              ]
                                .filter(Boolean)
                                .join(' ')}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                style={{ backgroundColor: viewItem.stage_color || '#16a34a' }}
                                className="px-2.5 py-0.5 rounded-lg text-white font-extrabold text-xs shadow-xs"
                              >
                                {viewItem.stage_group_name}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-white border border-emerald-200 font-mono font-bold text-emerald-800 text-xs">
                                {viewItem.process_code}
                              </span>
                              <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                                {viewItem.sub_item_name} ({viewItem.process_name})
                              </h3>
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold">
                                생육과정 세부 정보 및 처방 농자재 안내
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2" onMouseDown={(e) => e.stopPropagation()}>
                            <span className="px-2.5 py-1 rounded-lg bg-white text-emerald-800 border border-emerald-200 font-mono font-extrabold text-xs">
                              📅 추천 진행일: {formatYmdWithWeekday(viewDate)}
                            </span>
                          </div>

                          {/* 오른쪽 상단 끝 닫기 버튼 */}
                          <button
                            type="button"
                            onClick={() => setClickedProvisionItem(null)}
                            className="absolute top-2.5 right-3 z-20 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-300 font-extrabold text-xs inline-flex items-center gap-1 transition cursor-pointer"
                            title="세부 정보 모달리스 창 닫기"
                          >
                            <X className="w-4 h-4" />
                            <span>닫기</span>
                          </button>
                        </div>

                        {/* 세부 정보 모달리스 창 스크롤 본문 (수정 불가 조회 전용) */}
                        <div className="p-5 space-y-4 text-xs overflow-y-auto flex-1 bg-white">
                          {/* 0. 생육과정 기본 메타데이터 및 추천 진행일(요일 포함 1일 추천) 요약 카드 */}
                          <div className="rounded-xl border-2 border-emerald-500/70 bg-emerald-50/30 p-3.5 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200 pb-2">
                              <div className="font-extrabold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[11px]">
                                  추천 진행일 · 기후 연동
                                </span>
                                <span>생육과정 기본 정보 및 추천 진행일(1일 · 요일 포함) 상세 안내</span>
                              </div>
                              <div className="flex flex-wrap items-center gap-3 ml-auto">
                                <span className="text-[11px] font-bold text-emerald-800">
                                  🌡️ 작물 한계온도({cropMinT}~{cropMaxT}℃) 회피 · 적정온도({cropOptTempText}) 추천 적용
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                              <div>
                                <div className="text-[11px] font-extrabold text-slate-600 mb-1">
                                  단계 구분 (관리명칭)
                                </div>
                                <div className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 font-bold text-slate-900">
                                  {viewItem.stage_group_name || '-'}
                                </div>
                              </div>
                              <div>
                                <div className="text-[11px] font-extrabold text-slate-600 mb-1">
                                  생육 과정명
                                </div>
                                <div className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 font-bold text-slate-900">
                                  {viewItem.sub_item_name || '-'}
                                </div>
                              </div>
                              <div>
                                <div className="text-[11px] font-extrabold text-slate-600 mb-1">
                                  공정 코드 (process_code)
                                </div>
                                <div className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 font-mono font-bold text-slate-900">
                                  {viewItem.process_code || '-'}
                                </div>
                              </div>
                              <div>
                                <div className="text-[11px] font-extrabold text-slate-600 mb-1">
                                  상세 공정명 (process_name)
                                </div>
                                <div className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 font-bold text-slate-900">
                                  {viewItem.process_name || '-'}
                                </div>
                              </div>

                              <div className="sm:col-span-2">
                                <div className="text-[11px] font-extrabold text-emerald-800 mb-1">
                                  📅 추천 진행일 (1일 추천 · 요일 포함)
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="flex-1 min-w-[160px] px-3 py-2 rounded-lg bg-white border-2 border-emerald-500 font-mono font-extrabold text-emerald-900">
                                    {formatYmdWithWeekday(viewDate)}
                                  </div>
                                  <span className="px-3 py-2 rounded-lg bg-emerald-600 text-white font-mono font-extrabold text-xs shrink-0 shadow-2xs">
                                    {viewItem.start_week_label} · 1일 추천
                                  </span>
                                </div>
                              </div>
                              <div>
                                <div className="text-[11px] font-extrabold text-slate-600 mb-1">
                                  목표 유효적산온도 (PGDD, ℃)
                                </div>
                                <div className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 font-mono font-bold text-slate-900">
                                  {viewItem.target_pgdd ?? 0} ℃
                                </div>
                              </div>
                              <div>
                                <div className="text-[11px] font-extrabold text-slate-600 mb-1">
                                  간트 막대 표시 라벨 (bar_label)
                                </div>
                                <div className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 font-bold text-slate-900">
                                  {viewItem.bar_label || viewItem.sub_item_name || '-'}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* 1. 추천 진행일(요일 포함) 및 재배지 기후 대입 분석 정렬 테이블 */}
                          <div>
                            <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm mb-2 flex flex-wrap items-center gap-2">
                              <span>
                                ① 추천 진행일(요일 포함) 및 재배지({provisionData.activeRequest?.sido}{' '}
                                {provisionData.activeRequest?.sigungu} {provisionData.activeRequest?.eupmyeondong}) 기후 대입 분석
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-900 border border-teal-300 text-[11px] font-bold">
                                {viewItem.climate_stats?.climate_source_summary ||
                                  '동일 날짜 (작년+올해예측)/2 평균 대입 · +6개월 이후 미예측일 작년 기후 단독 참조'}
                              </span>
                            </h4>
                            <div className="overflow-x-auto rounded-xl border border-slate-200">
                              <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                                    <th className="py-2 px-3 font-bold">추천 진행일 (년-월-일 · 요일)</th>
                                    <th className="py-2 px-3 font-bold">해당 월·주차 / 추천 기준</th>
                                    <th className="py-2 px-3 font-bold">추천일 기온 (최저~최고 / 평균 · 한계/적정온도)</th>
                                    <th className="py-2 px-3 font-bold">멀칭보정 유효기온</th>
                                    <th className="py-2 px-3 font-bold">추천일 평균습도</th>
                                    <th className="py-2 px-3 font-bold">추천일 강수량</th>
                                    <th className="py-2 px-3 font-bold">유효적산온도 (당일 / 누적 / 목표)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr className="bg-emerald-50/40 font-semibold text-slate-900">
                                    <td className="py-2.5 px-3 font-mono font-extrabold text-emerald-800 text-sm">
                                      {formatYmdWithWeekday(viewDate)}
                                    </td>
                                    <td className="py-2.5 px-3">{viewItem.start_week_label} (단일 추천 진행일)</td>
                                    <td className="py-2.5 px-3">
                                      최저 {viewDayClimate.temp_min}℃ ~ 최고 {viewDayClimate.temp_max}℃ (평균{' '}
                                      <strong>{viewDayClimate.temp_avg}℃</strong> · 한계 {cropMinT}~{cropMaxT}℃ 이내 / 적정 {cropOptTempText})
                                    </td>
                                    <td className="py-2.5 px-3 font-bold text-amber-700">
                                      {viewDayClimate.effective_temp_avg}℃ (+
                                      {provisionData.croppingSystem?.mulching_offset ?? 1.5}℃ 보정)
                                    </td>
                                    <td className="py-2.5 px-3">
                                      평균 <strong>{viewDayClimate.humidity_avg}%</strong>
                                    </td>
                                    <td className="py-2.5 px-3">
                                      <strong>{viewDayClimate.precipitation_mm}mm</strong> (
                                      {Number(viewDayClimate.precipitation_mm) <= 2 ? '무강우·작업적기' : '강수 주의'})
                                    </td>
                                    <td className="py-2.5 px-3 font-mono font-extrabold text-emerald-800">
                                      +{viewDayClimate.daily_pgdd}℃ / 누적 {viewItem.climate_stats?.accumulated_pgdd}℃ / 목표{' '}
                                      {viewItem.target_pgdd}℃
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                            <div className="mt-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs">
                              <div className="font-extrabold text-emerald-800 mb-1">
                                🤖 [작년 기후 + 올해 예측 기후(현재+6개월) 평균 / 미예측일 작년 기후 단독 참조] AI 일정 산출 근거:
                              </div>
                              <div className="p-2.5 rounded-lg bg-white border border-emerald-200 text-slate-800 leading-relaxed whitespace-pre-line">
                                {viewItem.ai_analysis_reason ||
                                  '지역별 과거 기후 및 올해 예측 기후 평균을 기반으로 작물 한계온도를 피하고 적정온도에 도달하는 최적 작업일로 산출되었습니다.'}
                              </div>
                            </div>
                          </div>

                          {/* 2. 작업내용 · 기후 대응 가이드 · 농자재 사용팁 2열 열람 영역 */}
                          <div className="grid lg:grid-cols-2 gap-3">
                            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2">
                              <div className="font-extrabold text-slate-900 text-xs sm:text-sm flex items-center justify-between border-b border-slate-200 pb-1.5">
                                <span>② 생육과정 핵심 작업내용</span>
                                <span className="text-[11px] font-mono text-slate-500">{viewItem.process_code}</span>
                              </div>
                              <div className="p-3 rounded-lg bg-white border border-slate-200 text-slate-800 leading-relaxed whitespace-pre-line min-h-[84px]">
                                {viewItem.work_content ||
                                  viewItem.work_description ||
                                  '기온 및 토양 조건에 맞춰 작업을 진행합니다.'}
                              </div>
                              <div className="p-2.5 rounded-lg bg-sky-50 border border-sky-200 text-sky-900 space-y-1">
                                <div className="font-extrabold text-sky-900 text-[11px]">
                                  🌦️ 365일 기후 분석 대응 원칙:
                                </div>
                                <div className="px-2.5 py-2 rounded bg-white border border-sky-200 text-slate-900 font-semibold">
                                  {viewItem.climate_rule || '기온 및 강수 예보를 확인하여 적습·무강우 조건에서 작업을 수행합니다.'}
                                </div>
                              </div>
                            </div>

                            <div className="bg-amber-50/50 rounded-xl p-3.5 border border-amber-200 space-y-2">
                              <div className="font-extrabold text-amber-950 text-xs sm:text-sm flex items-center justify-between border-b border-amber-200 pb-1.5">
                                <span>③ 농자재 사용팁 및 영농 노하우</span>
                                <span className="text-[11px] text-amber-700 font-bold">현장 처방 가이드</span>
                              </div>
                              <div className="p-3 rounded-lg bg-white border border-amber-200 text-slate-800 leading-relaxed whitespace-pre-line min-h-[140px]">
                                {viewItem.usage_tip ||
                                  viewItem.action_tip ||
                                  '작물 생육 상태와 토양 수분을 점검한 후 권장 희석배수 및 시비량을 준수하여 살포하세요.'}
                              </div>
                            </div>
                          </div>

                          {/* 3. 필요 농자재 명세 조회 영역 (최고 추천점수 1종 선정 · 재배지 평수 계산 필요 수량 · 개조식 추천 근거) */}
                          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-3">
                            <div className="font-extrabold text-slate-900 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200 pb-2">
                              <span className="flex items-center gap-2 flex-wrap">
                                <span>④ 해당 생육과정 최고 추천점수 1종 농자재 명세</span>
                                <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-extrabold">
                                  최고점 1종 선정 · DB저장 완료
                                </span>
                              </span>
                              <span className="text-xs text-emerald-700 font-bold">
                                요청 재배지 면적: {Number(provisionData.activeRequest?.area_pyeong || 300).toLocaleString()}평 기준 필요 갯수 자동 산출
                              </span>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                              {[...(viewItem.materials || [])]
                                .sort(
                                  (a: any, b: any) =>
                                    Number(b?.match_score || 0) - Number(a?.match_score || 0)
                                )
                                .slice(0, 1)
                                .map((mat: any, mIdx: number) => {
                                  const reqArea = Number(
                                    provisionData.activeRequest?.area_pyeong || 300
                                  );
                                  const neededQty = parseRecommendedQuantity(mat, reqArea);
                                  const unitSpec = String(mat.unit_spec || '1개');
                                  const unitMatch = unitSpec.match(
                                    /(포|병|봉|통|팩|판|박스|개|롤)/
                                  );
                                  const unitLabel = unitMatch ? unitMatch[1] : '개';
                                  const bullets = buildStageRationaleBullets(
                                    mat,
                                    viewItem.sub_item_name || viewItem.process_name || '생육과정',
                                    reqArea
                                  );

                                  return (
                                    <div
                                      key={`${mat.material_id || 'MAT'}-${mIdx}`}
                                      className="bg-white rounded-xl border-2 border-emerald-200 p-3.5 flex items-start gap-3 shadow-2xs"
                                    >
                                      <img
                                        src={
                                          mat.thumbnail_url ||
                                          '/api/agro-materials/image/FERT-PRD-01/thumb'
                                        }
                                        alt={mat.product_name}
                                        className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-50"
                                      />
                                      <div className="min-w-0 flex-1 space-y-2">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-[10px]">
                                            {mat.sub_type || '맞춤 농자재'}
                                          </span>
                                          {mat.manufacturer && (
                                            <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-bold text-[10px]">
                                              {mat.manufacturer}
                                            </span>
                                          )}
                                          {mat.match_score && (
                                            <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-extrabold text-[10px]">
                                              최고 추천점수 1종 ({mat.match_score}점 · 1위)
                                            </span>
                                          )}
                                          <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-300 text-amber-900 font-extrabold text-[10px]">
                                            평수 계산 필요 수량: {neededQty}
                                            {unitLabel} ({unitSpec})
                                          </span>
                                        </div>

                                        <div className="font-extrabold text-slate-900 text-xs sm:text-sm">
                                          {mat.product_name || '-'}
                                        </div>

                                        {(mat.category_spec_badge || mat.nutrient_ratio_summary) && (
                                          <div className="text-[11px] text-indigo-800 bg-indigo-50/70 border border-indigo-100 rounded px-2.5 py-1 font-semibold leading-snug">
                                            {mat.category_spec_badge || mat.nutrient_ratio_summary}
                                          </div>
                                        )}

                                        <div className="px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-800 space-y-0.5">
                                          <div>
                                            📐{' '}
                                            {mat.recommended_for_area ||
                                              `재배지 ${reqArea.toLocaleString()}평 계산: 총 ${neededQty}${unitLabel}(${unitSpec}) 필요`}
                                          </div>
                                          {mat.quantity_calc_formula && (
                                            <div className="text-[10px] font-semibold text-emerald-700">
                                              산출식: {mat.quantity_calc_formula}
                                            </div>
                                          )}
                                        </div>

                                        <div className="px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-700 leading-relaxed space-y-1.5">
                                          <div className="font-extrabold text-emerald-900 flex items-center justify-between border-b border-slate-200 pb-1">
                                            <span>📋 생육과정별 최고점 1종 추천 근거 (개조식 · DB저장)</span>
                                            <span className="text-[10px] text-emerald-700 font-mono">
                                              {mat.material_category === 'FERTILIZER'
                                                ? '비료 9대 보증성분 기준'
                                                : mat.material_category === 'NUTRIENT'
                                                ? '영양제 기능성분 기준'
                                                : '병해충 PLS·IRAC 기준'}
                                            </span>
                                          </div>
                                          <ul className="space-y-1 text-[11px] text-slate-700">
                                            {bullets.map((bLine: string, bIdx: number) => (
                                              <li key={`det-bul-${bIdx}`} className="leading-snug font-medium">
                                                {bLine.startsWith('•') ? bLine : `• ${bLine}`}
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

              {/* ==================== [CloudBae 회원 일괄 구매 완료 확인서 모달] ==================== */}
              {purchaseOrderReceipt && (
                <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden my-auto">
                    <div className="bg-emerald-700 text-white px-5 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <PackageCheck className="w-6 h-6 text-emerald-200" />
                        <div>
                          <div className="text-[11px] font-bold text-emerald-200">
                            한팜(FarmPlan) 생육단계 맞춤 농자재 원클릭 주문 완료
                          </div>
                          <h4 className="text-base sm:text-lg font-extrabold">
                            {purchaseOrderReceipt.memberId} 회원님, 농자재 일괄 주문이 접수되었습니다!
                          </h4>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPurchaseOrderReceipt(null)}
                        className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="p-4 sm:p-6 space-y-4 max-h-[78vh] overflow-y-auto">
                      {/* 주문 요약 정보 */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-50 rounded-2xl p-3.5 border border-slate-200 text-xs">
                        <div>
                          <span className="text-slate-500 font-semibold">주문번호:</span>{' '}
                          <span className="font-extrabold text-slate-900">
                            {purchaseOrderReceipt.orderNo}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 font-semibold">주문일시:</span>{' '}
                          <span className="font-bold text-slate-800">
                            {purchaseOrderReceipt.orderedAt}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 font-semibold">주문자(회원):</span>{' '}
                          <span className="font-extrabold text-emerald-700">
                            {purchaseOrderReceipt.memberName} ({purchaseOrderReceipt.memberPhone})
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 font-semibold">적용 작물/면적:</span>{' '}
                          <span className="font-bold text-slate-800">
                            {purchaseOrderReceipt.cropTitle} ({purchaseOrderReceipt.areaPyeong}평)
                          </span>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="text-slate-500 font-semibold">배송 농지 주소:</span>{' '}
                          <span className="font-bold text-slate-900">
                            {purchaseOrderReceipt.regionAddress}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 font-semibold">선택 배송방식:</span>{' '}
                          <span className="font-extrabold text-emerald-700">
                            {purchaseOrderReceipt.deliveryOption === 'STAGE_SCHEDULED'
                              ? '생육단계별 적기 맞춤 자동 분할배송'
                              : '전 단계 농자재 일괄 묶음배송'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 font-semibold">결제수단:</span>{' '}
                          <span className="font-bold text-slate-900">
                            {purchaseOrderReceipt.paymentMethod === 'NONGHYUP_CARD'
                              ? 'NH농협 영농카드 간편결제 (결제완료)'
                              : purchaseOrderReceipt.paymentMethod === 'BANK_TRANSFER'
                              ? `무통장입금 (${purchaseOrderReceipt.bankAccount.bank_name} ${purchaseOrderReceipt.bankAccount.account_number})`
                              : '농협 콕뱅크 · 지역사랑페이 (결제완료)'}
                          </span>
                        </div>
                      </div>

                      {/* 주문 농자재 단계별 내역 */}
                      <div className="space-y-2">
                        <div className="text-xs font-extrabold text-slate-900 flex items-center justify-between">
                          <span>
                            주문 농자재 상세 내역 ({purchaseOrderReceipt.orderItems.length}종)
                          </span>
                          <span className="text-emerald-700">
                            적립 예정 포인트: +{purchaseOrderReceipt.rewardPoints.toLocaleString()}P
                          </span>
                        </div>
                        <div className="border border-slate-200 rounded-2xl divide-y divide-slate-200 max-h-60 overflow-y-auto">
                          {purchaseOrderReceipt.orderItems.map((item: any, iIdx: number) => (
                            <div
                              key={`${item.selKey}-${iIdx}`}
                              className="p-3 flex items-center justify-between gap-3 text-xs bg-white"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <img
                                  src={item.thumbnail_url}
                                  alt={item.product_name}
                                  className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold">
                                      {item.stageName}
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-semibold">
                                      {purchaseOrderReceipt.deliveryOption ===
                                      'STAGE_SCHEDULED'
                                        ? `도착예정: ${item.scheduledDeliveryDate}`
                                        : '즉시 일괄출고'}
                                    </span>
                                  </div>
                                  <div className="font-extrabold text-slate-900 truncate mt-0.5">
                                    {item.product_name}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="font-bold text-slate-700">
                                  {item.unit_price.toLocaleString()}원 × {item.qty}개
                                </div>
                                <div className="font-extrabold text-emerald-700">
                                  {item.subtotal.toLocaleString()}원
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 결제 금액 합계 */}
                      <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="text-xs text-slate-700 space-y-0.5">
                          <div>
                            총 상품금액 {purchaseOrderReceipt.orderRawTotal.toLocaleString()}원 -{' '}
                            {purchaseOrderReceipt.memberId} 회원 5% 할인{' '}
                            {purchaseOrderReceipt.orderDiscount.toLocaleString()}원 + 배송비 0원
                          </div>
                          <div className="font-bold text-emerald-800">
                            생육단계 일정에 맞춘 영농 알림톡이 {purchaseOrderReceipt.memberPhone}으로 발송됩니다.
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] font-bold text-emerald-700">
                            최종 결제 금액
                          </div>
                          <div className="text-lg sm:text-xl font-extrabold text-emerald-900">
                            {purchaseOrderReceipt.orderFinalTotal.toLocaleString()}원
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setPurchaseOrderReceipt(null);
                            setActiveMenu('마이페이지');
                            setMyPageTab('ORDERS');
                          }}
                          className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-emerald-600 bg-white hover:bg-emerald-50 text-emerald-800 text-xs sm:text-sm font-extrabold cursor-pointer"
                        >
                          마이페이지 &gt; 농자재 구매현황 확인
                        </button>
                        <button
                          type="button"
                          onClick={() => setPurchaseOrderReceipt(null)}
                          className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-extrabold cursor-pointer"
                        >
                          확인 완료
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== [탭 3: 재배일정 요청 (해당 아이디 재배일정 요청 이력 리스트 + 모달리스 요청 폼)] ==================== */}
        {activeMenu === '재배일정 요청' && (
          <div className="space-y-4 sm:space-y-6">
            {renderScheduleNavigationTabs()}

            {/* 해당 아이디(회원)로 지금까지 재배일정 요청했던 리스트 영역 */}
            <section className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-2xs space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-extrabold shrink-0">
                    <FileEdit className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-3 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[13px] sm:text-sm font-extrabold">
                        ID: {loggedInUser.email || 'CloudBae@naver.com'} ({loggedInUser.name || '배철민'} 회원)
                      </span>
                      <span className="px-3 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[13px] sm:text-sm font-extrabold">
                        총 {cloudBaeCropList.length}건 요청 완료
                      </span>
                    </div>
                    <h2 className="text-[19px] sm:text-2xl font-black text-slate-900 mt-1.5 whitespace-nowrap truncate">
                      요청한 내 재배일정 리스트 ({cloudBaeCropList.length}건)
                    </h2>
                    <p className="text-[14.5px] sm:text-base font-semibold text-slate-600 mt-1 leading-relaxed">
                      해당 아이디로 요청하여 산출된 맞춤형 재배일정 내역입니다. 우측 <strong>[재배일정 요청]</strong> 버튼을 누르면 새로운 모달리스 폼에서 추가 재배일정을 요청할 수 있습니다.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setReqFormSubmitted(false);
                      setScheduleReqModalPos({ x: 0, y: 0 });
                      setIsScheduleReqModelessOpen(true);
                    }}
                    className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[15px] sm:text-base shadow-sm transition cursor-pointer inline-flex items-center gap-2"
                  >
                    <FileEdit className="w-4 h-4" />
                    <span>재배일정 요청</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveMenu('홈')}
                    className="px-4 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-[15px] sm:text-base font-extrabold text-slate-800 cursor-pointer"
                  >
                    홈으로 돌아가기
                  </button>
                </div>
              </div>

              {/* 해당 아이디의 재배일정 요청 이력 카드 리스트 */}
              <div className="space-y-3.5">
                {cloudBaeCropList.map((crop: any, idx: number) => {
                  const displayReqNo = crop.display_request_no || crop.request_no;
                  const isDetailSelected =
                    selectedReqDetailCrop &&
                    (selectedReqDetailCrop.crop_plan_id || selectedReqDetailCrop.request_no) ===
                      (crop.crop_plan_id || crop.request_no);
                  return (
                    <div
                      key={crop.crop_plan_id || `${displayReqNo}-${idx}`}
                      className="space-y-2.5"
                    >
                      <div
                        className={`w-full rounded-2xl px-4 sm:px-6 py-4 border transition flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-2xs ${
                          isDetailSelected
                            ? 'border-emerald-600 bg-emerald-50/30'
                            : 'border-slate-200 bg-white hover:border-emerald-400 hover:bg-emerald-50/20'
                        }`}
                      >
                        {/* 좌측: 순번 + 썸네일 + 요청번호·작물명·품종 */}
                        <div className="flex items-center gap-3.5 min-w-0 lg:w-[33%] shrink-0">
                          <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white text-sm sm:text-base font-mono font-black inline-flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>

                          <div
                            className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br ${crop.thumb_gradient} text-white flex flex-col items-center justify-center shrink-0 shadow-xs border border-white/20`}
                          >
                            <Sprout className="w-6 h-6 sm:w-7 sm:h-7" />
                            <span className="text-[11px] sm:text-xs font-black mt-0.5">{crop.crop_short}</span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="px-2.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono font-extrabold text-[13px] sm:text-sm text-slate-800">
                                {displayReqNo}
                              </span>
                              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-extrabold text-[13px] sm:text-sm">
                                {crop.badge}
                              </span>
                              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-extrabold text-[12.5px] sm:text-[13px]">
                                산출완료
                              </span>
                            </div>
                            <div className="font-black text-[19px] sm:text-[22px] text-slate-950 mt-1 truncate leading-snug">
                              {crop.crop_title}
                            </div>
                            <div className="text-[14.5px] sm:text-[15.5px] text-slate-600 font-bold truncate mt-0.5">
                              요청 ID: {loggedInUser.email || 'CloudBae@naver.com'} · 적정온도 {crop.opt_temp}
                            </div>
                          </div>
                        </div>

                        {/* 중앙: 요청 재배지 주소·평수 + 추천 정식/파종일 & 수확예정일 + 현재 생육단계 */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
                          <div className="bg-slate-50/90 rounded-xl px-4 py-3 border border-slate-200/70">
                            <div className="text-[13px] sm:text-sm text-slate-500 font-extrabold">요청 재배지 · 면적</div>
                            <div className="text-[16px] sm:text-[18px] font-black text-slate-900 mt-1 truncate">{crop.region}</div>
                            <div className="text-[14px] sm:text-[15px] text-emerald-700 font-extrabold mt-0.5">
                              {Number(crop.area_pyeong).toLocaleString()}평 ({crop.planting_type})
                            </div>
                          </div>

                          <div className="bg-slate-50/90 rounded-xl px-4 py-3 border border-slate-200/70">
                            <div className="text-[13px] sm:text-sm text-slate-500 font-extrabold">기후 연동 추천 시작일 · 수확예정</div>
                            <div className="text-[16px] sm:text-[18px] font-black text-slate-900 mt-1 truncate">{crop.planting_label}</div>
                            <div className="text-[14px] sm:text-[15px] text-slate-600 font-bold mt-0.5">
                              수확예정: {crop.expected_harvest_date}
                            </div>
                          </div>

                          <div className="bg-slate-50/90 rounded-xl px-4 py-3 border border-slate-200/70">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[13px] sm:text-sm text-slate-500 font-extrabold">현재 진행 단계</span>
                              <span className="font-mono font-black text-emerald-700 text-[15px] sm:text-base">
                                진행률 {crop.progress_pct}%
                              </span>
                            </div>
                            <div className="text-[16px] sm:text-[18px] font-black text-emerald-900 mt-1 truncate">
                              {crop.current_stage_name}
                            </div>
                            <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden mt-1.5">
                              <div
                                className="h-full rounded-full bg-emerald-500"
                                style={{ width: `${crop.progress_pct}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* 우측: 세부보기 버튼 + 일정확인 버튼 + 삭제 버튼 */}
                        <div className="flex items-center justify-end gap-2 shrink-0 border-t lg:border-t-0 pt-2.5 lg:pt-0 border-slate-100">
                          <button
                            type="button"
                            onClick={() => {
                              if (isDetailSelected) {
                                setSelectedReqDetailCrop(null);
                              } else {
                                setReqDetailModalPos({ x: 0, y: 0 });
                                setSelectedReqDetailCrop({
                                  ...crop,
                                  displayReqNo,
                                  orderIndex: idx + 1,
                                });
                              }
                            }}
                            className={`px-4 py-3 rounded-xl border font-black text-[15px] sm:text-base transition cursor-pointer inline-flex items-center gap-1 shadow-2xs ${
                              isDetailSelected
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white hover:bg-emerald-50 text-slate-900 border-slate-300 hover:border-emerald-400'
                            }`}
                          >
                            <span>세부보기</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRequestNo(crop.request_no);
                              setExpandedScheduleRequestNo(crop.request_no);
                              setActiveMenu('재배일정 확인');
                              setMobileScheduleStep('detail');
                            }}
                            className="px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[15px] sm:text-base transition cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                          >
                            <span>일정확인</span>
                            <ChevronRight className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleDeleteScheduleAndCascade(crop, e)}
                            title="해당 재배일정 요청 및 연관된 일정·추천제품 데이터 모두 삭제"
                            className="px-3.5 py-3 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 hover:border-rose-300 text-rose-600 font-black text-[15px] sm:text-base transition cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>삭제</span>
                          </button>
                        </div>
                      </div>

                      {/* 인라인 세부보기 요약 패널 (세부보기 클릭 시 해당 항목 바로 아래에도 상세 정보 표시) */}
                      {isDetailSelected && (
                        <div className="ml-2 sm:ml-4 pl-3 sm:pl-4 border-l-4 border-emerald-500 rounded-2xl bg-emerald-50/40 border border-emerald-200 p-4 sm:p-5 space-y-3 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200/80 pb-2.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-3 py-1 rounded-md bg-emerald-600 text-white font-extrabold text-[13.5px]">
                                요청 세부정보 #{idx + 1}
                              </span>
                              <span className="font-mono font-black text-emerald-900 text-[15px]">
                                {displayReqNo}
                              </span>
                              <span className="font-black text-slate-900 text-[17px]">
                                {crop.crop_title} ({crop.region})
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedReqDetailCrop(null)}
                              className="px-3 py-1.5 rounded-lg bg-white hover:bg-rose-50 text-slate-800 hover:text-rose-700 border border-slate-300 font-extrabold text-[14px] cursor-pointer"
                            >
                              세부정보 닫기 ✕
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div className="bg-white rounded-xl p-3.5 border border-emerald-100">
                              <div className="text-[13px] text-slate-500 font-extrabold">요청자 계정 · 성명</div>
                              <div className="text-[16px] font-black text-slate-900 mt-1">
                                {loggedInUser.name || '배철민'} ({loggedInUser.email || 'CloudBae@naver.com'})
                              </div>
                              <div className="text-[13.5px] font-semibold text-slate-600 mt-0.5">
                                연락처: {loggedInUser.phone || '010-2026-0109'}
                              </div>
                            </div>
                            <div className="bg-white rounded-xl p-3.5 border border-emerald-100">
                              <div className="text-[13px] text-slate-500 font-extrabold">요청 재배지 주소 · 면적</div>
                              <div className="text-[16px] font-black text-slate-900 mt-1">{crop.region}</div>
                              <div className="text-[13.5px] text-emerald-700 font-extrabold mt-0.5">
                                재배면적 {Number(crop.area_pyeong).toLocaleString()}평 · 토양 pH {crop.soil_ph || 6.2} / EC {crop.soil_ec || 1.1}
                              </div>
                            </div>
                            <div className="bg-white rounded-xl p-3.5 border border-emerald-100">
                              <div className="text-[13px] text-slate-500 font-extrabold">작물 · 품종 · 재배구분</div>
                              <div className="text-[16px] font-black text-slate-900 mt-1">{crop.crop_title}</div>
                              <div className="text-[13.5px] text-emerald-700 font-extrabold mt-0.5">
                                {crop.badge} ({crop.planting_type}) · {crop.opt_temp}
                              </div>
                            </div>
                            <div className="bg-white rounded-xl p-3.5 border border-emerald-100">
                              <div className="text-[13px] text-slate-500 font-extrabold">추천 시작일 · 수확예정 · 상태</div>
                              <div className="text-[16px] font-black text-slate-900 mt-1">{crop.planting_label}</div>
                              <div className="text-[13.5px] text-slate-700 font-extrabold mt-0.5">
                                수확예정 {crop.expected_harvest_date} · {crop.status_text}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ==================== [모달리스(Modeless) 재배일정 요청 세부보기 창] ==================== */}
            {selectedReqDetailCrop && (
              <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center p-3 sm:p-6">
                <div
                  style={{
                    transform: `translate(${reqDetailModalPos.x}px, ${reqDetailModalPos.y}px)`,
                  }}
                  className="pointer-events-auto w-full max-w-2xl max-h-[86vh] flex flex-col rounded-2xl border-2 border-emerald-600 bg-white shadow-[0_25px_70px_rgba(15,23,42,0.38)] overflow-hidden"
                >
                  {/* 상단 드래그 헤더 바 */}
                  <div
                    onMouseDown={handleStartReqDetailModalDrag}
                    className={`relative bg-emerald-50/95 border-b border-emerald-200 px-5 py-3.5 pr-24 flex flex-wrap items-center justify-between gap-2 select-none ${
                      isDraggingReqDetailModal ? 'cursor-grabbing' : 'cursor-move'
                    }`}
                    title="마우스로 상단 바를 드래그하여 창 위치를 이동할 수 있습니다"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-lg bg-emerald-600 text-white font-extrabold text-xs">
                          재배일정 요청 세부보기
                        </span>
                        <span className="px-2 py-0.5 rounded bg-white border border-emerald-200 font-mono font-bold text-emerald-800 text-xs">
                          {selectedReqDetailCrop.displayReqNo}
                        </span>
                        <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                          {selectedReqDetailCrop.crop_title}
                        </h3>
                      </div>
                      <p className="text-[11px] text-slate-500 font-semibold">
                        요청 ID: {loggedInUser.email || 'CloudBae@naver.com'} ({loggedInUser.name || '배철민'} 회원)
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedReqDetailCrop(null)}
                      className="absolute top-3 right-3.5 z-20 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-300 font-extrabold text-xs inline-flex items-center gap-1 transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                      <span>닫기</span>
                    </button>
                  </div>

                  {/* 세부보기 본문 */}
                  <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 bg-white text-xs sm:text-sm">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-1">
                        <div className="text-[11px] font-bold text-slate-500">요청 번호 / 산출 상태</div>
                        <div className="font-mono font-extrabold text-slate-900 text-sm">
                          {selectedReqDetailCrop.displayReqNo} · 맞춤 일정 산출완료
                        </div>
                      </div>
                      <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-1">
                        <div className="text-[11px] font-bold text-slate-500">요청자 계정 (ID)</div>
                        <div className="font-extrabold text-slate-900 text-sm">
                          {loggedInUser.name || '배철민'} ({loggedInUser.email || 'CloudBae@naver.com'})
                        </div>
                      </div>
                      <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-1">
                        <div className="text-[11px] font-bold text-slate-500">요청 재배지 주소 (시도·시군구·읍면동)</div>
                        <div className="font-extrabold text-emerald-800 text-sm">
                          📍 {selectedReqDetailCrop.region}
                        </div>
                      </div>
                      <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-1">
                        <div className="text-[11px] font-bold text-slate-500">요청 재배 면적 · 토양 정보</div>
                        <div className="font-extrabold text-slate-900 text-sm">
                          {Number(selectedReqDetailCrop.area_pyeong).toLocaleString()}평 (토양 pH {selectedReqDetailCrop.soil_ph || 6.2} · EC {selectedReqDetailCrop.soil_ec || 1.1} dS/m)
                        </div>
                      </div>
                      <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-1">
                        <div className="text-[11px] font-bold text-slate-500">요청 작물 · 품종</div>
                        <div className="font-extrabold text-slate-900 text-sm">
                          {selectedReqDetailCrop.crop_title} ({selectedReqDetailCrop.badge})
                        </div>
                      </div>
                      <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-1">
                        <div className="text-[11px] font-bold text-slate-500">작물구분 (씨/모종) · 적정온도</div>
                        <div className="font-extrabold text-emerald-800 text-sm">
                          {selectedReqDetailCrop.planting_type} · {selectedReqDetailCrop.opt_temp}
                        </div>
                      </div>
                      <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-3.5 space-y-1">
                        <div className="text-[11px] font-bold text-emerald-700">기후 연동 추천 시작일 (정식/파종)</div>
                        <div className="font-extrabold text-emerald-950 text-sm">
                          📅 {selectedReqDetailCrop.planting_label}
                        </div>
                      </div>
                      <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-3.5 space-y-1">
                        <div className="text-[11px] font-bold text-emerald-700">예상 수확일 · 현재 진행 단계</div>
                        <div className="font-extrabold text-emerald-950 text-sm">
                          🌾 {selectedReqDetailCrop.expected_harvest_date} ({selectedReqDetailCrop.current_stage_name})
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs text-slate-700 space-y-1.5">
                      <div className="font-extrabold text-slate-900">
                        🤖 기후 데이터 및 적산온도(GDD/PGDD) 일정 산출 요약
                      </div>
                      <p className="leading-relaxed">
                        • 재배지(<strong>{selectedReqDetailCrop.region}</strong>)의 작년 기후와 올해 예측 기후(현재+6개월) 평균을 대입하여 최저·최고 한계온도 기간을 회피하고 <strong>{selectedReqDetailCrop.opt_temp}</strong> 조건에 부합하는 최적 추천 진행일을 산출했습니다.
                      </p>
                      <p className="leading-relaxed">
                        • 현재 생육 진행률은 <strong>{selectedReqDetailCrop.progress_pct}%</strong> ({selectedReqDetailCrop.status_text})이며, 평균기온 {selectedReqDetailCrop.temp_avg} · 강수량 {selectedReqDetailCrop.rain_mm} 예보가 반영되어 있습니다.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => setSelectedReqDetailCrop(null)}
                        className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs sm:text-sm cursor-pointer"
                      >
                        닫기
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const targetReqNo = selectedReqDetailCrop.request_no;
                          setSelectedReqDetailCrop(null);
                          setSelectedRequestNo(targetReqNo);
                          setExpandedScheduleRequestNo(targetReqNo);
                          setActiveMenu('재배일정 확인');
                          setMobileScheduleStep('detail');
                        }}
                        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs sm:text-sm cursor-pointer inline-flex items-center gap-1 shadow-xs"
                      >
                        <span>일정확인 페이지로 이동</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== [모달리스(Modeless) 재배일정 요청 폼] ==================== */}
            {isScheduleReqModelessOpen && (
              <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center p-3 sm:p-6">
                <div
                  style={{
                    transform: `translate(${scheduleReqModalPos.x}px, ${scheduleReqModalPos.y}px)`,
                  }}
                  className="pointer-events-auto w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl border-2 border-emerald-600 bg-white shadow-[0_25px_70px_rgba(15,23,42,0.38)] overflow-hidden"
                >
                  {/* 모달리스 상단 드래그 헤더 바 */}
                  <div
                    onMouseDown={handleStartScheduleReqModalDrag}
                    className={`relative bg-emerald-50/95 border-b border-emerald-200 px-5 py-3.5 pr-24 flex flex-wrap items-center justify-between gap-2 select-none ${
                      isDraggingScheduleReqModal ? 'cursor-grabbing' : 'cursor-move'
                    }`}
                    title="마우스로 상단 바를 드래그하여 모달리스 폼 위치를 이동할 수 있습니다"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-lg bg-emerald-600 text-white font-extrabold text-xs shadow-2xs">
                          모달리스 폼
                        </span>
                        <span className="px-2 py-0.5 rounded bg-white border border-emerald-200 font-mono font-bold text-emerald-800 text-xs">
                          {loggedInUser.email || 'CloudBae@naver.com'}
                        </span>
                        <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                          맞춤형 재배일정 요청 (기후·토양 연동)
                        </h3>
                      </div>
                      <p className="text-[11px] text-slate-500 font-semibold">
                        상단 바를 드래그하여 창을 이동하면서 뒤쪽의 기존 재배일정 요청 리스트를 함께 참조할 수 있습니다.
                      </p>
                    </div>

                    {/* 우측 상단 닫기 버튼 */}
                    <button
                      type="button"
                      onClick={() => setIsScheduleReqModelessOpen(false)}
                      className="absolute top-3 right-3.5 z-20 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-300 font-extrabold text-xs inline-flex items-center gap-1 transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                      <span>닫기</span>
                    </button>
                  </div>

                  {/* 모달리스 폼 본문 */}
                  <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1 bg-white">
                    {/* 기후 데이터 대입 원칙 안내 배너 */}
                    <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-3.5 text-xs text-slate-700 space-y-1">
                      <div className="font-extrabold text-emerald-900 flex items-center gap-1.5">
                        <Sprout className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>지역별 적산온도(GDD/PGDD) 및 작년+올해예측 기후 평균 자동 대입</span>
                      </div>
                      <p className="leading-relaxed">
                        ① 작물구분이 <strong>&lsquo;모종&rsquo;</strong>이면 작년 기준 최저온도 미만·최고온도 초과 기간을 제외하고 최적 예상 온도일 때 정식을 시작하며, ② <strong>&lsquo;씨&rsquo;</strong>일 경우 평균기온이 최적 발아온도 이상인 빠른 시기에 파종을 시작합니다.
                      </p>
                    </div>

                    {reqFormSubmitted ? (
                      <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-300 p-5 space-y-3.5">
                        <div className="flex items-center gap-2 text-emerald-800 font-extrabold text-base">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                          <span>
                            [{reqForm.sido} {reqForm.sigungu} {reqForm.eupmyeondong}] {reqForm.crop_name}({reqForm.cultivar_name}) 맞춤형 재배일정 요청 및 산출이 완료되었습니다!
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-700">
                          요청하신 내역이 해당 아이디(<strong>{loggedInUser.email || 'CloudBae@naver.com'}</strong>)의 재배일정 요청 리스트 최상단에 추가되었습니다. 산출된 생육과정별 단일 추천 진행일(요일 포함)을 바로 확인해 보세요.
                        </p>
                        <div className="flex flex-wrap items-center gap-2.5 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setReqFormSubmitted(false);
                              setIsScheduleReqModelessOpen(false);
                              setExpandedScheduleRequestNo(selectedRequestNo || 'REQ-20261106-009');
                              setActiveMenu('재배일정 확인');
                              setMobileScheduleStep('detail');
                            }}
                            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs sm:text-sm cursor-pointer shadow-xs"
                          >
                            산출된 재배일정 확인 이동 ›
                          </button>
                          <button
                            type="button"
                            onClick={() => setReqFormSubmitted(false)}
                            className="px-4 py-2.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 font-extrabold text-xs sm:text-sm cursor-pointer hover:bg-emerald-100/50"
                          >
                            + 추가 재배일정 요청하기
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsScheduleReqModelessOpen(false)}
                            className="px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold text-xs sm:text-sm cursor-pointer hover:bg-slate-50 ml-auto"
                          >
                            모달리스 창 닫기
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* 내 등록 농지 빠른 선택 바 */}
                        {myFarmlands.length > 0 && (
                          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5">
                            <label className="block text-xs font-extrabold text-slate-800 mb-1.5">
                              📍 내 등록 재배지 빠른 불러오기 ({myFarmlands.length}필지)
                            </label>
                            <select
                              value={reqForm.farmland_id}
                              onChange={(e) => {
                                const lid = e.target.value;
                                const found = myFarmlands.find((f: any) => f.farmland_id === lid);
                                if (found) {
                                  setReqForm((prev) => ({
                                    ...prev,
                                    farmland_id: lid,
                                    sido: found.sido,
                                    sigungu: found.sigungu,
                                    eupmyeondong: found.eupmyeondong,
                                    area_pyeong: Number(found.area_pyeong || 300),
                                    soil_ph: Number(found.soil_ph || 6.2),
                                    soil_ec: Number(found.soil_ec || 1.1),
                                  }));
                                } else {
                                  setReqForm((prev) => ({ ...prev, farmland_id: lid }));
                                }
                              }}
                              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold text-xs sm:text-sm"
                            >
                              {myFarmlands.map((f: any) => (
                                <option key={f.farmland_id} value={f.farmland_id}>
                                  {f.farmland_title} — {f.sido} {f.sigungu} {f.eupmyeondong} ({Number(f.area_pyeong || 300).toLocaleString()}평 · pH {f.soil_ph || 6.2})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs sm:text-sm">
                          <div>
                            <label className="block font-bold text-slate-700 mb-1">시/도</label>
                            <input
                              type="text"
                              value={reqForm.sido}
                              onChange={(e) => setReqForm({ ...reqForm, sido: e.target.value })}
                              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold"
                            />
                          </div>
                          <div>
                            <label className="block font-bold text-slate-700 mb-1">시/군/구</label>
                            <input
                              type="text"
                              value={reqForm.sigungu}
                              onChange={(e) => setReqForm({ ...reqForm, sigungu: e.target.value })}
                              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold"
                            />
                          </div>
                          <div>
                            <label className="block font-bold text-slate-700 mb-1">읍/면/동</label>
                            <input
                              type="text"
                              value={reqForm.eupmyeondong}
                              onChange={(e) => setReqForm({ ...reqForm, eupmyeondong: e.target.value })}
                              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold"
                            />
                          </div>

                          <div>
                            <label className="block font-bold text-slate-700 mb-1">농작물 선택</label>
                            <select
                              value={reqForm.crop_name}
                              onChange={(e) => {
                                const cname = e.target.value;
                                const defaultCv =
                                  cname === '봄배추'
                                    ? '춘광'
                                    : cname === '월동배추'
                                    ? '해남1호'
                                    : cname === '시금치'
                                    ? '포항초 (재래종)'
                                    : cname === '감자'
                                    ? '두백'
                                    : cname === '상추'
                                    ? '청치마상추'
                                    : cname === '고추'
                                    ? '칼라탄'
                                    : cname === '마늘'
                                    ? '홍산마늘'
                                    : '불암3호';
                                setReqForm({ ...reqForm, crop_name: cname, cultivar_name: defaultCv });
                              }}
                              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold"
                            >
                              <option value="가을배추">가을배추</option>
                              <option value="봄배추">봄배추</option>
                              <option value="월동배추">월동배추</option>
                              <option value="시금치">시금치</option>
                              <option value="감자">감자</option>
                              <option value="상추">상추</option>
                              <option value="마늘">마늘</option>
                              <option value="고추">고추</option>
                            </select>
                          </div>

                          <div>
                            <label className="block font-bold text-slate-700 mb-1">품종 선택</label>
                            <select
                              value={reqForm.cultivar_name}
                              onChange={(e) => setReqForm({ ...reqForm, cultivar_name: e.target.value })}
                              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold"
                            >
                              <option value="불암3호">불암3호 (최저 5℃ · 최고 26℃ · 최적 18~20℃)</option>
                              <option value="불암플러스">불암플러스 (최저 5℃ · 최고 26℃ · 최적 18~20℃)</option>
                              <option value="휘파람골드">휘파람골드 (최저 5℃ · 최고 26℃ · 최적 18~20℃)</option>
                              <option value="청명가을">청명가을 (씨 파종 · 적정발아 20℃)</option>
                              <option value="춘광">춘광 (최저 4℃ · 최고 25℃ · 최적 15~18℃)</option>
                              <option value="포항초 (재래종)">포항초 (재래종 · 적온 15~20℃)</option>
                              <option value="두백">두백 (감자 · 적온 15~18℃)</option>
                              <option value="설봉">설봉 (감자 · 적온 16~20℃)</option>
                              <option value="청치마상추">청치마상추 (적온 15~20℃)</option>
                              <option value="해남1호">해남1호 (월동배추)</option>
                              <option value="홍산마늘">홍산마늘</option>
                              <option value="칼라탄">칼라탄 (복합내병계 고추)</option>
                            </select>
                          </div>

                          <div>
                            <label className="block font-bold text-slate-700 mb-1">작물구분 (씨 / 모종)</label>
                            <select
                              value={reqForm.planting_type}
                              onChange={(e) => setReqForm({ ...reqForm, planting_type: e.target.value })}
                              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold"
                            >
                              <option value="모종">모종 (최저·최고온도 회피 최적기 정식)</option>
                              <option value="씨">씨 (평균기온 ≥ 적정발아온도 빠른 시기 파종)</option>
                            </select>
                          </div>

                          <div>
                            <label className="block font-bold text-slate-700 mb-1">희망 시작(정식/파종) 기준일</label>
                            <input
                              type="date"
                              value={reqForm.planting_date}
                              onChange={(e) => setReqForm({ ...reqForm, planting_date: e.target.value })}
                              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold"
                            />
                          </div>

                          <div>
                            <label className="block font-bold text-slate-700 mb-1">재배 면적 (평)</label>
                            <input
                              type="number"
                              value={reqForm.area_pyeong}
                              onChange={(e) =>
                                setReqForm({ ...reqForm, area_pyeong: Number(e.target.value) || 300 })
                              }
                              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block font-bold text-slate-700 mb-1">토양 산도 (pH)</label>
                              <input
                                type="number"
                                step="0.1"
                                value={reqForm.soil_ph}
                                onChange={(e) =>
                                  setReqForm({ ...reqForm, soil_ph: Number(e.target.value) || 6.2 })
                                }
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold"
                              />
                            </div>
                            <div>
                              <label className="block font-bold text-slate-700 mb-1">토양 EC (dS/m)</label>
                              <input
                                type="number"
                                step="0.1"
                                value={reqForm.soil_ec}
                                onChange={(e) =>
                                  setReqForm({ ...reqForm, soil_ec: Number(e.target.value) || 1.1 })
                                }
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                          <button
                            type="button"
                            onClick={() => setIsScheduleReqModelessOpen(false)}
                            className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs sm:text-sm cursor-pointer"
                          >
                            취소
                          </button>
                          <button
                            type="button"
                            onClick={handleSubmitScheduleReqForm}
                            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs sm:text-sm transition cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>맞춤 재배일정 산출 요청하기</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== [탭 4: 농작물 구매 (비료 / 영양제 / 병해충방지제 / 씨 / 모종 통합 탭 구분 + 관리자 DB 실시간 연동)] ==================== */}
        {(activeMenu === '농작물 구매' ||
          activeMenu === '농자재 판매' ||
          activeMenu === '비료' ||
          activeMenu === '영양제' ||
          activeMenu === '병해충관리제' ||
          activeMenu === '병해충방지제' ||
          activeMenu === '씨' ||
          activeMenu === '모종') && (
          <div className="space-y-4 sm:space-y-6">
            {/* ==================== [모바일 전용: 상/하단 메뉴 고정 + 중앙 리스트만 상하 스크롤 구조] ==================== */}
            <div
              className={`lg:hidden fixed inset-x-0 z-20 flex flex-col bg-[#F4F6F5] overflow-hidden ${
                isLegacyAndroidWebView
                  ? 'top-[calc(max(34px,env(safe-area-inset-top,34px))+3.8rem)] sm:top-[calc(max(34px,env(safe-area-inset-top,34px))+5.3rem)] bottom-[calc(max(14px,env(safe-area-inset-bottom,14px))+4.75rem)]'
                  : 'top-[calc(env(safe-area-inset-top,0px)+3.8rem)] sm:top-[calc(env(safe-area-inset-top,0px)+5.3rem)] bottom-[calc(env(safe-area-inset-bottom,0px)+4.75rem)]'
              }`}
            >
              {/* 1. 상단 고정 영역: 모바일 타이틀 + 일체형 화이트 플로팅 5대 카테고리 카드 독 (항상 고정 노출) */}
              <div className="shrink-0 px-3 pt-1.5 pb-1.5 bg-[#F4F6F5] z-10 space-y-1.5">
                {/* 상단 타이틀 & 전체보기·검색 버튼 */}
                <div className="flex items-center justify-between gap-2 px-1">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-[17px] font-black tracking-tight text-slate-900 leading-none">
                      농작물 구매
                    </h2>
                    <span className="px-2 py-0.5 rounded-full bg-[#DDF5E8] text-[11px] font-extrabold text-[#11643C] leading-none">
                      총 {userAgroResult.total}종
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMobileAgroCategoryTab('ALL');
                        setUserAgroMainTypeFilter('ALL');
                        setUserAgroSubTypeFilter('ALL');
                        setUserAgroOrganicFilter('ALL');
                        executeUserAgroMaterialSearch({
                          category: 'ALL',
                          main_type: 'ALL',
                          sub_type: 'ALL',
                          is_organic: 'ALL',
                          q: userAgroKeyword,
                        });
                        document
                          .getElementById('mobile-agro-list-scroll')
                          ?.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold transition cursor-pointer leading-none ${
                        mobileAgroCategoryTab === 'ALL'
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs shadow-emerald-600/20'
                          : 'bg-[#E9ECEB] hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      전체보기
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowMobileAgroSearch((prev) => !prev)}
                      aria-label="농작물 및 농자재 검색"
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer ${
                        showMobileAgroSearch || userAgroKeyword.trim()
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs shadow-emerald-600/20'
                          : 'bg-[#E9ECEB] text-slate-800 hover:bg-slate-200'
                      }`}
                    >
                      <Search className="w-3.5 h-3.5 stroke-[2.4]" />
                    </button>
                  </div>
                </div>

                {/* 2. 일체형 화이트 플로팅 카드 (5분할 카테고리 카드 - 최소 높이 슬림형) */}
                <div className="bg-white rounded-2xl p-1.5 shadow-[0_6px_20px_rgba(15,23,42,0.06)] border border-slate-200/85">
                  <div className="grid grid-cols-5 gap-1">
                    {[
                      {
                        key: 'FERTILIZER' as const,
                        label: '비료',
                        renderIcon: (active: boolean) => (
                          <svg viewBox="0 0 36 36" className="w-5 h-5" fill="none">
                            {/* 플라스크 기포 */}
                            <circle cx="13" cy="6.5" r="1.3" fill={active ? '#A7F3D0' : '#4E9F86'} />
                            <circle cx="16.5" cy="4.8" r="1" fill={active ? '#ffffff' : '#334155'} />
                            {/* 삼각 플라스크 */}
                            <path
                              d="M11.5 9.5h5M12.8 9.5v4.2l-5.2 9.5a2 2 0 001.75 2.95h9.3a2 2 0 001.75-2.95l-5.2-9.5V9.5"
                              stroke={active ? '#ffffff' : '#334155'}
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M8.8 21.5h10.4l1.1 2.1a1 1 0 01-.88 1.48H8.58a1 1 0 01-.88-1.48l1.1-2.1z"
                              fill={active ? '#A7F3D0' : '#5BB89A'}
                            />
                            {/* 우측 비료 포대 */}
                            <rect
                              x="19.5"
                              y="14.5"
                              width="9.5"
                              height="11.8"
                              rx="2"
                              fill={active ? '#ffffff' : '#F1F5F9'}
                              stroke={active ? '#ffffff' : '#334155'}
                              strokeWidth="1.9"
                            />
                            <path
                              d="M22.5 21.8c0-2.2 1.8-3.8 4-3.8 0 2.2-1.8 3.8-4 3.8z"
                              fill={active ? '#059669' : '#4E9F86'}
                            />
                          </svg>
                        ),
                      },
                      {
                        key: 'NUTRIENT' as const,
                        label: '영양제',
                        renderIcon: (active: boolean) => (
                          <svg viewBox="0 0 36 36" className="w-5 h-5" fill="none">
                            {/* 큰 반짝임 별 */}
                            <path
                              d="M15 8l2.2 5.8L23 16l-5.8 2.2L15 24l-2.2-5.8L7 16l5.8-2.2L15 8z"
                              fill={active ? '#A7F3D0' : '#94A3B8'}
                              fillOpacity={active ? '0.35' : '0.35'}
                              stroke={active ? '#ffffff' : '#334155'}
                              strokeWidth="2"
                              strokeLinejoin="round"
                            />
                            {/* 작은 반짝임 별 */}
                            <path
                              d="M24.5 6.5l1.1 2.9 2.9 1.1-2.9 1.1-1.1 2.9-1.1-2.9-2.9-1.1 2.9-1.1 1.1-2.9z"
                              fill={active ? '#ffffff' : '#CBD5E1'}
                              stroke={active ? '#ffffff' : '#334155'}
                              strokeWidth="1.7"
                              strokeLinejoin="round"
                            />
                            {/* 영양 물방울 */}
                            <path
                              d="M25 18.2c0 0 4 4.5 4 7.1a4 4 0 01-8 0c0-2.6 4-7.1 4-7.1z"
                              fill={active ? '#6EE7B7' : '#5BB89A'}
                              stroke={active ? '#ffffff' : '#334155'}
                              strokeWidth="2"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ),
                      },
                      {
                        key: 'PESTICIDE' as const,
                        label: '병해충방지제',
                        renderIcon: (active: boolean) => (
                          <svg viewBox="0 0 36 36" className="w-5 h-5" fill="none">
                            <path
                              d="M18 6.5l9.5 3.8v7.2c0 6.4-4.1 11.4-9.5 13.5-5.4-2.1-9.5-7.1-9.5-13.5v-7.2L18 6.5z"
                              fill={active ? '#ffffff' : '#F8FAFC'}
                              fillOpacity={active ? '0.18' : '1'}
                              stroke={active ? '#ffffff' : '#475569'}
                              strokeWidth="2.1"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M18 7.5v11h8.5v-1c0-2.2 0-4.5 0-6.5L18 7.5z"
                              fill={active ? '#6EE7B7' : '#64748B'}
                              fillOpacity={active ? '0.75' : '0.65'}
                            />
                            <path
                              d="M18 18.5H9.5c.4 4.8 3.8 9 8.5 11.2V18.5z"
                              fill={active ? '#6EE7B7' : '#64748B'}
                              fillOpacity={active ? '0.75' : '0.65'}
                            />
                            <path
                              d="M18 7v23.5M9 18.5h18"
                              stroke={active ? '#ffffff' : '#475569'}
                              strokeWidth="1.9"
                            />
                          </svg>
                        ),
                      },
                      {
                        key: 'SEED' as const,
                        label: '씨',
                        renderIcon: (active: boolean) => (
                          <svg viewBox="0 0 36 36" className="w-5 h-5" fill="none">
                            {/* 종자 봉투 */}
                            <rect
                              x="9"
                              y="8"
                              width="14"
                              height="17.5"
                              rx="2"
                              fill={active ? '#ffffff' : '#E2E8F0'}
                              fillOpacity={active ? '0.2' : '0.7'}
                              stroke={active ? '#ffffff' : '#334155'}
                              strokeWidth="2"
                            />
                            <path
                              d="M9 11.8h14"
                              stroke={active ? '#ffffff' : '#334155'}
                              strokeWidth="1.8"
                            />
                            {/* 봉투 안 씨앗 잎 */}
                            <path
                              d="M13.5 20.5c0-3.2 2.4-5.5 5.5-5.5 0 3.2-2.4 5.5-5.5 5.5z"
                              fill={active ? '#6EE7B7' : '#5BB89A'}
                              stroke={active ? '#ffffff' : '#334155'}
                              strokeWidth="1.7"
                            />
                            {/* 바깥 씨앗 알갱이 */}
                            <ellipse
                              cx="26.5"
                              cy="21.5"
                              rx="2"
                              ry="3.2"
                              transform="rotate(25 26.5 21.5)"
                              fill={active ? '#6EE7B7' : '#5BB89A'}
                              stroke={active ? '#ffffff' : '#334155'}
                              strokeWidth="1.7"
                            />
                            <ellipse
                              cx="22.8"
                              cy="26.5"
                              rx="1.8"
                              ry="2.8"
                              transform="rotate(-20 22.8 26.5)"
                              fill={active ? '#ffffff' : '#94A3B8'}
                              stroke={active ? '#ffffff' : '#334155'}
                              strokeWidth="1.7"
                            />
                          </svg>
                        ),
                      },
                      {
                        key: 'SEEDLING' as const,
                        label: '모종',
                        renderIcon: (active: boolean) => (
                          <svg viewBox="0 0 36 36" className="w-5 h-5" fill="none">
                            {/* 줄기 */}
                            <path
                              d="M18 25V13"
                              stroke={active ? '#ffffff' : '#334155'}
                              strokeWidth="2.1"
                              strokeLinecap="round"
                            />
                            {/* 우측 큰 떡잎 */}
                            <path
                              d="M18 16.5c0-4.8 3.8-8 8.5-8 0 4.8-3.8 8-8.5 8z"
                              fill={active ? '#6EE7B7' : '#5BB89A'}
                              stroke={active ? '#ffffff' : '#334155'}
                              strokeWidth="2"
                              strokeLinejoin="round"
                            />
                            {/* 좌측 작은 떡잎 */}
                            <path
                              d="M18 19c0-3.8-3.2-6.5-7-6.5 0 3.8 3.2 6.5 7 6.5z"
                              fill={active ? '#A7F3D0' : '#7BC8AF'}
                              stroke={active ? '#ffffff' : '#334155'}
                              strokeWidth="2"
                              strokeLinejoin="round"
                            />
                            {/* 흙 둔덕 */}
                            <path
                              d="M11 27.5c1.5-2.2 4-3.3 7-3.3s5.5 1.1 7 3.3H11z"
                              fill={active ? '#ffffff' : '#64748B'}
                              fillOpacity={active ? '0.35' : '0.55'}
                              stroke={active ? '#ffffff' : '#334155'}
                              strokeWidth="2"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ),
                      },
                    ].map((tab) => {
                      const isActive = mobileAgroCategoryTab === tab.key;
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => {
                            setMobileAgroCategoryTab(tab.key);
                            setUserAgroMainTypeFilter('ALL');
                            setUserAgroSubTypeFilter('ALL');
                            setUserAgroOrganicFilter('ALL');
                            executeUserAgroMaterialSearch({
                              category: tab.key,
                              main_type: 'ALL',
                              sub_type: 'ALL',
                              is_organic: 'ALL',
                              q: userAgroKeyword,
                            });
                            document
                              .getElementById('mobile-agro-list-scroll')
                              ?.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className={`relative flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all duration-150 cursor-pointer ${
                            isActive
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-600 shadow-xs shadow-emerald-600/20'
                              : 'bg-white hover:bg-slate-50 text-slate-900 border border-slate-200/95'
                          }`}
                        >
                          <div className="h-5 flex items-center justify-center mb-0.5">
                            {tab.renderIcon(isActive)}
                          </div>
                          <span
                            className={`min-h-[26px] flex flex-col items-center justify-center text-center tracking-tighter ${
                              tab.key === 'PESTICIDE'
                                ? 'text-[13px] min-[390px]:text-[14px] sm:text-[15.5px] leading-[1.02]'
                                : 'text-[15px] min-[390px]:text-[16px] sm:text-[17.5px] leading-none'
                            } ${
                              isActive
                                ? 'font-black text-white'
                                : 'font-black text-slate-900'
                            }`}
                          >
                            {tab.key === 'PESTICIDE' ? (
                              <>
                                <span className="block whitespace-nowrap">병해충</span>
                                <span className="block whitespace-nowrap">방지제</span>
                              </>
                            ) : (
                              <span className="block whitespace-nowrap">{tab.label}</span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* 돋보기 클릭 시에만 열리는 심플 검색바 */}
                  {showMobileAgroSearch && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        executeUserAgroMaterialSearch({
                          category: mobileAgroCategoryTab,
                          q: userAgroKeyword,
                        });
                        document
                          .getElementById('mobile-agro-list-scroll')
                          ?.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="mt-2 pt-2 px-1 border-t border-slate-100 flex items-center gap-2"
                    >
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                        <input
                          type="text"
                          value={userAgroKeyword}
                          onChange={(e) => setUserAgroKeyword(e.target.value)}
                          placeholder="비료, 영양제, 병해충방지제, 씨, 모종 검색..."
                          className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-900 placeholder-slate-400 focus:bg-white focus:border-emerald-600 focus:outline-none"
                        />
                        {userAgroKeyword && (
                          <button
                            type="button"
                            onClick={() => {
                              setUserAgroKeyword('');
                              executeUserAgroMaterialSearch({
                                category: mobileAgroCategoryTab,
                                q: '',
                              });
                              document
                                .getElementById('mobile-agro-list-scroll')
                                ?.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700 p-0.5"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <button
                        type="submit"
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shrink-0 cursor-pointer shadow-xs shadow-emerald-600/20"
                      >
                        검색
                      </button>
                    </form>
                  )}
                </div>

                {/* 주문 완료 토스트 알림 (모바일) */}
                {userAgroOrderToast && (
                  <div className="rounded-2xl bg-emerald-50 border border-emerald-300 px-4 py-2.5 text-xs font-extrabold text-emerald-900 flex items-center justify-between gap-2 shadow-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="truncate">{userAgroOrderToast}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setMyPageTab('ORDERS');
                        setActiveMenu('마이페이지');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-extrabold shrink-0 cursor-pointer"
                    >
                      구매현황 ›
                    </button>
                  </div>
                )}
              </div>

              {/* 3. 중앙 독립 스크롤 영역: 모바일 심플 카드 리스트 (이 영역만 위·아래로 스크롤됨) */}
              <div
                id="mobile-agro-list-scroll"
                className="flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-6"
              >
                {(() => {
                  const totalItems = userAgroResult.items.length;
                  const mobileItems = userAgroResult.items;

                  const getMobileBadgeMeta = (item: any) => {
                    const cat = String(item.material_category || '').toUpperCase();
                    if (cat === 'SEEDLING') {
                      return { label: '모종', cls: 'bg-[#68B678] text-white' };
                    }
                    if (cat === 'SEED') {
                      return { label: '씨', cls: 'bg-[#C88A2B] text-white' };
                    }
                    if (cat === 'FERTILIZER') {
                      return { label: '비료', cls: 'bg-[#6E6235] text-white' };
                    }
                    if (cat === 'NUTRIENT') {
                      return { label: '영양제', cls: 'bg-[#2E7D78] text-white' };
                    }
                    if (cat === 'PESTICIDE') {
                      return { label: '병해충방지제', cls: 'bg-[#E57368] text-white' };
                    }
                    return { label: activeMenu, cls: 'bg-emerald-600 text-white' };
                  };

                  const stripParenthesesText = (val?: string | null) =>
                    formatMobileProductName(val);

                  const getMobileOneLineSummary = (item: any) => {
                    const cat = String(item.material_category || '').toUpperCase();
                    if (cat === 'SEEDLING') {
                      const stageOrPeriod = item.sowing_period_spec
                        ? `정식시기 : ${stripParenthesesText(item.sowing_period_spec)}`
                        : item.seedling_age_spec
                        ? `육묘 : ${stripParenthesesText(item.seedling_age_spec)}`
                        : '정식시기 : 봄·가을 적기';
                      const tempOrTray = item.germination_temp_spec
                        ? `생육적온 ${stripParenthesesText(item.germination_temp_spec).replace(/적온/g, '').trim()}`
                        : item.plug_tray_spec
                        ? stripParenthesesText(item.plug_tray_spec)
                        : '생육적온 18~25°C';
                      return `${stageOrPeriod} · ${tempOrTray}`;
                    }
                    if (cat === 'SEED') {
                      const sowPeriod = item.sowing_period_spec
                        ? `파종시기 : ${stripParenthesesText(item.sowing_period_spec)}`
                        : '파종시기 : 봄·가을';
                      const germTemp = item.germination_temp_spec
                        ? `발아적온 ${stripParenthesesText(item.germination_temp_spec).replace(/발아|적온/g, '').trim()}`
                        : '발아적온 15~22°C';
                      return `${sowPeriod} · ${germTemp}`;
                    }
                    if (cat === 'FERTILIZER') {
                      const stagePart = item.usage_stage
                        ? stripParenthesesText(String(item.usage_stage).split('/')[0])
                        : stripParenthesesText(item.sub_type) || '밑거름용';
                      const npkPart = item.nutrient_ratio_summary
                        ? stripParenthesesText(String(item.nutrient_ratio_summary).split('·')[0])
                        : item.target_nutrient_or_pest
                        ? stripParenthesesText(String(item.target_nutrient_or_pest).split(',')[0])
                        : 'N-P-K 균형 공급';
                      return `${stagePart} · ${npkPart}`;
                    }
                    if (cat === 'NUTRIENT') {
                      const effectPart = item.target_nutrient_or_pest
                        ? stripParenthesesText(
                            String(item.target_nutrient_or_pest).split('·').slice(0, 2).join(' · ')
                          )
                        : stripParenthesesText(item.stress_target) || '생육 활력 · 세포벽 강화';
                      const methodPart = item.application_method
                        ? stripParenthesesText(String(item.application_method).split('/')[0])
                        : '엽면시비';
                      return `${effectPart} · ${methodPart}`;
                    }
                    if (cat === 'PESTICIDE') {
                      const orgPart =
                        Number(item.is_organic) === 1
                          ? '유기농업자재'
                          : item.sub_type
                          ? stripParenthesesText(item.sub_type)
                          : '전문방제제';
                      const targetPart = item.target_nutrient_or_pest
                        ? stripParenthesesText(String(item.target_nutrient_or_pest).split('·')[0])
                        : Number(item.is_organic) === 1
                        ? '수확 전 사용 가능'
                        : `안전사용 ${stripParenthesesText(item.safety_phi_days) || '준수'}`;
                      return `${orgPart} · ${targetPart}`;
                    }
                    return `${stripParenthesesText(item.sub_type)} · ${stripParenthesesText(item.unit_spec)}`;
                  };

                  if (isUserAgroLoading) {
                    return (
                      <div className="bg-white rounded-3xl p-10 text-center text-slate-500 font-extrabold text-[15px] border border-slate-200/70">
                        농작물·농자재 목록을 불러오는 중입니다...
                      </div>
                    );
                  }

                  if (totalItems === 0) {
                    return (
                      <div className="bg-white rounded-3xl p-10 text-center space-y-3 border border-slate-200/70">
                        <div className="text-slate-700 font-black text-[17px]">
                          조건에 일치하는 품목이 없습니다.
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setMobileAgroCategoryTab('ALL');
                            setUserAgroKeyword('');
                            executeUserAgroMaterialSearch({
                              category: 'ALL',
                              main_type: 'ALL',
                              sub_type: 'ALL',
                              is_organic: 'ALL',
                              q: '',
                            });
                          }}
                          className="px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-[15px] font-black cursor-pointer shadow-xs shadow-emerald-600/20"
                        >
                          전체 품목 다시 보기
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3 pb-4">
                      {mobileItems.map((item: any) => {
                        const badge = getMobileBadgeMeta(item);
                        const summaryLine = getMobileOneLineSummary(item);
                        const cleanMobileProductName = stripParenthesesText(item.product_name).replace(
                          /(\d)-(\d)/g,
                          '$1\u2011$2'
                        );
                        const thumbUrl =
                          item.thumbnail_url ||
                          `/api/agro-materials/image/${encodeURIComponent(item.material_id)}/thumb`;
                        const detailImgs = [
                          item.detail_image_1 ||
                            `/api/agro-materials/image/${encodeURIComponent(item.material_id)}/detail1`,
                          item.detail_image_2 ||
                            `/api/agro-materials/image/${encodeURIComponent(item.material_id)}/detail2`,
                          item.detail_image_3 ||
                            `/api/agro-materials/image/${encodeURIComponent(item.material_id)}/detail3`,
                          item.detail_image_4 ||
                            `/api/agro-materials/image/${encodeURIComponent(item.material_id)}/detail4`,
                        ];

                        return (
                          <button
                            key={item.material_id}
                            type="button"
                            onClick={() => {
                              setSelectedUserAgroDetail(item);
                              setActiveUserAgroGalleryImg(detailImgs[0]);
                            }}
                            className="w-full text-left bg-white rounded-[24px] px-3.5 py-3 shadow-[0_2px_10px_rgba(15,23,42,0.04)] border border-slate-200/80 hover:border-emerald-400 active:scale-[0.99] transition flex items-center gap-3.5 cursor-pointer"
                          >
                            {/* 좌측 1:1 썸네일 (텍스트 영역과 동일한 순백색 배경 + 이미지 최대 확대) */}
                            <div className="w-[104px] h-[104px] rounded-2xl bg-white overflow-hidden shrink-0 flex items-center justify-center">
                              <img
                                src={thumbUrl}
                                alt={cleanMobileProductName}
                                className="w-full h-full object-contain scale-[1.18]"
                              />
                            </div>

                            {/* 중앙 배지 + 품목명 + 핵심 1줄 요약 (고령자 기준 대형 가독성 폰트) */}
                            <div className="flex-1 min-w-0 space-y-1">
                              <div>
                                <span
                                  className={`inline-flex items-center px-3 py-0.5 rounded-full text-[13.5px] sm:text-[15px] font-black tracking-tight leading-tight ${badge.cls}`}
                                >
                                  {badge.label}
                                </span>
                              </div>
                              <div className="text-[19px] sm:text-[21px] font-black text-slate-950 truncate leading-snug tracking-tight">
                                {cleanMobileProductName}
                              </div>
                              <div className="text-[15px] sm:text-[16.5px] font-bold text-slate-700 truncate leading-snug">
                                {summaryLine}
                              </div>
                            </div>

                            {/* 우측 화살표 */}
                            <ChevronRight className="w-6 h-6 text-slate-500 shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* ==================== [PC 전용 (lg 이상): 기존 와이드 배너 + 세련된 5대 카테고리 탭 + 다중 검색 필터 + 상세 리스트] ==================== */}
            <div className="hidden lg:block space-y-6">
              {/* 비료 / 영양제 / 병해충방지제 / 씨 / 모종 페이지별 맞춤형 3D 아바타 와이드 배너 (홈과 동일한 비율 · 1376x328) */}
              <section className="rounded-3xl overflow-hidden border border-slate-200/80 shadow-xs bg-sky-100">
                <div className="relative w-full">
                  <img
                    src={
                      activeMenu === '영양제'
                        ? '/images/user-nutrient-3d-banner.jpg?v=20261109'
                        : activeMenu === '병해충관리제' || activeMenu === '병해충방지제'
                        ? '/images/user-pesticide-3d-banner.jpg?v=20261109'
                        : activeMenu === '씨'
                        ? '/images/user-schedule-request-3d-banner.jpg?v=20261109'
                        : activeMenu === '모종'
                        ? '/images/user-schedule-check-3d-banner.jpg?v=20261109'
                        : '/images/user-fertilizer-3d-banner.jpg?v=20261109'
                    }
                    alt={`${activeMenu} 페이지 전용 3D 농부 캐릭터 와이드 배너`}
                    className="w-full h-auto min-h-[140px] object-cover object-center block"
                  />
                </div>
              </section>

              {/* 주문 완료 토스트 알림 */}
              {userAgroOrderToast && (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-300 px-5 py-3.5 text-xs sm:text-sm font-extrabold text-emerald-900 flex items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{userAgroOrderToast}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setMyPageTab('ORDERS');
                        setActiveMenu('마이페이지');
                      }}
                      className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-extrabold cursor-pointer"
                    >
                      구매현황 보기 ›
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserAgroOrderToast('')}
                      className="text-emerald-700 hover:text-emerald-950 font-bold cursor-pointer"
                    >
                      닫기
                    </button>
                  </div>
                </div>
              )}

              {/* 농작물 구매: 세련된 5대 카테고리 탭 바 (비료 / 영양제 / 병해충방지제 / 씨 / 모종) */}
              <section className="bg-white rounded-3xl border border-slate-200 p-3.5 shadow-xs space-y-3">
                {/* 세련된 5분할 세그먼트 카테고리 탭 (최소 높이 슬림형) */}
                <div className="bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 grid grid-cols-5 gap-1.5">
                  {[
                    {
                      menu: '비료',
                      label: '비료',
                      eng: 'FERTILIZER',
                      desc: '밑거름 · 웃거름 · 유기질 퇴비',
                      icon: FlaskConical,
                      badgeCls: 'bg-emerald-100 text-emerald-800',
                    },
                    {
                      menu: '영양제',
                      label: '영양제',
                      eng: 'NUTRIENT',
                      desc: '칼슘 · 아미노산 · 생리활성',
                      icon: Sparkles,
                      badgeCls: 'bg-teal-100 text-teal-800',
                    },
                    {
                      menu: '병해충관리제',
                      label: '병해충방지제',
                      eng: 'PESTICIDE',
                      desc: '살균 · 살충 · 친환경 방제',
                      icon: ShieldAlert,
                      badgeCls: 'bg-rose-100 text-rose-800',
                    },
                    {
                      menu: '씨',
                      label: '씨',
                      eng: 'SEED',
                      desc: '발아보증 · 내병성 우량 종자',
                      icon: Package,
                      badgeCls: 'bg-amber-100 text-amber-800',
                    },
                    {
                      menu: '모종',
                      label: '모종',
                      eng: 'SEEDLING',
                      desc: '트레이 육묘 · 접목 건묘',
                      icon: Sprout,
                      badgeCls: 'bg-green-100 text-green-800',
                    },
                  ].map((tabItem) => {
                    const TabIcon = tabItem.icon;
                    const isCurrentTab =
                      activeMenu === tabItem.menu ||
                      ((activeMenu === '농작물 구매' || activeMenu === '농자재 판매') &&
                        tabItem.menu === '비료');
                    return (
                      <button
                        key={tabItem.menu}
                        type="button"
                        onClick={() => setActiveMenu(tabItem.menu)}
                        className={`group relative rounded-lg px-3 py-2 text-left transition-all duration-200 cursor-pointer flex items-center gap-2.5 ${
                          isCurrentTab
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-600 shadow-xs shadow-emerald-600/20'
                            : 'bg-white/80 hover:bg-white text-slate-700 border border-slate-200/70 hover:border-emerald-300 shadow-2xs'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition ${
                            isCurrentTab
                              ? 'bg-white/20 text-white shadow-inner'
                              : 'bg-slate-100 text-emerald-700 group-hover:bg-emerald-50'
                          }`}
                        >
                          <TabIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-sm font-extrabold tracking-tight truncate ${
                                isCurrentTab ? 'text-white' : 'text-slate-900'
                              }`}
                            >
                              {tabItem.label}
                            </span>
                            <span
                              className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider leading-none ${
                                isCurrentTab ? 'bg-white/20 text-white' : tabItem.badgeCls
                              }`}
                            >
                              {tabItem.eng}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2.5">
                  <div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold">
                      관리자 페이지 등록 농작물·농자재 DB 실시간 연동{loggedInUser.isLoggedIn ? ` · ${loggedInUser.name} 님 맞춤 처방` : ''}
                    </span>
                    <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1.5 flex items-center gap-2.5 flex-wrap">
                      <span>
                        {activeMenu === '영양제'
                          ? '영양제 (NUTRIENT) 전문 판매점 전체 제품 리스트'
                          : activeMenu === '병해충관리제' || activeMenu === '병해충방지제'
                          ? '병해충방지제 (PESTICIDE) 전문 판매점 전체 제품 리스트'
                          : activeMenu === '씨'
                          ? '씨 (SEED) 전문 종자 판매점 전체 제품 리스트'
                          : activeMenu === '모종'
                          ? '모종 (SEEDLING) 전문 육묘 판매점 전체 제품 리스트'
                          : '비료 (FERTILIZER) 전문 판매점 전체 제품 리스트'}
                      </span>
                      <span className="px-3 py-0.5 rounded-full text-xs sm:text-sm bg-emerald-600 text-white font-extrabold">
                        총 {userAgroResult.total}개 제품
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      {activeMenu === '씨' ? (
                        <>
                          관리자 페이지에 등록된 <strong>종자 분류 카테고리</strong>, <strong>립수·포장단위·발아율 보증(%)·발아 적온(℃)·코팅처리·파종적기·수확소요일수·내병성·품종신고번호</strong> 및 <strong>실제 종자 상품 이미지</strong>를 확인하고 검색할 수 있습니다.
                        </>
                      ) : activeMenu === '모종' ? (
                        <>
                          관리자 페이지에 등록된 <strong>모종 분류 카테고리</strong>, <strong>트레이 규격(구수/본수)·육묘일수(묘령)·접목여부·재식거리·외기순화 상태·내병성·안전배송 규격</strong> 및 <strong>실제 모종 상품 이미지</strong>를 확인하고 검색할 수 있습니다.
                        </>
                      ) : (
                        <>
                          관리자 페이지에 등록된 <strong>구분 카테고리</strong>, <strong>주요 영양소 첨가비(N·P·K·칼슘·고토·붕소·규산·유황·유기물)</strong>, <strong>100평당 권장 처방량</strong> 및 <strong>상세 이미지(총 6종)</strong>를 모두 확인하고 검색할 수 있습니다.
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* 관리자 페이지와 동일한 다중 검색 필터 바 (① 구분 카테고리, ② 친환경·유기농자재 구분, ③ 제품명·제조사·영양소·효능 키워드 검색) */}
                <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/30 p-4 sm:p-5 space-y-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-100 pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-extrabold text-xs flex items-center gap-1">
                        <Search className="w-3.5 h-3.5" />
                        {activeMenu === '영양제'
                          ? '영양제 제품'
                          : activeMenu === '병해충관리제' || activeMenu === '병해충방지제'
                          ? '병해충방지제 제품'
                          : activeMenu === '씨'
                          ? '씨 (종자) 제품'
                          : activeMenu === '모종'
                          ? '모종 (육묘) 제품'
                          : '비료 전문점 제품'}{' '}
                        다중 검색 필터
                      </span>
                      <span className="text-xs text-slate-600 font-semibold">
                        구분 카테고리 · 친환경 구분 · 제조사 · 제품명 · 주요 스펙 · 핵심 특성으로 실시간 검색합니다.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const cat = getUserAgroCategoryFromMenu(activeMenu);
                        setUserAgroMainTypeFilter('ALL');
                        setUserAgroSubTypeFilter('ALL');
                        setUserAgroOrganicFilter('ALL');
                        setUserAgroKeyword('');
                        executeUserAgroMaterialSearch({
                          category: cat,
                          main_type: 'ALL',
                          sub_type: 'ALL',
                          is_organic: 'ALL',
                          q: '',
                        });
                      }}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-extrabold text-xs flex items-center gap-1 self-start sm:self-auto transition cursor-pointer shadow-2xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      필터 초기화
                    </button>
                  </div>

                  <div className="grid sm:grid-cols-12 gap-3 text-xs">
                    {(activeMenu === '비료' || activeMenu === '농작물 구매' || activeMenu === '농자재 판매') && (
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-extrabold text-emerald-900 mb-1">
                          ① 비료 구분 카테고리 (Main-Type)
                        </label>
                        <select
                          value={userAgroMainTypeFilter}
                          onChange={(e) => {
                            const nextMain = e.target.value;
                            setUserAgroMainTypeFilter(nextMain);
                            setUserAgroSubTypeFilter('ALL');
                            executeUserAgroMaterialSearch({ main_type: nextMain, sub_type: 'ALL' });
                          }}
                          className="w-full px-3 py-2.5 rounded-xl bg-white border border-emerald-400 font-extrabold text-slate-900"
                        >
                          <option value="ALL">전체 (천연 + 화학)</option>
                          <option value="천연비료">천연비료</option>
                          <option value="화학비료">화학비료</option>
                        </select>
                      </div>
                    )}

                    {/* 세부 카테고리 (Sub-Type) */}
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-extrabold text-emerald-900 mb-1">
                        {activeMenu === '영양제'
                          ? '① 영양제 구분 카테고리 (Sub-Type)'
                          : activeMenu === '병해충관리제' || activeMenu === '병해충방지제'
                          ? '① 병해충방지제 구분 카테고리 (Sub-Type)'
                          : activeMenu === '씨'
                          ? '① 씨 (종자) 구분 카테고리 (Sub-Type)'
                          : activeMenu === '모종'
                          ? '① 모종 (육묘) 구분 카테고리 (Sub-Type)'
                          : '② 비료 세부 카테고리 (Sub-Type)'}
                      </label>
                      <select
                        value={userAgroSubTypeFilter}
                        onChange={(e) => {
                          const nextSub = e.target.value;
                          setUserAgroSubTypeFilter(nextSub);
                          executeUserAgroMaterialSearch({ sub_type: nextSub });
                        }}
                        className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-300 font-bold text-slate-900"
                      >
                        <option value="ALL">전체 세부 카테고리</option>
                        {(activeMenu === '영양제'
                          ? resolvedUserNutrientCategories
                          : activeMenu === '병해충관리제' || activeMenu === '병해충방지제'
                          ? resolvedUserPesticideCategories
                          : activeMenu === '씨'
                          ? resolvedUserSeedCategories
                          : activeMenu === '모종'
                          ? resolvedUserSeedlingCategories
                          : resolvedUserFertilizerCategories.filter((catItem: any) =>
                              userAgroMainTypeFilter === 'ALL'
                                ? true
                                : resolveFertilizerMainType(
                                    catItem.category_name || catItem.name || catItem.code,
                                    catItem.main_type
                                  ) === userAgroMainTypeFilter
                            )
                        ).map((catItem: any) => {
                          const catCode = catItem.category_code || catItem.code;
                          const catName = catItem.category_name || catItem.name;
                          return (
                            <option key={catCode} value={catName}>
                              {activeMenu === '비료' || activeMenu === '농작물 구매' || activeMenu === '농자재 판매'
                                ? `[${resolveFertilizerMainType(catName || catCode, catItem.main_type)}] ${catName}`
                                : catName}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {/* 친환경·유기농자재 구분 */}
                    <div
                      className={
                        activeMenu === '비료' || activeMenu === '농작물 구매' || activeMenu === '농자재 판매'
                          ? 'sm:col-span-2'
                          : 'sm:col-span-3'
                      }
                    >
                      <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                        {activeMenu === '비료' || activeMenu === '농작물 구매' || activeMenu === '농자재 판매'
                          ? '③ 친환경·유기농 구분'
                          : '② 친환경·유기농자재 구분'}
                      </label>
                      <select
                        value={userAgroOrganicFilter}
                        onChange={(e) => {
                          const nextOrg = e.target.value;
                          setUserAgroOrganicFilter(nextOrg);
                          executeUserAgroMaterialSearch({ is_organic: nextOrg });
                        }}
                        className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-300 font-bold text-slate-900"
                      >
                        <option value="ALL">전체 (친환경 + 일반)</option>
                        <option value="1">유기농자재 (친환경 공시)</option>
                        <option value="0">일반 화학·복합 농자재</option>
                      </select>
                    </div>

                    {/* 제품명 · 제조사 · 주요 영양소 첨가비 · 효능 검색 */}
                    <div
                      className={
                        activeMenu === '비료' || activeMenu === '농작물 구매' || activeMenu === '농자재 판매'
                          ? 'sm:col-span-5'
                          : 'sm:col-span-6'
                      }
                    >
                      <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                        {activeMenu === '비료' || activeMenu === '농작물 구매' || activeMenu === '농자재 판매'
                          ? '④ 제품명 · 제조사 · 주요 영양소 첨가비 · 효능 검색'
                          : activeMenu === '씨' || activeMenu === '모종'
                          ? '③ 품종명 · 종묘사/육묘장 · 내병성 · 규격 검색'
                          : '③ 제품명 · 제조사 · 주요 영양소 첨가비 · 효능 검색'}
                      </label>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          executeUserAgroMaterialSearch();
                        }}
                        className="flex gap-2"
                      >
                        <div className="relative flex-1">
                          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                          <input
                            type="text"
                            value={userAgroKeyword}
                            onChange={(e) => setUserAgroKeyword(e.target.value)}
                            placeholder={
                              activeMenu === '영양제'
                                ? '예: 칼슘, 붕소, 발근, 비대, 아미노산, 냉해, 광합성, 미량요소...'
                                : activeMenu === '병해충관리제' || activeMenu === '병해충방지제'
                                ? '예: 무름병, 노균병, 진딧물, 나방, 뿌리혹병, 제초제, 친환경...'
                                : activeMenu === '씨'
                                ? '예: 불암3호, 포항초, 청치마, 코팅종자, 무사마귀병, 농우바이오, 아시아종묘...'
                                : activeMenu === '모종'
                                ? '예: 불암3호 모종, 칼라탄 고추모종, 105구, 접목묘, 베니하루카, 씨감자...'
                                : '예: 슈퍼원예복합, 엔케이, 단한번, 고토석회, 유박, 대유, 남해화학, 누보...'
                            }
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white border border-slate-300 font-bold text-slate-900 placeholder-slate-400"
                          />
                        </div>
                        <button
                          type="submit"
                          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shrink-0 flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                        >
                          <Search className="w-3.5 h-3.5" />
                          검색
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* 카테고리 원클릭 빠른 필터 칩 바 */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setUserAgroSubTypeFilter('ALL');
                        executeUserAgroMaterialSearch({ sub_type: 'ALL' });
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-extrabold border transition cursor-pointer ${
                        userAgroSubTypeFilter === 'ALL'
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300'
                      }`}
                    >
                      전체 ({userAgroResult.total})
                    </button>
                    {(activeMenu === '영양제'
                      ? resolvedUserNutrientCategories
                      : activeMenu === '병해충관리제' || activeMenu === '병해충방지제'
                      ? resolvedUserPesticideCategories
                      : activeMenu === '씨'
                      ? resolvedUserSeedCategories
                      : activeMenu === '모종'
                      ? resolvedUserSeedlingCategories
                      : resolvedUserFertilizerCategories
                    ).map((catItem: any) => {
                      const catCode = catItem.category_code || catItem.code;
                      const catName = catItem.category_name || catItem.name;
                      return (
                        <button
                          key={catCode}
                          type="button"
                          onClick={() => {
                            setUserAgroSubTypeFilter(catName);
                            executeUserAgroMaterialSearch({ sub_type: catName });
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-extrabold border transition cursor-pointer ${
                            userAgroSubTypeFilter === catName
                              ? 'bg-emerald-700 text-white border-emerald-700'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300'
                          }`}
                        >
                          {catName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>

              {/* 관리자 페이지 등록 제품 전체 리스트 출력 영역 (1페이지 20개 페이징) */}
              {(() => {
                const totalItems = userAgroResult.items.length;
                const totalPages = Math.max(1, Math.ceil(totalItems / USER_AGRO_PAGE_SIZE));
                const safePage = Math.min(Math.max(1, userAgroPage), totalPages);
                const startIdx = (safePage - 1) * USER_AGRO_PAGE_SIZE;
                const pagedItems = userAgroResult.items.slice(startIdx, startIdx + USER_AGRO_PAGE_SIZE);
                const startRowNum = totalItems === 0 ? 0 : startIdx + 1;
                const endRowNum = Math.min(startIdx + USER_AGRO_PAGE_SIZE, totalItems);

                return (
                  <section className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                    {isUserAgroLoading ? (
                      <div className="py-16 text-center text-slate-500 font-extrabold text-base">
                        관리자 페이지 농자재 DB에서 {activeMenu} 제품 목록을 불러오는 중입니다...
                      </div>
                    ) : totalItems === 0 ? (
                      <div className="py-16 text-center space-y-3">
                        <div className="text-slate-700 font-black text-lg">
                          검색 조건에 일치하는 {activeMenu} 제품이 없습니다.
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const cat = getUserAgroCategoryFromMenu(activeMenu);
                            setUserAgroSubTypeFilter('ALL');
                            setUserAgroOrganicFilter('ALL');
                            setUserAgroKeyword('');
                            executeUserAgroMaterialSearch({
                              category: cat,
                              sub_type: 'ALL',
                              is_organic: 'ALL',
                              q: '',
                            });
                          }}
                          className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-base font-black cursor-pointer"
                        >
                          전체 {activeMenu} 리스트 다시 보기
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="divide-y divide-slate-200">
                          {pagedItems.map((item: any, idxOnPage: number) => {
                            const rowNumber = startIdx + idxOnPage + 1;
                            const thumbUrl =
                              item.thumbnail_url ||
                              `/api/agro-materials/image/${encodeURIComponent(item.material_id)}/thumb`;
                            const detailImgs = [
                              item.detail_image_1 ||
                                `/api/agro-materials/image/${encodeURIComponent(item.material_id)}/detail1`,
                              item.detail_image_2 ||
                                `/api/agro-materials/image/${encodeURIComponent(item.material_id)}/detail2`,
                              item.detail_image_3 ||
                                `/api/agro-materials/image/${encodeURIComponent(item.material_id)}/detail3`,
                              item.detail_image_4 ||
                                `/api/agro-materials/image/${encodeURIComponent(item.material_id)}/detail4`,
                            ];
                            return (
                              <div
                                key={item.material_id}
                                className="p-4 sm:p-6 hover:bg-emerald-50/30 transition flex flex-col lg:flex-row gap-3.5 sm:gap-5 items-stretch lg:items-center justify-between"
                              >
                                <div className="grid grid-cols-[5.25rem_minmax(0,1fr)] sm:grid-cols-[auto_7.5rem_minmax(0,1fr)] gap-x-3.5 sm:gap-x-4 gap-y-3 sm:gap-y-1.5 items-center flex-1 min-w-0 w-full">
                                  <span className="hidden sm:flex sm:row-span-2 w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-black text-sm items-center justify-center shrink-0">
                                    {rowNumber}
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedUserAgroDetail(item);
                                      setActiveUserAgroGalleryImg(detailImgs[0]);
                                    }}
                                    className="relative w-[6rem] h-[6rem] sm:w-32 sm:h-32 sm:row-span-2 rounded-2xl bg-white overflow-hidden group cursor-pointer shrink-0"
                                    title="클릭하여 상세 페이지 보기"
                                  >
                                    <img
                                      src={thumbUrl}
                                      alt={item.product_name}
                                      className="w-full h-full object-contain scale-[1.16] group-hover:scale-[1.22] transition"
                                    />
                                    <span className="sm:hidden absolute top-1.5 left-1.5 min-w-6 h-6 px-1.5 rounded-full bg-slate-900/80 text-white font-black text-xs flex items-center justify-center shadow-2xs">
                                      {rowNumber}
                                    </span>
                                    <span className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded bg-slate-900/80 text-white text-[11px] font-extrabold">
                                      상세보기
                                    </span>
                                  </button>

                                  <div className="min-w-0 self-center sm:self-end">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedUserAgroDetail(item);
                                        setActiveUserAgroGalleryImg(detailImgs[0]);
                                      }}
                                      className="hover:text-emerald-700 hover:underline text-left cursor-pointer block"
                                    >
                                      <span className="inline-block text-emerald-800 font-black text-[15px] sm:text-xl mr-1.5">
                                        [{item.manufacturer || '대유'}]
                                      </span>
                                      <span className="lg:hidden text-[18px] sm:text-[22px] font-black text-slate-950 leading-snug break-keep">
                                        {formatMobileProductName(item.product_name).replace(/(\d)-(\d)/g, '$1\u2011$2')}
                                      </span>
                                      <span className="hidden lg:inline text-[18px] sm:text-[22px] font-black text-slate-950 leading-snug break-keep">
                                        {String(item.product_name || '').replace(/(\d)-(\d)/g, '$1\u2011$2')}
                                      </span>
                                    </button>
                                  </div>

                                  <div className="col-span-2 sm:col-span-1 sm:col-start-3 sm:self-start bg-slate-50/90 sm:bg-transparent border border-slate-200/80 sm:border-0 rounded-xl sm:rounded-none px-3.5 py-2.5 sm:p-0 space-y-1.5 sm:space-y-1">
                                    <div className="flex flex-wrap items-center justify-between sm:justify-start gap-x-2.5 gap-y-1 text-[14.5px] sm:text-base">
                                      <span className="text-slate-600 font-bold whitespace-nowrap">
                                        표준소비자가격:{' '}
                                        <span className="line-through font-bold text-slate-400">
                                          ₩{Number(item.retail_price || 0).toLocaleString()}
                                        </span>
                                      </span>
                                      <span className="hidden sm:inline text-slate-300">·</span>
                                      <span className="font-extrabold text-slate-700 whitespace-nowrap">
                                        규격 {item.unit_spec || item.weight_spec || '20Kg'} ·{' '}
                                        <span className="text-emerald-700 font-black">
                                          {item.stock_status || '정상판매'}
                                        </span>
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-between sm:justify-start gap-2.5 pt-0.5 sm:pt-0">
                                      <div className="flex items-center gap-2">
                                        <span className="px-2.5 py-1 rounded-md bg-rose-100 text-rose-700 font-black text-[14px] sm:text-[15px] whitespace-nowrap">
                                          {item.discount_rate ??
                                            (item.retail_price > item.unit_price
                                              ? Number(
                                                  (
                                                    ((item.retail_price - item.unit_price) /
                                                      item.retail_price) *
                                                    100
                                                  ).toFixed(1)
                                                )
                                              : 0)}
                                          % 할인
                                        </span>
                                        <span className="text-[20px] sm:text-2xl font-black text-slate-950 tracking-tight whitespace-nowrap">
                                          ₩{Number(item.unit_price || 0).toLocaleString()}
                                        </span>
                                      </div>
                                      <span className="px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-[13.5px] sm:text-[15px] font-extrabold text-amber-800 whitespace-nowrap">
                                        적립포인트: +
                                        {Number(
                                          item.reward_points ??
                                            Math.round(Number(item.unit_price || 0) * 0.02)
                                        ).toLocaleString()}
                                        P
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* 우측: 상세 페이지 보기 / 즉시 구매 버튼 */}
                                <div className="grid grid-cols-2 sm:flex items-center justify-end w-full lg:w-auto gap-2 shrink-0 sm:border-t lg:border-t-0 sm:pt-3 lg:pt-0 border-slate-100">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedUserAgroDetail(item);
                                      setActiveUserAgroGalleryImg(detailImgs[0]);
                                    }}
                                    className="px-4 py-3 rounded-xl bg-white hover:bg-emerald-50 text-emerald-900 border border-emerald-300 font-black text-[15px] sm:text-base shadow-2xs transition cursor-pointer text-center justify-center inline-flex items-center"
                                  >
                                    상세 페이지 보기
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleQuickBuyAgroMaterial(item)}
                                    className="px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[15px] sm:text-base inline-flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                                  >
                                    <ShoppingCart className="w-4 h-4" />
                                    즉시 구매
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* 하단 1페이지 20개 기준 페이징 네비게이션 바 */}
                        <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                          <div className="text-[14.5px] sm:text-base font-extrabold text-slate-700">
                            총 <strong className="text-emerald-700 font-black">{totalItems}개</strong> {activeMenu} 제품 중{' '}
                            <strong className="text-slate-950 font-black">
                              {startRowNum}–{endRowNum}번째
                            </strong>{' '}
                            표시 · 1페이지당 {USER_AGRO_PAGE_SIZE}개 (현재 {safePage} / {totalPages} 페이지)
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              disabled={safePage <= 1}
                              onClick={() => setUserAgroPage(1)}
                              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-black text-slate-800 hover:bg-emerald-50 hover:border-emerald-300 disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition"
                            >
                              처음
                            </button>
                            <button
                              type="button"
                              disabled={safePage <= 1}
                              onClick={() => setUserAgroPage(Math.max(1, safePage - 1))}
                              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-black text-slate-800 hover:bg-emerald-50 hover:border-emerald-300 disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition"
                            >
                              이전
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pNum) => (
                              <button
                                key={pNum}
                                type="button"
                                onClick={() => setUserAgroPage(pNum)}
                                className={`min-w-9 h-9 px-3 rounded-xl text-sm font-black border transition cursor-pointer ${
                                  pNum === safePage
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                    : 'bg-white text-slate-800 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300'
                                }`}
                              >
                                {pNum}
                              </button>
                            ))}
                            <button
                              type="button"
                              disabled={safePage >= totalPages}
                              onClick={() => setUserAgroPage(Math.min(totalPages, safePage + 1))}
                              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-black text-slate-800 hover:bg-emerald-50 hover:border-emerald-300 disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition"
                            >
                              다음
                            </button>
                            <button
                              type="button"
                              disabled={safePage >= totalPages}
                              onClick={() => setUserAgroPage(totalPages)}
                              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-black text-slate-800 hover:bg-emerald-50 hover:border-emerald-300 disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition"
                            >
                              마지막
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </section>
                );
              })()}
            </div>
            {/* ==================== 유저 페이지: 농자재 상세 페이지 보기 모달 (세부이미지 4 + 제품 세부설명 이미지 1) ==================== */}
            {selectedUserAgroDetail && (
              <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
                <div className="bg-white rounded-3xl border border-emerald-200 shadow-2xl max-w-5xl w-full overflow-hidden my-8">
                  <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white px-6 py-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                          농자재 상세 정보 · Product Detail Page
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-white/15 text-emerald-200 font-mono text-[11px] font-bold">
                          {selectedUserAgroDetail.material_id}
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-extrabold mt-0.5">
                        [{selectedUserAgroDetail.sub_type}]{' '}
                        {selectedUserAgroDetail.manufacturer || '대유'}{' '}
                        {selectedUserAgroDetail.product_name}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedUserAgroDetail(null)}
                      className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-6 space-y-6 text-xs max-h-[82vh] overflow-y-auto">
                    <div className="grid lg:grid-cols-12 gap-6 items-start">
                      {/* 좌측 갤러리: 세부 이미지 4개 */}
                      <div className="lg:col-span-5 space-y-3">
                        <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-3 flex items-center justify-center h-80 overflow-hidden">
                          <img
                            src={
                              activeUserAgroGalleryImg ||
                              selectedUserAgroDetail.detail_image_1 ||
                              `/api/agro-materials/image/${encodeURIComponent(
                                selectedUserAgroDetail.material_id
                              )}/detail1`
                            }
                            alt={selectedUserAgroDetail.product_name}
                            className="max-h-full max-w-full object-contain rounded-xl"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <div className="text-[11px] font-bold text-slate-600 flex items-center justify-between">
                            <span>세부 이미지 4개 (클릭 시 확대 전환)</span>
                            <span className="text-emerald-700 font-mono">총 4장 갤러리</span>
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            {[
                              {
                                label: '세부1(성분)',
                                url:
                                  selectedUserAgroDetail.detail_image_1 ||
                                  `/api/agro-materials/image/${encodeURIComponent(
                                    selectedUserAgroDetail.material_id
                                  )}/detail1`,
                              },
                              {
                                label: '세부2(제형)',
                                url:
                                  selectedUserAgroDetail.detail_image_2 ||
                                  `/api/agro-materials/image/${encodeURIComponent(
                                    selectedUserAgroDetail.material_id
                                  )}/detail2`,
                              },
                              {
                                label: '세부3(시비)',
                                url:
                                  selectedUserAgroDetail.detail_image_3 ||
                                  `/api/agro-materials/image/${encodeURIComponent(
                                    selectedUserAgroDetail.material_id
                                  )}/detail3`,
                              },
                              {
                                label: '세부4(효과)',
                                url:
                                  selectedUserAgroDetail.detail_image_4 ||
                                  `/api/agro-materials/image/${encodeURIComponent(
                                    selectedUserAgroDetail.material_id
                                  )}/detail4`,
                              },
                            ].map((imgItem, i) => {
                              const defaultDetailUrl =
                                selectedUserAgroDetail.detail_image_1 ||
                                `/api/agro-materials/image/${encodeURIComponent(
                                  selectedUserAgroDetail.material_id
                                )}/detail1`;
                              const isCurrent =
                                (activeUserAgroGalleryImg || defaultDetailUrl) === imgItem.url;
                              return (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => setActiveUserAgroGalleryImg(imgItem.url)}
                                  className={`p-1.5 rounded-xl border-2 transition cursor-pointer bg-white ${
                                    isCurrent
                                      ? 'border-emerald-600 shadow-xs'
                                      : 'border-slate-200 hover:border-emerald-300'
                                  }`}
                                >
                                  <img
                                    src={imgItem.url}
                                    alt={imgItem.label}
                                    className="w-full h-14 object-contain rounded-lg"
                                  />
                                  <div className="text-[10px] font-bold text-center text-slate-700 mt-1 truncate">
                                    {imgItem.label}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* 우측: 제품 스펙 · 가격/할인/포인트 · 주요 영양소 첨가비 */}
                      <div className="lg:col-span-7 space-y-4">
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-extrabold">
                              {selectedUserAgroDetail.sub_type}
                            </span>
                            <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-emerald-300 font-mono font-bold">
                              카테고리코드: {selectedUserAgroDetail.category_code || 'CAT-NPK-COMP'}
                            </span>
                          </div>
                          <h4 className="text-base font-extrabold text-slate-900">
                            {selectedUserAgroDetail.product_name}
                          </h4>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                            <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                              <div className="text-[10px] font-bold text-slate-500">
                                표준소비자가격
                              </div>
                              <div className="text-sm font-bold text-slate-500 line-through mt-0.5">
                                ₩{Number(selectedUserAgroDetail.retail_price || 0).toLocaleString()}
                              </div>
                            </div>
                            <div className="bg-white p-2.5 rounded-xl border border-emerald-300">
                              <div className="text-[10px] font-bold text-emerald-800">할인가격</div>
                              <div className="text-base font-extrabold text-emerald-700 mt-0.5">
                                ₩{Number(selectedUserAgroDetail.unit_price || 0).toLocaleString()}
                              </div>
                            </div>
                            <div className="bg-white p-2.5 rounded-xl border border-rose-200">
                              <div className="text-[10px] font-bold text-rose-700">할인율</div>
                              <div className="text-base font-extrabold text-rose-600 mt-0.5">
                                {selectedUserAgroDetail.discount_rate ??
                                  (selectedUserAgroDetail.retail_price >
                                  selectedUserAgroDetail.unit_price
                                    ? Number(
                                        (
                                          ((selectedUserAgroDetail.retail_price -
                                            selectedUserAgroDetail.unit_price) /
                                            selectedUserAgroDetail.retail_price) *
                                          100
                                        ).toFixed(1)
                                      )
                                    : 0)}
                                %
                              </div>
                            </div>
                            <div className="bg-white p-2.5 rounded-xl border border-amber-200">
                              <div className="text-[10px] font-bold text-amber-800">적립포인트</div>
                              <div className="text-base font-extrabold text-amber-600 mt-0.5">
                                +
                                {Number(
                                  selectedUserAgroDetail.reward_points ??
                                    Math.round(
                                      Number(selectedUserAgroDetail.unit_price || 0) * 0.02
                                    )
                                ).toLocaleString()}
                                P
                              </div>
                            </div>
                          </div>

                          <div className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-2 gap-y-2.5 gap-x-6 text-xs">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                              <span className="font-bold text-slate-600">제조사:</span>
                              <span className="font-extrabold text-slate-900">
                                {selectedUserAgroDetail.manufacturer || '대유'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                              <span className="font-bold text-slate-600">제품코드:</span>
                              <span className="font-mono font-extrabold text-slate-900">
                                {selectedUserAgroDetail.product_code || '30001000012'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                              <span className="font-bold text-slate-600">유기농 여부:</span>
                              <span className="font-extrabold text-emerald-700">
                                {selectedUserAgroDetail.organic_label ||
                                  (selectedUserAgroDetail.is_organic ? '(유기농)' : '(비유기농)')}
                              </span>
                            </div>
                            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                              <span className="font-bold text-slate-600">무게 / 부피:</span>
                              <span className="font-extrabold text-slate-900">
                                {selectedUserAgroDetail.weight_spec || '3Kg'} /{' '}
                                {selectedUserAgroDetail.volume_spec || '0ml'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                              <span className="font-bold text-slate-600">원산지:</span>
                              <span className="font-semibold text-slate-800">
                                {selectedUserAgroDetail.origin_country || '대한민국 (국산)'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                              <span className="font-bold text-slate-600">연락처:</span>
                              <span className="font-mono font-semibold text-slate-800">
                                {selectedUserAgroDetail.contact_phone || '1588-2026'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* 품목 구분별 핵심 유효성분 / 생리활성성분 / 보증성분 / 종자·모종 상세 테이블 */}
                        {selectedUserAgroDetail.material_category === 'SEED' ? (
                          <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 space-y-2.5">
                            <div className="font-extrabold text-emerald-950 text-sm flex items-center justify-between">
                              <span>씨(종자) 전문 쇼핑몰 표준 품질보증 스펙 · 재배작형 기준</span>
                              <span className="text-[11px] font-bold text-emerald-700">
                                종자산업법 품질표시 및 품종신고 기준
                              </span>
                            </div>
                            <div className="text-xs font-bold text-emerald-900 bg-white px-3 py-2 rounded-xl border border-emerald-200">
                              {selectedUserAgroDetail.nutrient_ratio_summary ||
                                `${selectedUserAgroDetail.seed_count_spec || ''} · 발아율 ${
                                  selectedUserAgroDetail.germination_rate_pct || '85% 이상'
                                } · 발아적온 ${selectedUserAgroDetail.germination_temp_spec || '18~25℃'}`}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                              <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
                                <div className="text-[10px] text-slate-500 font-bold">
                                  립수 · 포장단위 규격
                                </div>
                                <div className="font-extrabold text-emerald-800 text-xs mt-0.5">
                                  {selectedUserAgroDetail.seed_count_spec ||
                                    selectedUserAgroDetail.unit_spec ||
                                    '2,000립 / 1봉'}
                                </div>
                              </div>
                              <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
                                <div className="text-[10px] text-slate-500 font-bold">
                                  발아율 보증 (%) · 발아 적온 (℃)
                                </div>
                                <div className="font-extrabold text-sky-800 text-xs mt-0.5">
                                  발아율 {selectedUserAgroDetail.germination_rate_pct || '85% 이상'} · 적온{' '}
                                  {selectedUserAgroDetail.germination_temp_spec || '18~25℃'}
                                </div>
                              </div>
                              <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
                                <div className="text-[10px] text-slate-500 font-bold">
                                  종자 소독 · 코팅 처리
                                </div>
                                <div className="font-extrabold text-purple-800 text-xs mt-0.5">
                                  {selectedUserAgroDetail.seed_coating_spec || '필름코팅 / 약제소독필'}
                                </div>
                              </div>
                              <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
                                <div className="text-[10px] text-slate-500 font-bold">
                                  품종 생산·수입 판매신고번호
                                </div>
                                <div className="font-extrabold text-slate-800 text-xs mt-0.5">
                                  {selectedUserAgroDetail.variety_reg_no || '국립종자원 신고품종'}
                                </div>
                              </div>
                              <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
                                <div className="text-[10px] text-slate-500 font-bold">
                                  파종 적기 · 재배 작형
                                </div>
                                <div className="font-extrabold text-teal-800 text-xs mt-0.5">
                                  {selectedUserAgroDetail.sowing_period_spec || '작형별 적기 파종'}
                                </div>
                              </div>
                              <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
                                <div className="text-[10px] text-slate-500 font-bold">
                                  수확 소요일수 (숙기)
                                </div>
                                <div className="font-extrabold text-amber-800 text-xs mt-0.5">
                                  {selectedUserAgroDetail.days_to_harvest_spec || '파종/정식 후 65~75일'}
                                </div>
                              </div>
                              <div className="bg-white p-2.5 rounded-xl border border-emerald-200 sm:col-span-2">
                                <div className="text-[10px] text-slate-500 font-bold">
                                  내병성 · 품종 핵심 특성
                                </div>
                                <div className="font-extrabold text-rose-800 text-xs mt-0.5">
                                  {selectedUserAgroDetail.disease_resistance_spec ||
                                    selectedUserAgroDetail.target_nutrient_or_pest}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : selectedUserAgroDetail.material_category === 'SEEDLING' ? (
                          <div className="bg-teal-50/70 p-4 rounded-2xl border border-teal-200 space-y-2.5">
                            <div className="font-extrabold text-teal-950 text-sm flex items-center justify-between">
                              <span>모종(육묘) 전문 쇼핑몰 표준 규격 · 정식 재배 기준</span>
                              <span className="text-[11px] font-bold text-teal-700">
                                전문 육묘장 건묘 출하 품질 기준
                              </span>
                            </div>
                            <div className="text-xs font-bold text-teal-900 bg-white px-3 py-2 rounded-xl border border-teal-200">
                              {selectedUserAgroDetail.nutrient_ratio_summary ||
                                `${selectedUserAgroDetail.plug_tray_spec || ''} · ${
                                  selectedUserAgroDetail.seedling_age_spec || ''
                                } · ${selectedUserAgroDetail.grafting_type_spec || ''}`}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                              <div className="bg-white p-2.5 rounded-xl border border-teal-200">
                                <div className="text-[10px] text-slate-500 font-bold">
                                  트레이 규격 (구수 / 본수)
                                </div>
                                <div className="font-extrabold text-emerald-800 text-xs mt-0.5">
                                  {selectedUserAgroDetail.plug_tray_spec ||
                                    selectedUserAgroDetail.unit_spec ||
                                    '105구 트레이'}
                                </div>
                              </div>
                              <div className="bg-white p-2.5 rounded-xl border border-teal-200">
                                <div className="text-[10px] text-slate-500 font-bold">
                                  육묘 일수 · 묘령 (본엽 매수)
                                </div>
                                <div className="font-extrabold text-sky-800 text-xs mt-0.5">
                                  {selectedUserAgroDetail.seedling_age_spec || '본엽 4~5매 A급 건묘'}
                                </div>
                              </div>
                              <div className="bg-white p-2.5 rounded-xl border border-teal-200">
                                <div className="text-[10px] text-slate-500 font-bold">
                                  접목 여부 · 육묘 방식
                                </div>
                                <div className="font-extrabold text-purple-800 text-xs mt-0.5">
                                  {selectedUserAgroDetail.grafting_type_spec || '실생 프러그묘'}
                                </div>
                              </div>
                              <div className="bg-white p-2.5 rounded-xl border border-teal-200">
                                <div className="text-[10px] text-slate-500 font-bold">
                                  권장 재식 거리 (주간 × 이랑)
                                </div>
                                <div className="font-extrabold text-amber-800 text-xs mt-0.5">
                                  {selectedUserAgroDetail.planting_distance_spec ||
                                    '이랑 60~70cm × 주간 35~40cm'}
                                </div>
                              </div>
                              <div className="bg-white p-2.5 rounded-xl border border-teal-200">
                                <div className="text-[10px] text-slate-500 font-bold">
                                  외기 순화 (Hardening) · 뿌리돌림 상태
                                </div>
                                <div className="font-extrabold text-teal-800 text-xs mt-0.5">
                                  {selectedUserAgroDetail.hardening_spec ||
                                    '출하 전 노지 순화 및 뿌리돌림 완료'}
                                </div>
                              </div>
                              <div className="bg-white p-2.5 rounded-xl border border-teal-200">
                                <div className="text-[10px] text-slate-500 font-bold">
                                  안전 배송 포장 규격
                                </div>
                                <div className="font-extrabold text-slate-800 text-xs mt-0.5">
                                  {selectedUserAgroDetail.shipping_pack_spec ||
                                    '모종 전용 숨구멍 고정 박스 안전배송'}
                                </div>
                              </div>
                              <div className="bg-white p-2.5 rounded-xl border border-teal-200 sm:col-span-2">
                                <div className="text-[10px] text-slate-500 font-bold">
                                  내병성 · 품종 핵심 특성
                                </div>
                                <div className="font-extrabold text-rose-800 text-xs mt-0.5">
                                  {selectedUserAgroDetail.disease_resistance_spec ||
                                    selectedUserAgroDetail.target_nutrient_or_pest}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : selectedUserAgroDetail.material_category === 'PESTICIDE' ? (
                          <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-200 space-y-2.5">
                            <div className="font-extrabold text-rose-950 text-sm flex items-center justify-between">
                              <span>병해충관리제 유효성분 · 작용기작 · PLS 안전사용기준</span>
                              <span className="text-[11px] font-bold text-rose-700">
                                농촌진흥청 농약안전정보시스템 / PLS 기준
                              </span>
                            </div>
                            <div className="text-xs font-bold text-rose-900 bg-white px-3 py-2 rounded-xl border border-rose-200">
                              {selectedUserAgroDetail.nutrient_ratio_summary ||
                                selectedUserAgroDetail.active_ingredient ||
                                '유효성분 및 PLS 방제 정보'}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                              <div className="bg-white p-2.5 rounded-xl border border-rose-200">
                                <div className="text-[10px] text-slate-500 font-bold">
                                  유효성분 및 함량
                                </div>
                                <div className="font-extrabold text-rose-800 text-xs mt-0.5">
                                  {selectedUserAgroDetail.active_ingredient || '상세 요약 참조'}
                                </div>
                              </div>
                              <div className="bg-white p-2.5 rounded-xl border border-rose-200">
                                <div className="text-[10px] text-slate-500 font-bold">
                                  작용기작 그룹코드 (저항성 교호살포 기호)
                                </div>
                                <div className="font-extrabold text-purple-800 text-xs mt-0.5">
                                  {selectedUserAgroDetail.moa_group_code || '복합/미분류'}
                                </div>
                              </div>
                              <div className="bg-white p-2.5 rounded-xl border border-rose-200">
                                <div className="text-[10px] text-slate-500 font-bold">
                                  농약 품목등록번호 / 유기농업자재 공시번호
                                </div>
                                <div className="font-extrabold text-slate-800 text-xs mt-0.5">
                                  {selectedUserAgroDetail.pesticide_reg_no || '농진청 등록품목'}
                                </div>
                              </div>
                              <div className="bg-white p-2.5 rounded-xl border border-rose-200">
                                <div className="text-[10px] text-slate-500 font-bold">
                                  PLS 안전사용기준 (수확 전 일수 / 최대 횟수)
                                </div>
                                <div className="font-extrabold text-amber-800 text-xs mt-0.5">
                                  {Number(selectedUserAgroDetail.safety_phi_days) > 0
                                    ? `수확 ${selectedUserAgroDetail.safety_phi_days}일 전까지`
                                    : '수확 전 제한 없음 (친환경/유기농자재)'}{' '}
                                  ·{' '}
                                  {Number(selectedUserAgroDetail.safety_max_count) > 0
                                    ? `${selectedUserAgroDetail.safety_max_count}회 이내`
                                    : '발생 시 적기 살포'}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : selectedUserAgroDetail.material_category === 'NUTRIENT' ? (
                          <div className="bg-sky-50/70 p-4 rounded-2xl border border-sky-200 space-y-2.5">
                            <div className="font-extrabold text-sky-950 text-sm flex items-center justify-between">
                              <span>생리활성 기능성분 · 킬레이트 미량요소 · 수용성 무기성분</span>
                              <span className="text-[11px] font-bold text-sky-700">
                                기능성 생리활성 영양제 규격
                              </span>
                            </div>
                            <div className="text-xs font-bold text-sky-900 bg-white px-3 py-2 rounded-xl border border-sky-200">
                              {selectedUserAgroDetail.nutrient_ratio_summary ||
                                `유리아미노산 ${selectedUserAgroDetail.amino_acid_pct ?? 0}% · 해조/풀빅산 ${
                                  selectedUserAgroDetail.seaweed_humic_pct ?? 0
                                }% · Ca ${selectedUserAgroDetail.ca_pct ?? 0}% · B ${
                                  selectedUserAgroDetail.b_pct ?? 0
                                }%`}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                              <div className="bg-white p-2.5 rounded-xl border border-sky-200">
                                <div className="text-[10px] text-slate-500 font-bold">
                                  유리아미노산
                                </div>
                                <div className="font-extrabold text-sky-700 text-sm mt-0.5">
                                  {selectedUserAgroDetail.amino_acid_pct ?? 0}%
                                </div>
                              </div>
                              <div className="bg-white p-2.5 rounded-xl border border-sky-200">
                                <div className="text-[10px] text-slate-500 font-bold">
                                  해조추출물·풀빅산
                                </div>
                                <div className="font-extrabold text-teal-700 text-sm mt-0.5">
                                  {selectedUserAgroDetail.seaweed_humic_pct ?? 0}%
                                </div>
                              </div>
                              <div className="bg-white p-2.5 rounded-xl border border-sky-200">
                                <div className="text-[10px] text-slate-500 font-bold">
                                  수용성 칼슘(Ca)
                                </div>
                                <div className="font-extrabold text-emerald-700 text-sm mt-0.5">
                                  {selectedUserAgroDetail.ca_pct ?? 0}%
                                </div>
                              </div>
                              <div className="bg-white p-2.5 rounded-xl border border-sky-200">
                                <div className="text-[10px] text-slate-500 font-bold">
                                  수용성 붕소(B)
                                </div>
                                <div className="font-extrabold text-pink-700 text-sm mt-0.5">
                                  {selectedUserAgroDetail.b_pct ?? 0}%
                                </div>
                              </div>
                              <div className="bg-white p-2.5 rounded-xl border border-sky-200">
                                <div className="text-[10px] text-slate-500 font-bold">
                                  수용성 고토(Mg)
                                </div>
                                <div className="font-extrabold text-purple-700 text-sm mt-0.5">
                                  {selectedUserAgroDetail.mg_pct ?? 0}%
                                </div>
                              </div>
                              <div className="bg-white p-2.5 rounded-xl border border-sky-200">
                                <div className="text-[10px] text-slate-500 font-bold">
                                  수용성 N·P·K
                                </div>
                                <div className="font-extrabold text-amber-700 text-xs mt-1">
                                  {selectedUserAgroDetail.n_pct ?? 0}-
                                  {selectedUserAgroDetail.p_pct ?? 0}-
                                  {selectedUserAgroDetail.k_pct ?? 0}%
                                </div>
                              </div>
                              <div className="bg-white p-2.5 rounded-xl border border-sky-200 col-span-2 text-left">
                                <div className="text-[10px] text-slate-500 font-bold">
                                  킬레이트 미량요소 (Fe·Zn·Mn·Mo)
                                </div>
                                <div className="font-extrabold text-slate-800 text-xs mt-0.5 truncate">
                                  {selectedUserAgroDetail.chelate_micro_summary ||
                                    'EDTA 킬레이트 미량요소 복합 함유'}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200 space-y-2.5">
                            <div className="font-extrabold text-emerald-950 text-sm flex items-center justify-between">
                              <span>주요 영양소 첨가비 (보증성분 함량 %)</span>
                              <span className="text-[11px] font-bold text-emerald-700">
                                농촌진흥청 비료 공정규격 기준
                              </span>
                            </div>
                            <div className="text-xs font-bold text-emerald-900 bg-white px-3 py-2 rounded-xl border border-emerald-200">
                              {selectedUserAgroDetail.nutrient_ratio_summary ||
                                `N ${selectedUserAgroDetail.n_pct ?? 0}% · P ${
                                  selectedUserAgroDetail.p_pct ?? 0
                                }% · K ${selectedUserAgroDetail.k_pct ?? 0}%`}
                            </div>
                            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center">
                              <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
                                <div className="text-[10px] text-slate-500 font-bold">질소 (N)</div>
                                <div className="font-extrabold text-sky-700 text-sm mt-0.5">
                                  {selectedUserAgroDetail.n_pct ?? 0}%
                                </div>
                              </div>
                              <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
                                <div className="text-[10px] text-slate-500 font-bold">
                                  인산 (P₂O₅)
                                </div>
                                <div className="font-extrabold text-orange-600 text-sm mt-0.5">
                                  {selectedUserAgroDetail.p_pct ?? 0}%
                                </div>
                              </div>
                              <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
                                <div className="text-[10px] text-slate-500 font-bold">
                                  칼륨 (K₂O)
                                </div>
                                <div className="font-extrabold text-amber-600 text-sm mt-0.5">
                                  {selectedUserAgroDetail.k_pct ?? 0}%
                                </div>
                              </div>
                              <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
                                <div className="text-[10px] text-slate-500 font-bold">
                                  칼슘 (CaO)
                                </div>
                                <div className="font-extrabold text-emerald-700 text-sm mt-0.5">
                                  {selectedUserAgroDetail.ca_pct ?? 0}%
                                </div>
                              </div>
                              <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
                                <div className="text-[10px] text-slate-500 font-bold">
                                  고토 (MgO)
                                </div>
                                <div className="font-extrabold text-purple-700 text-sm mt-0.5">
                                  {selectedUserAgroDetail.mg_pct ?? 0}%
                                </div>
                              </div>
                              <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
                                <div className="text-[10px] text-slate-500 font-bold">
                                  붕소 (B₂O₃)
                                </div>
                                <div className="font-extrabold text-pink-700 text-sm mt-0.5">
                                  {selectedUserAgroDetail.b_pct ?? 0}%
                                </div>
                              </div>
                              <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
                                <div className="text-[10px] text-slate-500 font-bold">
                                  규산 (SiO₂)
                                </div>
                                <div className="font-extrabold text-teal-700 text-sm mt-0.5">
                                  {selectedUserAgroDetail.sio2_pct ?? 0}%
                                </div>
                              </div>
                              <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
                                <div className="text-[10px] text-slate-500 font-bold">유황 (S)</div>
                                <div className="font-extrabold text-yellow-700 text-sm mt-0.5">
                                  {selectedUserAgroDetail.s_pct ?? 0}%
                                </div>
                              </div>
                              <div className="bg-white p-2.5 rounded-xl border border-emerald-200 col-span-2 sm:col-span-1">
                                <div className="text-[10px] text-slate-500 font-bold">
                                  유기물 (OM)
                                </div>
                                <div className="font-extrabold text-stone-800 text-sm mt-0.5">
                                  {selectedUserAgroDetail.om_pct ?? 0}%
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 시비량·희석배수 및 생육단계 정보 */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
                          {selectedUserAgroDetail.application_method && (
                            <div>
                              <span className="text-slate-500 font-bold">
                                {selectedUserAgroDetail.material_category === 'PESTICIDE'
                                  ? '살포 방식 및 혼용 기준: '
                                  : selectedUserAgroDetail.material_category === 'NUTRIENT'
                                  ? '권장 처리 방식 (엽면/관주): '
                                  : '시비 방법: '}
                              </span>
                              <span className="font-extrabold text-indigo-800">
                                {selectedUserAgroDetail.application_method}
                                {selectedUserAgroDetail.material_category === 'FERTILIZER' &&
                                selectedUserAgroDetail.release_duration
                                  ? ` · ${selectedUserAgroDetail.release_duration}`
                                  : ''}
                              </span>
                            </div>
                          )}
                          {selectedUserAgroDetail.dilution_ratio &&
                            selectedUserAgroDetail.material_category !== 'FERTILIZER' && (
                              <div>
                                <span className="text-slate-500 font-bold">
                                  표준 희석배수 (물 20L 기준):{' '}
                                </span>
                                <span className="font-extrabold text-sky-800">
                                  {selectedUserAgroDetail.dilution_ratio}
                                </span>
                              </div>
                            )}
                          {selectedUserAgroDetail.stress_target &&
                            selectedUserAgroDetail.material_category === 'NUTRIENT' && (
                              <div>
                                <span className="text-slate-500 font-bold">
                                  타깃 생리장해·스트레스:{' '}
                                </span>
                                <span className="font-extrabold text-teal-800">
                                  {selectedUserAgroDetail.stress_target}
                                </span>
                              </div>
                            )}
                          <div>
                            <span className="text-slate-500 font-bold">
                              100평(330㎡) 권장 사용량:{' '}
                            </span>
                            <span className="font-extrabold text-emerald-800">
                              {selectedUserAgroDetail.dosage_per_100pyeong}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 font-bold">
                              {selectedUserAgroDetail.material_category === 'PESTICIDE'
                                ? '방제 대상 병해충·잡초: '
                                : '핵심 효능 및 대상 작물: '}
                            </span>
                            <span className="font-bold text-slate-900">
                              {selectedUserAgroDetail.target_nutrient_or_pest}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 font-bold">적용 생육단계: </span>
                            <span className="font-semibold text-slate-800">
                              {selectedUserAgroDetail.usage_stage}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 font-bold">
                              기상·토양 처방 트리거:{' '}
                            </span>
                            <span className="font-semibold text-slate-700">
                              {selectedUserAgroDetail.weather_trigger}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 하단 전체폭: 제품 세부설명용 상세 이미지 1개 */}
                    <div className="bg-slate-900 rounded-2xl p-5 space-y-3">
                      <div className="flex items-center justify-between text-white">
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                            Product Detailed Description Image
                          </span>
                          <h4 className="text-sm font-extrabold mt-0.5">
                            제품 세부설명용 상세 이미지 — 영양소 첨가비 · 작물별 시비 기준 · 취급 주의사항
                          </h4>
                        </div>
                      </div>
                      <div className="bg-white rounded-xl overflow-hidden border border-slate-700 flex justify-center p-2">
                        <img
                          src={
                            selectedUserAgroDetail.description_banner_url ||
                            `/api/agro-materials/image/${encodeURIComponent(
                              selectedUserAgroDetail.material_id
                            )}/desc`
                          }
                          alt={`${selectedUserAgroDetail.product_name} 제품 세부설명 이미지`}
                          className="w-full max-w-3xl h-auto object-contain rounded-lg"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
                    <div className="text-xs font-bold text-slate-600">
                      입금 지정계좌: <span className="text-emerald-800 font-extrabold">{primaryBankAccount.bank_name} {primaryBankAccount.account_number}</span> ({primaryBankAccount.account_holder})
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          handleQuickBuyAgroMaterial(selectedUserAgroDetail);
                          setSelectedUserAgroDetail(null);
                        }}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <ShoppingCart className="w-4 h-4" />이 제품 바로 구매하기
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedUserAgroDetail(null)}
                        className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs cursor-pointer"
                      >
                        닫기
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== [탭 7: 마이페이지 (좌측: 메뉴 영역 / 우측: 선택 메뉴 관련 내용 영역)] ==================== */}
        {activeMenu === '마이페이지' && (
          <div className="space-y-6">
            {/* 마이페이지 전용 3D 아바타 와이드 배너 (홈과 동일한 비율 · 1376x328) */}
            <section className="rounded-3xl overflow-hidden border border-slate-200/80 shadow-xs bg-sky-100">
              <div className="relative w-full">
                <img
                  src="/images/user-schedule-check-3d-banner.jpg?v=20261109"
                  alt="내 농장과 재배작물·농자재 구매현황을 관리하는 3D 농부 캐릭터 배너"
                  className="w-full h-auto min-h-[140px] object-cover object-center block"
                />
              </div>
            </section>

            {/* 모바일 전용: 좌측 슬라이드 메뉴 열기 상단 컨트롤 바 */}
            <div className="lg:hidden flex items-center justify-between gap-2 bg-white rounded-2xl border border-slate-200 px-3.5 py-3 shadow-xs">
              <button
                type="button"
                onClick={() => setIsMyPageMobileDrawerOpen(true)}
                className="inline-flex items-center gap-2.5 px-4 py-3 min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold shadow-xs cursor-pointer transition shrink-0"
              >
                <span className="flex flex-col gap-1 w-4" aria-hidden="true">
                  <span className="block h-0.5 w-full bg-white rounded-full" />
                  <span className="block h-0.5 w-full bg-white rounded-full" />
                  <span className="block h-0.5 w-full bg-white rounded-full" />
                </span>
                <span>마이페이지 메뉴</span>
              </button>
              <div className="min-w-0 flex-1 text-right">
                <div className="text-[11px] font-bold text-slate-500">현재 선택 메뉴</div>
                <div className="text-xs font-extrabold text-emerald-700 truncate">
                  {myPageTab === 'FARMLAND'
                    ? '① 내 재배지 등록 · 관리'
                    : myPageTab === 'CROPS'
                    ? '② 내 재배작물 등록'
                    : myPageTab === 'PROGRESS'
                    ? '③ 작물재배현황 및 진행율'
                    : myPageTab === 'ORDERS'
                    ? '④ 농자재 구매현황'
                    : myPageTab === 'PROFILE'
                    ? '⑤ 회원 기본정보 관리'
                    : '전체 항목 한눈에 보기'}
                </div>
              </div>
            </div>

            {/* 모바일 좌측 슬라이드 드로어 배경 오버레이 */}
            {isMyPageMobileDrawerOpen && (
              <div
                onClick={() => setIsMyPageMobileDrawerOpen(false)}
                className="fixed inset-0 z-40 bg-slate-900/45 backdrop-blur-[1px] lg:hidden transition-opacity"
                aria-hidden="true"
              />
            )}

            {/* 좌측 메뉴 영역 (모바일: 좌측 슬라이드 드로어 / PC: 고정 사이드바) + 우측 관련 내용 영역 */}
            <div className="flex flex-col lg:flex-row gap-6 items-start">
              {/* ==================== [좌측 영역: 마이페이지 메뉴 사이드바] ==================== */}
              <aside
                className={`fixed inset-y-0 left-0 z-50 w-[300px] sm:w-[320px] max-w-[86vw] bg-slate-50 p-4 overflow-y-auto shadow-2xl border-r border-slate-200 transition-transform duration-300 ease-in-out lg:static lg:z-auto lg:w-[310px] xl:w-[330px] lg:max-w-none lg:bg-transparent lg:p-0 lg:overflow-visible lg:shadow-none lg:border-0 shrink-0 space-y-4 lg:sticky lg:top-24 ${
                  isMyPageMobileDrawerOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
                }`}
              >
                {/* 모바일 슬라이드 드로어 상단 닫기 헤더 */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 lg:hidden">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                    <span className="text-sm font-extrabold text-slate-900">마이페이지 메뉴</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMyPageMobileDrawerOpen(false)}
                    aria-label="메뉴 닫기"
                    className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* 좌측 마이페이지 전용 네비게이션 메뉴 */}
                <nav
                  aria-label="마이페이지 메뉴"
                  className="bg-white rounded-3xl border border-slate-200 p-3 shadow-xs space-y-1.5"
                >
                  <div className="px-3 py-2 flex items-center justify-between border-b border-slate-100 mb-1">
                    <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                      마이페이지 메뉴
                    </span>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      6개 항목
                    </span>
                  </div>

                  {[
                    {
                      code: 'FARMLAND',
                      title: '① 내 재배지 등록 · 관리',
                      desc: '관리자 재배지 DB 검색 · 농지 등록',
                      badge: `${myFarmlands.length}곳`,
                      icon: MapPin,
                    },
                    {
                      code: 'CROPS',
                      title: '② 내 재배작물 등록',
                      desc: '모종·씨 다품종 복수 작물 등록',
                      badge: `${cloudBaeCropList.length}건`,
                      icon: Sprout,
                    },
                    {
                      code: 'PROGRESS',
                      title: '③ 작물재배현황 및 진행율',
                      desc: '실시간 생육단계 · 적산온도(PGDD)',
                      badge: `${
                        cloudBaeCropList.length > 0
                          ? Math.round(
                              cloudBaeCropList.reduce(
                                (s: number, c: any) => s + Number(c.progress_pct || 0),
                                0
                              ) / cloudBaeCropList.length
                            )
                          : 0
                      }%`,
                      icon: Calendar,
                    },
                    {
                      code: 'ORDERS',
                      title: '④ 농자재 구매현황',
                      desc: '생육단계별 원클릭 주문 · 배송 관제',
                      badge: `${myOrders.length}건`,
                      icon: ShoppingBag,
                    },
                    {
                      code: 'PROFILE',
                      title: '⑤ 회원 기본정보 관리',
                      desc: '이메일 · 이름 · 성별 · 도로명주소',
                      badge: '내 정보',
                      icon: User,
                    },
                    {
                      code: 'ALL',
                      title: '전체 항목 한눈에 보기',
                      desc: '마이페이지 모든 섹션 통합 조회',
                      badge: '통합',
                      icon: Layers,
                    },
                  ].map((item) => {
                    const IconComp = item.icon;
                    const isSelected = myPageTab === item.code;
                    return (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => {
                          setMyPageTab(item.code as any);
                          setIsMyPageMobileDrawerOpen(false);
                        }}
                        className={`w-full text-left px-3.5 py-4 lg:py-3 min-h-[76px] lg:min-h-0 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-white hover:bg-slate-50 text-slate-800 border-transparent hover:border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'bg-white/20 text-white'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            }`}
                          >
                            <IconComp className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div
                              className={`text-xs sm:text-sm font-extrabold truncate ${
                                isSelected ? 'text-white' : 'text-slate-900'
                              }`}
                            >
                              {item.title}
                            </div>
                            <div
                              className={`text-[11px] truncate mt-0.5 ${
                                isSelected ? 'text-emerald-100 font-medium' : 'text-slate-500 font-medium'
                              }`}
                            >
                              {item.desc}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[11px] font-extrabold shrink-0 ${
                            isSelected
                              ? 'bg-white text-emerald-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {item.badge}
                        </span>
                      </button>
                    );
                  })}
                </nav>

                {/* 3. 좌측 하단 내 농장 현황 요약 & 빠른 이동 */}
                <div className="bg-slate-900 text-white rounded-3xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-emerald-400">
                      내 농장 누적 요약
                    </span>
                    <span className="text-[11px] text-slate-400 font-semibold">실시간 연동</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div className="rounded-2xl bg-white/10 p-3">
                      <div className="text-slate-300 text-[11px]">총 등록 재배면적</div>
                      <div className="text-base font-extrabold text-white mt-0.5">
                        {myFarmlands
                          .reduce((s: number, f: any) => s + Number(f.area_pyeong || 0), 0)
                          .toLocaleString()}
                        평
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white/10 p-3">
                      <div className="text-slate-300 text-[11px]">누적 농자재 구매</div>
                      <div className="text-base font-extrabold text-emerald-300 mt-0.5">
                        {myOrders
                          .reduce((s: number, o: any) => s + Number(o.final_total || 0), 0)
                          .toLocaleString()}
                        원
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMyPageMobileDrawerOpen(false);
                      setActiveMenu('재배일정 확인');
                      setMobileScheduleStep('list');
                    }}
                    className="w-full py-2.5 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center justify-between cursor-pointer transition"
                  >
                    <span>48주 재배일정 확인 바로가기</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </aside>

              {/* ==================== [우측 영역: 선택된 메뉴의 관련 내용] ==================== */}
              <div className="flex-1 min-w-0 w-full space-y-5">
                {myPageToast && (
                  <div className="rounded-2xl bg-emerald-50 border border-emerald-300 px-4 py-3 text-xs sm:text-sm font-extrabold text-emerald-900 flex items-center justify-between gap-2 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{myPageToast}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMyPageToast('')}
                      className="text-emerald-700 hover:text-emerald-950 font-bold cursor-pointer"
                    >
                      닫기
                    </button>
                  </div>
                )}

                {/* 우측 상단 4대 핵심 현황 KPI 요약 카드 (클릭 시 해당 메뉴 내용으로 즉시 전환) */}
                <section className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-xs">
                  <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                    <button
                      type="button"
                      onClick={() => setMyPageTab('FARMLAND')}
                      className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                        myPageTab === 'FARMLAND'
                          ? 'border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600'
                          : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-500">① 등록 재배지</div>
                      <div className="text-xl font-extrabold text-slate-900 mt-1">
                        {myFarmlands.length}곳
                      </div>
                      <div className="text-[11px] text-emerald-700 font-bold mt-0.5">
                        총{' '}
                        {myFarmlands
                          .reduce((s: number, f: any) => s + Number(f.area_pyeong || 0), 0)
                          .toLocaleString()}
                        평 경작중
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMyPageTab('CROPS')}
                      className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                        myPageTab === 'CROPS'
                          ? 'border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600'
                          : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-500">② 내 재배작물 등록</div>
                      <div className="text-xl font-extrabold text-slate-900 mt-1">
                        {cloudBaeCropList.length}건
                      </div>
                      <div className="text-[11px] text-emerald-700 font-bold mt-0.5">
                        모종·씨 복수 등록 지원
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMyPageTab('PROGRESS')}
                      className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                        myPageTab === 'PROGRESS'
                          ? 'border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600'
                          : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-500">③ 평균 재배 진행율</div>
                      <div className="text-xl font-extrabold text-emerald-700 mt-1">
                        {cloudBaeCropList.length > 0
                          ? Math.round(
                              cloudBaeCropList.reduce(
                                (s: number, c: any) => s + Number(c.progress_pct || 0),
                                0
                              ) / cloudBaeCropList.length
                            )
                          : 0}
                        %
                      </div>
                      <div className="text-[11px] text-slate-600 font-semibold mt-0.5">
                        48주 생육 타임라인 연동
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMyPageTab('ORDERS')}
                      className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                        myPageTab === 'ORDERS'
                          ? 'border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600'
                          : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-500">④ 농자재 구매현황</div>
                      <div className="text-xl font-extrabold text-slate-900 mt-1">
                        {myOrders.length}건
                      </div>
                      <div className="text-[11px] text-emerald-700 font-bold mt-0.5">
                        누적{' '}
                        {myOrders
                          .reduce((s: number, o: any) => s + Number(o.final_total || 0), 0)
                          .toLocaleString()}
                        원
                      </div>
                    </button>
                  </div>
                </section>

            {/* ⑤ 회원 기본정보 수정 섹션 */}
            {(myPageTab === 'PROFILE' || myPageTab === 'ALL') && (
              <section className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                      내 기본 회원정보 (이메일 · 이름 · 성별 · 출생년월일 · 나이 · 도로명주소)
                    </h3>
                    <p className="text-xs text-slate-600">
                      회원가입 기본항목 정보를 확인하고 수정할 수 있습니다.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveMemberProfile}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold cursor-pointer"
                  >
                    변경사항 저장
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-2xl bg-slate-50/70 border border-slate-200/80">
                    <label className="font-bold text-slate-700 sm:w-40 shrink-0">이메일 계정 (ID)</label>
                    <input
                      type="text"
                      value={loggedInUser.email}
                      disabled
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-700 font-bold"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-2xl bg-slate-50/70 border border-slate-200/80">
                    <label className="font-bold text-slate-700 sm:w-40 shrink-0">이름</label>
                    <input
                      type="text"
                      value={loggedInUser.name}
                      onChange={(e) => setLoggedInUser({ ...loggedInUser, name: e.target.value })}
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-2xl bg-slate-50/70 border border-slate-200/80">
                    <label className="font-bold text-slate-700 sm:w-40 shrink-0">성별</label>
                    <div className="flex-1 grid grid-cols-2 gap-2 max-w-xs">
                      {(['남성', '여성'] as const).map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setLoggedInUser({ ...loggedInUser, gender: g })}
                          className={`py-2.5 rounded-xl border font-extrabold cursor-pointer ${
                            loggedInUser.gender === g
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                              : 'border-slate-300 bg-white text-slate-700'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-2xl bg-slate-50/70 border border-slate-200/80">
                    <label className="font-bold text-slate-700 sm:w-40 shrink-0">출생년월일</label>
                    <input
                      type="date"
                      value={loggedInUser.birth_date}
                      onChange={(e) => {
                        const bd = e.target.value;
                        setLoggedInUser({
                          ...loggedInUser,
                          birth_date: bd,
                          age: calcAgeFromBirthDate(bd),
                        });
                      }}
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-2xl bg-slate-50/70 border border-slate-200/80">
                    <label className="font-bold text-slate-700 sm:w-40 shrink-0">나이 (만/연 나이)</label>
                    <input
                      type="number"
                      value={loggedInUser.age}
                      onChange={(e) =>
                        setLoggedInUser({ ...loggedInUser, age: Number(e.target.value) || 48 })
                      }
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-2xl bg-slate-50/70 border border-slate-200/80">
                    <label className="font-bold text-slate-700 sm:w-40 shrink-0">연락처</label>
                    <input
                      type="text"
                      value={loggedInUser.phone}
                      onChange={(e) => setLoggedInUser({ ...loggedInUser, phone: e.target.value })}
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-2xl bg-slate-50/70 border border-slate-200/80">
                    <label className="font-bold text-slate-700 sm:w-40 shrink-0">주소 (도로명)</label>
                    <input
                      type="text"
                      value={loggedInUser.road_address}
                      onChange={(e) =>
                        setLoggedInUser({ ...loggedInUser, road_address: e.target.value })
                      }
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-2xl bg-slate-50/70 border border-slate-200/80">
                    <label className="font-bold text-slate-700 sm:w-40 shrink-0">상세 주소</label>
                    <input
                      type="text"
                      value={loggedInUser.road_address_detail}
                      onChange={(e) =>
                        setLoggedInUser({ ...loggedInUser, road_address_detail: e.target.value })
                      }
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold"
                    />
                  </div>
                </div>
              </section>
            )}

            {/* ① 재배지 등록·관리 (관리자 페이지 재배지 관리 DB `시도, 시군구, 읍면동` 검색 연동 · 복수 등록) */}
            {(myPageTab === 'ALL' || myPageTab === 'FARMLAND') && (
              <section className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold">
                        관리자 재배지 관리 DB (cultivation_address) 실시간 연동
                      </span>
                    </div>
                    <h3 className="text-base sm:text-xl font-extrabold text-slate-900 mt-1">
                      ① 내 재배지 등록 · 관리 (시도 · 시군구 · 읍면동 DB 검색 · 복수 등록 가능)
                    </h3>
                    <p className="text-xs text-slate-600">
                      관리자 페이지의 전국 재배지 관리 DB에서 시도·시군구·읍면동을 검색하여 내 농지를 여러 곳 등록할 수 있습니다.
                    </p>
                  </div>
                </div>

                {/* 관리자 재배지 관리 DB 검색 & 신규 재배지 등록 폼 */}
                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-4">
                  <div className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    <span>관리자 재배지 관리 DB 검색 (시/도 · 시/군/구 · 읍/면/동)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">시/도 선택</label>
                      <select
                        value={farmlandSearchSido}
                        onChange={(e) => {
                          const nextSido = e.target.value;
                          const nextSigungu =
                            (adminAddrMeta.sigungusBySido[nextSido] || [])[0] || 'ALL';
                          setFarmlandSearchSido(nextSido);
                          setFarmlandSearchSigungu(nextSigungu);
                          searchAdminCultivationDb({
                            sido: nextSido,
                            sigungu: nextSigungu,
                            q: farmlandSearchQuery,
                          });
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold text-slate-900"
                      >
                        <option value="ALL">전체 시/도</option>
                        {(adminAddrMeta.sidos.length > 0
                          ? adminAddrMeta.sidos
                          : [
                              '충청북도',
                              '강원특별자치도',
                              '전라남도',
                              '경상북도',
                              '충청남도',
                              '경기도',
                              '전북특별자치도',
                              '경상남도',
                              '제주특별자치도',
                            ]
                        ).map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">시/군/구 선택</label>
                      <select
                        value={farmlandSearchSigungu}
                        onChange={(e) => {
                          const nextSg = e.target.value;
                          setFarmlandSearchSigungu(nextSg);
                          searchAdminCultivationDb({
                            sido: farmlandSearchSido,
                            sigungu: nextSg,
                            q: farmlandSearchQuery,
                          });
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold text-slate-900"
                      >
                        <option value="ALL">전체 시/군/구</option>
                        {(adminAddrMeta.sigungusBySido[farmlandSearchSido] || ['충주시', '평창군', '해남군']).map(
                          (sg) => (
                            <option key={sg} value={sg}>
                              {sg}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block font-bold text-slate-700 mb-1">
                        읍/면/동 또는 법정동코드 검색
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={farmlandSearchQuery}
                          onChange={(e) => setFarmlandSearchQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              searchAdminCultivationDb();
                            }
                          }}
                          placeholder="예: 단월동, 방림면, 산이면..."
                          className="flex-1 px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold text-slate-900"
                        />
                        <button
                          type="button"
                          onClick={() => searchAdminCultivationDb()}
                          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold cursor-pointer shrink-0"
                        >
                          DB 검색
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 관리자 DB 검색 결과 읍면동 선택 버튼 목록 */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-500">
                      검색된 관리자 재배지 DB 목록 ({adminDbAddresses.length}건) — 클릭하면 아래 등록 폼에 자동 입력됩니다:
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap max-h-28 overflow-y-auto p-2 rounded-xl bg-white border border-slate-200">
                      {adminDbAddresses.map((addr: any) => {
                        const isSelected =
                          newFarmlandForm.sido === addr.sido &&
                          newFarmlandForm.sigungu === addr.sigungu &&
                          newFarmlandForm.eupmyeondong === addr.eupmyeondong;
                        return (
                          <button
                            key={addr.bjd_code || `${addr.sido}-${addr.sigungu}-${addr.eupmyeondong}`}
                            type="button"
                            onClick={() =>
                              setNewFarmlandForm((prev) => ({
                                ...prev,
                                sido: addr.sido,
                                sigungu: addr.sigungu,
                                eupmyeondong: addr.eupmyeondong,
                                bjd_code: addr.bjd_code,
                                farmland_title: `${addr.sigungu} ${addr.eupmyeondong} 농장`,
                              }))
                            }
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300'
                            }`}
                          >
                            {addr.sido} {addr.sigungu} {addr.eupmyeondong}{' '}
                            <span className="opacity-70 text-[10px]">({addr.bjd_code})</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 선택된 재배지 상세 입력 및 추가 버튼 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 pt-2 border-t border-slate-200 text-xs items-end">
                    <div className="lg:col-span-2">
                      <label className="block font-bold text-slate-700 mb-1">
                        선택된 지역 (시도 · 시군구 · 읍면동)
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={`${newFarmlandForm.sido} ${newFarmlandForm.sigungu} ${newFarmlandForm.eupmyeondong} (${newFarmlandForm.bjd_code})`}
                        className="w-full px-3 py-2 rounded-xl border border-emerald-300 bg-emerald-50/60 text-emerald-950 font-extrabold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">농장 별칭</label>
                      <input
                        type="text"
                        value={newFarmlandForm.farmland_title}
                        onChange={(e) =>
                          setNewFarmlandForm({ ...newFarmlandForm, farmland_title: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">상세 지번</label>
                      <input
                        type="text"
                        value={newFarmlandForm.detail_jibun}
                        onChange={(e) =>
                          setNewFarmlandForm({ ...newFarmlandForm, detail_jibun: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">재배 면적 (평)</label>
                      <input
                        type="number"
                        value={newFarmlandForm.area_pyeong}
                        onChange={(e) =>
                          setNewFarmlandForm({
                            ...newFarmlandForm,
                            area_pyeong: Number(e.target.value) || 300,
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold"
                      />
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={handleAddFarmland}
                        className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold cursor-pointer shadow-2xs"
                      >
                        + 내 재배지 추가 등록
                      </button>
                    </div>
                  </div>
                </div>

                {/* 등록된 내 재배지 리스트 (1줄에 1개 항목) */}
                <div className="grid grid-cols-1 gap-3">
                  {myFarmlands.map((land: any, lIdx: number) => (
                    <div
                      key={land.farmland_id}
                      className="rounded-2xl border border-slate-200 p-4 bg-white hover:border-emerald-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs"
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-xs font-extrabold">
                            등록 재배지 #{lIdx + 1}
                          </span>
                          <span className="font-extrabold text-slate-900 text-sm sm:text-base">
                            {land.farmland_title}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            법정동코드 {land.bjd_code}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-emerald-800">
                          📍 {land.sido} {land.sigungu} {land.eupmyeondong} {land.detail_jibun}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-600 font-semibold">
                          <span>면적: {Number(land.area_pyeong || 300).toLocaleString()}평</span>
                          <span>·</span>
                          <span>토양 pH {land.soil_ph || 6.2}</span>
                          <span>·</span>
                          <span>EC {land.soil_ec || 1.1}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setNewCropPlanForm((prev) => ({
                              ...prev,
                              farmland_id: land.farmland_id,
                              sido: land.sido,
                              sigungu: land.sigungu,
                              eupmyeondong: land.eupmyeondong,
                              area_pyeong: Number(land.area_pyeong || 300),
                            }));
                            setMyPageTab('CROPS');
                          }}
                          className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-xs font-extrabold text-emerald-800 cursor-pointer transition"
                        >
                          이 재배지에 작물 추가 ›
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteFarmland(land.farmland_id)}
                          className="px-3 py-2 rounded-xl border border-rose-200 hover:bg-rose-50 text-xs font-bold text-rose-600 cursor-pointer transition"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ② 재배작물 등록 (복수 가능) */}
            {(myPageTab === 'ALL' || myPageTab === 'CROPS') && (
              <section className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
                <div className="border-b border-slate-200 pb-3.5">
                  <span className="px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 text-xs font-extrabold">
                    다품종 · 다필지 복수 작물 등록 지원
                  </span>
                  <h3 className="text-base sm:text-xl font-extrabold text-slate-900 mt-1">
                    ② 내 재배작물 등록 (복수 등록 가능)
                  </h3>
                  <p className="text-xs text-slate-600">
                    등록된 내 재배지를 선택하고 재배할 작물·품종·작물구분(모종/씨)·정식(파종)일을 입력하여 여러 작물을 복수로 등록할 수 있습니다.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs items-end">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">등록 재배지 선택</label>
                    <select
                      value={newCropPlanForm.farmland_id}
                      onChange={(e) => {
                        const lid = e.target.value;
                        const found = myFarmlands.find((f: any) => f.farmland_id === lid);
                        if (found) {
                          setNewCropPlanForm((prev) => ({
                            ...prev,
                            farmland_id: lid,
                            sido: found.sido,
                            sigungu: found.sigungu,
                            eupmyeondong: found.eupmyeondong,
                            area_pyeong: Number(found.area_pyeong || 300),
                          }));
                        } else {
                          setNewCropPlanForm((prev) => ({ ...prev, farmland_id: lid }));
                        }
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold text-slate-900"
                    >
                      {myFarmlands.map((f: any) => (
                        <option key={f.farmland_id} value={f.farmland_id}>
                          {f.farmland_title} ({f.sido} {f.sigungu} {f.eupmyeondong})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">재배 작물 선택</label>
                    <select
                      value={newCropPlanForm.crop_name}
                      onChange={(e) => {
                        const cname = e.target.value;
                        const defaultCv =
                          cname === '봄배추'
                            ? '춘광'
                            : cname === '월동배추'
                            ? '해남1호'
                            : cname === '고추'
                            ? '칼라탄'
                            : cname === '마늘'
                            ? '홍산마늘'
                            : '불암3호';
                        setNewCropPlanForm((prev) => ({
                          ...prev,
                          crop_name: cname,
                          cultivar_name: defaultCv,
                        }));
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold text-slate-900"
                    >
                      <option value="가을배추">가을배추</option>
                      <option value="봄배추">봄배추</option>
                      <option value="월동배추">월동배추</option>
                      <option value="고추">고추</option>
                      <option value="마늘">마늘</option>
                      <option value="양파">양파</option>
                      <option value="감자">감자</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">품종 선택</label>
                    <select
                      value={newCropPlanForm.cultivar_name}
                      onChange={(e) =>
                        setNewCropPlanForm((prev) => ({ ...prev, cultivar_name: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold text-slate-900"
                    >
                      <option value="불암3호">불암3호 (가을배추 표준)</option>
                      <option value="청명가을">청명가을 (직파/씨 전용)</option>
                      <option value="불암플러스">불암플러스</option>
                      <option value="춘광">춘광 (봄·고랭지배추)</option>
                      <option value="해남1호">해남1호 (월동배추)</option>
                      <option value="칼라탄">칼라탄 (복합내병계 고추)</option>
                      <option value="홍산마늘">홍산마늘</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">작물구분 (모종 / 씨)</label>
                    <select
                      value={newCropPlanForm.planting_type}
                      onChange={(e) =>
                        setNewCropPlanForm((prev) => ({ ...prev, planting_type: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold text-slate-900"
                    >
                      <option value="모종">모종 (정식 재배)</option>
                      <option value="씨">씨 (직파 · 최적 발아온도)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      정식/파종일 &amp; 면적(평)
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="date"
                        value={newCropPlanForm.planting_date}
                        onChange={(e) =>
                          setNewCropPlanForm((prev) => ({ ...prev, planting_date: e.target.value }))
                        }
                        className="w-3/5 px-2 py-2 rounded-xl border border-slate-300 bg-white font-bold"
                      />
                      <input
                        type="number"
                        value={newCropPlanForm.area_pyeong}
                        onChange={(e) =>
                          setNewCropPlanForm((prev) => ({
                            ...prev,
                            area_pyeong: Number(e.target.value) || 300,
                          }))
                        }
                        placeholder="평"
                        className="w-2/5 px-2 py-2 rounded-xl border border-slate-300 bg-white font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={handleAddCropPlan}
                      className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold cursor-pointer shadow-2xs"
                    >
                      + 재배작물 복수 등록
                    </button>
                  </div>
                </div>

                {/* 등록된 내 재배작물 카드 리스트 (1줄에 1개 항목) */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-700">
                      등록된 내 재배작물 목록 ({cloudBaeCropList.length}건)
                    </span>
                    <button
                      type="button"
                      onClick={() => setMyPageTab('PROGRESS')}
                      className="text-xs font-extrabold text-emerald-700 hover:underline cursor-pointer"
                    >
                      ③ 작물재배현황 및 진행율 상세 보기 ›
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {cloudBaeCropList.map((crop: any, idx: number) => (
                      <div
                        key={crop.crop_plan_id || `crop-reg-${idx}`}
                        className="rounded-2xl border border-slate-200 p-4 bg-white hover:border-emerald-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs"
                      >
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-lg bg-emerald-700 text-white text-xs font-extrabold">
                              {crop.crop_title}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-bold">
                              {crop.planting_type} · {Number(crop.area_pyeong).toLocaleString()}평
                            </span>
                            <span className="text-xs font-bold text-slate-700">📍 {crop.region}</span>
                          </div>
                          <div className="text-xs text-slate-600 font-semibold">
                            정식/파종일: {crop.planting_label} · 수확예정일: {crop.expected_harvest_date || '2026-11-15'} · 현재 단계: {crop.current_stage_name || '04. 생육 관리'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setMyPageTab('PROGRESS')}
                            className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-xs font-extrabold text-emerald-800 cursor-pointer transition"
                          >
                            생육 진행율 ({crop.progress_pct}%) 확인 ›
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteScheduleAndCascade(crop, e)}
                            className="px-3 py-2 rounded-xl border border-rose-200 hover:bg-rose-50 text-xs font-bold text-rose-600 cursor-pointer transition inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>삭제</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* ③ 작물재배현황 및 진행율 */}
            {(myPageTab === 'ALL' || myPageTab === 'PROGRESS') && (
              <section className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3.5">
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold">
                      실시간 생육단계 · 적산온도(PGDD) 연동
                    </span>
                    <h3 className="text-base sm:text-xl font-extrabold text-slate-900 mt-1">
                      ③ 내 작물재배현황 및 진행율 ({cloudBaeCropList.length}건)
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMenu('재배일정 확인');
                      setMobileScheduleStep('list');
                    }}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold cursor-pointer self-start sm:self-center"
                  >
                    재배일정 확인 탭 전체보기 ›
                  </button>
                </div>

                <div className="space-y-3">
                  {cloudBaeCropList.map((crop: any, idx: number) => (
                    <div
                      key={crop.crop_plan_id || `${crop.request_no}-${idx}`}
                      className="rounded-2xl border border-slate-200 p-4 hover:border-emerald-300 transition bg-slate-50/40 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-lg bg-emerald-700 text-white text-xs font-extrabold">
                            {crop.crop_title}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 text-xs font-bold">
                            {crop.planting_type} · {Number(crop.area_pyeong).toLocaleString()}평
                          </span>
                          <span className="text-xs font-bold text-slate-600">
                            📍 {crop.region}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 flex-wrap text-xs text-slate-600 font-semibold">
                          <span>시작일: {crop.planting_label}</span>
                          <span>·</span>
                          <span>수확예정일: {crop.expected_harvest_date || '2026-11-15'}</span>
                          <span>·</span>
                          <span className="text-emerald-800 font-extrabold">
                            현재 생육단계: {crop.current_stage_name || '04. 생육 관리'}
                          </span>
                        </div>

                        {/* 진행율 프로그레스 바 */}
                        <div className="pt-1 max-w-xl space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-700">
                              생육 진행율 ({crop.status_text})
                            </span>
                            <span className="font-extrabold text-emerald-700">
                              {crop.progress_pct}%
                            </span>
                          </div>
                          <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden">
                            <div
                              style={{ width: `${Math.min(100, Math.max(5, crop.progress_pct))}%` }}
                              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-all"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {crop.crop_plan_id && (
                          <div className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1 text-[11px] font-bold text-slate-600">
                            <span>진행율 변경:</span>
                            {[25, 60, 80, 100].map((pct) => (
                              <button
                                key={pct}
                                type="button"
                                onClick={() => handleUpdateCropProgress(crop.crop_plan_id, pct)}
                                className={`px-2 py-0.5 rounded-md cursor-pointer ${
                                  Number(crop.progress_pct) === pct
                                    ? 'bg-emerald-600 text-white font-extrabold'
                                    : 'hover:bg-slate-100 text-slate-700'
                                }`}
                              >
                                {pct}%
                              </button>
                            ))}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            const reqNo = crop.request_no || 'REQ-20261106-009';
                            setSelectedRequestNo(reqNo);
                            setExpandedScheduleRequestNo(reqNo);
                            setActiveMenu('재배일정 확인');
                            setMobileScheduleStep('detail');
                          }}
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold cursor-pointer"
                        >
                          48주 타임라인 · 농자재 구매 ›
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleDeleteScheduleAndCascade(crop, e)}
                          className="px-2.5 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold cursor-pointer inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>삭제</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ④ 농자재 구매현황 */}
            {(myPageTab === 'ALL' || myPageTab === 'ORDERS') && (
              <section className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3.5">
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-extrabold">
                      생육단계별 원클릭 구매 내역 &amp; 배송 관제
                    </span>
                    <h3 className="text-base sm:text-xl font-extrabold text-slate-900 mt-1">
                      ④ 농자재 구매현황 ({myOrders.length}건)
                    </h3>
                    <p className="text-xs text-slate-600">
                      재배일정 확인 하단의 생육 단계별 추천 농자재 구매 모듈에서 주문한 모든 내역이 실시간으로 표시됩니다.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedScheduleRequestNo(selectedRequestNo || 'REQ-20261106-009');
                      setActiveMenu('재배일정 확인');
                      setMobileScheduleStep('detail');
                      setTimeout(() => {
                        document
                          .getElementById('stage-materials-bulk-purchase-section')
                          ?.scrollIntoView({ behavior: 'smooth' });
                      }, 150);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold cursor-pointer self-start sm:self-center"
                  >
                    + 생육단계별 농자재 추가 구매하기
                  </button>
                </div>

                <div className="space-y-4">
                  {myOrders.map((ord: any) => (
                    <div
                      key={ord.order_no}
                      className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-2xs"
                    >
                      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-extrabold text-slate-900 bg-white px-2.5 py-0.5 rounded-md border border-slate-200">
                            {ord.order_no}
                          </span>
                          <span className="text-xs text-slate-500 font-semibold">
                            주문일시: {ord.ordered_at}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold">
                            {ord.delivery_status}
                          </span>
                        </div>
                        <div className="text-xs font-extrabold text-emerald-800">
                          최종 결제금액: {Number(ord.final_total || 0).toLocaleString()}원 (할인 -
                          {Number(ord.discount_amount || 0).toLocaleString()}원)
                        </div>
                      </div>

                      <div className="p-4 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <div className="font-extrabold text-slate-900 text-sm sm:text-base">
                              {ord.purchase_title}
                            </div>
                            <div className="text-xs text-slate-600 mt-0.5">
                              적용 작물: <span className="font-bold">{ord.crop_title}</span> · 배송지:{' '}
                              <span className="font-bold">{ord.region_address}</span>
                            </div>
                          </div>
                          <div className="text-xs text-slate-600 font-semibold shrink-0">
                            결제수단:{' '}
                            <span className="font-bold text-slate-900">
                              {ord.payment_method === 'NONGHYUP_CARD'
                                ? 'NH농협 영농카드 간편결제'
                                : ord.payment_method === 'BANK_TRANSFER'
                                ? '법인계좌 무통장입금'
                                : '농협 콕뱅크 · 지역사랑페이'}
                            </span>
                          </div>
                        </div>

                        {/* 주문 포함 농자재 아이템 리스트 (1줄에 1개 항목) */}
                        <div className="grid grid-cols-1 gap-2 pt-1">
                          {(ord.orderItems || []).map((item: any, idx: number) => (
                            <div
                              key={`${ord.order_no}-item-${idx}`}
                              className="rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-3 bg-slate-50/60 text-xs"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <img
                                  src={
                                    item.thumbnail_url ||
                                    '/api/agro-materials/image/FERT-PRD-01/thumb'
                                  }
                                  alt={item.product_name}
                                  className="w-11 h-11 rounded-lg object-cover border border-slate-200 bg-white shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px] font-extrabold">
                                      {item.stageName || '맞춤단계'}
                                    </span>
                                    <span className="font-extrabold text-slate-900 truncate">
                                      {item.product_name}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5">
                                    주문수량: {item.qty}개
                                  </div>
                                </div>
                              </div>
                              <div className="text-xs sm:text-sm font-extrabold text-emerald-700 shrink-0">
                                {Number(item.subtotal || 0).toLocaleString()}원
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== [독립 폼 1: 회원 로그인 전용 폼 (화이트 & 에메랄드 미니멀 구성)] ==================== */}
        {isAuthModalOpen && authModalTab === 'LOGIN' && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-[0_20px_50px_rgba(15,23,42,0.14)] max-w-[420px] w-full overflow-hidden my-auto">
              {/* 상단 에메랄드 포인트 라인 */}
              <div className="h-1.5 w-full bg-emerald-600" />

              {/* 로그인 폼 헤더 */}
              <div className="px-7 pt-6 pb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                    <Sprout className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
                      회원 로그인
                    </h3>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">
                      이메일 또는 Google 계정으로 로그인하세요
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAuthModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-7 pb-7 space-y-4 max-h-[82vh] overflow-y-auto">
                {authNoticeMsg && (
                  <div
                    className={`rounded-xl px-3.5 py-2.5 text-xs font-bold border ${
                      authNoticeMsg.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border-rose-200 text-rose-700'
                    }`}
                  >
                    {authNoticeMsg.text}
                  </div>
                )}

                <form onSubmit={handleEmailLogin} className="space-y-4">
                  <div className="space-y-3.5 text-xs">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="font-bold text-slate-700">이메일 주소</label>
                        <button
                          type="button"
                          onClick={() =>
                            setLoginForm({
                              ...loginForm,
                              email: 'CloudBae@naver.com',
                              password: '1234',
                            })
                          }
                          className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md cursor-pointer transition"
                        >
                          테스트 계정 자동입력
                        </button>
                      </div>
                      <input
                        type="text"
                        value={loginForm.email}
                        onChange={(e) =>
                          setLoginForm({ ...loginForm, email: e.target.value })
                        }
                        placeholder="example@naver.com"
                        className="w-full px-3.5 py-3 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/15 focus:outline-none font-semibold text-slate-900 transition"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="font-bold text-slate-700">비밀번호</label>
                        <button
                          type="button"
                          onClick={() => {
                            setAuthNoticeMsg(null);
                            setAuthModalTab('FIND_PASSWORD');
                          }}
                          className="text-[11px] font-semibold text-slate-500 hover:text-emerald-700 cursor-pointer transition"
                        >
                          비밀번호 찾기
                        </button>
                      </div>
                      <input
                        type="password"
                        value={loginForm.password}
                        onChange={(e) =>
                          setLoginForm({ ...loginForm, password: e.target.value })
                        }
                        placeholder="비밀번호 입력"
                        className="w-full px-3.5 py-3 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/15 focus:outline-none font-semibold text-slate-900 transition"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm cursor-pointer shadow-xs transition"
                  >
                    로그인
                  </button>

                  <div className="relative flex py-1 items-center">
                    <div className="grow border-t border-slate-100" />
                    <span className="shrink mx-3 text-[11px] font-semibold text-slate-400">
                      또는
                    </span>
                    <div className="grow border-t border-slate-100" />
                  </div>

                  {/* Google Gmail 간편 로그인 */}
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setShowGmailPicker(!showGmailPicker)}
                      className="w-full py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path
                          fill="#EA4335"
                          d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.8C6.2 7.2 8.9 5 12 5z"
                        />
                        <path
                          fill="#4285F4"
                          d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.7z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.3 14.8c-.2-.8-.4-1.8-.4-2.8s.2-2 .4-2.8L1.6 6.4C.6 8.4 0 10.6 0 12s.6 3.6 1.6 5.6l3.7-2.8z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5l-3.7 2.8C3.5 20.4 7.4 23 12 23z"
                        />
                      </svg>
                      <span>Google Gmail로 계속하기</span>
                    </button>

                    {showGmailPicker && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2 text-xs">
                        <div className="flex gap-2">
                          <input
                            type="email"
                            value={loginForm.gmailAccount}
                            onChange={(e) =>
                              setLoginForm({ ...loginForm, gmailAccount: e.target.value })
                            }
                            placeholder="example@gmail.com"
                            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-white font-semibold"
                          />
                          <button
                            type="button"
                            onClick={() => handleGoogleGmailAuth(loginForm.gmailAccount)}
                            className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer shrink-0"
                          >
                            연동 로그인
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 회원가입 전용 폼으로 전환 */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">
                      아직 계정이 없으신가요?
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthNoticeMsg(null);
                        setShowRoadSearchBox(false);
                        setAuthModalTab('SIGNUP');
                      }}
                      className="font-extrabold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                    >
                      회원가입 폼 열기 ›
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ==================== [독립 폼 2: 신규 회원가입 전용 폼 (화이트 & 에메랄드 그린 2단 클린 구성)] ==================== */}
        {isAuthModalOpen && authModalTab === 'SIGNUP' && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-[0_20px_50px_rgba(15,23,42,0.14)] max-w-[560px] w-full overflow-hidden my-auto">
              {/* 상단 에메랄드 포인트 라인 */}
              <div className="h-1.5 w-full bg-emerald-600" />

              {/* 회원가입 폼 헤더 */}
              <div className="px-7 pt-6 pb-4 border-b border-slate-100 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
                      신규 회원가입
                    </h3>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">
                      필수 회원 정보를 입력하고 맞춤형 영농 서비스를 시작하세요
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAuthModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-7 py-6 space-y-5 max-h-[82vh] overflow-y-auto">
                {authNoticeMsg && (
                  <div
                    className={`rounded-xl px-3.5 py-2.5 text-xs font-bold border ${
                      authNoticeMsg.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border-rose-200 text-rose-700'
                    }`}
                  >
                    {authNoticeMsg.text}
                  </div>
                )}

                <form onSubmit={handleSignupSubmit} className="space-y-5 text-xs">
                  {/* 가입 방식 선택 (깔끔한 세그먼트 탭) */}
                  <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100">
                    <button
                      type="button"
                      onClick={() =>
                        setSignupForm((prev) => ({ ...prev, signup_type: 'EMAIL' }))
                      }
                      className={`py-2 px-3 rounded-lg font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        signupForm.signup_type === 'EMAIL'
                          ? 'bg-white text-emerald-700 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>이메일로 가입</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const defaultGmail = signupForm.email.endsWith('@gmail.com')
                          ? signupForm.email
                          : 'farmer2026@gmail.com';
                        setSignupForm((prev) => ({
                          ...prev,
                          signup_type: 'GOOGLE_GMAIL',
                          email: defaultGmail,
                          emailChecked: false,
                          emailCheckMsg: '',
                        }));
                      }}
                      className={`py-2 px-3 rounded-lg font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        signupForm.signup_type === 'GOOGLE_GMAIL'
                          ? 'bg-white text-emerald-700 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                        <path
                          fill="#EA4335"
                          d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.8C6.2 7.2 8.9 5 12 5z"
                        />
                        <path
                          fill="#4285F4"
                          d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.7z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.3 14.8c-.2-.8-.4-1.8-.4-2.8s.2-2 .4-2.8L1.6 6.4C.6 8.4 0 10.6 0 12s.6 3.6 1.6 5.6l3.7-2.8z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5l-3.7 2.8C3.5 20.4 7.4 23 12 23z"
                        />
                      </svg>
                      <span>Google Gmail로 가입</span>
                    </button>
                  </div>

                  {/* 섹션 1: 계정 정보 (이메일 중복검사 · 비밀번호) */}
                  <div className="space-y-3.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1.5">
                        이메일 주소 <span className="text-emerald-600">*</span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={signupForm.email}
                          onChange={(e) =>
                            setSignupForm({
                              ...signupForm,
                              email: e.target.value,
                              emailChecked: false,
                              emailCheckMsg: '',
                            })
                          }
                          placeholder={
                            signupForm.signup_type === 'GOOGLE_GMAIL'
                              ? 'example@gmail.com'
                              : 'example@naver.com'
                          }
                          className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/15 focus:outline-none font-semibold text-slate-900 transition"
                        />
                        <button
                          type="button"
                          onClick={handleCheckEmailDuplicate}
                          className={`px-4 py-2.5 rounded-xl font-bold cursor-pointer shrink-0 transition ${
                            signupForm.emailChecked
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-800 hover:bg-slate-900 text-white'
                          }`}
                        >
                          {signupForm.emailChecked ? '✓ 사용가능' : '중복검사'}
                        </button>
                      </div>
                      {signupForm.emailCheckMsg && (
                        <div
                          className={`mt-1.5 text-[11px] font-bold ${
                            signupForm.emailChecked ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {signupForm.emailCheckMsg}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1.5">
                          비밀번호 <span className="text-emerald-600">*</span>
                        </label>
                        <input
                          type="password"
                          value={signupForm.password}
                          onChange={(e) =>
                            setSignupForm({ ...signupForm, password: e.target.value })
                          }
                          placeholder="4자리 이상 입력"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/15 focus:outline-none font-semibold transition"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1.5">
                          비밀번호 확인 <span className="text-emerald-600">*</span>
                        </label>
                        <input
                          type="password"
                          value={signupForm.passwordConfirm}
                          onChange={(e) =>
                            setSignupForm({ ...signupForm, passwordConfirm: e.target.value })
                          }
                          placeholder="비밀번호 재입력"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/15 focus:outline-none font-semibold transition"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-100" />

                  {/* 섹션 2: 이름 · 성별 · 출생년월일 · 나이 */}
                  <div className="space-y-3.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1.5">
                          이름 <span className="text-emerald-600">*</span>
                        </label>
                        <input
                          type="text"
                          value={signupForm.name}
                          onChange={(e) =>
                            setSignupForm({ ...signupForm, name: e.target.value })
                          }
                          placeholder="실명 입력"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/15 focus:outline-none font-semibold transition"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1.5">
                          성별 <span className="text-emerald-600">*</span>
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {(['남성', '여성'] as const).map((g) => (
                            <button
                              key={g}
                              type="button"
                              onClick={() => setSignupForm({ ...signupForm, gender: g })}
                              className={`py-2.5 rounded-xl border font-bold cursor-pointer transition ${
                                signupForm.gender === g
                                  ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                                  : 'border-slate-200 bg-slate-50/70 text-slate-600 hover:bg-white'
                              }`}
                            >
                              {g}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1.5">
                          출생년월일 <span className="text-emerald-600">*</span>
                        </label>
                        <input
                          type="date"
                          value={signupForm.birth_date}
                          onChange={(e) => {
                            const bd = e.target.value;
                            setSignupForm({
                              ...signupForm,
                              birth_date: bd,
                              age: calcAgeFromBirthDate(bd),
                            });
                          }}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/15 focus:outline-none font-semibold transition"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1.5">
                          나이 (세) <span className="text-emerald-600">*</span>
                        </label>
                        <input
                          type="number"
                          value={signupForm.age}
                          onChange={(e) =>
                            setSignupForm({
                              ...signupForm,
                              age: Number(e.target.value) || 46,
                            })
                          }
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/15 focus:outline-none font-semibold transition"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-100" />

                  {/* 섹션 3: 도로명 주소 */}
                  <div className="space-y-2.5">
                    <label className="block font-bold text-slate-700">
                      주소 (도로명) <span className="text-emerald-600">*</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={signupForm.road_address}
                        onChange={(e) =>
                          setSignupForm({ ...signupForm, road_address: e.target.value })
                        }
                        placeholder="도로명 주소 검색 또는 직접 입력"
                        className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/15 focus:outline-none font-semibold transition"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setShowRoadSearchBox(!showRoadSearchBox);
                          if (roadSearchResults.length === 0) {
                            handleSearchRoadAddress('충원대로');
                          }
                        }}
                        className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold cursor-pointer shrink-0 transition"
                      >
                        도로명 검색
                      </button>
                    </div>

                    {showRoadSearchBox && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-3 space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={roadSearchKeyword}
                            onChange={(e) => setRoadSearchKeyword(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSearchRoadAddress();
                              }
                            }}
                            placeholder="도로명·동이름 입력 (예: 충원대로, 단월동)"
                            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-white font-semibold"
                          />
                          <button
                            type="button"
                            onClick={() => handleSearchRoadAddress()}
                            className="px-3.5 py-2 rounded-lg bg-emerald-600 text-white font-bold cursor-pointer"
                          >
                            {isRoadSearching ? '검색중...' : '찾기'}
                          </button>
                        </div>
                        <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 bg-white rounded-lg border border-slate-200">
                          {roadSearchResults.map((rItem: any, rIdx: number) => (
                            <button
                              key={`${rItem.road_code}-${rIdx}`}
                              type="button"
                              onClick={() => {
                                setSignupForm((prev) => ({
                                  ...prev,
                                  road_address: rItem.full_road_address,
                                  postal_code: rItem.postal_code || '27481',
                                }));
                                setShowRoadSearchBox(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-emerald-50 transition cursor-pointer"
                            >
                              <div className="font-bold text-slate-900">
                                [{rItem.postal_code}] {rItem.full_road_address}
                              </div>
                              {rItem.full_jibun_address && (
                                <div className="text-[11px] text-slate-500">
                                  지번: {rItem.full_jibun_address}
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <input
                      type="text"
                      value={signupForm.road_address_detail}
                      onChange={(e) =>
                        setSignupForm({ ...signupForm, road_address_detail: e.target.value })
                      }
                      placeholder="상세주소 입력 (예: 101동 202호 / 농장명)"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/15 focus:outline-none font-semibold transition"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm cursor-pointer shadow-xs transition"
                  >
                    회원가입 완료
                  </button>

                  {/* 로그인 전용 폼으로 전환 */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-500">
                      이미 가입된 계정이 있으신가요?
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthNoticeMsg(null);
                        setShowGmailPicker(false);
                        setAuthModalTab('LOGIN');
                      }}
                      className="font-extrabold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
                    >
                      로그인 폼으로 이동 ›
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ==================== [독립 폼 3: 비밀번호 찾기 전용 폼 (화이트 & 슬레이트 클린 구성)] ==================== */}
        {isAuthModalOpen && authModalTab === 'FIND_PASSWORD' && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-[0_20px_50px_rgba(15,23,42,0.14)] max-w-[420px] w-full overflow-hidden my-auto">
              {/* 상단 슬레이트 포인트 라인 */}
              <div className="h-1.5 w-full bg-slate-800" />

              {/* 비밀번호 찾기 헤더 */}
              <div className="px-7 pt-6 pb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-slate-700" />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
                      비밀번호 찾기 · 재설정
                    </h3>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">
                      가입 정보 확인 후 새 비밀번호를 설정합니다
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAuthModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-7 pb-7 space-y-4 max-h-[82vh] overflow-y-auto text-xs">
                {authNoticeMsg && (
                  <div
                    className={`rounded-xl px-3.5 py-2.5 text-xs font-bold border ${
                      authNoticeMsg.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border-rose-200 text-rose-700'
                    }`}
                  >
                    {authNoticeMsg.text}
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="font-bold text-slate-700">가입 이메일 주소</label>
                      <button
                        type="button"
                        onClick={() =>
                          setFindPwForm({
                            ...findPwForm,
                            email: 'CloudBae@naver.com',
                            name: '배철민',
                            birth_date: '1978-05-15',
                          })
                        }
                        className="text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-md cursor-pointer transition"
                      >
                        테스트 정보 자동입력
                      </button>
                    </div>
                    <input
                      type="email"
                      value={findPwForm.email}
                      onChange={(e) =>
                        setFindPwForm({ ...findPwForm, email: e.target.value, verified: false })
                      }
                      placeholder="example@naver.com"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-slate-800 focus:outline-none font-semibold"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1.5">이름</label>
                      <input
                        type="text"
                        value={findPwForm.name}
                        onChange={(e) =>
                          setFindPwForm({ ...findPwForm, name: e.target.value, verified: false })
                        }
                        placeholder="이름 입력"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-slate-800 focus:outline-none font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1.5">출생년월일</label>
                      <input
                        type="date"
                        value={findPwForm.birth_date}
                        onChange={(e) =>
                          setFindPwForm({
                            ...findPwForm,
                            birth_date: e.target.value,
                            verified: false,
                          })
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-slate-800 focus:outline-none font-semibold"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleFindPasswordVerify}
                    className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-extrabold cursor-pointer transition"
                  >
                    회원 본인 확인
                  </button>
                </div>

                {findPwForm.verified && (
                  <div className="rounded-2xl border border-emerald-300 bg-emerald-50/40 p-4 space-y-3">
                    <div className="font-extrabold text-emerald-900">
                      ✓ {findPwForm.verifiedMsg}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          새 비밀번호
                        </label>
                        <input
                          type="password"
                          value={findPwForm.new_password}
                          onChange={(e) =>
                            setFindPwForm({ ...findPwForm, new_password: e.target.value })
                          }
                          placeholder="4자리 이상"
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          새 비밀번호 확인
                        </label>
                        <input
                          type="password"
                          value={findPwForm.new_password_confirm}
                          onChange={(e) =>
                            setFindPwForm({
                              ...findPwForm,
                              new_password_confirm: e.target.value,
                            })
                          }
                          placeholder="재입력"
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white font-semibold"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleFindPasswordReset}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold cursor-pointer"
                    >
                      새 비밀번호로 변경 완료
                    </button>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthNoticeMsg(null);
                      setAuthModalTab('LOGIN');
                    }}
                    className="text-emerald-700 font-extrabold hover:underline cursor-pointer"
                  >
                    ‹ 로그인 폼으로
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthNoticeMsg(null);
                      setAuthModalTab('SIGNUP');
                    }}
                    className="text-blue-600 font-extrabold hover:underline cursor-pointer"
                  >
                    회원가입 폼 열기 ›
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 푸터 (모바일에서는 하단 고정 네비게이션 바 높이만큼 여백 확보, 농작물 구매 모바일 고정뷰에서는 숨김) */}
      <footer
        className={`bg-white border-t border-slate-200/80 py-6 mt-8 ${
          activeMenu === '홈' ? 'pb-6' : 'pb-24 lg:pb-6'
        } ${
          activeMenu === '농작물 구매' ||
          activeMenu === '농자재 판매' ||
          activeMenu === '비료' ||
          activeMenu === '영양제' ||
          activeMenu === '병해충관리제' ||
          activeMenu === '병해충방지제' ||
          activeMenu === '씨' ||
          activeMenu === '모종'
            ? 'hidden lg:block'
            : ''
        }`}
      >
        <div className="max-w-[1600px] w-full mx-auto px-6 sm:px-10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="font-semibold text-slate-700">
            © 2026 FarmPlan 맞춤형 농작물 재배일정 서비스 · 등록특허 제10-2814596호 기반
          </div>
          <div className="flex items-center gap-4">
            <span>기후(PGDD·한계온도 회피) · 토양검정 · 농자재 통합 처방</span>
            <Link to="/admin" className="text-emerald-700 font-bold hover:underline">
              관리자 콘솔 (/admin)
            </Link>
          </div>
        </div>
      </footer>

      {/* ==================== 모바일 전용 하단 고정 탭바 (메인 '홈' 페이지에서는 숨김, 내부 서브 페이지에서만 노출) ==================== */}
      {activeMenu !== '홈' && (
        <nav
          aria-label="모바일 하단 주 메뉴"
          className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/98 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-8px_28px_rgba(15,23,42,0.08)]"
          style={{
            paddingBottom: isLegacyAndroidWebView
              ? 'max(14px, env(safe-area-inset-bottom, 14px))'
              : 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          <div className="grid grid-cols-4 gap-1.5 h-[64px] max-w-lg mx-auto px-2.5 py-1.5 items-stretch">
            {/* 1. 홈 */}
            {(() => {
              const isHomeActive = activeMenu === '홈';
              return (
                <button
                  type="button"
                  onClick={() => {
                    setActiveMenu('홈');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-1 transition-all duration-150 cursor-pointer overflow-hidden ${
                    isHomeActive
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-600 shadow-xs shadow-emerald-600/20'
                      : 'bg-white hover:bg-slate-50 text-slate-900 border border-slate-200/95'
                  }`}
                >
                  <Home
                    className={`w-[18px] h-[18px] stroke-[2.2] shrink-0 ${
                      isHomeActive ? 'text-white' : 'text-[#334155]'
                    }`}
                  />
                  <span
                    className={`text-[11.5px] min-[390px]:text-[12.5px] sm:text-[13.5px] leading-tight tracking-tight whitespace-nowrap font-extrabold ${
                      isHomeActive ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    홈
                  </span>
                </button>
              );
            })()}

            {/* 2. 재배일정 */}
            {(() => {
              const isScheduleActive =
                activeMenu === '재배일정 확인' || activeMenu === '재배일정 요청';
              return (
                <button
                  type="button"
                  onClick={() => {
                    setActiveMenu('재배일정 확인');
                    setMobileScheduleStep('list');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-1 transition-all duration-150 cursor-pointer overflow-hidden ${
                    isScheduleActive
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-600 shadow-xs shadow-emerald-600/20'
                      : 'bg-white hover:bg-slate-50 text-slate-900 border border-slate-200/95'
                  }`}
                >
                  <Calendar
                    className={`w-[18px] h-[18px] stroke-[2.2] shrink-0 ${
                      isScheduleActive ? 'text-white' : 'text-[#334155]'
                    }`}
                  />
                  <span
                    className={`text-[11.5px] min-[390px]:text-[12.5px] sm:text-[13.5px] leading-tight tracking-tight whitespace-nowrap font-extrabold ${
                      isScheduleActive ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    재배일정
                  </span>
                </button>
              );
            })()}

            {/* 3. 농자재 판매 */}
            {(() => {
              const isAgroActive =
                activeMenu === '농작물 구매' ||
                activeMenu === '농자재 판매' ||
                activeMenu === '비료' ||
                activeMenu === '영양제' ||
                activeMenu === '병해충관리제' ||
                activeMenu === '병해충방지제' ||
                activeMenu === '씨' ||
                activeMenu === '모종';
              return (
                <button
                  type="button"
                  onClick={() => {
                    setMobileAgroCategoryTab('FERTILIZER');
                    setActiveMenu('농작물 구매');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-1 transition-all duration-150 cursor-pointer overflow-hidden ${
                    isAgroActive
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-600 shadow-xs shadow-emerald-600/20'
                      : 'bg-white hover:bg-slate-50 text-slate-900 border border-slate-200/95'
                  }`}
                >
                  <Sprout
                    className={`w-[18px] h-[18px] stroke-[2.2] shrink-0 ${
                      isAgroActive ? 'text-white' : 'text-[#334155]'
                    }`}
                  />
                  <span
                    className={`text-[11.5px] min-[390px]:text-[12.5px] sm:text-[13.5px] leading-tight tracking-tight whitespace-nowrap font-extrabold ${
                      isAgroActive ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    농자재 판매
                  </span>
                </button>
              );
            })()}

            {/* 4. 마이페이지 */}
            {(() => {
              const isMyPageActive = activeMenu === '마이페이지';
              return (
                <button
                  type="button"
                  onClick={() => {
                    setActiveMenu('마이페이지');
                    setMyPageTab('FARMLAND');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-1 transition-all duration-150 cursor-pointer overflow-hidden ${
                    isMyPageActive
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-600 shadow-xs shadow-emerald-600/20'
                      : 'bg-white hover:bg-slate-50 text-slate-900 border border-slate-200/95'
                  }`}
                >
                  <User
                    className={`w-[18px] h-[18px] stroke-[2.2] shrink-0 ${
                      isMyPageActive ? 'text-white' : 'text-[#334155]'
                    }`}
                  />
                  <span
                    className={`text-[11.5px] min-[390px]:text-[12.5px] sm:text-[13.5px] leading-tight tracking-tight whitespace-nowrap font-extrabold ${
                      isMyPageActive ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    마이페이지
                  </span>
                </button>
              );
            })()}
          </div>
        </nav>
      )}
    </div>
  );
}
