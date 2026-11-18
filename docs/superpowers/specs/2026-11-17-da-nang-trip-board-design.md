# 다낭 3박 4일 여행 보드 설계

## 의도

2026년 11월 19–22일 다낭 여행의 흩어진 항공·숙소·맛집·액티비티 정보를 한 화면에서 확인하고, 아직 확정하지 않은 후보와 추천 동선을 구분한다.

## 목표

- 11월 19일 입국부터 22일 출국까지 날짜별 추천 코스를 시간순으로 보여준다.
- 날짜를 바꾸면 해당 날짜의 장소와 방문 순서를 Leaflet 지도에서 함께 바꾼다.
- 각 날짜에 최고·최저 기온과 예보 문구를 표시하고 최신 공식 예보 링크를 제공한다.
- 추천 일정과 후보 카드를 누르면 요약·방문 팁·출처·지도 링크를 상세창에서 확인한다.
- 점심·저녁은 한 곳으로 고정하지 않고 끼니별 2–3곳의 식당·대표 메뉴를 지도 선택지로 보여준다.
- 사용자가 준 후보와 웹·소셜 추천 후보를 음식, 액티비티, 마사지로 묶는다.
- 비·뇌우에 따라 보트와 오행산을 선택적으로 바꾸도록 날씨 주의사항과 실내 대안을 보여준다.
- `ui-ux-pro-max`의 편집형 레이아웃을 단순하게 적용한다. 흰 배경, 하늘색 강조, 본문과 같은 글꼴, 모바일의 지도→날짜→일정 순서를 사용한다.

## 비목표

- 예약·결제·교통편 예약, 실시간 날씨 연동, 주소 자동 지오코딩은 추가하지 않는다.
- 후보를 클릭해 일정에 자동 삽입하는 기능이나 후보 편집 기능은 추가하지 않는다.
- 기존 Node.js API와 편집자 토큰 흐름을 교체하지 않는다.

## 접근 방식

1. **현재 앱에 다낭 여행 데이터를 채우고 후보 영역과 상세창을 추가한다 (선택안).** 이미 있는 날짜 탭, Leaflet 지도, JSON 저장 API를 재사용하므로 요구된 일정·지도·편집 흐름을 가장 적은 변경으로 완성한다.
2. 별도 정적 페이지를 새로 만든다. 기존 화면·지도·편집 기능을 중복 구현하게 되어 유지할 이유가 없다.
3. 후보를 서버에서 편집하고 검색하는 별도 콘텐츠 관리 기능을 만든다. 이번 여행 한 건에 필요하지 않은 저장 구조와 기능이 늘어난다.

## 제안 일정

날짜는 요일이 맞는 2026년으로 해석한다. 이동 시간은 교통 상황에 따라 달라질 수 있으므로 앱에는 예상치와 여유를 둔다.

- **11/19 목 — 입국·한시장:** 14:15 다낭 도착, STAR Cafe 앞 Trip.com 픽업, Marriott 체크인. 17시 전후 한시장과 핑크성당을 짧게 본다. 저녁 후보는 한시장 주변 Quán Phú Hồng(넴느엉), Chao Ba Bun Cha Ha Noi(분짜), Banh Mi Co Tien(반미) 중 선택한다. 이후 SPA Field 마사지. 항공 지연 시 시장은 건너뛴다. 조식·점심은 출국일/기내 식사로 두고 다낭 식당을 억지로 배정하지 않는다.
- **11/20 금 — 호이안:** 아침은 호텔 조식. 11:30 전후 출발해 점심 후보인 Cao Lầu Thanh(까오러우), Cơm Gà Bà Buội(호이안 치킨라이스), Mì Quảng 92(미꽝) 중 하나를 고른다. 날씨와 현장 운영이 괜찮을 때만 깜탄 바구니배를 먼저 타고, 호이안 구시가지·Mót·Faifo Coffee를 둘러본다. 저녁 후보는 Morning Glory Original(호이안 지역 음식), White Rose Restaurant(화이트로즈 만두·완탕), Bánh Mì Phượng(반미) 중 선택한 뒤 야시장을 걷는다. 강 수위나 비가 좋지 않으면 배 체험을 생략하고 구시가지 실내 식당·카페 위주로 바꾼다.
- **11/21 토 — 오행산·다낭 야경:** 아침은 호텔 조식. 오전에 오행산과 암푸동굴을 함께 둘러본다. 점심은 호텔 식당 Man Ho, Beach House 또는 Gallery Restaurant에서 현지식/해산물 메뉴를 고른다. 비가 오거나 계단이 미끄러우면 참 조각 박물관과 호텔 식당으로 변경한다. 저녁은 Mộc Quán, Zo Zo Seafood, Hải Sản Phú 중 한 곳에서 해산물을 먹고, 날씨·운영이 허락하면 썬짜 야시장과 용다리 주말 불·물 쇼를 본다.
- **11/22 일 — 리조트·귀국:** 아침은 호텔 조식, 오전은 리조트 휴식. 점심은 13시 공항 출발 전 Beach House, Man Ho 또는 Gallery Restaurant를 선택한다. 13:00 공항 이동, 15:45 KE458 탑승. 기내/귀국 후 저녁 식당은 일정에 넣지 않는다.

