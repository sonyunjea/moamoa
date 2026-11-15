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
    const CATEGORY_COLORS = {
        '사회복지': '#2563eb',
        '지역개발·교통': '#d97706',
        '환경·보건': '#059669',
        '교육·문화': '#7c3aed',
        '산업·일자리': '#e11d48',
        '일반공공행정': '#475569'
    };
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
        // 2014 ~ 현재연도 전체 데이터 사전 생성 (2026년부터는 광주전남특별시 기준 생성)
    const ALL_YEARS_DATA = {};
    YEARS.forEach(yr => {
        ALL_YEARS_DATA[yr] = {};
        getRegionsForYear(yr).forEach(region => {
            ALL_YEARS_DATA[yr][region.id] = generateRegionYearData(region, yr);
        });
    });

    // 특정 연도·지역(또는 전국)의 행정분야별 지출 합계 및 핵심 사업 요약 계산
    function getCategoryBreakdown(year, regionId) {
        const statsMap = ALL_YEARS_DATA[year];
        const activeRegions = getRegionsForYear(year);
        let targetItems = [];

        if (regionId === 'ALL') {
            activeRegions.forEach(r => {
                if (statsMap[r.id]) targetItems.push(...statsMap[r.id].items);
            });
        } else if (statsMap[regionId]) {
            targetItems = statsMap[regionId].items;
        }

        const totalManWon = targetItems.reduce((acc, cur) => acc + cur.amountManWon, 0);
        const byCat = CATEGORIES.map(cat => {
            const catItems = targetItems.filter(it => it.category === cat);
            const sumManWon = catItems.reduce((acc, cur) => acc + cur.amountManWon, 0);
            const eok = Math.round((sumManWon / 10000) * 10) / 10;
            const share = totalManWon > 0 ? Math.round((sumManWon / totalManWon) * 1000) / 10 : 0;
            return {
                category: cat,
                color: CATEGORY_COLORS[cat] || '#334155',
                sumManWon,
                eok,
                share,
                count: catItems.length
            };
        }).sort((a, b) => b.sumManWon - a.sumManWon);

        const topProjects = [...targetItems]
            .sort((a, b) => b.amountManWon - a.amountManWon)
            .slice(0, 3);

        return {
            totalManWon,
            totalEok: Math.round((totalManWon / 10000) * 10) / 10,
            byCat,
            topProjects
        };
    }

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
                                    <p class="text-xs text-slate-500">지도의 시·도를 누르면 <b class="text-slate-700">어디에(분야별 비중) · 어떻게(핵심 지출 사업)</b> 썼는지 상세 카드가 바로 열립니다.</p>
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
                        <div class="relative w-full h-[480px] sm:h-[540px]">
                            <div id="js-leaflet-map" class="w-full h-full"></div>
                            <button id="js-reset-region-btn" class="hidden absolute top-4 right-4 z-[500] bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl shadow-lg transition">
                                전국 전체보기로 복귀
                            </button>
                            <!-- 지도 위 선택 지역 '어디에·어떻게 썼나' 즉석 브리핑 패널 -->
                            <div id="js-map-insight-card" class="hidden absolute bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:bottom-4 sm:w-[370px] z-[500] bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/90 p-4"></div>
                        </div>
                    </div>

                    <!-- 2. 연도별 추이 그래프 + 행정분야별 지출 구조 분석 (2단 그리드) -->
                    <div class="grid grid-cols-1 xl:grid-cols-12 gap-6">
                        <div id="js-trend-section" class="xl:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6"></div>
                        <div id="js-category-chart-section" class="xl:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 flex flex-col justify-between"></div>
                    </div>

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
            renderCategoryChart();
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
        const insightCard = document.getElementById('js-map-insight-card');

        if (state.selectedRegionId !== 'ALL') {
            resetBtn.classList.remove('hidden');
        } else {
            resetBtn.classList.add('hidden');
        }

        // 지도 위 즉석 브리핑 카드 갱신 (어디에·어떻게 썼는지 바로 시각화)
        if (insightCard) {
            const breakdown = getCategoryBreakdown(state.selectedYear, state.selectedRegionId);
            const selectedReg = ALL_REGION_DEFS.find(r => r.id === state.selectedRegionId);
            const scopeName = selectedReg ? selectedReg.name : `전국 통합 (${state.selectedYear}년)`;
            const top3Cats = breakdown.byCat.slice(0, 3);

            insightCard.classList.remove('hidden');
            insightCard.innerHTML = `
                <div class="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">지출 사용처 브리핑</span>
                        <h3 class="text-sm font-extrabold text-slate-900 mt-1">${scopeName}</h3>
                    </div>
                    <div class="text-right">
                        <div class="text-[11px] text-slate-500">총 집행액</div>
                        <div class="text-sm font-extrabold text-emerald-700">${breakdown.totalEok.toLocaleString()}억원</div>
                    </div>
                </div>

                <!-- 어디에 썼나? (분야별 누적 바) -->
                <div class="mt-2.5">
                    <div class="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-1">
                        <span>1. 어디에 썼나? (분야별 비중)</span>
                        <span class="text-blue-700">1위 ${top3Cats[0]?.category} (${top3Cats[0]?.share}%)</span>
                    </div>
                    <div class="w-full h-3 rounded-full overflow-hidden flex bg-slate-100">
                        ${breakdown.byCat.map(c => `
                            <div style="width:${c.share}%; background-color:${c.color};" title="${c.category}: ${c.eok}억원 (${c.share}%)"></div>
                        `).join('')}
                    </div>
                    <div class="grid grid-cols-3 gap-1.5 mt-2">
                        ${top3Cats.map(c => `
                            <div class="bg-slate-50 rounded-lg px-2 py-1.5 border border-slate-100">
                                <div class="flex items-center gap-1 text-[10px] font-bold text-slate-600 truncate">
                                    <span class="w-2 h-2 rounded-full shrink-0" style="background:${c.color};"></span>
                                    <span class="truncate">${c.category}</span>
                                </div>
                                <div class="text-xs font-extrabold text-slate-900 mt-0.5">${c.eok}억 <span class="text-[10px] font-normal text-slate-500">(${c.share}%)</span></div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- 어떻게 썼나? (핵심 지출 사업 TOP 3) -->
                <div class="mt-3 pt-2.5 border-t border-slate-100">
                    <div class="text-[11px] font-bold text-slate-700 mb-1.5">2. 어떻게 썼나? (최대 집행 사업 TOP 3)</div>
                    <div class="space-y-1.5">
                        ${breakdown.topProjects.map((p, idx) => `
                            <div class="flex items-center justify-between gap-2 text-[11px] bg-slate-50/80 px-2.5 py-1.5 rounded-lg">
                                <div class="truncate text-slate-800 font-medium">
                                    <span class="font-extrabold text-blue-800 mr-1">${idx + 1}.</span>${escapeHtml(p.projectName.replace(/^\[\d+\]\s*/, ''))}
                                </div>
                                <span class="shrink-0 font-bold text-slate-900">${formatManWon(p.amountManWon)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
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
            const regionBreakdown = getCategoryBreakdown(state.selectedYear, region.id);
            const topCat = regionBreakdown.byCat[0];

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
                `<div style="font-family:'Noto Sans KR',sans-serif; padding:4px 6px; min-width:195px;">
                    <div style="font-weight:800; color:#0f172a; font-size:13px; border-bottom:1px solid #e2e8f0; padding-bottom:3px; margin-bottom:4px;">${region.name} (${state.selectedYear}년)</div>
                    <div style="font-size:12px; color:#334155;">총 예산: <b>${stat.totalBudget.toLocaleString()}억원</b> (집행 ${stat.execRate}%)</div>
                    <div style="font-size:11.5px; color:#1d4ed8; margin-top:3px; font-weight:700;">최다 지출 분야: ${topCat.category} (${topCat.share}%)</div>
                    <div style="font-size:11px; color:#475569; margin-top:2px;">주요 사업: ${escapeHtml(regionBreakdown.topProjects[0].projectName.replace(/^\[\d+\]\s*/, ''))}</div>
                </div>`,
                { direction: 'top', offset: [0, -size / 2] }
            );

            marker.addTo(markersLayer);
        });
    }

    // =========================================================================
    // 7. 지역 빠른 선택 바 및 핵심 요약 카드
    // =========================================================================
    // 8-2. '어디에 어떻게 썼나?' 행정분야별 지출 구조 & 대표 사업 차트
    // =========================================================================
    function renderCategoryChart() {
        const container = document.getElementById('js-category-chart-section');
        if (!container) return;

        const breakdown = getCategoryBreakdown(state.selectedYear, state.selectedRegionId);
        const selectedReg = ALL_REGION_DEFS.find(r => r.id === state.selectedRegionId);
        const scopeLabel = selectedReg ? selectedReg.shortName : '전국';
        const maxEok = Math.max(...breakdown.byCat.map(c => c.eok), 1);

        container.innerHTML = `
            <div>
                <div class="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div class="flex items-center gap-2">
                        <span class="w-2.5 h-6 bg-amber-500 rounded-full"></span>
                        <div>
                            <h2 class="text-base sm:text-lg font-bold text-slate-900">어디에 썼나? 분야별 지출</h2>
                            <p class="text-xs text-slate-500">${state.selectedYear}년 ${scopeLabel} 기준 (막대 클릭 시 해당 분야 필터링)</p>
                        </div>
                    </div>
                    ${state.selectedCategory !== 'ALL' ? `
                        <button id="js-cat-reset-btn" class="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-900 text-white hover:bg-slate-800">
                            전체 분야
                        </button>
                    ` : ''}
                </div>

                <!-- 6대 분야별 가로 막대 그래프 -->
                <div class="mt-4 space-y-3">
                    ${breakdown.byCat.map(cat => {
                        const barPct = Math.max(6, Math.round((cat.eok / maxEok) * 100));
                        const isCatSelected = state.selectedCategory === cat.category;
                        return `
                            <button type="button" data-cat="${cat.category}" class="js-cat-bar-btn w-full text-left group p-2 rounded-xl transition ${
                                isCatSelected ? 'bg-blue-50 ring-2 ring-blue-600' : 'hover:bg-slate-50'
                            }">
                                <div class="flex items-center justify-between text-xs mb-1">
                                    <span class="font-bold text-slate-800 flex items-center gap-1.5">
                                        <span class="w-2.5 h-2.5 rounded-full inline-block" style="background:${cat.color};"></span>
                                        ${cat.category}
                                    </span>
                                    <span class="font-extrabold text-slate-900">
                                        ${cat.eok.toLocaleString()}억원 <span class="text-slate-500 font-semibold">(${cat.share}%)</span>
                                    </span>
                                </div>
                                <div class="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div class="h-full rounded-full transition-all duration-300" style="width:${barPct}%; background:${cat.color};"></div>
                                </div>
                            </button>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- 어떻게 썼나? 핵심 집행 사업 요약 -->
            <div class="mt-5 pt-4 border-t border-slate-100">
                <div class="text-xs font-extrabold text-slate-800 mb-2">어떻게 썼나? 주요 집행 사업 TOP 3</div>
                <div class="space-y-2">
                    ${breakdown.topProjects.map((proj, idx) => `
                        <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between gap-2">
                            <div class="min-w-0">
                                <div class="text-[11px] font-bold text-blue-800">${idx + 1}위 · ${proj.regionShort} · ${proj.category}</div>
                                <div class="text-xs font-semibold text-slate-900 truncate mt-0.5">${escapeHtml(proj.projectName.replace(/^\[\d+\]\s*/, ''))}</div>
                            </div>
                            <div class="shrink-0 text-xs font-extrabold text-emerald-700">${formatManWon(proj.amountManWon)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        container.querySelectorAll('.js-cat-bar-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const clickedCat = btn.getAttribute('data-cat');
                state.selectedCategory = (state.selectedCategory === clickedCat) ? 'ALL' : clickedCat;
                const catSelect = document.getElementById('js-category-select');
                if (catSelect) catSelect.value = state.selectedCategory;
                renderCategoryChart();
                renderTable();
            });
        });

        const resetCatBtn = document.getElementById('js-cat-reset-btn');
        if (resetCatBtn) {
            resetCatBtn.addEventListener('click', () => {
                state.selectedCategory = 'ALL';
                const catSelect = document.getElementById('js-category-select');
                if (catSelect) catSelect.value = 'ALL';
                renderCategoryChart();
                renderTable();
            });
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
        renderCategoryChart();
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
