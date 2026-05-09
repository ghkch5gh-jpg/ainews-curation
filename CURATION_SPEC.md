---
layout: default
title: 큐레이션 명세
---

# 건축 AI 큐레이션 명세

이 파일은 자동 큐레이션 작업의 단일 기준 문서. 스케줄 작업이 매 회차 이 명세를 따른다.
변경 시 이 파일만 수정하면 다음 회차부터 반영됨.

---

## 0. 사용자 도메인

- 건축가 / 현상설계(competition design) 워크플로우
- 관심: **컨셉 가속 + 법규·실시 자동화** 둘 다
- 건축 온톨로지: **연구 흐름 + 본인 프로젝트에 박을 인프라** 둘 다
- 빌더 마인드 — 단순 데모 ❌ / 파이프라인에 박을 수 있는 것 ✅

## 1. 절대 필터 — "Claude Code에 URL 박으면 작업이 시작되는 자료"

각 큐레이션 아이템은 다음 중 하나여야 함:
- GitHub repo URL (clone 가능)
- Hugging Face 모델 / 데이터셋 / Space URL
- arXiv 논문 URL — **단 코드 링크 있는 것만**
- Papers with Code 링크
- HN/Reddit 글 — **GitHub repo·HF 모델 링크가 본문에 달린 글만** 통과

자동 제외:
- 코드 없는 arXiv 논문 (큰 흐름이면 마지막 "흐름 메모"에만 짧게)
- 데모영상만 있는 트윗·마케팅 페이지
- 유료 SaaS 출시 / 투자·인수 소식
- 미디엄·ArchDaily·Dezeen 류 일반 뉴스/리스트

## 2. 소스

### 2.1 GitHub Trending + Topics
- `https://github.com/trending` (daily/weekly)
- `https://github.com/trending/python?since=weekly` 등 언어별
- 토픽 페이지:
  - `https://github.com/topics/bim`
  - `https://github.com/topics/ifc`
  - `https://github.com/topics/grasshopper`
  - `https://github.com/topics/parametric-design`
  - `https://github.com/topics/generative-design`
  - `https://github.com/topics/architectural-design`
  - `https://github.com/topics/nerf`
  - `https://github.com/topics/gaussian-splatting`
  - `https://github.com/topics/image-to-3d`
  - `https://github.com/topics/floor-plan`
- GitHub Search API: `https://api.github.com/search/repositories?q=architecture+OR+bim+OR+ifc+stars:>50+pushed:>YYYY-MM-DD&sort=stars`

### 2.2 Hugging Face
- Trending 모델: `https://huggingface.co/models?sort=trending`
- 토픽 검색: `https://huggingface.co/models?other=image-to-3d`, `other=depth-estimation`, `other=segmentation`
- Spaces Trending: `https://huggingface.co/spaces?sort=trending`

### 2.3 arXiv (코드 있는 것만)
- `cs.GR`, `cs.CV`, `cs.AI` 카테고리 최근 listing
- 각 논문 abstract 페이지에 "Code" 링크(GitHub/Papers with Code) 없으면 제외
- 키워드: architecture, BIM, IFC, floor plan, building, generative design, layout, 3D reconstruction, NeRF, gaussian splatting, depth, semantic segmentation

### 2.4 Papers with Code
- `https://paperswithcode.com/latest`
- 키워드 검색: `https://paperswithcode.com/search?q_meta=&q=architecture`

### 2.5 Hacker News (Show HN 포함)
- Algolia API: `https://hn.algolia.com/api/v1/search?query=KEYWORD&tags=story&numericFilters=points>30`
- Show HN: `https://hn.algolia.com/api/v1/search?tags=show_hn&numericFilters=points>20`
- 키워드: BIM, IFC, architecture AI, generative design, floor plan, NeRF, gaussian splatting, image-to-3d, parametric, grasshopper, revit, CAD AI
- 본문에 GitHub/HF 링크 있는 것만 통과

### 2.6 Reddit (JSON API, 인증 불필요)
- 서브레딧 (top of week):
  - `https://www.reddit.com/r/architecture/top.json?t=week`
  - `https://www.reddit.com/r/Rhino/top.json?t=week`
  - `https://www.reddit.com/r/grasshopper3d/top.json?t=week`
  - `https://www.reddit.com/r/BIM/top.json?t=week`
  - `https://www.reddit.com/r/Revit/top.json?t=week`
  - `https://www.reddit.com/r/MachineLearning/top.json?t=week`
  - `https://www.reddit.com/r/LocalLLaMA/top.json?t=week` (건축·IFC·도메인 적용 글만 추림)
