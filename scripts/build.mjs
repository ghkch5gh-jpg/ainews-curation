#!/usr/bin/env node
import { readFile, writeFile, readdir } from "node:fs/promises";

const DRY_RUN = process.env.DRY_RUN === "1";
const API_KEY = process.env.MANUS_API_KEY;
const AGENT_PROFILE = process.env.MANUS_AGENT_PROFILE || "manus-1.6-lite";
const BASE_URL = "https://api.manus.ai/v2";
const POLL_INTERVAL_MS = 10_000;
const MAX_POLLS = 90;

if (!DRY_RUN && !API_KEY) {
  console.error("MANUS_API_KEY 환경변수가 비어 있음.");
  process.exit(1);
}

const sources = JSON.parse(await readFile("scripts/sources.json", "utf8"));

// SINCE: yesterday in ISO (for GitHub Search pushed filter) + unix ts for HN
const now = new Date();
const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
const sinceIso = yesterday.toISOString().slice(0, 10);
const sinceTs = Math.floor(yesterday.getTime() / 1000);

const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
const dateStr = kst.toISOString().slice(0, 10);
const dayOfWeek = ["일", "월", "화", "수", "목", "금", "토"][kst.getUTCDay()];
const slug = `${dateStr}_${dayOfWeek}`;

async function fetchWithRetry(url, { headers = {}, attempts = 3, baseDelayMs = 800 } = {}) {
  const mergedHeaders = {
    "User-Agent":
      "Mozilla/5.0 (compatible; ArchAINewsBot/1.0; +https://www.dangsun.kr)",
    "Accept-Language": "en-US,en;q=0.9,ko;q=0.8",
    ...headers,
  };
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: mergedHeaders });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      lastErr = err;
      if (/HTTP (401|403|404)/.test(err.message)) throw err;
      if (i < attempts - 1) {
        const delay = baseDelayMs * Math.pow(2, i);
        console.warn(`fetch 재시도 ${i + 1}/${attempts - 1} (${delay}ms): ${url} — ${err.message}`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

function stripHtml(html, baseUrl) {
  const seen = new Set();
  let s = html.replace(
    /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_, href, inner) => {
      let url;
      try {
        url = new URL(href, baseUrl).href;
      } catch {
        url = href;
      }
      const text = inner.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      if (!text) return " ";
      if (/^(mailto:|tel:|javascript:|#)/i.test(url)) return ` ${text} `;
      if (text.length < 3) return ` ${text} `;
      const key = `${text}::${url}`;
      if (seen.has(key)) return ` ${text} `;
      seen.add(key);
      return ` ${text} (${url}) `;
    }
  );
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function jsonExtractFromGithubSearch(json) {
  const items = json.items || [];
  return items
    .map((r) => {
      const star = r.stargazers_count || 0;
      const pushed = (r.pushed_at || "").slice(0, 10);
      const desc = (r.description || "").replace(/\s+/g, " ").trim();
      const lang = r.language || "";
      const topics = (r.topics || []).slice(0, 5).join(",");
      return `- ${r.full_name} (${r.html_url}) — ${star}⭐ · pushed ${pushed} · ${lang} · topics: ${topics} · ${desc}`;
    })
    .join("\n");
}

function jsonExtractFromHN(json) {
  const hits = json.hits || [];
  return hits
    .map((h) => {
      const url = h.url || `https://news.ycombinator.com/item?id=${h.objectID}`;
      return `- "${h.title || "(no title)"}" (${url}) — ${h.points || 0} pts · ${h.num_comments || 0} comments · ${(h.author || "").slice(0, 40)}`;
    })
    .join("\n");
}

function jsonExtractFromReddit(json) {
  const children = json?.data?.children || [];
  return children
    .map((c) => {
      const d = c.data || {};
      const externalUrl = d.url_overridden_by_dest || d.url || "";
      const ghMatch = /github\.com\/[\w.-]+\/[\w.-]+|huggingface\.co\/[\w/.-]+/.test(
        externalUrl + " " + (d.selftext || "")
      );
      const tag = ghMatch ? "[has-code-link]" : "";
      return `- "${d.title}" (https://reddit.com${d.permalink}) — ${d.score} pts · external: ${externalUrl} ${tag}`;
    })
    .join("\n");
}

async function fetchSource(s) {
  let url = s.url
    .replaceAll("__SINCE__", sinceIso)
    .replaceAll("__SINCE_TS__", String(sinceTs));

  try {
    const res = await fetchWithRetry(url);
    if (s.kind === "html") {
      const html = await res.text();
      return { ...s, text: stripHtml(html, url).slice(0, 8000), ok: true };
    }
    if (s.kind === "json-search") {
      const json = await res.json();
      return { ...s, text: jsonExtractFromGithubSearch(json), ok: true };
    }
    if (s.kind === "json") {
      const json = await res.json();
      const isHN = /algolia/.test(url);
      const isReddit = /reddit\.com/.test(url);
      const text = isHN
        ? jsonExtractFromHN(json)
        : isReddit
        ? jsonExtractFromReddit(json)
        : JSON.stringify(json).slice(0, 4000);
      return { ...s, text: text.slice(0, 8000), ok: true };
    }
    return { ...s, text: "", ok: false, error: `unknown kind: ${s.kind}` };
  } catch (err) {
    console.warn(`수집 실패 ${s.name}: ${err.message}`);
    return { ...s, text: "", ok: false, error: String(err) };
  }
}

console.log(`소스 ${sources.length}개 fetch 시작 (병렬)...`);
const fetched = await Promise.all(sources.map(fetchSource));
const okSources = fetched.filter((f) => f.ok && f.text);
console.log(`성공: ${okSources.length}/${sources.length}`);

if (okSources.length === 0) {
  console.error("모든 소스 fetch 실패");
  process.exit(1);
}

// Read previous 2 episodes' titles+urls to avoid duplicates
const allMd = (await readdir(".")).filter((f) =>
  /^\d{4}-\d{2}-\d{2}.*\.md$/.test(f) && f !== `${slug}.md`
);
const priorFiles = allMd.sort().reverse().slice(0, 2);
const priorUrls = new Set();
const priorTitles = [];
for (const f of priorFiles) {
  const content = await readFile(f, "utf8");
  for (const m of content.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g)) {
    priorUrls.add(m[2]);
    priorTitles.push(m[1]);
  }
}
console.log(`이전 2회차에서 URL ${priorUrls.size}개 추출 (중복 회피용)`);

const SPEC = await readFile("CURATION_SPEC.md", "utf8");

const prompt = `**중요 사전 지시 — 이 요청은 *채팅 응답* 형식입니다. 작업 요청이 아닙니다.**
- 어떤 도구·외부 검색·파일시스템도 사용 금지.
- 파일을 만들거나 디스크에 저장하지 마세요.
- 응답은 *한 덩어리 JSON*만. 인사·"완성했습니다"·"파일 경로:" 같은 보고문 절대 금지.
- 첫 글자부터 \`{\` 또는 \`\`\`json 으로 시작.

당신은 한국 건축 현상설계 사무소 직원을 위한 **AI·오픈소스 큐레이터**입니다. 오늘(${dateStr}, ${dayOfWeek}요일) 회차를 작성하세요.

# 핵심 명세 (필독)

${SPEC}

# 사이트 텍스트 (오늘 ${okSources.length}개 소스에서 fetch 됨)

${okSources.map((f) => `### ${f.name} (${f.url})\n${f.text}`).join("\n\n---\n\n")}

# 이전 2회차에 다룬 URL (중복 게재 금지 — 단, 의미 있는 신규 릴리스면 "[업데이트]" 라벨로 OK)

${[...priorUrls].slice(0, 60).map((u) => `- ${u}`).join("\n") || "(없음 — 첫 회차)"}

# 출력 규칙

**첫 글자부터** 아래 JSON 스키마로 답하세요. 인사·서론·"분석하겠습니다" 류 절대 금지.

스키마:
\`\`\`
{
  "description": "이 회차 요약 한 문장 (~100자) — frontmatter description에 들어감",
  "flow_summary": "이번 회차 흐름 2~3 문단 (~300자) — '이번 회차 흐름' 섹션에 들어감",
  "trending_picks": [
    {
      "name": "owner/repo 또는 도구명",
      "url": "https://github.com/...",
      "meta": "GitHub Trending | XXk ⭐ | +XX 이번 주 등 한 줄",
      "what": "이게 뭐 하는 도구인지 한 문장 (비유 포함)",
      "arch_use": "건축 활용 한 줄 — 직접 무관/시도 가능 등 솔직히"
    }
  ],
  "core_picks": [
    {
      "name": "owner/repo",
      "url": "https://github.com/...",
      "meta": "★★★ | GitHub | XXk ⭐ | 마지막 갱신",
      "what": "친구가 1초 만에 이해하는 설명 (비유 포함)",
      "why": ["시나리오 1 (구체적)", "시나리오 2 (구체적)", "시나리오 3 (선택)"],
      "claude_use": "git clone 후 자연어 지시 한 줄",
      "why_now": "왜 이번 주 다루는지 1줄"
    }
  ],
  "sub_picks": [
    {
      "name": "owner/repo",
      "url": "https://github.com/...",
      "meta": "★★ | GitHub | XXk ⭐ | 마지막 갱신",
      "what": "한 줄 설명 (비유 포함, CS 약어 풀이)",
      "claude_use": "→ \\\`git clone …\\\` · \\"자연어 지시\\""
    }
  ],
  "memo": "큰 흐름 2~3줄 + 수집 한계 + 다음 회차 예고. 자유 단락 형태."
}
\`\`\`

분량 (명세 §4 — 절대 준수):
- trending_picks: **정확히 5개** (도메인 무관, 그 주에 핫한 거)
- core_picks: **3~5개** (★★★, 건축 직격)
- sub_picks: **5~8개** (★★, 인접 기술)

언어 규칙 (명세 §4-1 — 톤 체크 셀프 질문 통과 필수):
1. "이게 뭐냐" 비유·비교 우선 — 사용자가 아는 것(PPT·DWG·ChatGPT·Revit·CAD)에 빗대 설명
2. "왜 의미 있냐" 구체적 시나리오 — 추상어 ("워크플로우 가속") 금지
3. CS 약어 처음 등장 시 풀이 (repo·SDK·API·library 등)
4. AI/ML 용어 풀이 + 짧은 비유 (LLM·임베딩·NeRF·diffusion·RAG)
5. 건축 약어는 그대로 OK (IFC·BIM·RVT·GH 등)
6. "워크플로우 가속"·"파이프라인 통합"·"에코시스템"·"스택" 금지
7. WebAssembly·transformer·feedforward·topology(CS) 같은 무거운 CS 용어 의역
8. 슬랭("박다"·"꽂다") 절대 금지`;

const promptBytes = Buffer.byteLength(prompt, "utf8");
console.log(`Prompt 길이: ${prompt.length}자 (${(promptBytes / 1024).toFixed(1)} KB)`);

if (DRY_RUN) {
  console.log("=== DRY RUN ===");
  console.log(prompt.slice(0, 2000));
  console.log("...");
  console.log(`(전체 ${prompt.length}자, agent_profile=${AGENT_PROFILE})`);
  process.exit(0);
}

console.log(`Manus task.create 호출 — profile=${AGENT_PROFILE}`);
const createRes = await fetch(`${BASE_URL}/task.create`, {
  method: "POST",
  headers: {
    "x-manus-api-key": API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    message: { content: [{ type: "text", text: prompt }] },
    agent_profile: AGENT_PROFILE,
    hide_in_task_list: true,
    title: `ainews ${slug}`,
  }),
});

if (!createRes.ok) {
  console.error(`task.create 실패: ${createRes.status} ${await createRes.text()}`);
  process.exit(1);
}

const createJson = await createRes.json();
if (!createJson.ok) {
  console.error(`task.create 응답 오류:`, createJson);
  process.exit(1);
}
const taskId = createJson.task_id;
console.log(`Task 생성: ${taskId}`);

async function pollOnce() {
  const res = await fetch(
    `${BASE_URL}/task.listMessages?task_id=${encodeURIComponent(taskId)}&order=desc&limit=100&verbose=true`,
    { headers: { "x-manus-api-key": API_KEY } }
  );
  if (!res.ok) throw new Error(`listMessages: ${res.status} ${await res.text()}`);
  return res.json();
}

let resultJson = null;
let lastStatus = "running";
for (let i = 0; i < MAX_POLLS; i++) {
  await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  let pollJson;
  try {
    pollJson = await pollOnce();
  } catch (err) {
    console.warn(`Poll ${i + 1} 실패: ${err.message} — 재시도`);
    continue;
  }
  const messages = pollJson.messages || [];

  const stopped = messages.find(
    (m) => m.type === "status_update" && m.status_update?.agent_status === "stopped"
  );
  if (stopped) {
    console.log("Task stopped — assistant_message에서 JSON 추출");
    const assistant = messages.find((m) => m.type === "assistant_message");
    const raw = assistant?.assistant_message?.content;
    const text =
      typeof raw === "string"
        ? raw
        : Array.isArray(raw)
        ? raw
            .filter((p) => p?.type === "text" && typeof p.text === "string")
            .map((p) => p.text)
            .join("\n")
        : "";
    if (text) {
      const m =
        text.match(/```json\s*([\s\S]*?)\s*```/) ||
        text.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          resultJson = JSON.parse(m[1] ?? m[0]);
        } catch (e) {
          console.error("JSON 파싱 실패:", e.message);
          console.error("원문 앞 500:", text.slice(0, 500));
        }
      } else {
        console.error("JSON 블록 미발견. 원문 앞 500:", text.slice(0, 500));
      }
    } else {
      console.error("assistant_message.content 비어있음.");
    }
    break;
  }

  const latestStatus = messages.find((m) => m.type === "status_update");
  const status = latestStatus?.status_update?.agent_status || "running";
  if (status !== lastStatus) {
    console.log(`상태: ${status}`);
    lastStatus = status;
  } else {
    console.log(`Poll ${i + 1}: ${status}...`);
  }
}

