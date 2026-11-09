---
name: climate-schedule-gdd
description: FarmPlan 재배일정 및 생육과정별 목표 적산온도(GDD/PGDD) 도달 일정 산출 시 적용하는 기후 데이터 대입 및 일정 결정 규칙 스킬. ① 첫 실질적 생육 작업 시작 시 작년 기준 해당 모종(작물) 최저온도 미만·최고온도 초과 기후 기간을 제외하고 최적 예상 온도일 때 시작, ② 작물구분이 '씨'일 경우 평균 온도가 최적 발아온도 이상인 빠른 시기에 평균날씨를 선택하여 파종 시작, ③ 지역별(시도·시군구·읍면동) 작물별 생육 과정 적산온도 및 작년+올해예측(현재+6개월) 기후 평균(미예측일 작년 단독)을 적용한다.
---

# 재배일정 · 목표 적산온도(GDD/PGDD) 기후 대입 스킬 (`climate-schedule-gdd`)

## 언제 이 스킬을 사용하는가
- `3. 재배 일정 관리 > 재배 일정 요청 관리` 및 `재배 일정 제공 관리` (`/api/schedule-provision`) 기능을 개발·수정·검증할 때
- `4. 농작물 관리 > 농작물 등록 및 관리` (`min_temp`, `max_temp`, `opt_temp`, `planting_type`, `germination_temp`) 및 `작물별 생육 과정 적산온도 관리` (`standard_template`의 `시도 · 시군구 · 읍면동` 지역별 적산온도)를 기반으로 재배일정을 산출할 때
- `6. 기후 관리 > 작년 지난 기후`(`climate_address_daily`)와 `올해 예측 기후`(`climate_future_daily`) 데이터를 결합하여 농작업 적기 및 수확 예정일을 계산할 때

---

## 핵심 규칙 정의

### 0. 재배 일정 결정 3대 핵심 규칙 (필수 준수)
1. **첫 실질적 생육 작업 시작 규칙 (모종·작물 최저/최고온도 제외 및 최적 예상 온도 시작)**:
   - 첫 실질적 생육 작업(정식 등)을 시작할 때는 **작년 기후 기준 해당 모종(작물)의 최저온도(`min_temp`)보다 낮고, 최고온도(`max_temp`)보다 높은 기후의 기간을 제외**해서 **최적의 예상 온도(`opt_temp`)일 때 시작**한다.
2. **작물구분 값이 `'씨'`일 경우 파종 시작 규칙**:
   - 작물구분(`planting_type`) 값이 `'씨'`일 경우, **평균 온도(`temp_avg`)가 적정 발아온도(`germination_temp`) 이상인 빠른 시기**에 **평균날씨(무강우·적습)**를 선택해서 생육과정 중 **파종**을 시작한다.
3. **재배지 정보(`시도, 시군구, 읍면동`) 기반 지역별 적산온도 연동 규칙**:
   - 같은 농작물이라도 지역별로 적산온도가 달라질 수 있으므로, `4. 농작물 관리 > 작물별 생육 과정 적산 온도 관리`(`standard_template`) 테이블에 등록된 `시도, 시군구, 읍면동` 재배지 기준 목표 적산온도(PGDD)를 우선 적용한다 (가을배추의 기본 기준 재배지는 `"충청북도 충주시 단월동"`으로 통일).

### 1. 왜 평균 대입 + 작년 데이터 폴백(Fallback) 규칙을 사용하는가?
1. **올해 예측 기후(`climate_future_daily`)의 6개월 한계**:
   - 기상청 API(단기·중기·1개월·3개월·6개월 전망)를 통한 올해 예측 기후 데이터는 **현재 시점 기준으로 최대 +6개월치까지만** 예측이 가능합니다.
   - 따라서 현재 시점으로부터 **6개월 이후의 날짜**는 (설령 그 날짜가 12월 31일 안쪽 날짜이거나 다음 해로 넘어가는 날짜라 하더라도) 예측 데이터가 존재하지 않는 **미예측 날짜**가 발생합니다.
2. **해결 원칙**:
   - **같은 날짜에 작년 데이터와 올해 예측 데이터가 모두 있을 때**: 두 기후 데이터의 **평균값(`(작년 + 올해예측) / 2`)**을 대입합니다.
   - **같은 날짜에 올해 예측 데이터가 없을 때(+6개월 이후 미예측 날짜)**: **작년 동일 날짜(`MM-DD`)의 기후 데이터**를 단독으로 참고하여 일정을 생성합니다.

---

### 2. 날짜별 기후 산출 공식 (`getClimateForDate(ymd)`)

입력 날짜 `ymd = 'YYYY-MM-DD'`, 월-일 `mmdd = ymd.slice(5, 10)` (`'MM-DD'`), 법정동코드 `bjd_code`에 대하여:

1. **작년 기후 조회 (`past`)**:
   - `climate_address_daily` 테이블에서 `bjd_code` 및 `month-day (mmdd)`가 일치하는 레코드 조회
2. **올해 예측 기후 조회 (`future`)**:
   - `ymd <= effectiveForecastHorizonDate` (현재 또는 예측 기준일 + 6개월 이내)이면서 `climate_future_daily` 테이블에 해당 날짜의 레코드가 존재하는지 확인
3. **분기 대입**:
   - **Case 1 (`past`와 `future`가 모두 존재하는 날짜 — `BLENDED_AVG`)**:
     ```ts
     temp_min = Number(((past.temp_min + future.temp_min) / 2 + regionalTopoOffset).toFixed(1));
     temp_max = Number(((past.temp_max + future.temp_max) / 2 + regionalTopoOffset).toFixed(1));
     temp_avg = Number(((past.temp_avg + future.temp_avg) / 2 + regionalTopoOffset).toFixed(1));
     humidity_avg = Number(((past.humidity_avg + future.humidity_avg) / 2).toFixed(1));
     precipitation_mm = Number(((past.precipitation_mm + future.precipitation_mm) / 2).toFixed(1));
     climate_source_mode = 'BLENDED_AVG';
     ```
   - **Case 2 (`future`가 없는 미예측 날짜 — `PAST_ONLY`)**:
     ```ts
     temp_min = Number((past.temp_min + regionalTopoOffset).toFixed(1));
     temp_max = Number((past.temp_max + regionalTopoOffset).toFixed(1));
     temp_avg = Number((past.temp_avg + regionalTopoOffset).toFixed(1));
     humidity_avg = Number(past.humidity_avg);
     precipitation_mm = Number(past.precipitation_mm);
     climate_source_mode = 'PAST_ONLY';
     ```

---

### 3. 검증 및 응답 메타데이터 필수 포함 항목
`/api/schedule-provision` 응답의 `climateOverview.climate_rule_policy` 및 각 공정별 `climate_stats`에는 항상 아래 항목이 포함되어야 합니다.
- `blended_days`: `(작년 + 올해예측) / 2` 평균값이 대입된 일수
- `past_only_days`: `+6개월 이후 미예측`으로 작년 기후가 단독 대입된 일수
- `climate_source_summary`: 구간별 기후 대입 방식 요약 문자열
- `forecast_base_date` / `forecast_horizon_end_date`: 예측 기준일 및 +6개월 예측 상한일