- 본문 또는 url 필드에 GitHub/HF 링크 있는 글만 통과

## 3. 등급

- ★★★ — 사용자 도메인 직격. 컨셉 또는 법규/온톨로지 단계에 즉시 박을 수 있음. 코어 섹션.
- ★★ — 인접·재료 기술. 가져다 쓰면 가공 필요. 서브 섹션.
- ★ — 흐름상 알 가치는 있지만 직접 적용 모호. 흐름 메모에만 한두 줄.

가산점 사유:
- IFC / BIM / 건축 온톨로지 / 법규 자동화 직접 다룸
- Rhino·Grasshopper·Revit 플러그인 형태
- 한국어 또는 동아시아 도시 데이터·법규 다룸
- 활발한 커밋 (지난 30일 내)

## 4. 출력 분량

- **🔥 GitHub 전체 인기 (도메인 무관)**: 5개 — 건축이든 아니든 그 주에 가장 별 많이 받은 repo
- 코어 ★★★: 3~5개 (건축 직격)
- 서브 ★★: 5~8개 (인접·재료)
- 흐름 메모: 2~3줄 (이번 회차 큰 흐름)

## 4-1. 언어 규칙 (중요)

전문용어는 그대로 쓰되 **등장할 때마다 짧은 괄호 풀이**. 사용자가 매번 풀이하기로 결정함 (2026-05-10). 모든 걸 일상어로 바꾸진 말 것 — 용어 자체는 보여줘야 함.

예외: 한 항목 안에서 같은 용어가 2~3번 연달아 나오면 두 번째부턴 생략 OK. 다른 항목·다른 섹션에선 다시 풀이.

용어 처리 기준:
- **건축 약어 (IFC, BIM, RVT, DWG, DGN, glTF, OBJ, FBX)** → 그대로. 풀이 불필요.
- **AI/ML 핵심 (LLM, RAG, 임베딩, NeRF, gaussian splatting, depth estimation, mesh, segmentation, diffusion, transformer)** → 처음 등장 시 괄호 두세 단어 풀이, 이후 용어만.
  예시: "임베딩(비슷한 것끼리 가깝게 숫자로 변환)", "NeRF(사진 여러 장으로 3D 재구성)"
- **CS 일반 (API, SDK, repo, library, framework, CLI)** → 그대로. 풀이 없음.
- **여전히 풀어쓸 niche 용어:**
  - WebAssembly / WASM → "네이티브 속도로" 정도로 의역
  - 파레토 프론트 → "여러 기준 동시에 괜찮은 옵션 묶음"
  - 피드포워드 → "한 번에" 또는 빼기
  - 메트릭 깊이 → "실측 거리(미터)"
  - 토폴로지(CS 의미) → "구조" 또는 빼기 (건축 토폴로지는 OK)

설명 원칙:
- "건축가에게 어떤 의미인지" 한 줄은 구체로 — "이거 있으면 ___ 자동화" 식
- 한 항목 안에서 같은 개념을 두 용어로 부르지 말 것
- 풀이 추가한다고 줄 수 늘리지 말 것 (괄호 안에 박기)

## 5. 아이템 표준 포맷

```markdown
### [이름](URL)
★등급 | 소스 | stars/score | 마지막 업데이트 또는 등재일

**한 줄 요약:** 이게 뭐 하는 물건인지 한 문장.

**현상설계 적용:**
- 컨셉 단계: …
- 법규/온톨로지: …

**Claude Code 사용:**
\`\`\`
git clone <URL>
\`\`\`
→ "<자연어 지시>"

**왜 지금 봐야:** 한 줄.
```

## 6. 파일 출력

- 경로: `C:\Users\myh43\ainews\YYYY-MM-DD_요일.md`
- 요일: 한글 한 글자 (월/화/수/목/금/토/일)
- 파일 헤더: 날짜, 회차 요약 1줄
- 섹션 순서: 흐름 메모 → 코어 ★★★ → 서브 ★★

## 7. 일정

- **현재 운영:** 매일 09:00 KST (cron: `0 9 * * *` 로컬 타임)
- **시범 운영 기간** — 2026-05-11 ~ 2026-05-17 (1주). 이후 사용자가 빈도 재검토 (월/수/금으로 줄일지 매일 유지할지)
- 변경 시: 이 파일과 스케줄 작업 둘 다 수정

## 8. 중복 방지

- 직전 2회차(`ainews/`의 최신 2개 파일) 읽고, 동일 repo·논문·모델 URL은 새 파일에서 제외
- 단, 같은 repo가 의미 있는 신규 릴리스/논문 발표한 경우는 "업데이트" 표시로 다시 등재 가능
