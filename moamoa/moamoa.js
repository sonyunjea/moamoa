/**
 * 지방재정통합공시관 - 순수 JavaScript (Vanilla JS) 단일 애플리케이션
 * - 별도의 HTML 작성 없이 JavaScript만으로 스타일, 외부 라이브러리(Tailwind, Leaflet),
 *   전국 지도(5단계 예산 구간 컬러 마커 및 범례), 연도별 지자체 색상 분할 누적 막대 그래프,
 *   그리고 생략 없는 전체 세부 지출 내역 테이블을 렌더링합니다.
 */

(function () {
    'use strict';

    // =========================================================================
    // 1. 연도(2014 ~ 현재연도 자동 갱신) 및 전국 17개 광역자치단체 정의
    // =========================================================================
    const CURRENT_YEAR = new Date().getFullYear();
    const YEARS = Array.from({ length: Math.max(1, CURRENT_YEAR - 2014 + 1) }, (_, i) => 2014 + i);

    // 2014~2025년 기준 17개 광역자치단체 정보
    const BASE_REGIONS = [
        { id: '11', name: '서울특별시', shortName: '서울', lat: 37.5665, lng: 126.9780, baseScale: 3.45, color: '#1e3a8a' },
        { id: '41', name: '경기도', shortName: '경기', lat: 37.4138, lng: 127.5183, baseScale: 3.20, color: '#2563eb' },
        { id: '26', name: '부산광역시', shortName: '부산', lat: 35.1796, lng: 129.0756, baseScale: 2.15, color: '#0d9488' },
        { id: '48', name: '경상남도', shortName: '경남', lat: 35.4606, lng: 128.2132, baseScale: 1.95, color: '#059669' },
        { id: '47', name: '경상북도', shortName: '경북', lat: 36.4919, lng: 128.8889, baseScale: 1.90, color: '#65a30d' },
        { id: '28', name: '인천광역시', shortName: '인천', lat: 37.4563, lng: 126.7052, baseScale: 1.85, color: '#ca8a04' },
        { id: '44', name: '충청남도', shortName: '충남', lat: 36.5184, lng: 126.8000, baseScale: 1.65, color: '#ea580c' },
        { id: '46', name: '전라남도', shortName: '전남', lat: 34.8679, lng: 126.9910, baseScale: 1.62, color: '#dc2626' },
        { id: '27', name: '대구광역시', shortName: '대구', lat: 35.8714, lng: 128.6014, baseScale: 1.58, color: '#e11d48' },
        { id: '45', name: '전북특별자치도', shortName: '전북', lat: 35.7175, lng: 127.1530, baseScale: 1.48, color: '#db2777' },
        { id: '42', name: '강원특별자치도', shortName: '강원', lat: 37.8228, lng: 128.1555, baseScale: 1.42, color: '#9333ea' },
        { id: '43', name: '충청북도', shortName: '충북', lat: 36.8000, lng: 127.7000, baseScale: 1.35, color: '#7c3aed' },
        { id: '29', name: '광주광역시', shortName: '광주', lat: 35.1595, lng: 126.8526, baseScale: 1.24, color: '#4f46e5' },
        { id: '30', name: '대전광역시', shortName: '대전', lat: 36.3504, lng: 127.3845, baseScale: 1.22, color: '#0284c7' },
        { id: '31', name: '울산광역시', shortName: '울산', lat: 35.5384, lng: 129.3114, baseScale: 1.08, color: '#0891b2' },
        { id: '50', name: '제주특별자치도', shortName: '제주', lat: 33.4890, lng: 126.4983, baseScale: 0.96, color: '#475569' },
        { id: '36', name: '세종특별자치시', shortName: '세종', lat: 36.4800, lng: 127.2890, baseScale: 0.72, color: '#f59e0b' }
    ];

    // 2026년부터 출범한 광주전남특별시 통합 정의
    const GWANGJU_JEONNAM_MERGED = {
        id: '2946',
        name: '광주전남특별시',
        shortName: '광주전남',
        lat: 35.0200,
        lng: 126.9200,
        baseScale: 2.86, // 기존 광주(1.24) + 전남(1.62) 통합 규모
        color: '#4f46e5'
    };

    // 연도별 유효 광역자치단체 목록 반환 (2026년부터 광주·전남 -> 광주전남특별시 통합)
    function getRegionsForYear(year) {
        if (year >= 2026) {
            return BASE_REGIONS
                .filter(r => r.id !== '29' && r.id !== '46')
                .concat([GWANGJU_JEONNAM_MERGED])
                .sort((a, b) => b.baseScale - a.baseScale);
        }
        return BASE_REGIONS;
    }

    // 그래프 범례 및 전체 참조용 마스터 목록
    const ALL_REGION_DEFS = [...BASE_REGIONS, GWANGJU_JEONNAM_MERGED];

    // 지도 마커용 5단계 예산 규모별 색상 기준 (투명도 100% 고정)
    const BUDGET_TIERS = [
        { label: '500억 이상', min: 500, color: '#1e3a8a' },
        { label: '300억 ~ 500억', min: 300, color: '#6d28d9' },
        { label: '200억 ~ 300억', min: 200, color: '#b91c1c' },
        { label: '150억 ~ 200억', min: 150, color: '#c2410c' },
        { label: '150억 미만', min: 0, color: '#047857' }
    ];

    const CATEGORIES = ['사회복지', '지역개발·교통', '환경·보건', '교육·문화', '산업·일자리', '일반공공행정'];
    const VENDORS = [
        '농협중앙회', '국민은행', '신한은행', '한국전력공사', '한국수자원공사',
        '(주)한화건설', '현대엔지니어링', '대우건설', 'GS건설', '포스코이앤씨',
        'KT 공공사업단', 'SK텔레콤', '삼성SDS', 'LG CNS', '대한적십자사'
    ];
    const PROJECT_TEMPLATES = {
        '사회복지': ['기초연금 지급 사업', '어르신 돌봄 서비스 지원', '영유아 보육료 지원', '장애인 활동지원 급여', '취약계층 긴급복지 지원'],
        '지역개발·교통': ['시내버스 준공영제 재정지원', '노후 상하수도관 정비사업', '도시재생 뉴딜 기반시설 조성', '지방도 확포장 공사', '스마트 교통체계 구축'],
        '환경·보건': ['미세먼지 저감 친환경차 보급', '공공보건의료원 시설 확충', '생활폐기물 처리시설 운영', '하천 수질개선 생태복원', '국가예방접종 위탁사업'],
        '교육·문화': ['초중고 무상급식 경비 지원', '공공도서관 도서 확충 및 운영', '지역문화예술회관 기획공연', '생활체육공원 조성사업', '청년 문화패스 지원'],
        '산업·일자리': ['지역주도형 청년일자리 사업', '중소기업 육성자금 이차보전', '전통시장 시설현대화 지원', '지역화폐 발행 및 운영지원', '스마트공장 보급 확산'],
        '일반공공행정': ['주민참여예산 행정운영비', '지방세 정보시스템 유지보수', '청사 시설물 안전관리', '재난안전상황실 운영', '민원행정서비스 개선']
    };

    // =========================================================================
    // 2. 유틸리티 및 연도별·지자체별 재정 데이터 생성
    // =========================================================================
    function getBudgetTier(budgetEok) {
        return BUDGET_TIERS.find(t => budgetEok >= t.min) || BUDGET_TIERS[BUDGET_TIERS.length - 1];
    }

    function formatManWon(manWon) {
        const eok = Math.floor(manWon / 10000);
        const rest = manWon % 10000;
        if (eok > 0 && rest > 0) return `${eok.toLocaleString()}억 ${rest.toLocaleString()}만원`;
        if (eok > 0) return `${eok.toLocaleString()}억원`;
        return `${rest.toLocaleString()}만원`;
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function generateRegionYearData(region, year) {
        const yearDiff = year - 2014;
        const annualGrowthRate = region.id === '36'
            ? 0.115
            : (region.id === '41' || region.id === '50' || region.id === '2946' ? 0.078 : 0.064);
        const growthFactor = Math.pow(1 + annualGrowthRate, yearDiff);
        const seedNum = parseInt(region.id.slice(0, 2), 10);
        const wave = 1 + (((year * 17 + seedNum * 13) % 9) - 4) * 0.008;

        const totalBudget = Math.round(region.baseScale * 118 * growthFactor * wave * 10) / 10;
        const execRate = 0.89 + (((year * 7 + seedNum * 5) % 8) * 0.009);
        const totalExecuted = Math.round(totalBudget * execRate * 10) / 10;

        const itemCount = Math.max(18, Math.round(region.baseScale * 10));
        const items = [];
        let remainingExecutedManWon = Math.round(totalExecuted * 10000);

        for (let i = 0; i < itemCount; i++) {
            const cat = CATEGORIES[(seedNum + year + i) % CATEGORIES.length];
            const templates = PROJECT_TEMPLATES[cat];
            const title = templates[(i + year) % templates.length];
            const vendor = VENDORS[(seedNum * 3 + i + year) % VENDORS.length];

            const month = String(((i * 3 + year) % 12) + 1).padStart(2, '0');
            const day = String(((i * 7 + seedNum) % 28) + 1).padStart(2, '0');

            let amountManWon;
            if (i === itemCount - 1) {
                amountManWon = Math.max(1200, remainingExecutedManWon);
            } else {
                const weight = ((i % 5) + 1) / (itemCount * 2.6);
                amountManWon = Math.max(1500, Math.round(totalExecuted * 10000 * weight));
                remainingExecutedManWon = Math.max(1200, remainingExecutedManWon - amountManWon);
            }

            items.push({
                id: `${year}-${region.id}-${String(i + 1).padStart(4, '0')}`,
                year,
                regionId: region.id,
                regionName: region.name,
                regionShort: region.shortName,
                category: cat,
                projectName: `[${year}] ${region.shortName} ${title}`,
                vendor,
                amountManWon,
                date: `${year}-${month}-${day}`
            });
        }

        return {
            regionId: region.id,
            regionName: region.name,
            regionShort: region.shortName,
            year,
            totalBudget,
            totalExecuted,
            execRate: Math.round(execRate * 1000) / 10,
            items
        };
    }

    // 2014 ~ 현재연도 전체 데이터 사전 생성 (2026년부터는 광주전남특별시 기준 생성)
    const ALL_YEARS_DATA = {};
    YEARS.forEach(yr => {
        ALL_YEARS_DATA[yr] = {};
        getRegionsForYear(yr).forEach(region => {
            ALL_YEARS_DATA[yr][region.id] = generateRegionYearData(region, yr);
        });
    });

    // =========================================================================
    // 3. 애플리케이션 상태 관리
    // =========================================================================
    const state = {
        selectedYear: CURRENT_YEAR,
        selectedRegionId: 'ALL',
        selectedCategory: 'ALL',
        searchKeyword: '',
        chartMetric: 'budget' // 'budget' (총 예산) | 'executed' (지출액)
    };

    let mapInstance = null;
    let markersLayer = null;

    // =========================================================================
    // 4. 외부 라이브러리(Tailwind, Leaflet, 폰트) 및 스타일 동적 로드
    // =========================================================================
    function loadExternalAssets() {
        return new Promise((resolve) => {
            document.title = '행정 모아모아 - 전국 광역자치단체 예산 및 세출 집행 현황';

            const fontLink = document.createElement('link');
            fontLink.rel = 'stylesheet';
            fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Noto+Sans+KR:wght@400;500;600;700&display=swap';
            document.head.appendChild(fontLink);

            const leafletCss = document.createElement('link');
            leafletCss.rel = 'stylesheet';
            leafletCss.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(leafletCss);

            const customStyle = document.createElement('style');
            customStyle.textContent = `
                body {
                    font-family: 'Noto Sans KR', 'Inter', sans-serif;
                    background-color: #f8fafc;
                    color: #0f172a;
                    margin: 0;
                }
                .leaflet-container {
                    width: 100%;
                    height: 100%;
                    z-index: 10;
                    background-color: #e2e8f0;
                }
                .custom-region-marker {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    border-radius: 9999px;
                    color: #ffffff;
                    font-weight: 700;
                    box-shadow: 0 4px 10px rgba(15, 23, 42, 0.28);
                    border: 2.5px solid #ffffff;
                    transition: transform 0.18s ease, box-shadow 0.18s ease;
                    cursor: pointer;
                    text-align: center;
                    line-height: 1.15;
                }
                .custom-region-marker:hover {
                    transform: scale(1.12);
                    z-index: 999 !important;
                }
                .custom-region-marker.selected {
                    border: 3.5px solid #facc15;
                    transform: scale(1.16);
                    box-shadow: 0 0 0 4px rgba(250, 204, 21, 0.45), 0 8px 16px rgba(15, 23, 42, 0.35);
                    z-index: 1000 !important;
                }
                .stacked-bar-seg {
                    transition: opacity 0.15s ease;
                    touch-action: manipulation;
                }
                .stacked-bar-seg:hover {
                    opacity: 0.85;
                }
                .js-chart-tooltip {
                    position: fixed;
                    pointer-events: none;
                    z-index: 9999;
                    background: rgba(15, 23, 42, 0.96);
                    color: #ffffff;
                    padding: 8px 12px;
                    border-radius: 10px;
                    font-size: 12px;
                    line-height: 1.45;
                    box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.4);
                    border: 1px solid rgba(255, 255, 255, 0.14);
                    display: none;
                    white-space: nowrap;
                }
            `;
            document.head.appendChild(customStyle);

            let loadedCount = 0;
            const checkDone = () => {
                loadedCount += 1;
                if (loadedCount >= 2) resolve();
            };

            if (!window.tailwind) {
                const twScript = document.createElement('script');
                twScript.src = 'https://cdn.tailwindcss.com';
                twScript.onload = checkDone;
                twScript.onerror = checkDone;
                document.head.appendChild(twScript);
            } else {
                checkDone();
            }

            if (!window.L) {
                const lfScript = document.createElement('script');
                lfScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
                lfScript.onload = checkDone;
                lfScript.onerror = checkDone;
                document.head.appendChild(lfScript);
            } else {
                checkDone();
            }
        });
    }

    // =========================================================================
    // 5. 기본 DOM 레이아웃 구축
    // =========================================================================
    function buildAppShell() {
        const root = document.getElementById('root') || document.body;
        root.innerHTML = `
            <div class="min-h-screen flex flex-col">
                <!-- 상단 헤더 -->
                <header class="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-[1100]">
                    <div class="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div class="flex items-center gap-3.5">
                            <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-600 to-violet-700 flex items-center justify-center shadow-md shadow-blue-950/50 border border-white/15 shrink-0">
                                <svg class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M12 2L3 6.5L12 11L21 6.5L12 2Z" fill="rgba(255,255,255,0.22)" />
                                    <path d="M3 12L12 16.5L21 12" />
                                    <path d="M3 17.5L12 22L21 17.5" />
                                </svg>
                            </div>
                            <div>
                                <div class="flex items-center gap-2">
                                    <h1 class="text-lg sm:text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-blue-100 to-indigo-200 bg-clip-text text-transparent">행정 모아모아</h1>
                                    <span class="hidden sm:inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">공공재정 데이터</span>
                                </div>
                                <p class="text-xs text-slate-400 mt-0.5">전국 광역자치단체 예산 및 세출 집행 현황</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-2.5">
                            <label for="js-year-select" class="text-xs sm:text-sm font-semibold text-slate-300">조회 회계연도:</label>
                            <select id="js-year-select" class="bg-slate-800 border border-slate-600 text-white text-sm font-bold rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                                ${YEARS.slice().reverse().map(yr => `<option value="${yr}">${yr}년 회계연도</option>`).join('')}
                            </select>
                        </div>
                    </div>
                </header>

                <!-- 메인 본문 -->
                <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
                    <!-- 지역 빠른 선택 버튼 바 -->
                    <div id="js-region-bar" class="bg-white rounded-2xl shadow-sm border border-slate-200 p-3.5"></div>

                    <!-- 핵심 요약 지표 카드 -->
                    <div id="js-summary-cards" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"></div>

                    <!-- 1. 전국 지방재정 현황 지도 -->
                    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                        <div class="p-4 border-b border-slate-100 bg-slate-50/70 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                            <div class="flex items-center gap-2.5">
                                <span class="w-2.5 h-6 bg-blue-800 rounded-full"></span>
                                <div>
                                    <h2 id="js-map-title" class="text-base sm:text-lg font-bold text-slate-900"></h2>
                                    <p class="text-xs text-slate-500">지도의 시·도를 클릭하면 해당 지역의 연도별 추이와 전체 지출 내역만 필터링됩니다.</p>
                                </div>
                            </div>
                            <div class="flex flex-wrap items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200">
                                <span class="text-xs font-bold text-slate-600 mr-1">예산 규모 범례:</span>
                                ${BUDGET_TIERS.map(t => `
                                    <div class="flex items-center gap-1.5 text-xs text-slate-700">
                                        <span class="w-3.5 h-3.5 rounded-full inline-block border border-white" style="background-color:${t.color};"></span>
                                        <span class="font-medium">${t.label}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        <div class="relative w-full h-[460px] sm:h-[520px]">
                            <div id="js-leaflet-map" class="w-full h-full"></div>
                            <button id="js-reset-region-btn" class="hidden absolute top-4 right-4 z-[500] bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl shadow-lg transition">
                                전국 전체보기로 복귀
                            </button>
                        </div>
                    </div>

                    <!-- 2. 연도별 지자체 색상 분할 누적 막대 그래프 -->
                    <div id="js-trend-section" class="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6"></div>

                    <!-- 3. 지도 아래 통합 배치된 전체 세부 지출 내역 테이블 -->
                    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div class="p-4 sm:p-6 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                            <div class="flex items-center gap-2.5">
                                <span class="w-2.5 h-6 bg-emerald-700 rounded-full"></span>
                                <div>
                                    <h2 id="js-table-title" class="text-base sm:text-lg font-bold text-slate-900"></h2>
                                    <p id="js-table-subtitle" class="text-xs text-slate-500"></p>
                                </div>
                            </div>
                            <div class="flex flex-wrap items-center gap-2.5">
                                <select id="js-category-select" class="bg-slate-50 border border-slate-200 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    <option value="ALL">전체 행정분야</option>
                                    ${CATEGORIES.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
                                </select>
                                <input id="js-search-input" type="text" placeholder="사업명, 거래처, 지역 검색..." class="bg-slate-50 border border-slate-200 text-slate-800 text-xs sm:text-sm rounded-xl px-3.5 py-2 w-48 sm:w-60 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                <button id="js-csv-btn" class="bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold px-4 py-2 rounded-xl transition">
                                    엑셀(CSV) 저장
                                </button>
                            </div>
                        </div>
                        <div class="overflow-auto max-h-[620px]">
                            <table class="w-full text-left border-collapse">
                                <thead class="bg-slate-100 text-slate-700 text-xs font-bold uppercase sticky top-0 z-10 border-b border-slate-200">
                                    <tr>
                                        <th class="py-3.5 px-4 whitespace-nowrap">연도</th>
                                        <th class="py-3.5 px-4 whitespace-nowrap">지자체</th>
                                        <th class="py-3.5 px-4 whitespace-nowrap">행정분야</th>
                                        <th class="py-3.5 px-4">세부 사업명</th>
                                        <th class="py-3.5 px-4 whitespace-nowrap">거래처</th>
                                        <th class="py-3.5 px-4 text-right whitespace-nowrap">지출금액</th>
                                        <th class="py-3.5 px-4 text-center whitespace-nowrap">지출일자</th>
                                    </tr>
                                </thead>
                                <tbody id="js-table-body" class="divide-y divide-slate-100 text-xs sm:text-sm"></tbody>
                            </table>
                        </div>
                    </div>
                </main>
            </div>
        `;

        // 이벤트 리스너 등록
        document.getElementById('js-year-select').addEventListener('change', (e) => {
            const nextYear = Number(e.target.value);
            // 2026년 기준 광주/전남 <-> 광주전남특별시 선택 상태 자동 보정
            if (nextYear >= 2026 && (state.selectedRegionId === '29' || state.selectedRegionId === '46')) {
                state.selectedRegionId = '2946';
            } else if (nextYear < 2026 && state.selectedRegionId === '2946') {
                state.selectedRegionId = '29';
            }
            state.selectedYear = nextYear;
            renderAll();
        });

        document.getElementById('js-reset-region-btn').addEventListener('click', () => {
            state.selectedRegionId = 'ALL';
            renderAll();
        });

        document.getElementById('js-category-select').addEventListener('change', (e) => {
            state.selectedCategory = e.target.value;
            renderTable();
        });

        document.getElementById('js-search-input').addEventListener('input', (e) => {
            state.searchKeyword = e.target.value;
            renderTable();
        });

        document.getElementById('js-csv-btn').addEventListener('click', downloadCSV);
    }

    // =========================================================================
    // 6. Leaflet 지도 초기화 및 마커 갱신
    // =========================================================================
    function initLeafletMap() {
        const container = document.getElementById('js-leaflet-map');
        if (!container || mapInstance || !window.L) return;

        mapInstance = L.map(container, {
            center: [36.35, 127.85],
            zoom: 7,
            minZoom: 6,
            maxZoom: 11,
            zoomControl: true,
            scrollWheelZoom: false
        });

        const vworldLayer = L.tileLayer(
            'https://xdworld.vworld.kr/2d/Base/service/{z}/{x}/{y}.png',
            { attribution: '&copy; 국토교통부 V-World', maxZoom: 18 }
        );

        const fallbackLayer = L.tileLayer(
            'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
            { attribution: '&copy; OpenStreetMap &copy; CARTO', maxZoom: 18 }
        );

        let errorCount = 0;
        vworldLayer.on('tileerror', () => {
            errorCount += 1;
            if (errorCount > 3 && mapInstance.hasLayer(vworldLayer)) {
                mapInstance.removeLayer(vworldLayer);
                fallbackLayer.addTo(mapInstance);
            }
        });

        vworldLayer.addTo(mapInstance);
        markersLayer = L.layerGroup().addTo(mapInstance);

        setTimeout(() => mapInstance.invalidateSize(), 150);
        window.addEventListener('resize', () => mapInstance && mapInstance.invalidateSize());
    }

    function renderMapMarkers() {
        document.getElementById('js-map-title').textContent = `전국 지방재정 현황 지도 (${state.selectedYear}년)`;
        const resetBtn = document.getElementById('js-reset-region-btn');
        if (state.selectedRegionId !== 'ALL') {
            resetBtn.classList.remove('hidden');
        } else {
            resetBtn.classList.add('hidden');
        }

        if (!mapInstance || !markersLayer) return;
        markersLayer.clearLayers();

        const statsMap = ALL_YEARS_DATA[state.selectedYear];
        const activeRegions = getRegionsForYear(state.selectedYear);

        activeRegions.forEach(region => {
            const stat = statsMap[region.id];
            if (!stat) return;

            const tier = getBudgetTier(stat.totalBudget);
            const isSelected = state.selectedRegionId === region.id;
            const size = Math.min(68, Math.max(44, Math.round(38 + Math.sqrt(stat.totalBudget) * 1.15)));

            const iconHtml = `
                <div class="custom-region-marker ${isSelected ? 'selected' : ''}"
                     style="width:${size}px; height:${size}px; background-color:${tier.color}; opacity:1;">
                    <span style="font-size:${size > 54 ? '12px' : '11px'};">${region.shortName}</span>
                    <span style="font-size:${size > 54 ? '11px' : '10px'}; font-weight:600; opacity:0.95;">${Math.round(stat.totalBudget)}억</span>
                </div>
            `;

            const icon = L.divIcon({
                html: iconHtml,
                className: '',
                iconSize: [size, size],
                iconAnchor: [size / 2, size / 2]
            });

            const marker = L.marker([region.lat, region.lng], { icon });
            marker.on('click', () => {
                state.selectedRegionId = (region.id === state.selectedRegionId) ? 'ALL' : region.id;
                renderAll();
            });

            marker.bindTooltip(
                `<div style="font-family:'Noto Sans KR',sans-serif; padding:2px 4px;">
                    <div style="font-weight:700; color:#0f172a;">${region.name} (${state.selectedYear}년)</div>
                    <div style="font-size:12px; color:#334155;">총 예산: <b>${stat.totalBudget.toLocaleString()}억원</b></div>
                    <div style="font-size:12px; color:#334155;">지출액: <b>${stat.totalExecuted.toLocaleString()}억원</b> (${stat.execRate}%)</div>
                </div>`,
                { direction: 'top', offset: [0, -size / 2] }
            );

            marker.addTo(markersLayer);
        });
    }

    // =========================================================================
    // 7. 지역 빠른 선택 바 및 핵심 요약 카드
    // =========================================================================
    function renderRegionBarAndSummary() {
        const barEl = document.getElementById('js-region-bar');
        const activeRegions = getRegionsForYear(state.selectedYear);

        barEl.innerHTML = `
            <div class="flex items-center gap-2 overflow-x-auto pb-1">
                <button data-region="ALL" class="js-region-btn shrink-0 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
                    state.selectedRegionId === 'ALL'
                        ? 'bg-blue-800 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }">전국</button>
                <div class="w-px h-5 bg-slate-200 shrink-0 mx-0.5"></div>
                ${activeRegions.map(r => {
                    const active = state.selectedRegionId === r.id;
                    return `<button data-region="${r.id}" class="js-region-btn shrink-0 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
                        active
                            ? 'bg-slate-900 text-amber-300 shadow-sm'
                            : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/70'
                    }">${r.shortName}</button>`;
                }).join('')}
            </div>
        `;

        barEl.querySelectorAll('.js-region-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.getAttribute('data-region');
                state.selectedRegionId = (target === state.selectedRegionId && target !== 'ALL') ? 'ALL' : target;
                renderAll();
            });
        });

        const statsMap = ALL_YEARS_DATA[state.selectedYear];
        const regionCountLabel = state.selectedYear >= 2026 ? '16개 광역자치단체 합계' : '17개 광역자치단체 합계';
        let title = `전국 ${state.selectedYear >= 2026 ? '16개' : '17개'} 시·도 통합`;
        let budgetSum = 0;
        let execSum = 0;
        let itemTotalCount = 0;

        if (state.selectedRegionId === 'ALL') {
            activeRegions.forEach(r => {
                const st = statsMap[r.id];
                if (st) {
                    budgetSum += st.totalBudget;
                    execSum += st.totalExecuted;
                    itemTotalCount += st.items.length;
                }
            });
            budgetSum = Math.round(budgetSum * 10) / 10;
            execSum = Math.round(execSum * 10) / 10;
        } else {
            const st = statsMap[state.selectedRegionId];
            title = st.regionName;
            budgetSum = st.totalBudget;
            execSum = st.totalExecuted;
            itemTotalCount = st.items.length;
        }
        const rate = budgetSum > 0 ? Math.round((execSum / budgetSum) * 1000) / 10 : 0;

        document.getElementById('js-summary-cards').innerHTML = `
            <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                <div class="text-xs font-semibold text-slate-500">조회 대상 (${state.selectedYear}년)</div>
                <div class="mt-1.5 text-xl font-extrabold text-slate-900">${title}</div>
                <div class="mt-1 text-xs text-blue-700 font-medium">${state.selectedRegionId === 'ALL' ? regionCountLabel : '개별 광역자치단체 상세'}</div>
            </div>
            <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                <div class="text-xs font-semibold text-slate-500">총 예산 현액</div>
                <div class="mt-1.5 text-2xl font-extrabold text-blue-900">${budgetSum.toLocaleString()}억원</div>
                <div class="mt-1 text-xs text-slate-500">${state.selectedYear}년 본예산 및 추경 포함</div>
            </div>
            <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                <div class="text-xs font-semibold text-slate-500">누적 지출 집행액</div>
                <div class="mt-1.5 text-2xl font-extrabold text-emerald-700">${execSum.toLocaleString()}억원</div>
                <div class="mt-1 text-xs text-emerald-600 font-semibold">집행률 ${rate}%</div>
            </div>
            <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                <div class="text-xs font-semibold text-slate-500">공시 지출 내역 건수</div>
                <div class="mt-1.5 text-2xl font-extrabold text-slate-900">${itemTotalCount.toLocaleString()}건</div>
                <div class="mt-1 text-xs text-slate-500">하단 표에서 전체 내역 열람 가능</div>
            </div>
        `;
    }

    // =========================================================================
    // 8. 연도별 지자체 색상 분할 누적 막대 그래프 (통합 단일 뷰)
    // =========================================================================
    function renderTrendChart() {
        const container = document.getElementById('js-trend-section');
        const selectedRegionObj = ALL_REGION_DEFS.find(r => r.id === state.selectedRegionId);

        const width = 940;
        const height = 400;
        const margin = { top: 34, right: 20, bottom: 38, left: 68 };
        const innerW = width - margin.left - margin.right;
        const innerH = height - margin.top - margin.bottom;

        // 전국 보기일 때: 연도별 막대 하나 안에 17개 시·도의 금액이 색상별로 누적 분할됨
        if (!selectedRegionObj) {
            const metricKey = state.chartMetric === 'budget' ? 'totalBudget' : 'totalExecuted';
            const metricLabel = state.chartMetric === 'budget' ? '총 예산' : '지출액';

            // 연도별 누적 데이터 계산 (각 연도별 유효 시·도 기준: 2026년부터 광주전남특별시 반영)
            const yearStacks = YEARS.map(yr => {
                const yrRegions = [...getRegionsForYear(yr)].sort((a, b) => b.baseScale - a.baseScale);
                let cumulative = 0;
                const segments = yrRegions.map(region => {
                    const val = ALL_YEARS_DATA[yr][region.id][metricKey];
                    const start = cumulative;
                    cumulative += val;
                    return {
                        regionId: region.id,
                        shortName: region.shortName,
                        fullName: region.name,
                        color: region.color,
                        value: val,
                        start,
                        end: Math.round(cumulative * 10) / 10
                    };
                });
                const total = Math.round(cumulative * 10) / 10;
                segments.forEach(seg => {
                    seg.share = total > 0 ? Math.round((seg.value / total) * 1000) / 10 : 0;
                });
                return { year: yr, total, segments };
            });

            const legendRegions = [...getRegionsForYear(state.selectedYear)].sort((a, b) => b.baseScale - a.baseScale);

            const maxTotal = Math.max(...yearStacks.map(d => d.total), 100);
            const yMax = Math.ceil((maxTotal * 1.12) / 500) * 500;

            const yTicks = [];
            for (let i = 0; i <= 5; i++) {
                const val = (yMax * i) / 5;
                yTicks.push({ val, label: `${Math.round(val).toLocaleString()}억` });
            }

            const getY = (val) => margin.top + innerH - (val / yMax) * innerH;
            const slotW = innerW / YEARS.length;
            const barW = Math.min(50, Math.max(28, slotW * 0.72));

            container.innerHTML = `
                <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-100">
                    <div class="flex items-center gap-2.5">
                        <span class="w-2.5 h-6 bg-indigo-700 rounded-full"></span>
                        <div>
                            <h2 class="text-base sm:text-lg font-bold text-slate-900">
                                연도별 전국 ${metricLabel} 및 지자체별 비중 추이 (2014~${CURRENT_YEAR}년)
                            </h2>
                            <p class="text-xs text-slate-500">
                                막대를 누르거나 아래 지자체 버튼을 선택해 상세 내역을 확인하세요 (2026년부터 광주전남특별시 통합 반영).
                            </p>
                        </div>
                    </div>

                    <!-- 하나로 통합된 단일 지표 전환 버튼 -->
                    <div class="inline-flex rounded-xl bg-slate-100 p-1 self-start lg:self-auto">
                        <button data-metric="budget" class="js-metric-btn px-4 py-2 rounded-lg text-xs font-bold transition ${
                            state.chartMetric === 'budget' ? 'bg-blue-800 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                        }">총 예산 기준</button>
                        <button data-metric="executed" class="js-metric-btn px-4 py-2 rounded-lg text-xs font-bold transition ${
                            state.chartMetric === 'executed' ? 'bg-emerald-700 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                        }">지출액 기준</button>
                    </div>
                </div>

                <!-- 모바일 터치 시 선택된 막대/연도 빠른 이동 배너 -->
                <div id="js-mobile-chart-picker" class="hidden mt-3 p-3 rounded-xl bg-blue-50/90 border border-blue-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5"></div>

                <!-- 누적 막대 그래프 SVG -->
                <div class="mt-4 w-full overflow-x-auto">
                    <div class="min-w-[680px]">
                        <svg id="js-trend-svg" viewBox="0 0 ${width} ${height}" class="w-full h-auto select-none">
                            <!-- Y축 가로 눈금선 -->
                            ${yTicks.map(t => {
                                const yPos = getY(t.val);
                                return `
                                    <line x1="${margin.left}" y1="${yPos}" x2="${width - margin.right}" y2="${yPos}" stroke="#e2e8f0" stroke-dasharray="4 4" />
                                    <text x="${margin.left - 10}" y="${yPos + 4}" text-anchor="end" font-size="11" fill="#64748b" font-weight="500">${t.label}</text>
                                `;
                            }).join('')}

                            <!-- 연도별 색상 분할 누적 막대 -->
                            ${yearStacks.map((stack, idx) => {
                                const centerX = margin.left + slotW * idx + slotW / 2;
                                const xPos = centerX - barW / 2;
                                const topY = getY(stack.total);
                                const isCurrentSelectedYear = stack.year === state.selectedYear;

                                const segRects = stack.segments.map(seg => {
                                    const yTop = getY(seg.end);
                                    const yBot = getY(seg.start);
                                    const segH = Math.max(2, yBot - yTop);
                                    return `
                                        <rect
                                            x="${xPos}"
                                            y="${yTop}"
                                            width="${barW}"
                                            height="${segH}"
                                            fill="${seg.color}"
                                            stroke="#ffffff"
                                            stroke-width="0.7"
                                            class="stacked-bar-seg js-stack-seg"
                                            style="cursor:pointer;"
                                            data-year="${stack.year}"
                                            data-total="${stack.total}"
                                            data-region-id="${seg.regionId}"
                                            data-region-short="${seg.shortName}"
                                            data-region-name="${seg.fullName}"
                                            data-value="${seg.value}"
                                            data-share="${seg.share}"
                                        ><title>${seg.fullName} (${stack.year}년: ${seg.value.toLocaleString()}억원)</title></rect>
                                    `;
                                }).join('');

                                return `
                                    <g>
                                        ${segRects}
                                        <!-- 막대 상단 전국 합계 금액 표기 -->
                                        <text x="${centerX}" y="${topY - 7}" text-anchor="middle" font-size="10.5" font-weight="700" fill="${isCurrentSelectedYear ? '#1e3a8a' : '#334155'}">
                                            ${Math.round(stack.total).toLocaleString()}억
                                        </text>
                                        <!-- X축 연도 라벨 -->
                                        <text x="${centerX}" y="${height - 12}" text-anchor="middle" font-size="11.5" font-weight="${isCurrentSelectedYear ? '800' : '500'}" fill="${isCurrentSelectedYear ? '#1e3a8a' : '#64748b'}">
                                            ${stack.year}
                                        </text>
                                    </g>
                                `;
                            }).join('')}
                        </svg>
                    </div>
                </div>

                <!-- 하단 시·도 색상 범례 (클릭 시 해당 지역 필터링) -->
                <div class="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                    <span class="w-full sm:w-auto text-xs font-bold text-slate-600 mr-1">지자체 직접 선택 (터치 시 상세조회):</span>
                    ${legendRegions.map(r => `
                        <button data-region-id="${r.id}" class="js-stack-legend inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50 active:bg-blue-100 hover:bg-slate-100 text-slate-800 transition">
                            <span class="w-3 h-3 rounded-xs inline-block shrink-0" style="background-color:${r.color};"></span>
                            <span>${r.shortName}</span>
                        </button>
                    `).join('')}
                </div>
            `;

            // 총 예산 / 지출액 전환 이벤트
            container.querySelectorAll('.js-metric-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    state.chartMetric = btn.getAttribute('data-metric');
                    renderTrendChart();
                });
            });

            // 말풍선 엘리먼트가 지워졌더라도 항상 존재하도록 보장
            let tooltipEl = document.getElementById('js-chart-floating-tooltip');
            if (!tooltipEl) {
                tooltipEl = document.createElement('div');
                tooltipEl.id = 'js-chart-floating-tooltip';
                tooltipEl.className = 'js-chart-tooltip';
                document.body.appendChild(tooltipEl);
            }

            // 막대 분할 구간 마우스 커서 옆 휘발성 말풍선 및 모바일 터치 지원
            const svgEl = document.getElementById('js-trend-svg');
            const mobilePickerEl = document.getElementById('js-mobile-chart-picker');
            let isTouchInteraction = false;

            const positionTooltipAt = (clientX, clientY) => {
                const tipW = tooltipEl.offsetWidth || 170;
                const tipH = tooltipEl.offsetHeight || 52;
                const x = (clientX + 14 + tipW > window.innerWidth) ? Math.max(8, clientX - tipW - 14) : (clientX + 14);
                const y = (clientY - tipH - 12 < 0) ? (clientY + 18) : (clientY - tipH - 12);
                tooltipEl.style.left = `${x}px`;
                tooltipEl.style.top = `${y}px`;
            };

            const hideTooltip = () => {
                tooltipEl.style.display = 'none';
            };

            const navigateToRegion = (rId) => {
                if (!rId) return;
                if (state.selectedYear >= 2026 && (rId === '29' || rId === '46')) {
                    state.selectedRegionId = '2946';
                } else if (state.selectedYear < 2026 && rId === '2946') {
                    state.selectedRegionId = '29';
                } else {
                    state.selectedRegionId = rId;
                }
                renderAll();
            };

            if (svgEl) {
                svgEl.querySelectorAll('.js-stack-seg').forEach(seg => {
                    const renderSegTooltip = (clientX, clientY) => {
                        const yr = seg.getAttribute('data-year');
                        const rShort = seg.getAttribute('data-region-short');
                        const rName = seg.getAttribute('data-region-name');
                        const val = Number(seg.getAttribute('data-value')).toLocaleString();
                        const share = seg.getAttribute('data-share');
                        const segColor = seg.getAttribute('fill');

                        tooltipEl.innerHTML = `
                            <div style="display:flex; align-items:center; gap:6px; font-weight:800; font-size:13.5px; color:#fde047;">
                                <span style="width:11px; height:11px; border-radius:3px; background:${segColor}; display:inline-block; border:1.5px solid #fff;"></span>
                                <span>${rShort} (${rName})</span>
                            </div>
                            <div style="margin-top:2px; font-size:11.5px; color:#f1f5f9;">
                                ${yr}년 ${metricLabel}: <b>${val}억원</b> <span style="color:#94a3b8;">(${share}%)</span>
                            </div>
                        `;
                        tooltipEl.style.display = 'block';
                        positionTooltipAt(clientX, clientY);
                    };

                    // 모바일 터치 시: 오터치 방지를 위해 말풍선 + 하단 큰 확인 버튼 표시
                    seg.addEventListener('touchstart', (e) => {
                        isTouchInteraction = true;
                        const touch = e.touches && e.touches[0];
                        if (touch) {
                            renderSegTooltip(touch.clientX, touch.clientY);
                        }
                        const yr = Number(seg.getAttribute('data-year'));
                        const rId = seg.getAttribute('data-region-id');
                        const rName = seg.getAttribute('data-region-name');
                        const val = Number(seg.getAttribute('data-value')).toLocaleString();
                        const share = seg.getAttribute('data-share');
                        const segColor = seg.getAttribute('fill');
                        const yearObj = yearStacks.find(s => s.year === yr);

                        if (mobilePickerEl && yearObj) {
                            mobilePickerEl.classList.remove('hidden');
                            mobilePickerEl.innerHTML = `
                                <div class="flex items-center justify-between gap-2">
                                    <div class="flex items-center gap-2">
                                        <span class="w-3.5 h-3.5 rounded-xs shrink-0 border border-white shadow-2xs" style="background:${segColor};"></span>
                                        <div class="text-xs sm:text-sm text-slate-900">
                                            <span class="font-extrabold">${yr}년 ${rName}</span>
                                            <span class="text-slate-600 ml-1">(${val}억원 · ${share}%)</span>
                                        </div>
                                    </div>
                                    <button type="button" data-go-region="${rId}" class="js-mobile-go-btn shrink-0 bg-blue-800 active:bg-blue-900 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-2xs">
                                        이 지역 상세보기 →
                                    </button>
                                </div>
                                <div class="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5">
                                    <span class="text-[11px] font-bold text-slate-500 shrink-0">${yr}년 다른 지역:</span>
                                    ${yearObj.segments.map(s => `
                                        <button type="button" data-go-region="${s.regionId}" class="js-mobile-go-btn shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border ${
                                            s.regionId === rId ? 'bg-slate-900 text-amber-300 border-slate-900' : 'bg-white text-slate-700 border-slate-200'
                                        }">
                                            ${s.shortName} ${Math.round(s.value).toLocaleString()}억
                                        </button>
                                    `).join('')}
                                </div>
                            `;
                            mobilePickerEl.querySelectorAll('.js-mobile-go-btn').forEach(btn => {
                                btn.addEventListener('click', () => {
                                    hideTooltip();
                                    navigateToRegion(btn.getAttribute('data-go-region'));
                                });
                            });
                        }
                    }, { passive: true });

                    seg.addEventListener('mouseenter', (e) => {
                        if (!isTouchInteraction) renderSegTooltip(e.clientX, e.clientY);
                    });
                    seg.addEventListener('mousemove', (e) => {
                        if (!isTouchInteraction) renderSegTooltip(e.clientX, e.clientY);
                    });
                    seg.addEventListener('mouseleave', () => {
                        if (!isTouchInteraction) hideTooltip();
                    });
                    seg.addEventListener('click', () => {
                        if (isTouchInteraction) {
                            isTouchInteraction = false;
                            return;
                        }
                        hideTooltip();
                        navigateToRegion(seg.getAttribute('data-region-id'));
                    });
                });

                svgEl.addEventListener('mouseleave', hideTooltip);
            }

            // 범례 클릭 시 해당 지자체 선택
            container.querySelectorAll('.js-stack-legend').forEach(btn => {
                btn.addEventListener('click', () => {
                    const rId = btn.getAttribute('data-region-id');
                    if (rId) {
                        state.selectedRegionId = rId;
                        renderAll();
                    }
                });
            });
        } else {
            // 개별 지자체 선택 시: 연도별 총 예산(파랑)과 지출액(초록) 막대 비교
            // (2026년 통합된 광주전남특별시의 경우 2014~2025년은 광주+전남 합산 추이로 연속 비교 제공)
            const regionSeries = YEARS.map(yr => {
                if (selectedRegionObj.id === '2946' && yr < 2026) {
                    const gj = ALL_YEARS_DATA[yr]['29'];
                    const jn = ALL_YEARS_DATA[yr]['46'];
                    return {
                        year: yr,
                        budget: Math.round((gj.totalBudget + jn.totalBudget) * 10) / 10,
                        executed: Math.round((gj.totalExecuted + jn.totalExecuted) * 10) / 10
                    };
                }
                if ((selectedRegionObj.id === '29' || selectedRegionObj.id === '46') && yr >= 2026) {
                    const ratio = selectedRegionObj.id === '29' ? (1.24 / 2.86) : (1.62 / 2.86);
                    const merged = ALL_YEARS_DATA[yr]['2946'];
                    return {
                        year: yr,
                        budget: Math.round(merged.totalBudget * ratio * 10) / 10,
                        executed: Math.round(merged.totalExecuted * ratio * 10) / 10
                    };
                }
                return {
                    year: yr,
                    budget: ALL_YEARS_DATA[yr][selectedRegionObj.id].totalBudget,
                    executed: ALL_YEARS_DATA[yr][selectedRegionObj.id].totalExecuted
                };
            });

            const maxVal = Math.max(...regionSeries.map(d => d.budget), 50);
            const yMax = Math.ceil((maxVal * 1.15) / 50) * 50;

            const yTicks = [];
            for (let i = 0; i <= 5; i++) {
                const val = (yMax * i) / 5;
                yTicks.push({ val, label: `${Math.round(val).toLocaleString()}억` });
            }

            const getY = (val) => margin.top + innerH - (val / yMax) * innerH;
            const slotW = innerW / YEARS.length;
            const singleBarW = Math.min(20, Math.max(10, slotW * 0.28));

            container.innerHTML = `
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
                    <div class="flex items-center gap-2.5">
                        <span class="w-2.5 h-6 bg-indigo-700 rounded-full"></span>
                        <div>
                            <h2 class="text-base sm:text-lg font-bold text-slate-900">
                                ${selectedRegionObj.name} 연도별 예산 및 지출액 추이 (2014~${CURRENT_YEAR}년)
                            </h2>
                            <p class="text-xs text-slate-500">해당 지자체의 연도별 총 예산과 실제 지출 집행액 변화입니다.</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3 text-xs font-semibold">
                        <span class="inline-flex items-center gap-1.5"><span class="w-3 h-3 rounded-xs bg-blue-800 inline-block"></span>총 예산</span>
                        <span class="inline-flex items-center gap-1.5"><span class="w-3 h-3 rounded-xs bg-emerald-600 inline-block"></span>지출액</span>
                        <button id="js-chart-reset-btn" class="ml-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-2xs transition cursor-pointer">
                            전국 전체보기
                        </button>
                    </div>
                </div>

                <div class="mt-4 w-full overflow-x-auto">
                    <div class="min-w-[700px]">
                        <svg viewBox="0 0 ${width} ${height}" class="w-full h-auto select-none">
                            ${yTicks.map(t => {
                                const yPos = getY(t.val);
                                return `
                                    <line x1="${margin.left}" y1="${yPos}" x2="${width - margin.right}" y2="${yPos}" stroke="#e2e8f0" stroke-dasharray="4 4" />
                                    <text x="${margin.left - 10}" y="${yPos + 4}" text-anchor="end" font-size="11" fill="#64748b" font-weight="500">${t.label}</text>
                                `;
                            }).join('')}

                            ${regionSeries.map((d, idx) => {
                                const centerX = margin.left + slotW * idx + slotW / 2;
                                const yB = getY(d.budget);
                                const hB = Math.max(2, margin.top + innerH - yB);
                                const yE = getY(d.executed);
                                const hE = Math.max(2, margin.top + innerH - yE);
                                const isSelYr = d.year === state.selectedYear;

                                return `
                                    <g>
                                        <rect x="${centerX - singleBarW - 1.5}" y="${yB}" width="${singleBarW}" height="${hB}" rx="2" fill="#1e40af" />
                                        <rect x="${centerX + 1.5}" y="${yE}" width="${singleBarW}" height="${hE}" rx="2" fill="#059669" />
                                        <text x="${centerX}" y="${yB - 6}" text-anchor="middle" font-size="10" font-weight="700" fill="#1e3a8a">
                                            ${Math.round(d.budget).toLocaleString()}억
                                        </text>
                                        <text x="${centerX}" y="${height - 12}" text-anchor="middle" font-size="11.5" font-weight="${isSelYr ? '800' : '500'}" fill="${isSelYr ? '#1e3a8a' : '#64748b'}">
                                            ${d.year}
                                        </text>
                                    </g>
                                `;
                            }).join('')}
                        </svg>
                    </div>
                </div>
            `;

            const chartResetBtn = document.getElementById('js-chart-reset-btn');
            if (chartResetBtn) {
                chartResetBtn.addEventListener('click', () => {
                    state.selectedRegionId = 'ALL';
                    renderAll();
                });
            }
        }
    }

    // =========================================================================
    // 9. 세부 지출 내역 전체 테이블 및 CSV 다운로드
    // =========================================================================
    function getFilteredItems() {
        const statsMap = ALL_YEARS_DATA[state.selectedYear];
        const activeRegions = getRegionsForYear(state.selectedYear);
        let list = [];

        if (state.selectedRegionId === 'ALL') {
            activeRegions.forEach(r => {
                if (statsMap[r.id]) list.push(...statsMap[r.id].items);
            });
        } else if (statsMap[state.selectedRegionId]) {
            list = [...statsMap[state.selectedRegionId].items];
        }

        if (state.selectedCategory !== 'ALL') {
            list = list.filter(item => item.category === state.selectedCategory);
        }

        if (state.searchKeyword.trim() !== '') {
            const kw = state.searchKeyword.trim().toLowerCase();
            list = list.filter(item =>
                item.projectName.toLowerCase().includes(kw) ||
                item.vendor.toLowerCase().includes(kw) ||
                item.regionName.toLowerCase().includes(kw)
            );
        }

        return list.sort((a, b) => b.amountManWon - a.amountManWon);
    }

    function renderTable() {
        const items = getFilteredItems();
        const regionObj = ALL_REGION_DEFS.find(r => r.id === state.selectedRegionId);
        const scopeTitle = regionObj ? regionObj.name : `전국 ${state.selectedYear >= 2026 ? '16개' : '17개'} 시·도 통합`;

        document.getElementById('js-table-title').textContent = `${scopeTitle} 세부 지출 내역 전체 (${state.selectedYear}년)`;
        document.getElementById('js-table-subtitle').innerHTML =
            `총 <span class="font-bold text-slate-800">${items.length.toLocaleString()}건</span>의 세부 집행 내역이 생략 없이 모두 표시됩니다.`;

        const tbody = document.getElementById('js-table-body');
        if (items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="py-12 text-center text-slate-400 font-medium">검색 조건에 일치하는 지출 내역이 없습니다.</td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = items.map(item => `
            <tr class="hover:bg-blue-50/40 transition">
                <td class="py-3 px-4 font-semibold text-slate-600 whitespace-nowrap">${item.year}년</td>
                <td class="py-3 px-4 whitespace-nowrap">
                    <button data-region="${item.regionId}" class="js-table-region font-bold text-blue-800 hover:underline">${escapeHtml(item.regionShort)}</button>
                </td>
                <td class="py-3 px-4 whitespace-nowrap">
                    <span class="inline-block px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold">${escapeHtml(item.category)}</span>
                </td>
                <td class="py-3 px-4 font-medium text-slate-900">${escapeHtml(item.projectName)}</td>
                <td class="py-3 px-4 text-slate-600 whitespace-nowrap">${escapeHtml(item.vendor)}</td>
                <td class="py-3 px-4 text-right font-bold text-slate-900 whitespace-nowrap">${formatManWon(item.amountManWon)}</td>
                <td class="py-3 px-4 text-center text-slate-500 whitespace-nowrap">${item.date}</td>
            </tr>
        `).join('');

        tbody.querySelectorAll('.js-table-region').forEach(btn => {
            btn.addEventListener('click', () => {
                state.selectedRegionId = btn.getAttribute('data-region');
                renderAll();
            });
        });
    }

    function downloadCSV() {
        const items = getFilteredItems();
        const regionObj = ALL_REGION_DEFS.find(r => r.id === state.selectedRegionId);
        const scopeTitle = regionObj ? regionObj.name : '전국통합';

        const headers = ['회계연도', '지자체명', '분야', '세부사업명', '거래처', '지출금액(만원)', '지출일자'];
        const rows = items.map(item => [
            `${item.year}년`,
            item.regionName,
            item.category,
            `"${item.projectName.replace(/"/g, '""')}"`,
            `"${item.vendor.replace(/"/g, '""')}"`,
            item.amountManWon,
            item.date
        ]);

        const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `행정모아모아_세부지출내역_${state.selectedYear}년_${scopeTitle}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }

    // =========================================================================
    // 10. 전체 화면 동기화 및 실행
    // =========================================================================
    function renderAll() {
        renderRegionBarAndSummary();
        renderMapMarkers();
        renderTrendChart();
        renderTable();
    }

    async function bootstrap() {
        await loadExternalAssets();
        buildAppShell();
        initLeafletMap();
        renderAll();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }
})();