if (!resultJson) {
  console.error(`Task 타임아웃 또는 결과 없음 (${MAX_POLLS} × ${POLL_INTERVAL_MS}ms)`);
  process.exit(1);
}

const heroDate = dateStr.replaceAll("-", " · ");

function renderTrending(t, i) {
  return `### ${i + 1}. [${t.name}](${t.url})
${t.meta || ""}

${t.what || ""}

**건축 활용:** ${t.arch_use || ""}`;
}

function renderCore(c) {
  const whyList = (c.why || []).map((w) => `- ${w}`).join("\n");
  return `### [${c.name}](${c.url})
${c.meta || ""}

**한 줄로:** ${c.what || ""}

**왜 의미 있냐:**
${whyList}

**Claude Code에 시키기:**
\`\`\`
git clone ${c.url}
\`\`\`
→ "${c.claude_use || ""}"

**왜 이번 주:** ${c.why_now || ""}`;
}

function renderSub(s) {
  return `### [${s.name}](${s.url})
${s.meta || ""}

${s.what || ""}
${s.claude_use || ""}`;
}

const trending = (resultJson.trending_picks || []).map(renderTrending).join("\n\n");
const core = (resultJson.core_picks || []).map(renderCore).join("\n\n---\n\n");
const sub = (resultJson.sub_picks || []).map(renderSub).join("\n\n");

