import React, { useEffect, useState } from 'react';
import { normalizeAppPath } from '../router.tsx';
import {
  Sprout,
  CheckCircle2,
  ClipboardList,
  Send,
  RotateCcw,
  AlertCircle,
  MapPin,
  User,
  Phone,
} from 'lucide-react';

interface SurveyQuestion {
  id: string;
  number: number;
  question: string;
  subtitle?: string;
  type: 'single' | 'multiple';
  allowOtherInput?: boolean;
  options: string[];
}

const FALLBACK_QUESTIONS: SurveyQuestion[] = [
  {
    id: 'q1',
    number: 1,
    question: '귀하의 연령대는 어떻게 되십니까?',
    subtitle: '',
    type: 'single',
    options: ['① 20대 이하', '② 30대', '③ 40대', '④ 50대', '⑤ 60대', '⑥ 70대 이상'],
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
    question: '현재 주로 재배하는 작물은 무엇입니까?',
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
    options: ['① 반드시 이용', '② 이용할 의향 있음', '③ 잘 모르겠음', '④ 이용 의향 없음'],
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
    question: '병해충 사진 진단 서비스까지 추가된다면 이용하시겠습니까?',
    subtitle:
      '작물 사진을 촬영하면 병해충을 자동으로 진단하고 알맞은 관리 및 방제 방법을 안내하는 서비스입니다.',
    type: 'single',
    options: ['① 반드시 이용', '② 이용할 의향 있음', '③ 잘 모르겠음', '④ 이용 의향 없음'],
  },
  {
    id: 'q8',
    number: 8,
    question:
      '맞춤형 재배일정과 병해충 진단이 모두 포함된 서비스에 월 얼마까지 지불할 의향이 있으십니까?',
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
      '재배일정에 맞춰 필요한 농자재를 추천하고 주문·배송까지 제공한다면 이용하시겠습니까?',
    subtitle: '',
    type: 'single',
    options: ['① 적극 이용', '② 필요할 때 이용', '③ 이용하지 않음'],
  },
];

