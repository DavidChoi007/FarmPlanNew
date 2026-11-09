# 재배일정 및 목표 적산온도(GDD/PGDD) 산출 시 기후 데이터 대입 핵심 규칙

재배일정을 정할 때 생육과정의 목표 적산온도(GDD / AI-PGDD) 도달을 위한 재배지역별(`시도`, `시군구`, `읍면동` / `bjd_code`), 해당 농작물(`1단계 대분류`, `2단계 종목/작물`, `3단계 품종`) 등의 일정을 산출할 때는 반드시 아래의 **기후 데이터 대입 규칙**을 준수해야 합니다.

---

## 1. 규칙 제정 배경 (Why)

- `6. 기후 관리 > 올해 예측 기후` (`climate_future_daily`) 데이터는 기상청(KMA) API 특성상 **올해 1월 1일부터 현재 기준 최대 +6개월까지만** 예측·수집이 가능합니다.
- 따라서 현재 시점으로부터 **6개월 이후의 날짜**는 (설령 같은 해 12월 31일 안쪽 날짜이거나 다음 해로 이어지는 날짜라 할지라도) **올해 예측 기후 데이터가 존재하지 않는 미예측 날짜**가 발생합니다.
- 이를 해결하고 예측 신뢰도를 높이기 위해, 예측 데이터가 존재하는 날짜와 예측되지 못한 날짜를 구분하여 아래와 같이 대입합니다.

---

## 2. 날짜별 기후 데이터 대입 규칙 (Core Rule)

재배지역(`시도 > 시군구 > 읍면동`, `bjd_code`)의 특정 날짜(`YYYY-MM-DD`, 월-일 `MM-DD`)에 대한 일일 기후(`temp_min`, `temp_max`, `temp_avg`, `humidity_avg`, `precipitation_mm`)를 산출할 때:

### 규칙 A — 동일 날짜에 [작년 기후 데이터]와 [올해 예측 기후 데이터]가 모두 존재하는 경우 (`BLENDED_AVG`)
- 현재 기준 +6개월 이내여서 `climate_future_daily`(올해 예측 기후)와 `climate_address_daily`(작년 동일 날짜 `MM-DD` 실측 기후)에 같은 날짜의 기후 데이터가 모두 존재할 때는 **두 기후 데이터의 평균값**을 대입합니다.
  - `대입 최저기온(temp_min)` = `(작년 temp_min + 올해예측 temp_min) / 2`
  - `대입 최고기온(temp_max)` = `(작년 temp_max + 올해예측 temp_max) / 2`
  - `대입 평균기온(temp_avg)` = `(작년 temp_avg + 올해예측 temp_avg) / 2`
  - `대입 평균습도(humidity_avg)` = `(작년 humidity_avg + 올해예측 humidity_avg) / 2`
  - `대입 강수량(precipitation_mm)` = `(작년 precipitation_mm + 올해예측 precipitation_mm) / 2`

### 규칙 B — 동일 날짜에 [올해 예측 기후 데이터]가 없는 경우 (`PAST_ONLY`)
- 현재 기준 +6개월 이후여서(12월 31일 안쪽 날짜이거나 차년도 날짜 포함) 올해 예측 기후 데이터가 존재하지 않는 미예측 날짜는 **작년 동일 날짜(`MM-DD`)의 기후 데이터(`climate_address_daily`)를 단독으로 참고**하여 생성합니다.
  - `대입 기후값` = `작년 동일 날짜(MM-DD) 기후 데이터 단독 대입`

---

## 3. 시스템 코드 적용 위치

- **백엔드 엔진**: `server/index.ts` 내 `/api/schedule-provision`의 `getClimateForDate(ymd)` 및 `analyzePeriodClimate(startYmd, endYmd, isAfterPlanting)`
- **프론트엔드 UI**: `src/pages/AdminDashboardPage.tsx` 내 `3. 재배 일정 관리 > 재배 일정 제공 관리` 모달 및 세부 정보 창
- 향후 재배일정 생성, 생육과정별 목표 적산온도(GDD/PGDD) 도달일 계산, 최적 파종·정식·수확기 탐색 로직을 수정하거나 확장할 때 언제나 이 규칙을 최우선으로 유지해야 합니다.