2026년 11월 17일 현재 국립 기상예보센터 예보는 날짜별로 다음과 같다. 11/19 최고 29°C·최저 24°C, 구름 많고 뇌우; 11/20 28°C·24°C, 구름 많고 보통 비; 11/21 29°C·24°C, 구름 많고 강한 비; 11/22 30°C·24°C, 소나기와 뇌우. 다낭 기상수문청은 19–22일 일부 지역 중·강한 비와 뇌우, 저지대·도시 침수 가능성 및 산사태 주의를 추가로 알린다. 화면의 예보는 이 확인 시점의 스냅샷이며, 매일 아침 공식 링크에서 갱신 확인을 안내한다. 바구니배·등불배와 오행산은 “현장 날씨·운영 확인 후” 조건을 붙인다.

## 화면·동작

- 상단에는 다낭 여행 날짜, 항공 정보, 숙소를 간결하게 표시한다.
- 데스크톱에서는 일정과 Leaflet 지도를 나란히 두고, 모바일에서는 지도·날짜 탭·일정 순서로 세로 배치한다.
- 날짜별 날씨 요약을 일정 상단에 보여준다. 날씨는 정적 스냅샷으로 입력하고 국립 기상예보센터 페이지에 연결한다.
- 일정 카드 선택은 키보드로도 열 수 있는 네이티브 상세 대화상자를 띄운다. 상세창에 시간, 장소, 메모, 출처 링크, 좌표 기반 지도 검색 링크를 보여준다. 지도 마커 선택은 기존처럼 해당 장소를 강조한다.
- 후보 영역은 음식·액티비티·마사지 3개 탭으로 나눈다. 점심·저녁 카드 그룹에 2–3개 식당을 놓고 대표 메뉴를 표시한다. 해당 장소들은 지도에도 대체 후보 마커로 표시하고, 마커/카드를 누르면 상세와 Google Maps 길찾기 링크를 연다. 시간선 경로는 추천 기본안의 방문 순서를 유지한다.
- 지도 선은 기존처럼 방문 순서의 직선 연결이다. 자동차·도보 길찾기를 계산하는 경로는 아니다.
- 현재 브라우저에서 작동하는 단일 여행 편집 흐름을 유지한다. 새 상세 정보 필드는 저장·수정 뒤에도 보존되도록 기존 검증과 편집 폼에 포함한다.
- 흰 배경과 하늘색 강조를 사용하고 제목도 본문과 같은 글꼴로 맞춘다. 포커스 표시·키보드 조작·작은 화면·감소된 모션을 유지한다.

## 후보 콘텐츠