const md = `---
layout: default
title: ${dateStr} (${dayOfWeek})
eyebrow: 큐레이션 회차
hero_title: "${heroDate} <em>(${dayOfWeek})</em>"
description: "${(resultJson.description || "").replaceAll('"', "'")}"
summary: ${(resultJson.description || "").replaceAll('"', "'")}
---

## 이번 회차 흐름

${resultJson.flow_summary || ""}

---

## 🔥 GitHub 이번 주 인기 (건축 무관, 그냥 핫한 거)

이번 주 사람들이 가장 별 많이 누른 5개. **분위기 파악용으로만**.

${trending}

---

## 코어 ★★★ (건축 직격)

${core}

---

## 서브 ★★

${sub}

---

## 메모

${resultJson.memo || ""}
`;

await writeFile(`${slug}.md`, md);
console.log(`${slug}.md 저장됨 (트렌딩 ${(resultJson.trending_picks || []).length} / 코어 ${(resultJson.core_picks || []).length} / 서브 ${(resultJson.sub_picks || []).length})`);

// Rebuild index.md episode list
const files = (await readdir("."))
  .filter((f) => /^\d{4}-\d{2}-\d{2}.*\.md$/.test(f))
  .sort()
  .reverse();

async function readSummaryOf(file) {
  try {
    const raw = await readFile(file, "utf8");
    const m = raw.replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---/);
    if (!m) return "";
    const fm = m[1];
    const sumMatch = fm.match(/^summary:\s*(.+)$/m);
    if (sumMatch) return sumMatch[1].trim();
    const descMatch = fm.match(/^description:\s*"?(.+?)"?$/m);
    if (descMatch) return descMatch[1].trim();
    return "";
  } catch {
    return "";
  }
}

