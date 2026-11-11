import React, { useEffect, useState } from 'react';
import { Sprout, Check, CheckCircle2, ArrowLeft } from 'lucide-react';
import { Link, decodeSharePayload } from '../router.tsx';

const DEFAULT_TEMPLATE = {
  docNumber: '제 HANFARM-2026-LOI 호',
  docCategory: '한팜 맞춤형 재배관리 플랫폼 표준 구독·구매의향서',
  docTitle: '한팜 맞춤형 재배관리 플랫폼 구독의향서',
  introLine1:
    '한팜은 작물·품종·지역·기상정보에 기반한 맞춤형 재배일정과 AI 병해충 진단 서비스를 개발하고 있습니다.',
  introLine2:
    '본인은 해당 서비스가 실제 재배관리에 활용할 수 있을 만큼 충분한 정확도와 신뢰성을 갖추고, 합리적인 구독료로 제공될 경우 이용할 의향이 있음을 확인합니다.',
  sec1Title: '1. 구독의향자 정보',
  labelApplicant: '- 성명(또는 농장명):',
  labelContact: '- 연락처:',
  labelCrops: '- 주요 재배작물:',
  sec2Title: '2. 구독 희망 서비스',
  serviceOptions: ['맞춤형 재배일정', '맞춤형 재배일정 + AI 병해충 진단'],
  sec3Title: '3. 월 구독료 지불의향',
  priceOptions: ['월 5,000원', '월 10,000원', '월 20,000원', '월 30,000원 초과'],
  sec4Title: '4. 구독의향 확인',
  sec4Line1:
    '본인은 한팜 플랫폼이 정식 출시되고, 서비스의 정확도·기능·가격 등이 적합할 경우 유료 구독할 의향이 있습니다.',
  sec4Line2: '본 의향서는 법적 구속력이 없으며 실제 구독이나 결제 의무가 발생하지 않습니다.',
  confirmTitle: '한팜 구매·구독 의향 확인',
  confirmBadge: '최종 확인 폼',
  finalIntentOptions: ['농자재 구매의향', '플랫폼 유료 구독의향'],
  confirmNotice:
    '본인은 한팜 서비스가 정식 출시되고 상품·서비스의 품질, 가격 및 이용조건이 적합할 경우 위 선택한 서비스를 이용할 의향이 있습니다. 본 의향 확인은 법적 구속력이 없으며 실제 구매·구독 의무가 발생하지 않습니다.',
  agreeLabel: '위 내용을 확인하고 본인의 의사로 동의합니다.',
  footerNote: '※ 개인정보 수집·이용 및 서비스 출시 안내에 대한 동의는 별도로 받습니다.',
  recipientName: '한팜(HANFARM) 재배컨설팅 플랫폼 귀중',
};

function normalizeIntentTemplate(raw: any): typeof DEFAULT_TEMPLATE {
  if (!raw || typeof raw !== 'object') return DEFAULT_TEMPLATE;
  const srcRaw = raw.template && typeof raw.template === 'object' ? raw.template : raw;
  const { _synced_to_sb, updated_at, ...src } = srcRaw || {};
  const rawRecipient = String(src.recipientName || '').trim();
  const recipientName =
    !rawRecipient || rawRecipient === '한팜(HANFARM) 맞춤형 재배관리 플랫폼 귀중'
      ? DEFAULT_TEMPLATE.recipientName
      : rawRecipient;
  return {
    ...DEFAULT_TEMPLATE,
    ...src,
    recipientName,
    serviceOptions:
      Array.isArray(src.serviceOptions) && src.serviceOptions.length > 0
        ? src.serviceOptions.map((x: any) => String(x || '').trim()).filter(Boolean)
        : DEFAULT_TEMPLATE.serviceOptions,
    priceOptions:
      Array.isArray(src.priceOptions) && src.priceOptions.length > 0
        ? src.priceOptions.map((x: any) => String(x || '').trim()).filter(Boolean)
        : DEFAULT_TEMPLATE.priceOptions,
    finalIntentOptions:
      Array.isArray(src.finalIntentOptions) && src.finalIntentOptions.length > 0
        ? src.finalIntentOptions.map((x: any) => String(x || '').trim()).filter(Boolean)
        : DEFAULT_TEMPLATE.finalIntentOptions,
  };
}

