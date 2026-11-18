# Wanderboard

한 여행의 일정과 지도 경로를 공유하는 작은 Node.js 웹앱입니다.

## 실행

```bash
EDITOR_TOKEN=change-me npm start
```

브라우저에서 `http://localhost:3000`을 열고, 편집은 `http://localhost:3000/?edit=1`에서 `EDITOR_TOKEN`을 입력합니다. 토큰은 브라우저 세션에만 보관됩니다.

일정 원본과 저장 파일은 `data/itinerary.json`입니다. 지도는 Leaflet과 OpenStreetMap 타일을 사용하며, 타일을 불러오지 못해도 일정 목록은 사용할 수 있습니다.

## 읽기 전용 정적 공유 페이지

```bash
npm run build:static
```

단일 HTML 파일 `dist/index.html`이 생성됩니다. 일정과 여행 정보, 앱 CSS·JS는 HTML에 포함되고, Vercel은 `vercel.json` 설정으로 이 파일을 배포합니다. Git 저장소를 Vercel에 연결해 배포하면 공유 URL을 받을 수 있습니다.

정적 페이지는 보기 전용입니다. 일정을 바꾸려면 로컬 앱에서 편집한 뒤 다시 빌드하고 배포하세요. HTML 안에 일정 정보가 들어 있어 공유 URL을 아는 사람은 일정을 볼 수 있습니다. 지도 라이브러리, 글꼴, 지도 타일은 인터넷에서 불러오므로 정적 HTML은 파일로 직접 열지 말고 호스팅 주소나 로컬 HTTP 서버에서 여세요.