const entries = await Promise.all(
  files.map(async (f) => {
    const slugOnly = f.replace(".md", "");
    const summary = await readSummaryOf(f);
    const m = slugOnly.match(/^(\d{4}-\d{2}-\d{2})_(.+)$/);
    const label = m ? `${m[1]} (${m[2]})` : slugOnly;
    return summary
      ? `- [${label} — ${summary}](${slugOnly}.html)`
      : `- [${label}](${slugOnly}.html)`;
  })
);

const indexMd = `---
layout: default
permalink: /
title: 건축 AI 큐레이션
eyebrow: ARCHITECTURE × AI · DAILY
hero_title: "건축 <em>AI</em> 큐레이션"
description: 매일 아침 8시, 건축·현상설계에 쓸 수 있는 AI 도구·오픈소스·논문을 자동으로 모아 정리합니다. 단순한 데모가 아니라, URL 하나 복사해서 AI 코딩 도구에 넣으면 바로 작업이 시작되는 자료만 추립니다.
stats:
  - num: "매일"
    lbl: "Daily Update"
  - num: "${sources.length}"
    lbl: "Sources"
  - num: "10+"
    lbl: "Items / Day"
  - num: "${files.length}"
    lbl: "회차"
---

## 회차 목록

${entries.join("\n")}
{:.episode-list}

*매일 08:00 KST 새 회차 자동 추가됩니다.*

## 각 회차에는

- 🔥 **GitHub 이번 주 인기** 5개 — 도메인 무관, 그냥 핫한 것
- ★★★ **코어** 3~5개 — 건축 · 현상설계 직격
- ★★ **서브** 5~8개 — 인접 · 재료 기술
- *흐름 메모* — 큰 흐름 2~3줄

---

## 이 사이트는

매일 아침 8시, **GitHub Trending · HuggingFace · arXiv** 같은 곳을 자동으로 돌며 그날 새로 나온 것 중 건축·현상설계에 실제 쓸 수 있는 것만 골라 정리합니다.

기준은 단순합니다 — **"이 URL을 AI 코딩 도구에 붙여 넣으면 바로 작업이 시작되는가?"** 단순히 멋진 데모나 마케팅 글은 거릅니다. 코드를 받아 자기 프로젝트에 통합할 수 있는 것 위주.

## 어떻게 쓰나

각 회차에 정리된 GitHub repo 또는 HuggingFace 모델 URL을 복사해서 [Claude Code](https://claude.com/claude-code) 같은 AI 코딩 도구에 붙여 넣으면, AI가 그 코드를 읽고 너의 의도대로 변형·실험·통합해줍니다.

> 예시 — IFC(BIM 표준 파일) 파서 라이브러리 URL을 붙여 넣고 한 줄:
> "이 라이브러리로 내 프로젝트 BIM 파일에서 모든 방의 면적·인접 관계 자동 추출하는 스크립트 짜줘."

→ 30분 안에 자기 사무실 워크플로우에 끼워 넣을 수 있는 도구가 만들어집니다.
`;

await writeFile("index.md", indexMd);
console.log(`index.md 갱신 (${files.length}회차)`);
