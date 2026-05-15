# 건축 AI 큐레이션

건축 · 현상설계 · 건축 온톨로지 관련 AI · 오픈소스 · 논문 자동 큐레이션.
**매일 08:00 KST** GitHub Actions에서 자동 실행 (로컬 PC 무관 — 클라우드 cron).

각 회차는 다음을 포함:
- 🔥 **GitHub 이번 주 인기 5개** (도메인 무관)
- ★★★ **코어** — 건축·현상설계 직격 (3~5개)
- ★★ **서브** — 인접·재료 (5~8개)
- 흐름 메모 — 큰 흐름 2~3줄

모든 항목은 **URL 하나 복사해서 Claude Code 같은 AI 코딩 도구에 붙여 넣으면 바로 작업이 시작**되는 형태입니다 (GitHub repo / HuggingFace 모델 / arXiv+코드).

웹: https://www.dangsun.kr/curation (메인) · https://ghkch5gh-jpg.github.io/ainews-curation/ (raw 미러)

---

## 명세

큐레이션 규칙·필터·언어 톤은 [`CURATION_SPEC.md`](CURATION_SPEC.md) 참조.
수정 요청은 그 파일을 고치면 다음 회차부터 자동 반영.

## 작동 방식

`.github/workflows/build.yml` 의 cron(`0 23 * * *` UTC = 매일 08:00 KST)이 GitHub Actions 러너에서 `scripts/build.mjs` 실행:

1. `scripts/sources.json` 의 모든 사이트/API fetch (GitHub Trending·HF·arXiv·HN·Reddit)
2. 텍스트 합쳐서 **Manus API** 호출 — `CURATION_SPEC.md` 명세 그대로 prompt에 박음
3. 응답 JSON → MD 파일 작성
4. `git commit && git push`

→ 결과는 raw.githubusercontent.com 통해서 `dangsun.kr/curation` 이 자동으로 5분 안에 가져감.

## 시크릿

레포 Settings → Secrets and variables → Actions 에 등록 필요:

- `MANUS_API_KEY` — Manus 대시보드 → API Keys 에서 발급

수동 실행 (워크플로 테스트):
```powershell
gh workflow run "Build daily AI news curation" --repo ghkch5gh-jpg/ainews-curation
```

## 로컬 개발

```powershell
$env:DRY_RUN = "1"
node scripts/build.mjs       # Manus 호출 없이 prompt 미리보기

$env:DRY_RUN = $null
$env:MANUS_API_KEY = "your-manus-key"
node scripts/build.mjs       # 실제 실행
```
