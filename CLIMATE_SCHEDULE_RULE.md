# FarmPlan 재배일정 산출 · 목표 적산온도(GDD/PGDD) 기후 데이터 대입 규칙 명세서

> **문서 목적**: 농작물(1단계 대분류 · 2단계 종목 · 3단계 품종) 및 재배지역(시도 · 시군구 · 읍면동 / `bjd_code`)별 생육과정 목표 적산온도(GDD / AI-PGDD) 도달 일정을 산출할 때, 시스템과 AI 에이전트가 상시 준수해야 하는 기후 데이터 대입 표준 규칙을 정의합니다.

---

## 1. 규칙 제정 배경

1. **기존 방식**:
   - 기존에는 재배지역별(`시도`, `시군구`, `읍면동`) 작년도 365일 실측 기후 데이터(`climate_address_daily`)만을 단독으로 참고하여 생육과정별 적산온도 도달일과 농작업 일정을 산출했습니다.
2. **올해 예측 기후 데이터의 특성 (+6개월 예측 한계)**:
   - `6. 기후 관리 > 올해 예측 기후` (`climate_future_daily`) 데이터는 올해 1월 1일부터 **현재 날짜(산출 기준일)로부터 최대 +6개월까지만** 기상청 API 예측 수집이 가능합니다.
   - 따라서 현재 시점으로부터 **6개월 이후의 날짜**는 — 설령 그 날짜가 올해 **12월 31일 안쪽 날짜**이거나 내년으로 넘어가는 날짜라 할지라도 — **올해 예측 기후 데이터가 존재하지 않는 미예측 날짜**가 됩니다.
3. **신규 하이브리드 대입 규칙 도입**:
   - 같은 날짜에 작년 기후 데이터와 올해 예측 기후 데이터가 **모두 존재할 때는 두 기후 데이터의 평균값(`(작년 + 올해예측) / 2`)**을 대입합니다.
   - 6개월 이후여서 같은 날짜의 올해 예측 기후 데이터가 **없을 때는 작년 동일 날짜(`MM-DD`)의 기후 데이터를 단독 참고**하여 일정을 생성합니다.

---

## 2. 날짜별 기후 데이터 대입 알고리즘

| 구분 | 조건 | 대입 방식 (`climate_source_mode`) | 산출 수식 (기온·습도·강수량) |
| :--- | :--- | :--- | :--- |
| **케이스 1 (평균 대입)** | 동일 날짜에 **작년 기후 데이터(`climate_address_daily`)**와 **올해 예측 기후 데이터(`climate_future_daily`, 현재 기준 +6개월 이내)**가 모두 존재할 때 | `BLENDED_AVG` (`작년+올해예측 평균`) | `temp_min = (작년 temp_min + 올해예측 temp_min) / 2`<br>`temp_max = (작년 temp_max + 올해예측 temp_max) / 2`<br>`temp_avg = (작년 temp_avg + 올해예측 temp_avg) / 2`<br>`humidity_avg = (작년 humidity_avg + 올해예측 humidity_avg) / 2`<br>`precipitation_mm = (작년 precipitation_mm + 올해예측 precipitation_mm) / 2` |
| **케이스 2 (작년 폴백)** | 현재 기준 **+6개월 이후**(12월 31일 안쪽 날짜 포함) 등 동일 날짜의 **올해 예측 기후 데이터가 없을 때** | `PAST_ONLY` (`미예측일 작년 단독 참조`) | `temp_min = 작년 동일 날짜(MM-DD) temp_min`<br>`temp_max = 작년 동일 날짜(MM-DD) temp_max`<br>`temp_avg = 작년 동일 날짜(MM-DD) temp_avg`<br>`humidity_avg = 작년 동일 날짜(MM-DD) humidity_avg`<br>`precipitation_mm = 작년 동일 날짜(MM-DD) precipitation_mm` |

---

## 3. 관련 파일 및 영구 설정 현황

1. **시스템 백엔드 엔진**: [server/index.ts](file:///d:/Developement/FarmPlanNew/server/index.ts#L3765-L4295)
   - `/api/schedule-provision` 내 `getClimateForDate(ymd)`, `analyzePeriodClimate()`, `climateOverview.climate_rule_policy`
   - 쿼리 파라미터 `forecast_base_date` 또는 `forecast_horizon_date`를 통해 임의 기준일(+6개월 상한) 시뮬레이션도 지원
2. **프론트엔드 대시보드 UI**: [src/pages/AdminDashboardPage.tsx](file:///d:/Developement/FarmPlanNew/src/pages/AdminDashboardPage.tsx#L7852-L7868)
   - `3. 재배 일정 관리 > 재배 일정 제공 관리` 상단 헤더 배지 및 `[세부 정보 보기]` 모달 내 대입 평균기온(작년/올해예측 병기) 및 구간별 평균대입 일수·작년단독 일수 표시
3. **Antigravity 워크스페이스 상시 규칙**: [.agents/rules/climate-schedule-rule.md](file:///d:/Developement/FarmPlanNew/.agents/rules/climate-schedule-rule.md)
4. **Antigravity 전용 스킬 파일**: [.agents/skills/climate-schedule-gdd/SKILL.md](file:///d:/Developement/FarmPlanNew/.agents/skills/climate-schedule-gdd/SKILL.md)