export default function PurchaseIntentPublicPage() {
  const today = new Date();
  const [tpl, setTpl] = useState<typeof DEFAULT_TEMPLATE>(() => {
    try {
      const saved = localStorage.getItem('hanfarm_purchase_intent_template_v1');
      if (saved) return normalizeIntentTemplate(JSON.parse(saved));
      const params = new URLSearchParams(window.location.search);
      const urlCfg = decodeSharePayload(params.get('cfg'));
      if (urlCfg) {
        return normalizeIntentTemplate(urlCfg);
      }
    } catch {
      // ignore
    }
    return DEFAULT_TEMPLATE;
  });

  useEffect(() => {
    document.title = '구매 및 구독 의향서';
    const setMetaContent = (selector: string, val: string) => {
      const el = document.querySelector(selector);
      if (el) el.setAttribute('content', val);
    };
    setMetaContent('meta[property="og:title"]', '구매 및 구독 의향서');
    setMetaContent('meta[property="og:description"]', '구매 및 구독 의향서');
    setMetaContent('meta[name="description"]', '구매 및 구독 의향서');
    setMetaContent('meta[name="twitter:title"]', '구매 및 구독 의향서');
    setMetaContent('meta[name="twitter:description"]', '구매 및 구독 의향서');

    const syncFromDb = () => {
      fetch('/api/purchase-intents')
        .then((r) => r.json())
        .then((res) => {
          if (res?.template) {
            const merged = normalizeIntentTemplate(res.template);
            setTpl(merged);
            setForm((prev) => {
              const validServices = prev.desiredServices.filter((s) =>
                merged.serviceOptions.includes(s)
              );
              const validFinalIntents = prev.finalIntents.filter((f) =>
                merged.finalIntentOptions.includes(f)
              );
              return {
                ...prev,
                desiredServices:
                  validServices.length > 0
                    ? validServices
                    : [merged.serviceOptions[1] || merged.serviceOptions[0] || '맞춤형 재배일정'],
                monthlyWtp: merged.priceOptions.includes(prev.monthlyWtp)
                  ? prev.monthlyWtp
                  : merged.priceOptions[1] || merged.priceOptions[0] || '월 10,000원',
                finalIntents:
                  validFinalIntents.length > 0 ? validFinalIntents : [...merged.finalIntentOptions],
              };
            });
          }
        })
        .catch(() => {});
    };

    syncFromDb();
    window.addEventListener('focus', syncFromDb);
    return () => window.removeEventListener('focus', syncFromDb);
  }, []);

  const [form, setForm] = useState({
    applicantName: '',
    contact: '',
    mainCrops: '',
    desiredServices: ['맞춤형 재배일정 + AI 병해충 진단'] as string[],
    monthlyWtp: '월 10,000원',
    finalIntents: ['농자재 구매의향', '플랫폼 유료 구독의향'] as string[],
    writtenYear: '2026',
    writtenMonth: String(today.getMonth() + 1).padStart(2, '0'),
    writtenDay: String(today.getDate()).padStart(2, '0'),
    agreedFinal: true,
    agreedPrivacySeparate: true,
  });

  const [copiedMessage, setCopiedMessage] = useState<string>('');
  const [submitted, setSubmitted] = useState<boolean>(false);

  const toggleDesiredService = (service: string) => {
    setForm((prev) => {
      const exists = prev.desiredServices.includes(service);
      return {
        ...prev,
        desiredServices: exists
          ? prev.desiredServices.filter((s) => s !== service)
          : [...prev.desiredServices, service],
      };
    });
  };

  const toggleFinalIntent = (intent: string) => {
    setForm((prev) => {
      const exists = prev.finalIntents.includes(intent);
      return {
        ...prev,
        finalIntents: exists
          ? prev.finalIntents.filter((i) => i !== intent)
          : [...prev.finalIntents, intent],
      };
    });
  };

  const buildSummaryText = () => {
    return [
      `[${tpl.docTitle}]`,
      '',
      tpl.introLine1,
      tpl.introLine2,
      '',
      tpl.sec1Title,
      `${tpl.labelApplicant} ${form.applicantName || '(미입력)'}`,
      `${tpl.labelContact} ${form.contact || '(미입력)'}`,
      `${tpl.labelCrops} ${form.mainCrops || '(미입력)'}`,
      '',
      tpl.sec2Title,
      `- ${form.desiredServices.length > 0 ? form.desiredServices.join(', ') : '(미선택)'}`,
      '',
      tpl.sec3Title,
      `- ${form.monthlyWtp || '(미선택)'}`,
      '',
      `4. ${tpl.confirmTitle}`,
      `- 의향 확인: ${form.finalIntents.length > 0 ? form.finalIntents.join(', ') : '(미선택)'}`,
      `- ${tpl.sec4Line1}`,
      `- ${tpl.sec4Line2}`,
      `- 본인 의사 동의 여부: ${form.agreedFinal ? '동의함' : '미동의'}`,
      `- 작성일: ${form.writtenYear}년 ${form.writtenMonth}월 ${form.writtenDay}일`,
      `- 개인정보 수집·이용 및 서비스 출시 안내 별도 동의: ${form.agreedPrivacySeparate ? '동의함' : '추후 별도 동의'}`,
    ].join('\n');
  };

  const handleCopyConsentText = () => {
    const text = buildSummaryText();
    navigator.clipboard?.writeText(text);
    setCopiedMessage('동의 내용 및 구독의향서 전문이 클립보드에 복사되었습니다.');
    setTimeout(() => setCopiedMessage(''), 4000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.applicantName.trim()) {
      window.alert('성명(또는 농장명)을 입력해 주세요.');
      return;
    }
    if (!form.agreedFinal) {
      window.alert('최종 확인 폼의 "위 내용을 확인하고 본인의 의사로 동의합니다." 항목에 체크해 주세요.');
      return;
    }
    const newEntry = {
      intent_id: `LOI-2026-${Date.now().toString().slice(-4)}`,
      applicant_name: form.applicantName.trim(),
      contact: form.contact.trim() || '010-****-****',
      main_crops: form.mainCrops.trim() || '가을배추',
      desired_services: form.desiredServices,
      monthly_wtp: form.monthlyWtp,
      final_intents: form.finalIntents,
      written_date: `${form.writtenYear}-${form.writtenMonth.padStart(2, '0')}-${form.writtenDay.padStart(2, '0')}`,
      agreed_final: form.agreedFinal,
      agreed_privacy: form.agreedPrivacySeparate,
      created_at: new Date().toISOString().slice(0, 16).replace('T', ' '),
    };
    try {
      await fetch('/api/purchase-intents/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEntry),
      });
    } catch {
      // ignore network errors
    }
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-slate-200/80 text-slate-900 py-8 px-3 sm:px-6">
      <div className="max-w-[820px] mx-auto space-y-4">
        {/* 상단 컨트롤 바 */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs">
              <Sprout className="w-4 h-4" />
            </div>
            <div>
              <span className="font-extrabold text-sm text-slate-900 block leading-none">
                한팜 (FarmPlan) 표준 공문 양식
              </span>
              <span className="text-[11px] text-slate-600 font-semibold">
                A4 (210 × 297mm) 맞춤형 재배관리 플랫폼 구독·구매의향서
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-xs font-extrabold text-slate-800 cursor-pointer"
            >
              🖨️ A4 인쇄 / PDF 저장
            </button>
            <Link
              to="/admin"
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-xs font-bold text-slate-700 inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              관리자 페이지
            </Link>
          </div>
        </div>

        {submitted ? (
          <div className="bg-white border border-slate-300 shadow-[0_14px_40px_rgba(15,23,42,0.12)] p-10 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900">
              한팜 맞춤형 재배관리 플랫폼 구독·구매의향서가 접수되었습니다
            </h2>
            <p className="text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
              <strong>{form.applicantName}</strong> 님의 소중한 구독·구매 의향 확인이 정상적으로 저장되었습니다.
            </p>
            <pre className="text-left text-xs bg-slate-50 border border-slate-200 rounded-2xl p-4 max-w-xl mx-auto whitespace-pre-wrap font-mono text-slate-700">
              {buildSummaryText()}
            </pre>
            <div className="pt-2 flex justify-center gap-3">
              <button
                type="button"
                onClick={handleCopyConsentText}
                className="px-5 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs cursor-pointer"
              >
                동의 내용 복사
              </button>
              <a
                href="https://www.farmplan.co.kr"
                onClick={(e) => {
                  e.preventDefault();
                  window.location.href = 'https://www.farmplan.co.kr';
                }}
                className="px-6 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs inline-flex items-center justify-center cursor-pointer"
              >
                완료
              </a>
            </div>
            {copiedMessage && (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-extrabold text-center max-w-md mx-auto">
                {copiedMessage}
              </div>
            )}
          </div>
        ) : (
          /* 실제 A4 1페이지 공문 컨테이너 */
          <form
            onSubmit={handleSubmit}
            className="w-full min-h-[1120px] bg-white text-slate-900 border border-slate-300 shadow-[0_14px_40px_rgba(15,23,42,0.12)] px-7 sm:px-16 py-10 sm:py-14 flex flex-col justify-between"
          >
            <div className="space-y-7">
              {/* 공문 상단 문서번호 및 분류 헤더 */}
              <div className="flex items-center justify-between text-[11px] text-slate-500 border-b border-slate-300 pb-2.5 font-mono">
                <span>문서번호: {tpl.docNumber}</span>
                <span>양식구분: {tpl.docCategory}</span>
              </div>

              {/* 공문 타이틀 */}
              <div className="text-center py-3 border-b-2 border-slate-900">
                <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight text-slate-950">
                  {tpl.docTitle}
                </h1>
              </div>

              {/* 공문 전문 (도입부) */}
              <div className="space-y-2.5 text-sm sm:text-[15px] leading-relaxed text-slate-800 font-medium pt-1">
                <p>{tpl.introLine1}</p>
                <p className="text-slate-950 font-semibold">
                  {tpl.introLine2}
                </p>
              </div>

              {/* 1. 구독의향자 정보 */}
              <div className="space-y-3 pt-1">
                <h2 className="text-base sm:text-[17px] font-extrabold text-slate-950">
                  {tpl.sec1Title}
                </h2>
                <div className="pl-2 sm:pl-4 space-y-2.5 text-sm sm:text-[15px] text-slate-900">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-bold w-40 shrink-0">{tpl.labelApplicant}</span>
                    <input
                      type="text"
                      value={form.applicantName}
                      onChange={(e) => setForm({ ...form, applicantName: e.target.value })}
                      placeholder="성명 또는 농장명 입력"
                      className="w-64 sm:w-80 border-b border-slate-800 px-2 py-0.5 text-sm sm:text-[15px] font-bold text-slate-950 bg-transparent focus:outline-none focus:border-emerald-700"
                    />
                  </div>

                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-bold w-40 shrink-0">{tpl.labelContact}</span>
                    <input
                      type="text"
                      value={form.contact}
                      onChange={(e) => setForm({ ...form, contact: e.target.value })}
                      placeholder="010-0000-0000"
                      className="w-64 sm:w-80 border-b border-slate-800 px-2 py-0.5 text-sm sm:text-[15px] font-bold text-slate-950 bg-transparent focus:outline-none focus:border-emerald-700"
                    />
                  </div>

                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-bold w-40 shrink-0">{tpl.labelCrops}</span>
                    <input
                      type="text"
                      value={form.mainCrops}
                      onChange={(e) => setForm({ ...form, mainCrops: e.target.value })}
                      placeholder="예: 가을배추, 고추, 마늘 등"
                      className="w-64 sm:w-80 border-b border-slate-800 px-2 py-0.5 text-sm sm:text-[15px] font-bold text-slate-950 bg-transparent focus:outline-none focus:border-emerald-700"
                    />
                  </div>
                </div>
              </div>

              {/* 2. 구독 희망 서비스 */}
              <div className="space-y-2.5 pt-1">
                <h2 className="text-base sm:text-[17px] font-extrabold text-slate-950">
                  {tpl.sec2Title}
                </h2>
                <div className="pl-2 sm:pl-4 flex flex-col sm:flex-row sm:items-center flex-wrap gap-3 sm:gap-10 text-sm sm:text-[15px]">
                  {tpl.serviceOptions.map((svc) => {
                    const checked = form.desiredServices.includes(svc);
                    return (
                      <button
                        key={svc}
                        type="button"
                        onClick={() => toggleDesiredService(svc)}
                        className="inline-flex items-center gap-2.5 text-left font-bold text-slate-900 hover:text-emerald-700 cursor-pointer py-0.5"
                      >
                        <span
                          className={`w-5 h-5 border border-slate-800 inline-flex items-center justify-center text-xs font-extrabold ${
                            checked ? 'bg-slate-900 text-white' : 'bg-white text-transparent'
                          }`}
                        >
                          ✓
                        </span>
                        <span>{svc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. 월 구독료 지불의향 */}
              <div className="space-y-2.5 pt-1">
                <h2 className="text-base sm:text-[17px] font-extrabold text-slate-950">
                  {tpl.sec3Title}
                </h2>
                <div className="pl-2 sm:pl-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm sm:text-[15px]">
                  {tpl.priceOptions.map((price) => {
                    const checked = form.monthlyWtp === price;
                    return (
                      <button
                        key={price}
                        type="button"
                        onClick={() => setForm({ ...form, monthlyWtp: price })}
                        className="inline-flex items-center gap-2.5 text-left font-bold text-slate-900 hover:text-emerald-700 cursor-pointer py-0.5"
                      >
                        <span
                          className={`w-5 h-5 border border-slate-800 inline-flex items-center justify-center text-xs font-extrabold ${
                            checked ? 'bg-slate-900 text-white' : 'bg-white text-transparent'
                          }`}
                        >
                          ✓
                        </span>
                        <span>{price}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. 구독의향 확인 */}
              <div className="space-y-3 pt-1">
                <h2 className="text-base sm:text-[17px] font-extrabold text-slate-950">
                  {tpl.sec4Title}
                </h2>
                <div className="pl-2 sm:pl-4 space-y-2 text-sm sm:text-[15px] text-slate-800 leading-relaxed">
                  <p className="font-semibold text-slate-950">
                    {tpl.sec4Line1}
                  </p>
                  <p>
                    {tpl.sec4Line2}
                  </p>

                  {/* 작성일: 2026년 _____월 _____일 */}
                  <div className="pt-3 flex items-center justify-end gap-1.5 text-sm sm:text-base font-extrabold text-slate-950">
                    <span>작성일:</span>
                    <input
                      type="text"
                      value={form.writtenYear}
                      onChange={(e) => setForm({ ...form, writtenYear: e.target.value })}
                      className="w-14 text-center border-b border-slate-800 bg-transparent font-extrabold focus:outline-none"
                    />
                    <span>년</span>
                    <input
                      type="text"
                      value={form.writtenMonth}
                      onChange={(e) => setForm({ ...form, writtenMonth: e.target.value })}
                      className="w-10 text-center border-b border-slate-800 bg-transparent font-extrabold focus:outline-none"
                    />
                    <span>월</span>
                    <input
                      type="text"
                      value={form.writtenDay}
                      onChange={(e) => setForm({ ...form, writtenDay: e.target.value })}
                      className="w-10 text-center border-b border-slate-800 bg-transparent font-extrabold focus:outline-none"
                    />
                    <span>일</span>
                  </div>
                </div>
              </div>

              {/* A4 공문 하단 내장: 첨부 이미지 형태의 [한팜 구매·구독 의향 확인] 최종 서명·확인 박스 */}
              <div className="rounded-3xl border border-slate-300 bg-slate-50/60 p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-950 tracking-tight">
                    {tpl.confirmTitle}
                  </h3>
                  <span className="px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-600 text-xs font-bold">
                    {tpl.confirmBadge}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                  <div className="sm:col-span-5 space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      성명 또는 농장명
                    </label>
                    <input
                      type="text"
                      value={form.applicantName}
                      onChange={(e) => setForm({ ...form, applicantName: e.target.value })}
                      placeholder="성명을 입력해 주세요"
                      className="w-full px-4 py-2.5 rounded-full bg-white border border-slate-300 text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div className="sm:col-span-7 space-y-1.5">
                    <div className="text-xs font-bold text-slate-700">
                      의향 확인 (복수 선택 가능)
                    </div>
                    <div className="flex flex-wrap items-center gap-5 pt-1">
                      {tpl.finalIntentOptions.map((intentItem) => {
                        const checked = form.finalIntents.includes(intentItem);
                        return (
                          <button
                            key={intentItem}
                            type="button"
                            onClick={() => toggleFinalIntent(intentItem)}
                            className="inline-flex items-center gap-2.5 text-left cursor-pointer"
                          >
                            <span
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
                                checked
                                  ? 'border-emerald-600 bg-emerald-600 text-white'
                                  : 'border-slate-400 bg-white'
                              }`}
                            >
                              {checked && <Check className="w-3 h-3 stroke-[3]" />}
                            </span>
                            <span className="text-sm font-extrabold text-slate-900">
                              {intentItem}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <hr className="border-slate-200" />

                <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium">
                  {tpl.confirmNotice}
                </p>

                <button
                  type="button"
                  onClick={() => setForm({ ...form, agreedFinal: !form.agreedFinal })}
                  className="w-full flex items-center gap-3 py-0.5 text-left cursor-pointer"
                >
                  <span
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
                      form.agreedFinal
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-400 bg-white'
                    }`}
                  >
                    {form.agreedFinal && <Check className="w-3 h-3 stroke-[3]" />}
                  </span>
                  <span className="text-sm sm:text-[15px] font-extrabold text-slate-950">
                    {tpl.agreeLabel}
                  </span>
                </button>

                <div className="pt-1">
                  <button
                    type="submit"
                    className="w-full py-3 px-6 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm sm:text-base shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>구매의향서 최종 승인 및 제출</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 공문 최하단 구분선 및 부기 사항 */}
            <div className="pt-6 mt-6 border-t border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
              <span className="font-semibold">
                {tpl.footerNote}
              </span>
              <span className="font-extrabold text-slate-800 tracking-wide">
                {tpl.recipientName}
              </span>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