export default function SurveyPublicPage() {
  const normalizedPath = normalizeAppPath(window.location.pathname);
  const pathParts = normalizedPath.split('/').filter(Boolean);
  const urlSurveyId = pathParts[1] || 'SURV-HANFARM-2026';

  const [surveyMeta, setSurveyMeta] = useState<any>({
    survey_id: urlSurveyId,
    title: '한팜 맞춤형 재배관리 서비스 수요조사',
    greeting_text: '안녕하세요, 농업인 여러분.',
    intro_text:
      '한팜은 농업인이 보다 쉽고 효율적으로 작물을 재배할 수 있도록 맞춤형 재배일정 및 병해충 진단 서비스를 개발하고 있습니다.',
    duration_text:
      '본 설문은 서비스 개발과 적정 이용료 설정을 위한 조사이며, 약 2~3분 정도 소요됩니다.',
    notice_text:
      '※ 본 설문은 맞춤형 재배일정과 병해충 진단이 실제 농작업에 활용할 수 있을 만큼 충분한 정확도와 신뢰성을 갖추었다는 가정하에 응답해 주시기 바랍니다.',
    footer_title: '설문에 참여해 주셔서 감사합니다.',
    footer_sub: '본 설문 결과는 한팜의 서비스 개발 및 사업성 검토를 위한 목적으로 활용됩니다.',
    questions: FALLBACK_QUESTIONS,
  });

  const [respondentName, setRespondentName] = useState('');
  const [regionSido, setRegionSido] = useState('');
  const [regionSigungu, setRegionSigungu] = useState('');
  const [regionDong, setRegionDong] = useState('');
  const [addressMeta, setAddressMeta] = useState<{
    sidos: string[];
    sigungusBySido: Record<string, string[]>;
  }>({
    sidos: [],
    sigungusBySido: {},
  });
  const [dongList, setDongList] = useState<string[]>([]);
  const [respondentContact, setRespondentContact] = useState('');
  const [singleAnswers, setSingleAnswers] = useState<Record<string, string>>({});
  const [q3Selected, setQ3Selected] = useState<string[]>([]);
  const [q3OtherText, setQ3OtherText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const respondentRegion = [regionSido, regionSigungu, regionDong].filter(Boolean).join(' ');

  const loadDongOptions = async (sido: string, sigungu: string) => {
    if (!sido || !sigungu) {
      setDongList([]);
      setRegionDong('');
      return;
    }
    try {
      const res = await fetch(
        `/api/addresses?sido=${encodeURIComponent(sido)}&sigungu=${encodeURIComponent(sigungu)}&pageSize=200`
      ).then((r) => r.json());
      const items = Array.isArray(res?.items) ? res.items : [];
      const uniqueDongs = Array.from(
        new Set<string>(items.map((it: any) => String(it.eupmyeondong || '').trim()).filter(Boolean))
      );
      setDongList(uniqueDongs);
      setRegionDong(uniqueDongs[0] || '');
    } catch {
      setDongList([]);
      setRegionDong('');
    }
  };

  useEffect(() => {
    fetch(`/api/surveys/public?survey_id=${encodeURIComponent(urlSurveyId)}`)
      .then((r) => r.json())
      .then((res) => {
        if (res?.ok && res.survey) {
          setSurveyMeta({
            ...res.survey,
            questions:
              Array.isArray(res.survey.questions) && res.survey.questions.length > 0
                ? res.survey.questions
                : FALLBACK_QUESTIONS,
          });
        }
      })
      .catch(() => {});

    fetch('/api/addresses/meta')
      .then((r) => r.json())
      .then((meta) => {
        if (meta && Array.isArray(meta.sidos)) {
          setAddressMeta({
            sidos: meta.sidos,
            sigungusBySido: meta.sigungusBySido || {},
          });
        }
      })
      .catch(() => {});
  }, [urlSurveyId]);

  const isSurveyClosed = Number(surveyMeta.is_active ?? 1) === 0;

  const toggleQ3Option = (opt: string) => {
    if (isSurveyClosed) return;
    setErrorMsg(null);
    setQ3Selected((prev) =>
      prev.includes(opt) ? prev.filter((item) => item !== opt) : [...prev, opt]
    );
  };

  const handleSelectSingle = (qId: string, opt: string) => {
    if (isSurveyClosed) return;
    setErrorMsg(null);
    setSingleAnswers((prev) => ({ ...prev, [qId]: opt }));
  };

  const questions: SurveyQuestion[] = surveyMeta.questions || FALLBACK_QUESTIONS;
  const answeredCount = questions.filter((q) =>
    q.type === 'multiple' ? q3Selected.length > 0 : Boolean(singleAnswers[q.id])
  ).length;

  const cleanKoreanText = (text: string) =>
    String(text || '')
      .replace(/\s*\(HANFARM\)/gi, '')
      .replace(/\s*\(복수\s*선택\s*가능\)/g, '')
      .trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSurveyClosed) {
      setErrorMsg('마감된 설문조사에는 더 이상 참여할 수 없습니다.');
      return;
    }
    for (const q of questions) {
      if (q.type === 'multiple') {
        if (q3Selected.length === 0) {
          setErrorMsg(`${q.number}번 문항을 최소 1개 이상 선택해 주세요.`);
          return;
        }
        if (
          q3Selected.some((o) => o.includes('기타')) &&
          !q3OtherText.trim()
        ) {
          setErrorMsg('3번 문항의 [⑦ 기타 (직접 입력)] 작물명을 입력해 주세요.');
          return;
        }
      } else {
        if (!singleAnswers[q.id]) {
          setErrorMsg(`${q.number}번 문항의 응답을 선택해 주세요.`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/surveys/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          survey_id: surveyMeta.survey_id || urlSurveyId,
          respondent_name: respondentName.trim() || '익명 농업인',
          respondent_region: respondentRegion.trim(),
          respondent_contact: respondentContact.trim(),
          q1_age: singleAnswers.q1,
          q2_scale: singleAnswers.q2,
          q3_crops: q3Selected,
          q3_other_text: q3OtherText.trim(),
          q4_difficulty: singleAnswers.q4,
          q5_schedule_intent: singleAnswers.q5,
          q6_schedule_wtp: singleAnswers.q6,
          q7_ai_pest_intent: singleAnswers.q7,
          q8_bundle_wtp: singleAnswers.q8,
          q9_commerce_intent: singleAnswers.q9,
        }),
      }).then((r) => r.json());

      if (res?.ok) {
        setSubmittedId(res.response_id || 'RESP-COMPLETED');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setErrorMsg(res?.message || '설문 제출 중 일시적인 오류가 발생했습니다. 다시 시도해 주세요.');
      }
    } catch {
      setErrorMsg('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submittedId) {
    return (
      <div className="min-h-screen bg-slate-100 py-8 px-3 sm:px-6 flex items-center justify-center">
        <div className="max-w-2xl w-full bg-white rounded-3xl border-2 border-emerald-200 shadow-xl overflow-hidden">
          <div className="bg-emerald-950 text-white p-6 sm:p-8 text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center mx-auto text-emerald-300">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h1 className="text-xl sm:text-3xl font-extrabold whitespace-nowrap">
              {cleanKoreanText(surveyMeta.footer_title || '설문에 참여해 주셔서 감사합니다.')}
            </h1>
            <p className="text-base sm:text-lg text-slate-200 leading-relaxed break-keep">
              {cleanKoreanText(
                surveyMeta.footer_sub ||
                  '본 설문 결과는 한팜의 서비스 개발 및 사업성 검토를 위한 목적으로 활용됩니다.'
              )}
            </p>
          </div>
          <div className="p-5 sm:p-8 space-y-6 text-center">
            <div className="p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-200 text-[17px] sm:text-lg text-emerald-950 space-y-2.5 text-left leading-relaxed">
              <div className="font-extrabold text-lg sm:text-xl text-emerald-950 border-b border-emerald-200 pb-2 whitespace-nowrap">
                설문 응답 요약
              </div>
              {respondentRegion && <div>• 재배 지역: {respondentRegion}</div>}
              <div>• 연령대 / 규모: {singleAnswers.q1} / {singleAnswers.q2}</div>
              <div>
                • 주요 작물: {q3Selected.join(', ')}
                {q3OtherText ? ` (${q3OtherText})` : ''}
              </div>
              <div>• 맞춤형 재배일정: {singleAnswers.q5} ({singleAnswers.q6})</div>
              <div>• 병해충 진단: {singleAnswers.q7} ({singleAnswers.q8})</div>
              <div>• 농자재 주문·배송: {singleAnswers.q9}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                setSubmittedId(null);
                setSingleAnswers({});
                setQ3Selected([]);
                setQ3OtherText('');
              }}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-[17px] inline-flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <RotateCcw className="w-5 h-5" />
              다시 작성하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  const displayTitle = cleanKoreanText(
    surveyMeta.title || '한팜 맞춤형 재배관리 서비스 수요조사'
  );

  return (
    <div className="min-h-screen bg-slate-100 py-4 sm:py-8 px-3 sm:px-6 text-slate-900">
      <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
        {/* 상단 브랜드 & 응답 진행률 바 (한 줄 고정, 영어 제거) */}
        <div className="flex items-center justify-between gap-2 bg-white px-4 py-3.5 sm:px-5 sm:py-4 rounded-2xl border-2 border-slate-200 shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold shrink-0">
              <Sprout className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[17px] sm:text-lg font-extrabold text-slate-900 whitespace-nowrap leading-tight">
                한팜 수요조사
              </div>
              <div className="text-xs sm:text-sm font-semibold text-slate-600 whitespace-nowrap">
                맞춤형 재배일정 · 병해충 진단
              </div>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="text-[15px] sm:text-base font-extrabold text-emerald-800 whitespace-nowrap">
              진행률 {answeredCount} / {questions.length} 문항
            </div>
            <div className="w-24 sm:w-36 h-2.5 bg-slate-200 rounded-full overflow-hidden mt-1 ml-auto">
              <div
                className="h-full bg-emerald-600 transition-all"
                style={{ width: `${Math.round((answeredCount / questions.length) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* 설문 헤더 및 안내문 카드 */}
        <div className="bg-white rounded-3xl border-2 border-slate-200 shadow-xs overflow-hidden">
          <div className="bg-emerald-950 text-white px-4 py-5 sm:px-8 sm:py-7 space-y-2.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-sm sm:text-base font-extrabold whitespace-nowrap">
              <ClipboardList className="w-4 h-4 shrink-0" />
              농업인 서비스 수요조사
            </div>
            <h1 className="text-[17px] sm:text-2xl md:text-3xl font-extrabold tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
              {displayTitle}
            </h1>
          </div>

          <div className="p-4 sm:p-7 space-y-3.5 text-[17px] sm:text-lg leading-relaxed text-slate-800 bg-gradient-to-b from-emerald-50/40 to-white">
            <p className="font-extrabold text-slate-900 text-lg sm:text-xl whitespace-nowrap">
              {cleanKoreanText(surveyMeta.greeting_text || '안녕하세요, 농업인 여러분.')}
            </p>
            <p className="break-keep">
              {surveyMeta.intro_text ? (
                cleanKoreanText(surveyMeta.intro_text)
              ) : (
                <>
                  <strong className="text-emerald-900 font-extrabold">한팜</strong>은 농업인분들께서 보다 쉽고 편하게 작물을 재배하실 수 있도록{' '}
                  <strong className="text-emerald-900 font-extrabold">
                    맞춤형 재배일정 및 병해충 진단 서비스
                  </strong>
                  를 개발하고 있습니다.
                </>
              )}
            </p>
            <p className="break-keep">
              {cleanKoreanText(
                surveyMeta.duration_text ||
                  '본 설문은 서비스 개발과 적정 구독료 설정을 위한 조사이며, 약 2~3분 정도 소요됩니다.'
              )}
            </p>
            <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-200 text-amber-950 font-bold text-[16px] sm:text-lg leading-relaxed break-keep">
              {cleanKoreanText(
                surveyMeta.notice_text ||
                  '※ 본 설문은 맞춤형 재배일정과 병해충 진단이 실제 농작업에 활용할 수 있을 만큼 충분한 정확도와 신뢰성을 갖추었다는 가정하에 응답해 주시기 바랍니다.'
              )}
            </div>
            {isSurveyClosed && (
              <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-800 font-extrabold text-[16px] sm:text-lg flex items-center gap-2.5 break-keep">
                <AlertCircle className="w-6 h-6 shrink-0 text-rose-600" />
                <span>현재 본 설문조사는 마감되어 더 이상 응답 제출이 불가능합니다.</span>
              </div>
            )}
          </div>
        </div>

        {/* 참여자 기본 정보 카드 (선택 입력) */}
        <div className="bg-white rounded-3xl border-2 border-slate-200 p-4 sm:p-7 shadow-xs space-y-4">
          <div className="border-b border-slate-200 pb-3 space-y-1">
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 whitespace-nowrap">
              참여자 기본 정보 (선택 입력)
            </h2>
            <p className="text-[15px] sm:text-base text-slate-600 whitespace-nowrap">
              미입력 시 익명 접수 · 경품 및 안내용
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1.5 text-[16px] sm:text-lg font-extrabold text-slate-800 mb-1.5 whitespace-nowrap">
                <User className="w-4 h-4 text-emerald-700 shrink-0" />
                성함 또는 농장명 (선택)
              </label>
              <input
                type="text"
                value={respondentName}
                onChange={(e) => setRespondentName(e.target.value)}
                placeholder="예: 홍길동 농가"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 focus:bg-white border-2 border-slate-300 focus:border-emerald-600 font-bold text-[17px] sm:text-lg text-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-[16px] sm:text-lg font-extrabold text-slate-800 mb-1.5 whitespace-nowrap">
                <Phone className="w-4 h-4 text-emerald-700 shrink-0" />
                연락처 (선택)
              </label>
              <input
                type="tel"
                value={respondentContact}
                onChange={(e) => setRespondentContact(e.target.value)}
                placeholder="예: 010-1234-5678"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 focus:bg-white border-2 border-slate-300 focus:border-emerald-600 font-bold text-[17px] sm:text-lg text-slate-900 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label className="flex items-center gap-1.5 text-[16px] sm:text-lg font-extrabold text-slate-800 whitespace-nowrap">
                <MapPin className="w-4 h-4 text-emerald-700 shrink-0" />
                주요 재배 지역 (선택)
              </label>
              {respondentRegion && (
                <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 text-sm font-extrabold whitespace-nowrap overflow-hidden text-ellipsis">
                  {respondentRegion}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <select
                value={regionSido}
                disabled={isSurveyClosed}
                onChange={(e) => {
                  const nextSido = e.target.value;
                  setRegionSido(nextSido);
                  if (!nextSido) {
                    setRegionSigungu('');
                    setRegionDong('');
                    setDongList([]);
                    return;
                  }
                  const nextSgg = addressMeta.sigungusBySido[nextSido]?.[0] || '';
                  setRegionSigungu(nextSgg);
                  loadDongOptions(nextSido, nextSgg);
                }}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-300 font-bold text-[17px] sm:text-lg text-slate-900 cursor-pointer"
              >
                <option value="">시/도 선택</option>
                {(addressMeta.sidos.length > 0
                  ? addressMeta.sidos
                  : [
                      '서울특별시',
                      '부산광역시',
                      '대구광역시',
                      '인천광역시',
                      '광주광역시',
                      '대전광역시',
                      '울산광역시',
                      '세종특별자치시',
                      '경기도',
                      '강원특별자치도',
                      '충청북도',
                      '충청남도',
                      '전북특별자치도',
                      '전라남도',
                      '경상북도',
                      '경상남도',
                      '제주특별자치도',
                    ]
                ).map((sd) => (
                  <option key={sd} value={sd}>
                    {sd}
                  </option>
                ))}
              </select>

              <select
                value={regionSigungu}
                disabled={isSurveyClosed || !regionSido}
                onChange={(e) => {
                  const nextSgg = e.target.value;
                  setRegionSigungu(nextSgg);
                  if (!nextSgg) {
                    setRegionDong('');
                    setDongList([]);
                    return;
                  }
                  loadDongOptions(regionSido, nextSgg);
                }}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-300 font-bold text-[17px] sm:text-lg text-slate-900 cursor-pointer disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="">시/군/구 선택</option>
                {(addressMeta.sigungusBySido[regionSido] || []).map((sgg) => (
                  <option key={sgg} value={sgg}>
                    {sgg}
                  </option>
                ))}
              </select>

              <select
                value={regionDong}
                disabled={isSurveyClosed || !regionSido || !regionSigungu}
                onChange={(e) => setRegionDong(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-300 font-bold text-[17px] sm:text-lg text-slate-900 cursor-pointer disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="">읍/면/동 선택</option>
                {dongList.map((dong) => (
                  <option key={dong} value={dong}>
                    {dong}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 설문 문항 1 ~ 9 리스트 */}
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          {questions.map((q) => {
            const isMulti = q.type === 'multiple';
            const cleanedQuestion = cleanKoreanText(q.question);
            return (
              <div
                key={q.id}
                className="bg-white p-4 sm:p-6 rounded-3xl border-2 border-slate-200 shadow-xs space-y-4"
              >
                <div className="space-y-2">
                  <h3 className="text-[18px] sm:text-xl font-extrabold text-slate-900 leading-snug break-keep">
                    <span>
                      {q.number}. {cleanedQuestion}
                    </span>
                    <span
                      className={`inline-flex items-center align-middle ml-2 px-2.5 py-0.5 rounded-full text-xs sm:text-sm font-extrabold whitespace-nowrap ${
                        isMulti
                          ? 'bg-teal-100 text-teal-900 border border-teal-300'
                          : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      }`}
                    >
                      {isMulti ? '복수 선택' : '단일 선택'}
                    </span>
                  </h3>
                  {q.subtitle && (
                    <p className="text-[15px] sm:text-base font-semibold text-emerald-950 bg-emerald-50/90 px-3.5 py-2.5 rounded-xl border border-emerald-200 leading-relaxed break-keep">
                      {cleanKoreanText(q.subtitle)}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                  {q.options.map((opt) => {
                    const isChecked = isMulti
                      ? q3Selected.includes(opt)
                      : singleAnswers[q.id] === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        disabled={isSurveyClosed}
                        onClick={() =>
                          isMulti ? toggleQ3Option(opt) : handleSelectSingle(q.id, opt)
                        }
                        className={`w-full min-h-[54px] text-left flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 text-[17px] sm:text-lg font-bold cursor-pointer transition select-none disabled:opacity-60 disabled:cursor-not-allowed ${
                          isChecked
                            ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                            : 'bg-slate-50/70 text-slate-900 border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/40'
                        }`}
                      >
                        <span
                          className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 shrink-0 text-base font-extrabold ${
                            isChecked
                              ? 'bg-white text-emerald-800 border-white'
                              : 'border-slate-400 bg-white'
                          }`}
                        >
                          {isChecked && '✓'}
                        </span>
                        <span className="leading-snug break-keep">{opt}</span>
                      </button>
                    );
                  })}
                </div>

                {isMulti &&
                  q.allowOtherInput &&
                  q3Selected.some((o) => o.includes('기타')) && (
                    <div className="pt-2">
                      <label className="block text-[16px] sm:text-lg font-extrabold text-emerald-950 mb-2 whitespace-nowrap">
                        ⑦ 기타 재배 작물 직접 입력
                      </label>
                      <input
                        type="text"
                        value={q3OtherText}
                        onChange={(e) => setQ3OtherText(e.target.value)}
                        placeholder="예: 수박, 멜론, 인삼, 버섯 등"
                        className="w-full px-4 py-3 rounded-xl bg-white border-2 border-emerald-600 text-[17px] sm:text-lg font-bold text-slate-900 focus:outline-none"
                      />
                    </div>
                  )}
              </div>
            );
          })}

          {errorMsg && (
            <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-800 text-[16px] sm:text-lg font-extrabold flex items-center gap-2.5 break-keep">
              <AlertCircle className="w-6 h-6 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 하단 감사 인사 및 제출 카드 */}
          <div className="bg-white rounded-3xl border-2 border-slate-200 p-5 sm:p-7 shadow-xs space-y-5 text-center">
            <div className="space-y-1.5">
              <p className="text-lg sm:text-2xl font-extrabold text-slate-900 whitespace-nowrap">
                {cleanKoreanText(surveyMeta.footer_title || '설문에 참여해 주셔서 감사합니다.')}
              </p>
              <p className="text-[15px] sm:text-base text-slate-600 leading-relaxed break-keep">
                {cleanKoreanText(
                  surveyMeta.footer_sub ||
                    '본 설문 결과는 한팜의 서비스 개발 및 사업성 검토를 위한 목적으로 활용됩니다.'
                )}
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isSurveyClosed}
              className="w-full sm:w-auto min-w-72 px-8 py-4 rounded-2xl bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-extrabold text-xl shadow-lg shadow-emerald-700/20 inline-flex items-center justify-center gap-2.5 transition cursor-pointer"
            >
              <Send className="w-5 h-5" />
              {isSurveyClosed
                ? '설문 마감 (참여 불가)'
                : isSubmitting
                ? '설문 응답 제출 중...'
                : '설문 응답 제출하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
