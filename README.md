# FarmPlan (팜플랜) - 기후 데이터 기반 맞춤형 작물 생육예측 · 재배일정 및 농자재 통합 관제 플랫폼

> **특허 KR 10-2814596 기반** · 유효적산온도(GDD/PGDD) 및 작년·올해 예측 기후 데이터를 결합한 정밀 재배일정 산출 및 농자재 추천 플랫폼

---

## 1. 외부 접속 및 소스 확인 링크

- **GitHub 공개 저장소 (Public Repository)**: [https://github.com/DavidChoi007/FarmPlanNew](https://github.com/DavidChoi007/FarmPlanNew)
- **GitHub Pages 웹 배포 URL**:
  - **사용자(USER) 페이지**: [https://davidchoi007.github.io/FarmPlanNew/](https://davidchoi007.github.io/FarmPlanNew/)
  - **관리자(ADMIN) 페이지**: [https://davidchoi007.github.io/FarmPlanNew/admin](https://davidchoi007.github.io/FarmPlanNew/admin)
- **실시간 풀스택 외부 접속 URL (Tunnel)**:
  - **사용자(USER) 페이지**: [https://22415286db83b0.lhr.life/](https://22415286db83b0.lhr.life/)
  - **관리자(ADMIN) 페이지**: [https://22415286db83b0.lhr.life/admin](https://22415286db83b0.lhr.life/admin)

---

## 2. 주요 기능 요약

1. **기후 데이터 기반 맞춤형 재배일정 산출 (`climate-schedule-gdd`)**
   - 전국 법정동(시도·시군구·읍면동) 기상 관측소 및 작년(2025) 실측 + 올해(2026~2027) 예측 기후 평균 대입
   - 작물별 최저/최적/한계 온도 및 발아 온도 규칙 기반 파종·정식 시작일 자동 탐색
   - 생육 과정별 목표 유효적산온도(PGDD) 도달 일정 자동 산출
2. **농자재 상품 관리 및 유저 카탈로그 (총 75개 상품 · 1페이지 20개 페이징)**
   - **비료 (`FERTILIZER`)**: 25종 (`FERT-PRD-01` ~ `FERT-PRD-25`)
   - **영양제 (`NUTRIENT`)**: 25종 (`MAT-NUTR-01` ~ `MAT-NUTR-25`)
   - **병해충관리제 (`PESTICIDE`)**: 25종 (`MAT-PEST-01` ~ `MAT-PEST-25`)
   - 세부 분류 필터, 유기농업자재 필터, 키워드 검색 및 1페이지당 20개 페이징 지원
3. **회원 맞춤형 마이페이지 및 재배일정 매칭**
   - 기본 회원: `CloudBae@naver.com` (이름: **배철민**, 비밀번호: `1234`)
   - 재배일정 요청 내역, 제공된 맞춤형 재배일정 간트차트, 농자재 원클릭 구매 내역 통합 조회
4. **원격 Supabase PostgreSQL 17 클라우드 DB 연동**
   - 전체 38개 테이블 실시간 양방향 동기화 (`server/supabaseClient.ts`)

---

## 3. 로컬 실행 방법

```bash
# 1. 패키지 설치
npm install

# 2. 환경변수 설정 (.env.example 참고하여 .env 생성)
cp .env.example .env

# 3. 백엔드 API 서버 실행 (Port 3001)
npm run dev:server

# 4. 프론트엔드 개발 서버 실행 (Port 5173)
npm run dev:client
```