사용자가 제공한 항목을 기본으로 담고, 새 후보로는 MICHELIN Guide의 Bánh Xèo Bà Dưỡng, Mỳ Quảng Sứa Hồng Vân, Bún Chả Cá Hờn과 소셜 추천의 Mì Quảng Bà Ngân을 추가한다. 호이안 식당과 Marriott 식당은 Vietnam Tourism·Da Nang 관광 포털·호텔 공식 안내를 참고한다. 우천 대안은 다낭 공식 관광 포털의 참 조각 박물관이다. 모든 식사 선택지는 위도·경도와 Google Maps 검색/길찾기 URL을 함께 가진다. 기존 사용자의 가격·평점은 입력자료 기준으로 표기하고, 영업시간과 가격은 바뀔 수 있어 방문 전 확인 링크를 둔다.

## 변경 범위

- `data/itinerary.json`: 서울 예시를 4일 다낭 일정으로 교체한다.
- `public/recommendations.json`: 날짜·끼니별 식당 선택지와 음식·액티비티·마사지 후보, 좌표, 지도 검색 및 출처 링크를 둔다.
- `public/index.html`, `public/app.js`, `public/styles.css`: 항공·여행 정보, 날짜별 날씨, 식사 선택, 후보 탭, 상세 대화상자, 대체 식당 지도 마커, 모바일 UI를 구현한다.
- `server.js`: 새 일정 상세·출처 필드를 검증하고 저장 시 보존한다. 읽기 API, 인증 방식, 파일 저장 구조는 유지한다.
- 자동 테스트는 추가하지 않는다. 구현 후 구문과 화면 동작만 확인한다.

## 확인 출처

- [다낭 기상수문청, 11월 18–24일 예보](https://pctt.danang.gov.vn/Portals/0/DNAN_DIEM_20261114_1530%20%281%29.pdf)
- [국립 기상예보센터, 다낭 10일 일별 예보](https://nchmf.gov.vn/KttvsiteE/en-US/2/da-nang-w55.html)
- [다낭 관광 포털, 2026 관광지 운영시간·요금](https://danangfantasticity.com/en/plan-your-da-nang-journey-2026-updated-admission-prices-for-attractions-and-tourist-sites)
- [다낭 관광 포털, 호이안 구시가지·야경·Faifo Coffee](https://danangfantasticity.com/en/see-and-do/hoi-an-ancient-town)
- [베트남 관광청, 호이안 음식과 지역 메뉴](https://vietnam.travel/things-to-do/explore-food-hoi-an/)
- [Vietnam Airlines, Cao Lầu Thanh 주소·운영 정보](https://www.vietnamairlines.com/go/vi/plan-book/travel/travel-guide/cao-lau-hoi-an)
- [Danang Marriott 공식 식음 안내](https://www.marriott.com/en-us/hotels/dadnn-danang-marriott-resort-and-spa-non-nuoc-beach-villas/dining/)
- [다낭 관광 포털, 용다리 주말 쇼 안내](https://danangfantasticity.com/cn/hint-where-should-we-go-in-da-nang-at-night)
- [MICHELIN Guide, Bánh Xèo Bà Dưỡng](https://guide.michelin.com/no/en/da-nang-region/da-nang_2984390/restaurant/banh-xeo-ba-duong)
- [MICHELIN Guide, Bún Chả Cá Hờn](https://guide.michelin.com/gb/en/da-nang-region/da-nang_2984390/restaurant/bun-cha-ca-hon)
- [Reddit, 다낭 현지 식당 추천에서 Mì Quảng Bà Ngân 언급](https://www.reddit.com/r/DaNang/comments/1p172gs/mi_quang_on_da_nang/)
- [Reddit, 최신 다낭 맛집 추천 글](https://www.reddit.com/r/VietnamFood/comments/1xvyut1/first_trip_to_da_nang_lmk_your/)

## 확인이 필요한 가정

- 여행 연도는 날짜의 요일과 현재 날짜에 맞춰 2026년으로 설정한다.
- 사용자가 입력한 마사지 가격과 평점은 조사 완료된 현재 가격으로 보증하지 않는다.
- Trip.com 픽업 참조번호는 일정 상세에 표시되면 해당 페이지를 보는 사람이 확인할 수 있다. 외부 공개 배포 전에는 숨기거나 삭제할 수 있어야 한다.
