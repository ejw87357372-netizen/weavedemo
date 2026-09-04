"use client";
// ─────────────────────────────────────────────────────────────
// Weave AI — 관리자·구성원 통합 데모 (단일 클라이언트 컴포넌트)
// 백엔드·외부 API 없음. 모든 추천은 규칙 기반 가상 데이터.
// ─────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
import {
  EMPLOYEES, PROJECT, SEARCH_RESULTS, TEAM_INIT, ALTERNATES,
  GAPS, GAPS_BY_ROLE, PATHS, RETENTION, empById,
  INTERVIEW_REQS, DECISIONS, BLIND_SPOTS, ROLE_FAMILY, FAMILY_RISK,
  workOf, smeOf,
} from "@/lib/tcData";
import { RiskQuadrant } from "@/components/charts";

// 화면 관점 구분: admin = 인사담당자, emp = 직원 본인, all = 전 구성원 공통
const MENU_GROUPS = [
  ["관리자 화면", "admin", [
    ["dash", "통합 대시보드"], ["search", "AI 인재 탐색"],
    ["profiles", "인재 프로필"], ["skillgap", "스킬 갭 분석"],
    ["matching", "프로젝트 매칭"], ["decisions", "결정 기록"],
    ["sim", "이탈 영향 시뮬레이션"], ["retention", "인재 유지관리"],
  ]],
  ["구성원 화면", "emp", [
    ["profile", "내 역량 프로필"], ["training", "성장 로드맵"], ["career", "경력경로"],
  ]],
  ["공통", "all", [
    ["fairness", "공정성·신뢰센터"], ["research", "인터뷰 반영 내역"], ["about", "시스템 안내"],
  ]],
];
const AUD = { dash: "admin", search: "admin", profiles: "admin", skillgap: "admin",
  matching: "admin", decisions: "admin", sim: "admin", retention: "admin",
  profile: "emp", training: "emp", career: "emp", fairness: "all", research: "all", about: "all" };
const AUD_LABEL = {
  admin: "관리자 화면",
  emp: "구성원 화면",
  all: "공통 화면",
};

const CHECKS = [
  "구성원에게 추천 사실을 안내했는가?",
  "구성원의 프로젝트 참여의사를 확인했는가?",
  "추천 근거를 담당자가 검토했는가?",
  "특정 구성원에게 기회가 편중되지 않았는가?",
  "AI가 제시한 후보 외의 인재도 검토했는가?",
];

export default function System() {
  const [screen, setScreen] = useState("dash");
  const [toasts, setToasts] = useState([]);
  const toast = (msg) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg }].slice(-3));   // 최대 3개까지만 쌓이게
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  };

  // SME(직무 전문가) 검토 상태 — { [empId]: { by, at, verdict, note } }
  const [smeDone, setSmeDone] = useState({});
  const [smeTarget, setSmeTarget] = useState(null);   // 검토 모달 대상
  const [decisionLog, setDecisionLog] = useState([]);  // 이번 세션에 기록된 결정
  const [smeVerdict, setSmeVerdict] = useState("적합");
  const [smeNote, setSmeNote] = useState("");

  // 인재 탐색
  const [searched, setSearched] = useState(false);
  const [why, setWhy] = useState(null);            // 추천 근거 모달 대상
  const [fDept, setFDept] = useState("전체");
  const [fSkill, setFSkill] = useState("전체");

  // 프로젝트 매칭
  const [team, setTeam] = useState(TEAM_INIT);
  const [confirmed, setConfirmed] = useState({});  // id -> 참여의사 확인
  const [excludeTarget, setExcludeTarget] = useState(null);
  const [excludeReason, setExcludeReason] = useState("");
  const [checks, setChecks] = useState(CHECKS.map(() => false));
  const [placed, setPlaced] = useState(false);

  // 역량 프로필 (김서연)
  const me = empById("E01");
  const [wantRole, setWantRole] = useState(me.wantRole);
  const [recvRec, setRecvRec] = useState(true);
  const [aiExcluded, setAiExcluded] = useState({}); // 항목별 AI 분석 제외
  const [requests, setRequests] = useState([]);     // 수정 요청·이의제기 기록

  // 교육 추천 / 경력경로
  const [courseState, setCourseState] = useState({});
  const [pathSel, setPathSel] = useState(null);

  // 필터는 전 구성원(16명)을 대상으로 동작한다.
  // 프로젝트 요구조건과의 일치도가 사전 계산된 후보(SEARCH_RESULTS)는 그 값을 쓰고,
  // 나머지는 요구역량 겹침 수로 규칙 기반 일치도를 즉석 계산한다.
  const results = useMemo(() => {
    const pre = Object.fromEntries(SEARCH_RESULTS.map((r) => [r.id, r]));
    return EMPLOYEES
      .filter((e) => {
        // AI 분석에 동의하지 않은 구성원은 추천 대상에서 제외한다(불이익 없음).
        if (!e.aiConsent) return false;
        if (fDept !== "전체" && e.dept !== fDept) return false;
        if (fSkill !== "전체" && !e.skills.some(([s]) => s === fSkill)) return false;
        return true;
      })
      .map((e) => {
        if (pre[e.id]) return pre[e.id];
        const matched = e.skills.filter(([s]) => PROJECT.required.includes(s)).map(([s]) => s);
        const fit = Math.min(72, 34 + matched.length * 12);
        return {
          id: e.id, fit,
          reason: matched.length
            ? `요구역량 중 ${matched.join(", ")} 보유. 현재 프로젝트 기준 일치도는 낮은 편입니다.`
            : "현재 프로젝트 요구역량과 직접 겹치는 스킬은 없습니다. 다른 프로젝트 기준으로 재검색할 수 있습니다.",
          matched, missing: PROJECT.required.filter((r) => !matched.includes(r)),
          similar: e.projects.slice(0, 1), wantMatch: false,
        };
      })
      .sort((a, b) => b.fit - a.fit);
  }, [fDept, fSkill]);

  return (
    <div className="tc">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* ── 헤더 ── */}
      <header className="tc-head">
        <div>
          <div className="tc-title">Weave AI <span className="tc-demo-tag">데모 · 가상 데이터</span></div>
          <div className="tc-sub">사람의 가능성과 조직의 기회를 연결하는 AI 인재관리 시스템</div>
        </div>
      </header>

      <div className="tc-body">
        {/* ── 사이드바 ── */}
        <nav className="tc-side">
          {(() => { let n = 0; return MENU_GROUPS.map(([gLabel, gAud, items]) => (
            <div key={gLabel} className="tc-side-group">
              <div className={`tc-side-label ${gAud}`}>{gLabel}</div>
              {items.map(([k, label]) => { n += 1; return (
                <button key={k} className={screen === k ? "on" : ""} onClick={() => setScreen(k)}>
                  <span className="no">{String(n).padStart(2, "0")}</span>{label}
                </button>
              ); })}
            </div>
          )); })()}
          <div className="tc-side-note">
            본 데모의 모든 인물·수치는 가상이며, 추천은 규칙 기반으로 생성된 예시입니다. 실제 AI를 호출하지 않습니다.
            이 화면의 가상 조직(구성원 248명)은 다른 탭의 예시 기업 &lsquo;세미코어&rsquo;와 별개입니다.
          </div>
        </nav>

        {/* ── 콘텐츠 ── */}
        <main className="tc-main">
          <div className={`tc-aud ${AUD[screen]}`}>{AUD_LABEL[AUD[screen]]}</div>
          {screen === "dash" && <Dash />}
          {screen === "search" && (
            <Search searched={searched} setSearched={setSearched} results={results}
                    fDept={fDept} setFDept={setFDept} fSkill={fSkill} setFSkill={setFSkill}
                    openWhy={setWhy} toast={toast} />
          )}
          {screen === "matching" && (
            <Matching team={team} setTeam={setTeam} confirmed={confirmed} setConfirmed={setConfirmed}
                      setExcludeTarget={setExcludeTarget} checks={checks} setChecks={setChecks}
                      placed={placed} setPlaced={setPlaced} toast={toast}
                      smeDone={smeDone} openSme={(m) => { setSmeTarget(m); setSmeVerdict("적합"); setSmeNote(""); }} />
          )}
          {screen === "profile" && (
            <Profile me={me} wantRole={wantRole} setWantRole={setWantRole}
                     recvRec={recvRec} setRecvRec={setRecvRec}
                     aiExcluded={aiExcluded} setAiExcluded={setAiExcluded}
                     requests={requests} setRequests={setRequests} toast={toast} />
          )}
          {screen === "training" && <Training wantRole={wantRole} me={me} courseState={courseState} setCourseState={setCourseState} toast={toast} />}
          {screen === "career" && <Career pathSel={pathSel} setPathSel={setPathSel} toast={toast} />}
          {screen === "profiles" && <Profiles />}
          {screen === "skillgap" && <SkillGap />}
          {screen === "decisions" && <Decisions extra={decisionLog} />}
          {screen === "sim" && <Simulation />}
          {screen === "retention" && <Retention />}
          {screen === "fairness" && <Fairness toast={toast} />}
          {screen === "research" && <Research setScreen={setScreen} />}
          {screen === "about" && <About setScreen={setScreen} />}
        </main>
      </div>

      {/* ── 추천 근거 모달 ── */}
      {why && (
        <Modal onClose={() => setWhy(null)} title={`추천 근거 · ${empById(why.id).name}`}>
          <WhyBody r={why} />
        </Modal>
      )}

      {/* ── 직무 전문가(SME) 검토 모달 ── */}
      {smeTarget && (() => {
        const e = empById(smeTarget.id);
        const w = workOf(smeTarget.id);
        const by = smeOf(smeTarget.slot);
        return (
          <Modal onClose={() => setSmeTarget(null)} title={`직무 전문가 검토 · ${e.name} (${smeTarget.slot})`}>
            <p className="tc-p muted">검토자: {by} · 이 화면은 추천을 승인하는 곳이 아니라, 추천 근거가 현업 기준에 맞는지 확인하는 곳입니다.</p>

            <div className="tc-sme-box">
              <dl className="tc-dl wide">
                <div><dt>AI 추천 이유</dt><dd>{smeTarget.why}</dd></div>
                <div><dt>보완 필요</dt><dd>{smeTarget.gap}</dd></div>
                <div><dt>현재 업무</dt><dd>{w ? `${w.task} · 업무 비중 ${w.load}% · ${w.until} 종료` : "배정된 프로젝트 없음"}</dd></div>
                <div><dt>투입 가능</dt><dd>{e.available}</dd></div>
                <div><dt>보유 기술</dt><dd>{e.skills.map(([sk, lv]) => `${sk} ${lv}/5`).join(" · ")}</dd></div>
                <div><dt>수행 프로젝트</dt><dd>{e.projects.join(", ")}</dd></div>
              </dl>
            </div>

            <p className="tc-p"><b>검토 결과</b></p>
            <div className="tc-sme-verdicts">
              {["적합", "조건부 적합", "부적합"].map((v) => (
                <label key={v} className={`tc-check tc-sme-v${smeVerdict === v ? " on" : ""}`}>
                  <input type="radio" name="smeVerdict" checked={smeVerdict === v}
                         onChange={() => setSmeVerdict(v)} /> {v}
                </label>
              ))}
            </div>

            <p className="tc-p"><b>검토 의견</b> <span className="muted small">기록으로 남고, 결정 기록에서 함께 확인됩니다</span></p>
            <textarea className="tc-input" rows={3} value={smeNote}
                      onChange={(ev) => setSmeNote(ev.target.value)}
                      placeholder={smeVerdict === "부적합"
                        ? "예: 요구 스택은 맞지만 해당 도메인 경험이 없어 초기 3개월 리스크가 큽니다"
                        : "예: 추천 근거는 타당하나 데이터 모델링은 착수 전 교육 이수 조건이 필요합니다"} />

            <div className="tc-row-end">
              <button className="tc-btn ghost" onClick={() => setSmeTarget(null)}>취소</button>
              <button className="tc-btn primary" disabled={!smeNote.trim()} onClick={() => {
                setSmeDone((d) => ({ ...d, [smeTarget.id]: { by, at: "방금 전", verdict: smeVerdict, note: smeNote.trim() } }));
                toast(`${by}의 검토 결과가 기록되었습니다: ${e.name} · ${smeVerdict}`);
                setSmeTarget(null); setSmeNote("");
              }}>검토 결과 기록</button>
            </div>
            <p className="tc-p muted">의견을 입력해야 기록됩니다. 판정만으로는 저장되지 않습니다.</p>
          </Modal>
        );
      })()}

      {/* ── 제외 사유 모달 ── */}
      {excludeTarget && (
        <Modal onClose={() => setExcludeTarget(null)} title={`후보 제외 · ${empById(excludeTarget.id).name} (${excludeTarget.slot})`}>
          <p className="tc-p">AI 추천과 다른 결정을 하는 것입니다. 사유를 남겨야 진행되며, 남긴 사유는 <b>결정 기록</b>에 그대로 저장되어 나중에 누구나 확인할 수 있습니다.</p>
          <textarea className="tc-input" rows={3} value={excludeReason}
                    onChange={(e) => setExcludeReason(e.target.value)}
                    placeholder="예: 해당 기간 타 프로젝트 투입 확정" />
          <div className="tc-row-end">
            <button className="tc-btn ghost" onClick={() => setExcludeTarget(null)}>취소</button>
            <button className="tc-btn primary" disabled={!excludeReason.trim()} onClick={() => {
              const alt = ALTERNATES[excludeTarget.slot];
              const sme = smeDone[excludeTarget.id];
              setTeam((t) => t.map((m) => m === excludeTarget
                ? { ...m, id: alt, why: "대체 후보(규칙 기반 재추천)", gap: "요구역량 재검토 필요", replaced: true }
                : m));
              setDecisionLog((L) => [{
                date: "오늘", project: PROJECT.name, slot: excludeTarget.slot,
                rec: excludeTarget.id, final: alt, match: false, cat: "담당자 판단",
                reason: excludeReason.trim(),
                sme: sme ? `${sme.by}: ${sme.verdict} — ${sme.note}` : null,
                by: "인사 담당자 (데모 계정)", fresh: true,
              }, ...L]);
              toast(`${empById(excludeTarget.id).name} 제외: 사유가 결정 기록에 남았습니다.`);
              setExcludeTarget(null); setExcludeReason("");
            }}>제외하고 다른 후보 추천</button>
          </div>
        </Modal>
      )}

      {/* ── 토스트 ── */}
      <div className="tc-toasts">
        {toasts.map((t) => <div key={t.id} className="tc-toast">{t.msg}</div>)}
      </div>
    </div>
  );
}

/* ═══════════ 화면 1. 통합 대시보드 ═══════════ */
function Dash() {
  const kpi = [
    ["248", "전체 구성원"], ["37", "프로젝트 투입 가능"], ["64", "핵심역량 보유 인재"],
    ["82%", "역량정보 업데이트율"], ["71%", "교육 추천 수락률"], ["156", "경력경로 설정 구성원"],
    ["12", "추가 검토 필요(이탈위험)", "warn"],
  ];
  const dept = [["플랫폼·디지털서비스", 58], ["영업·마케팅", 38], ["경영지원(인사·재무)", 30], ["데이터·AI", 34], ["인프라·정보보안", 27], ["디자인·서비스기획", 25], ["품질·고객지원", 21], ["기획·PMO", 15]];
  const skills = [["Java·Spring", 58], ["데이터 분석", 41], ["프로젝트 관리", 39], ["클라우드·인프라", 34], ["AI·머신러닝", 24], ["디자인·UX", 19], ["정보보안", 15]];
  const demands = [["차세대 데이터 플랫폼", "6명", "9월"], ["AI 민원 안내 고도화", "4명", "10월"], ["레거시 전환 2차", "8명", "11월"]];
  const recents = [
    ["프로젝트 매칭", "차세대 데이터 플랫폼 후보 6명 추천", "담당자 검토 중"],
    ["교육 추천", "Python 데이터 분석 12명 추천", "수락 9명"],
    ["경력경로", "AI 서비스 개발 경로 8명 안내", "설정 5명"],
  ];
  return (
    <>
      <Notice>AI 추천은 인사 결정을 지원하기 위한 참고정보이며, 최종 결정은 담당자의 검토와 구성원의 의사 확인을 거쳐 이루어집니다.</Notice>
      <div className="tc-kpis">
        {kpi.map(([v, l, w]) => (
          <div key={l} className={`tc-kpi${w ? " warn" : ""}`}><b>{v}</b><span>{l}</span></div>
        ))}
      </div>
      <div className="tc-grid2">
        <Card title="부서별 인원 현황">
          {dept.map(([n, v]) => <Bar key={n} label={n} v={v} max={70} suffix="명" />)}
        </Card>
        <Card title="주요 기술역량 분포">
          {skills.map(([n, v]) => <Bar key={n} label={n} v={v} max={80} suffix="명" tone="mint" />)}
        </Card>
        <Card title="현재 프로젝트 인력 수요">
          <table className="tc-table"><tbody>
            {demands.map(([n, c, m]) => <tr key={n}><td>{n}</td><td className="num">{c}</td><td className="muted">{m} 투입</td></tr>)}
          </tbody></table>
        </Card>
        <Card title="최근 AI 추천 현황">
          <table className="tc-table"><tbody>
            {recents.map(([t, d, s]) => <tr key={d}><td className="muted">{t}</td><td>{d}</td><td><span className="tc-badge">{s}</span></td></tr>)}
          </tbody></table>
        </Card>
        <Card title="구성원 정보 업데이트 요청">
          <p className="tc-p">역량정보가 90일 이상 갱신되지 않은 구성원 <b>45명</b>에게 업데이트 요청을 발송했습니다. 완료 31명 · 대기 14명.</p>
          <Bar label="업데이트 완료" v={31} max={45} suffix="명" tone="mint" />
        </Card>
        <Card title="개인정보·AI 분석 동의 현황">
          <Bar label="개인정보 활용 동의" v={97} max={100} suffix="%" />
          <Bar label="AI 분석 동의" v={93} max={100} suffix="%" />
          <p className="tc-p muted">동의하지 않은 구성원은 AI 추천 대상에서 제외되며, 어떠한 불이익도 없습니다.</p>
        </Card>
      </div>
    </>
  );
}

/* ═══════════ 화면 2. AI 인재 탐색 ═══════════ */
function Search({ searched, setSearched, results, fDept, setFDept, fSkill, setFSkill, openWhy, toast }) {
  // 필터 목록은 하드코딩하지 않고 실제 구성원 데이터에서 만든다 (선택지와 결과가 어긋나지 않게)
  const DEPTS = useMemo(() => ["전체", ...[...new Set(EMPLOYEES.map((e) => e.dept))]], []);
  // 선택한 부서에 실제로 있는 스킬만 보여준다. 없는 조합을 고를 수 없으니 빈 결과가 나오지 않는다.
  const SKILLS_F = useMemo(() => {
    // AI 분석 미동의자는 결과에서 빠지므로 선택지에도 넣지 않는다 (고를 수 있는데 0건인 상황 방지)
    const pool = EMPLOYEES.filter((e) => e.aiConsent && (fDept === "전체" || e.dept === fDept));
    const c = new Map();
    pool.forEach((e) => e.skills.forEach(([k]) => c.set(k, (c.get(k) || 0) + 1)));
    return ["전체", ...[...c.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k]) => k)];
  }, [fDept]);
  // 부서를 바꿨을 때 그 부서에 없는 스킬이 선택돼 있으면 전체로 되돌린다
  useEffect(() => {
    if (fSkill !== "전체" && !SKILLS_F.includes(fSkill)) setFSkill("전체");
  }, [SKILLS_F, fSkill, setFSkill]);
  // 결과가 없을 때 보여줄 근접 후보: 스킬만 맞는 사람 (부서 조건 완화)
  const near = useMemo(() => {
    if (fSkill === "전체") return [];
    return EMPLOYEES.filter((e) => e.aiConsent && e.skills.some(([k]) => k === fSkill)).slice(0, 3);
  }, [fSkill]);
  return (
    <>
      <Card title="인재 검색">
        <div className="tc-filters">
          <label>부서
            <select value={fDept} onChange={(e) => setFDept(e.target.value)}>
              {DEPTS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </label>
          <label>보유 기술
            <select value={fSkill} onChange={(e) => setFSkill(e.target.value)}>
              {SKILLS_F.map((d) => <option key={d}>{d}</option>)}
            </select>
          </label>
          <button className="tc-btn primary" onClick={() => { setSearched(true); toast(results.length ? `조건에 맞는 후보 ${results.length}명을 찾았습니다. (규칙 기반 매칭)` : "조건에 맞는 후보가 없습니다. 필터를 조정해 보세요."); }}>검색</button>
          <span className="muted tc-p" style={{ margin: 0 }}>보유 기술 목록은 선택한 부서에 실제로 있는 기술만 표시됩니다. 그 외 필터: 숙련도 · 자격증 · 희망 직무 · 투입 가능 시점 · 경력연수</span>
        </div>
      </Card>

      {searched && (
        <>
          <Notice>
            적합도는 사람의 우열을 매긴 점수가 아닙니다. 이 프로젝트가 요구하는 조건과 그 사람이 등록해 둔 역량 정보가
            얼마나 겹치는지를 나타낸 값입니다. 역량 정보를 적게 입력한 사람은 실제보다 낮게 나올 수 있습니다.
          </Notice>
          <div className="tc-cards">
            {results.map((r) => {
              const e = empById(r.id);
              return (
                <div key={r.id} className="tc-person">
                  <div className="tc-person-top">
                    <div>
                      <b>{e.name}</b> <span className="muted">{e.role} · {e.dept} · {e.years}년</span>
                    </div>
                    <div className="tc-fit">{r.fit}<em>%</em></div>
                  </div>
                  <dl className="tc-dl">
                    <div><dt>주요 기술</dt><dd>{e.skills.map(([s]) => s).slice(0, 4).join(", ")}</dd></div>
                    <div><dt>프로젝트</dt><dd>{e.projects[0]}</dd></div>
                    <div><dt>희망 경력</dt><dd>{e.wantRole}{r.wantMatch && <span className="tc-badge mint">희망 일치</span>}</dd></div>
                    <div><dt>투입 가능</dt><dd>{e.available}</dd></div>
                    <div><dt>정보 최신성</dt><dd>{e.updated} 갱신</dd></div>
                    <div><dt>AI 분석 동의</dt><dd>{e.aiConsent ? "동의함" : "미동의"}</dd></div>
                  </dl>
                  <p className="tc-p">{r.reason}</p>
                  <button className="tc-btn ghost" onClick={() => openWhy(r)}>추천 근거 보기</button>
                </div>
              );
            })}
            {!results.length && (
              <div className="tc-card" style={{ gridColumn: "1 / -1" }}>
                <b>이 조건에 맞는 구성원이 없습니다</b>
                <p className="tc-p muted" style={{ marginTop: 6 }}>
                  {fDept !== "전체" && fSkill !== "전체"
                    ? `${fDept}에는 '${fSkill}' 보유자가 등록되어 있지 않습니다.`
                    : "선택한 조건에 해당하는 구성원이 없습니다."}
                  {near.length > 0 && " 부서 조건을 빼면 아래 후보를 볼 수 있습니다."}
                </p>
                {near.length > 0 && (
                  <>
                    <div className="tc-chips small" style={{ marginTop: 8 }}>
                      {near.map((e) => (
                        <span key={e.id} className="tc-chip">{e.name} <em>{e.dept}</em></span>
                      ))}
                    </div>
                    <button className="tc-btn tiny" onClick={() => { setFDept("전체"); toast(`부서 조건을 해제하고 '${fSkill}' 보유자를 다시 찾습니다.`); }}>
                      부서 조건 해제하고 다시 검색
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          <p className="tc-p muted">
            AI 분석에 동의하지 않은 구성원은 이 목록에 나타나지 않습니다. 미동의로 인한 불이익은 없습니다.
          </p>
        </>
      )}
      {!searched && <p className="tc-p muted">조건을 고르고 검색 버튼을 누르면 프로젝트 요구조건과의 일치도 순으로 후보가 표시됩니다.</p>}
    </>
  );
}

function WhyBody({ r }) {
  const e = empById(r.id);
  return (
    <>
      <dl className="tc-why">
        <dt>요구역량과 일치</dt><dd>{r.matched.join(", ") || "없음"}</dd>
        <dt>부족한 역량</dt><dd>{r.missing.join(", ") || "없음"}</dd>
        <dt>유사 프로젝트 경험</dt><dd>{r.similar.join(", ")}</dd>
        <dt>희망 직무 일치</dt><dd>{r.wantMatch ? `일치 (본인 희망: ${e.wantRole})` : "부분 일치"}</dd>
        <dt>데이터 기준일</dt><dd>{e.updated}</dd>
        <dt>AI가 사용하지 않은 정보</dt>
        <dd>성별, 연령, 출신지역, 출신학교, 가족관계 등 직무와 직접 관련 없는 정보는 추천에 사용하지 않았습니다.</dd>
        <dt>관리자 추가 확인 사항</dt>
        <dd>현재 업무 부하, 본인 참여 의사, 부족 역량의 교육 보완 계획</dd>
      </dl>
      <p className="tc-p muted">본 근거는 규칙 기반으로 생성된 데모용 예시입니다.</p>
    </>
  );
}

/* AI가 반영하지 못하는 정성 요인 — 심층 인터뷰 3-2-9에서 도출 */
function BlindSpots() {
  const [ok, setOk] = useState({});
  const done = BLIND_SPOTS.filter(([k]) => ok[k]).length;
  return (
    <Card title="이 추천에 반영되지 않은 요소" tone={done === BLIND_SPOTS.length ? "mint" : "warn"}>
      <p className="tc-p muted" style={{ marginTop: 0 }}>
        아래 항목은 데이터로 존재하지 않아 AI가 계산하지 못합니다. 배치 전에 담당자가 직접 확인해 주세요.
        ({done}/{BLIND_SPOTS.length} 확인)
      </p>
      {BLIND_SPOTS.map(([k, why]) => (
        <label key={k} className="tc-check">
          <input type="checkbox" checked={!!ok[k]} onChange={() => setOk((x) => ({ ...x, [k]: !x[k] }))} />
          <span><b>{k}</b> <span className="muted small">— {why}</span></span>
        </label>
      ))}
    </Card>
  );
}

/* 숙련도 레벨 정의 — SFIA(자율성·복잡성)와 NCS 수준체계를 참고해 5단계로 압축했다 */
const LEVELS = [
  ["1", "입문", "지시와 감독 아래 수행", "정형화된 단순 과업", "1~2수준"],
  ["2", "보조", "일상 업무는 스스로, 판단은 확인받음", "절차가 정해진 과업", "3수준"],
  ["3", "자립", "담당 범위를 독립적으로 수행", "일반적 문제 해결", "4~5수준"],
  ["4", "숙련", "방향을 스스로 정하고 타인을 지도", "비정형 문제, 예외 상황 대응", "6수준"],
  ["5", "전문", "조직 기준을 만들고 판단 근거가 됨", "새로운 방식 설계, 전사 영향", "7~8수준"],
];

function LevelGuide({ onClose }) {
  return (
    <Modal title="숙련도 레벨 기준" onClose={onClose}>
      <p className="tc-p muted" style={{ marginTop: 0 }}>
        &lsquo;얼마나 잘하는가&rsquo;가 아니라 <b>어느 정도 자율성으로 얼마나 복잡한 일을 하는가</b>로 나눕니다.
        국제 표준 SFIA의 자율성·복잡성 축과 NCS 수준체계를 참고해 5단계로 압축했습니다.
      </p>
      <table className="tc-table lines lv-table">
        <thead>
          <tr><th>Lv</th><th>이름</th><th>자율성</th><th>복잡성</th><th>NCS</th></tr>
        </thead>
        <tbody>
          {LEVELS.map(([lv, name, auto, cx, ncs]) => (
            <tr key={lv} className={lv === "4" ? "alt" : ""}>
              <td className="lv-no">{lv}</td>
              <td><b>{name}</b></td>
              <td className="small">{auto}</td>
              <td className="small">{cx}</td>
              <td className="small muted">{ncs}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="tc-p muted" style={{ marginBottom: 0 }}>
        이 화면에서 <b>숙련자</b>는 레벨 4 이상을 말합니다. 남을 지도할 수 있어야 공백을 메울 수 있다고 보기 때문입니다.
        NCS 대응은 참고용 근사이며 공식 매핑이 아닙니다.
      </p>
    </Modal>
  );
}

/* ═══════════ 화면. 결정 기록 (AI 추천 대비 최종 결정) ═══════════ */
function Decisions({ extra = [] }) {
  const [only, setOnly] = useState(false);
  const ALL = [...extra, ...DECISIONS];
  const rows = only ? ALL.filter((d) => !d.match) : ALL;
  const total = ALL.length;
  const agreed = ALL.filter((d) => d.match).length;
  const rate = Math.round((agreed / total) * 100);
  // 불일치 사유 유형 분포
  const cats = {};
  ALL.filter((d) => !d.match).forEach((d) => { cats[d.cat] = (cats[d.cat] || 0) + 1; });
  const catRows = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  const nm = (id) => (empById(id) ? empById(id).name : id);

  return (
    <>
      <Notice>
        AI 추천과 다른 결정을 내린 경우 사유를 남기도록 한 기록입니다. 최종 결정은 사람이 하되,
        그 판단도 확인 가능해야 한다는 심층 인터뷰 요구를 반영했습니다.
        프로젝트 매칭에서 후보를 제외하면 그 사유와 직무 전문가 검토 의견이 이 목록에 바로 쌓입니다.
      </Notice>

      <div className="tc-kpis">
        <div className="tc-kpi"><b>{total}</b><span>기록된 배치 결정</span></div>
        <div className="tc-kpi"><b>{rate}<em style={{ fontSize: 14, fontStyle: "normal" }}>%</em></b><span>AI 추천 채택률</span></div>
        <div className="tc-kpi warn"><b>{total - agreed}</b><span>추천과 다른 결정</span></div>
        <div className="tc-kpi"><b>{total - agreed}</b><span>사유 기록 완료</span></div>
      </div>

      <div className="tc-sec-head">
        <h3>결정 목록</h3>
        <label className="tc-check tiny" style={{ margin: 0 }}>
          <input type="checkbox" checked={only} onChange={() => setOnly(!only)} />
          추천과 다른 결정만 보기
        </label>
      </div>
      <Card>
        <div className="tc-tablewrap">
          <table className="tc-table lines tc-dec">
            <colgroup>
              <col style={{ width: "10%" }} />
              <col style={{ width: "22%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "26%" }} />
              <col style={{ width: "11%" }} />
            </colgroup>
            <thead>
              <tr><th>일자</th><th>프로젝트 · 역할</th><th>AI 1순위</th><th>최종 선택</th><th>일치</th><th>사유</th><th>결정자</th></tr>
            </thead>
            <tbody>
              {rows.map((d, i) => (
                <tr key={i} className={d.match ? "" : "alt"}>
                  <td className="muted num">{d.date}{d.fresh && <div><span className="tc-badge mint">방금 기록</span></div>}</td>
                  <td className="tl"><b>{d.project}</b><div className="muted small">{d.slot}</div></td>
                  <td>{nm(d.rec)}</td>
                  <td><b>{nm(d.final)}</b></td>
                  <td>{d.match
                    ? <span className="tc-badge mint">일치</span>
                    : <span className="tc-badge orange">{d.cat}</span>}</td>
                  <td className="tl small">
                    {d.reason || <span className="muted">—</span>}
                    {d.sme && <div className="muted small" style={{ marginTop: 4 }}>직무 전문가 검토 · {d.sme}</div>}
                  </td>
                  <td className="muted small">{d.by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="tc-grid2" style={{ marginTop: 16 }}>
        <Card title="추천과 다른 결정의 사유 유형">
          {catRows.map(([c, n]) => (
            <div key={c} className="tc-skillrow">
              <span className="tc-skillname">{c}</span>
              <div className="tc-gbar"><i style={{ width: `${(n / (total - agreed)) * 100}%` }} /></div>
              <span className="tc-skillnum">{n}건</span>
            </div>
          ))}
          <p className="tc-p muted">
            사유 유형이 특정 항목에 몰리면 추천 기준을 손봐야 한다는 신호입니다.
            예컨대 &lsquo;일정 중복&rsquo;이 반복되면 투입 가능 시점을 추천 조건에 넣어야 합니다.
          </p>
        </Card>
        <Card title="이 기록이 필요한 이유">
          <ul className="tc-ul">
            <li>AI 추천을 따르지 않은 판단도 근거를 남겨 자의적 결정을 막습니다.</li>
            <li>채택률과 사유 분포는 추천 기준을 개선하는 자료가 됩니다.</li>
            <li>구성원이 배치 결과에 이의를 제기할 때 확인할 수 있는 기록이 됩니다.</li>
          </ul>
          <p className="tc-p muted">기록 열람 권한은 인사 담당자와 해당 부서장으로 제한됩니다.</p>
        </Card>
      </div>
    </>
  );
}

/* ═══════════ 화면. 인터뷰 반영 내역 ═══════════ */
function Research({ setScreen }) {
  const [area, setArea] = useState("전체");
  const areas = ["전체", ...new Set(INTERVIEW_REQS.map((r) => r.area))];
  const rows = area === "전체" ? INTERVIEW_REQS : INTERVIEW_REQS.filter((r) => r.area === area);
  const n = (st) => INTERVIEW_REQS.filter((r) => r.status === st).length;
  const LABEL = { done: "반영", partial: "부분 반영", todo: "후속 과제" };
  const TONE = { done: "mint", partial: "orange", todo: "" };

  return (
    <>
      <Notice>
        인사·인적자원개발 실무 담당자 심층 인터뷰에서 도출한 요건이 각각 어느 화면이 되었는지 정리한 표입니다.
        반영하지 못한 항목도 후속 과제로 함께 표시합니다.
      </Notice>

      <div className="tc-kpis">
        <div className="tc-kpi"><b>{INTERVIEW_REQS.length}</b><span>도출된 요건</span></div>
        <div className="tc-kpi"><b>{n("done")}</b><span>화면에 반영</span></div>
        <div className="tc-kpi"><b>{n("partial")}</b><span>부분 반영</span></div>
        <div className="tc-kpi warn"><b>{n("todo")}</b><span>후속 과제</span></div>
      </div>

      <div className="tc-filters">
        <label>영역
          <select value={area} onChange={(e) => setArea(e.target.value)}>
            {areas.map((a) => <option key={a}>{a}</option>)}
          </select>
        </label>
        <span className="tc-filter-count">{rows.length}건</span>
      </div>

      <Card>
        <table className="tc-table lines">
          <thead>
            <tr><th>영역</th><th>도출된 요건</th><th>인터뷰 근거</th><th>구현 화면</th><th>상태</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="muted small">{r.area}</td>
                <td><b>{r.req}</b></td>
                <td className="small muted">&ldquo;{r.voice}&rdquo;</td>
                <td>
                  {r.key
                    ? <button className="tc-btn tiny ghost" onClick={() => setScreen(r.key)}>{r.screen} →</button>
                    : <span className="muted small">미구현</span>}
                </td>
                <td><span className={`tc-badge ${TONE[r.status]}`}>{LABEL[r.status]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="tc-p muted">
        인터뷰 근거는 참여자 발언의 요지를 정리한 것이며 직접 인용이 아닙니다.
        참여자와 소속 기업은 익명 처리했습니다.
      </p>
    </>
  );
}

/* ═══════════ 화면 3. 프로젝트 매칭 ═══════════ */
function Matching({ team, setTeam, confirmed, setConfirmed, setExcludeTarget, checks, setChecks, placed, setPlaced, toast, smeDone, openSme }) {
  const allChecked = checks.every(Boolean);
  const smeAll = team.every((m) => smeDone[m.id]);
  const smeBlocked = team.some((m) => smeDone[m.id] && smeDone[m.id].verdict === "부적합");
  const lateCount = team.filter((m) => (empById(m.id).available || "") > PROJECT.start).length;

  return (
    <>
      <Card title={`프로젝트: ${PROJECT.name}`}>
        <dl className="tc-dl wide">
          <div><dt>기간</dt><dd>{PROJECT.period}</dd></div>
          <div><dt>착수 예정</dt><dd>{PROJECT.start}</dd></div>
          <div><dt>필요 인원</dt><dd>{PROJECT.headcount}명</dd></div>
          <div><dt>요구역량</dt><dd>{PROJECT.required.join(", ")}</dd></div>
          <div><dt>우대사항</dt><dd>{PROJECT.preferred.join(", ")}</dd></div>
        </dl>
      </Card>

      <Card title="AI 추천 팀 구성안 (규칙 기반 가상 추천)"
            tone={lateCount ? "warn" : ""}>
        <table className="tc-table lines">
          <thead>
            <tr>
              <th>역할</th><th>후보</th><th>추천 이유</th>
              <th>현재 업무 · 투입 가능</th><th>보완 필요</th>
              <th>SME 검토</th><th>참여의사</th><th></th>
            </tr>
          </thead>
          <tbody>
            {team.map((m, i) => {
              const e = empById(m.id);
              const w = workOf(m.id);
              const late = (e.available || "") > PROJECT.start;
              const sme = smeDone[m.id];
              return (
                <tr key={i} className={m.replaced ? "alt" : ""}>
                  <td className="muted">{m.slot}</td>
                  <td><b>{e.name}</b><div className="muted small">{e.dept} · {e.years}년</div></td>
                  <td>{m.why}</td>
                  <td>
                    {w
                      ? <div className="muted small">{w.task} · 업무 비중 {w.load}% · {w.until} 종료</div>
                      : <div className="muted small">현재 배정된 프로젝트 없음</div>}
                    <div>
                      <span className={`tc-badge ${late ? "orange" : "mint"}`}>
                        {late ? `착수 후 투입 (${e.available})` : `투입 가능 ${e.available}`}
                      </span>
                    </div>
                  </td>
                  <td>{m.gap}</td>
                  <td>
                    {sme
                      ? <button className="tc-btn tiny ghost" onClick={() => openSme(m)}>
                          <span className={`tc-badge ${sme.verdict === "부적합" ? "orange" : "mint"}`}>{sme.verdict}</span>
                          <div className="muted small">{sme.by} · 의견 보기</div>
                        </button>
                      : <button className="tc-btn tiny" onClick={() => openSme(m)}>검토하기</button>}
                  </td>
                  <td>
                    {confirmed[m.id]
                      ? <span className="tc-badge mint">확인됨</span>
                      : <button className="tc-btn tiny" onClick={() => { setConfirmed((c) => ({ ...c, [m.id]: true })); toast(`${e.name}님에게 참여의사 확인 요청을 보냈습니다. (데모: 즉시 확인됨)`); }}>의사 확인</button>}
                  </td>
                  <td><button className="tc-btn tiny ghost" onClick={() => setExcludeTarget(m)}>제외</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {lateCount > 0 && (
          <p className="tc-p warn-text">
            {lateCount}명은 현재 업무가 착수일({PROJECT.start}) 이후에 끝납니다. 투입 시점을 조정하거나 후보를 교체해야 합니다.
          </p>
        )}
        <p className="tc-p muted">
          적합도만으로는 배치를 결정할 수 없다는 심층 인터뷰 요구를 반영해, 현재 수행 업무와 잔여 일정을 함께 표시합니다.
          후보 제외 시 사유를 기록해야 하며, 규칙 기반으로 대체 후보가 추천됩니다.
        </p>
      </Card>

      <BlindSpots />

      <Card title="직무 전문가(SME) 검토" tone={smeAll ? "mint" : "warn"}>
        <p className="tc-p">
          AI가 제시한 추천 근거를 해당 직무를 아는 사람이 한 번 더 확인하는 단계입니다.
          역할별로 검토자가 지정되어 있고, 전원 검토를 마쳐야 최종 검토를 요청할 수 있습니다.
        </p>
        <table className="tc-table lines">
          <thead><tr><th>역할</th><th>대상</th><th>지정 검토자</th><th>판정</th><th>검토 의견</th></tr></thead>
          <tbody>
            {team.map((m, i) => {
              const d = smeDone[m.id];
              return (
                <tr key={i}>
                  <td className="muted">{m.slot}</td>
                  <td>{empById(m.id).name}</td>
                  <td>{smeOf(m.slot)}</td>
                  <td>{d
                    ? <span className={`tc-badge ${d.verdict === "부적합" ? "orange" : "mint"}`}>{d.verdict}</span>
                    : <span className="tc-badge orange">검토 대기</span>}</td>
                  <td>{d
                    ? <span>{d.note}<div className="muted small">{d.by} · {d.at}</div></span>
                    : <button className="tc-btn tiny" onClick={() => openSme(m)}>검토하기</button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="tc-p muted">
          SME 검토는 추천을 승인하는 절차가 아니라, 추천 근거가 현업 기준에 맞는지 확인하는 절차입니다.
          검토 의견과 검토자는 결정 기록에 함께 남습니다.
        </p>
      </Card>

      <Card title="배치 확정 전 공정성 점검" tone={placed ? "mint" : allChecked && smeAll && !smeBlocked ? "" : "warn"}>
        {CHECKS.map((c, i) => (
          <label key={i} className="tc-check">
            <input type="checkbox" checked={checks[i]}
                   onChange={() => setChecks((arr) => arr.map((v, j) => j === i ? !v : v))} /> {c}
          </label>
        ))}
        <div className="tc-row-end">
          {placed
            ? <span className="tc-badge mint big">최종 검토 완료: 배치안이 인사 담당자에게 전달되었습니다</span>
            : <button className="tc-btn primary" disabled={!allChecked || !smeAll || smeBlocked}
                      onClick={() => { setPlaced(true); toast("공정성 점검과 SME 검토를 통과했습니다. 최종 결정은 담당자 검토로 확정됩니다."); }}>
                관리자 최종검토 요청
              </button>}
        </div>
        {!placed && !allChecked && <p className="tc-p warn-text">모든 점검 항목을 확인해야 최종 검토를 요청할 수 있습니다.</p>}
        {!placed && allChecked && !smeAll && <p className="tc-p warn-text">직무 전문가 검토가 남아 있습니다. 전원 검토 후 요청할 수 있습니다.</p>}
        {!placed && smeBlocked && <p className="tc-p warn-text">&lsquo;부적합&rsquo; 판정이 있습니다. 해당 후보를 제외하고 대체 후보를 받은 뒤 다시 요청하세요.</p>}
      </Card>
    </>
  );
}

/* ═══════════ 화면 5. 내 역량 프로필(구성원) ═══════════ */
function Profile({ me, wantRole, setWantRole, recvRec, setRecvRec, aiExcluded, setAiExcluded, requests, setRequests, toast }) {
  const inferred = [["코드 리뷰 역량", "PR 이력 기반 추론"], ["공공 도메인 이해", "프로젝트 이력 기반 추론"]];
  const managerOk = ["Java", "Spring Boot"];
  const req = (type, target) => {
    setRequests((r) => [...r, { type, target, at: "방금 전" }]);
    toast(`'${target}'에 대한 ${type}가 접수되었습니다. 처리 결과는 알림으로 안내됩니다.`);
  };
  return (
    <>
      <Notice>AI가 추론한 정보와 내가 직접 입력한 정보를 구분해서 보여주고, 잘못된 정보는 수정 요청·이의제기·분석 제외를 할 수 있습니다.</Notice>
      <div className="tc-grid2">
        <Card title="기본 정보">
          <dl className="tc-dl wide">
            <div><dt>이름</dt><dd>데모 구성원 계정 (가상)</dd></div>
            <div><dt>직무</dt><dd>{me.role} · {me.years}년</dd></div>
            <div><dt>소속</dt><dd>{me.dept}</dd></div>
            <div><dt>희망 직무</dt>
              <dd>
                <select className="tc-input slim" value={wantRole} onChange={(e) => { setWantRole(e.target.value); toast("희망 직무가 변경되었습니다. 추천에 즉시 반영됩니다."); }}>
                  {["데이터·AI 서비스 개발자", "백엔드 아키텍트", "테크리드", "데이터 엔지니어"].map((r) => <option key={r}>{r}</option>)}
                </select>
              </dd></div>
            <div><dt>희망 프로젝트</dt><dd>{me.wantProject}</dd></div>
            <div><dt>자격증</dt><dd>{me.certs.join(", ")}</dd></div>
            <div><dt>교육 이력</dt><dd>{me.edu.join(", ")}</dd></div>
          </dl>
          <label className="tc-check">
            <input type="checkbox" checked={recvRec} onChange={() => { setRecvRec(!recvRec); toast(recvRec ? "프로젝트 추천 수신을 중단했습니다." : "프로젝트 추천을 다시 수신합니다."); }} />
            프로젝트 추천 수신
          </label>
          <p className="tc-p muted">데이터 활용 동의 범위: 역량·경력·교육 이력에 한함 (평가·근태 정보 미포함) · 보유기간 3년</p>
        </Card>

        <Card title="보유 기술과 숙련도">
          {me.skills.map(([s, lv]) => (
            <div key={s} className="tc-skillrow">
              <Bar label={s} v={lv} max={5} suffix="/5" />
              <div className="tc-skill-actions">
                <span className={`tc-badge ${managerOk.includes(s) ? "mint" : ""}`}>
                  {managerOk.includes(s) ? "관리자 확인" : "직접 등록"}
                </span>
                <button className="tc-btn tiny ghost" onClick={() => req("수정 요청", s)}>수정 요청</button>
                <label className="tc-check tiny">
                  <input type="checkbox" checked={!!aiExcluded[s]}
                         onChange={() => { setAiExcluded((x) => ({ ...x, [s]: !x[s] })); toast(`'${s}' 항목을 AI 분석에서 ${aiExcluded[s] ? "다시 포함" : "제외"}했습니다.`); }} />
                  분석 제외
                </label>
              </div>
            </div>
          ))}
        </Card>

        <Card title="AI가 추론한 역량 (본인 확인 필요)">
          {inferred.map(([s, src]) => (
            <div key={s} className="tc-skillrow">
              <div><b>{s}</b> <span className="muted small">{src}</span> <span className="tc-badge orange">AI 추론</span></div>
              <div className="tc-skill-actions">
                <button className="tc-btn tiny" onClick={() => toast(`'${s}' 추론에 동의했습니다. 프로필에 반영됩니다.`)}>동의</button>
                <button className="tc-btn tiny ghost" onClick={() => req("이의제기", s)}>이의 제기</button>
              </div>
            </div>
          ))}
          <p className="tc-p muted">AI 추론 역량은 본인이 동의하기 전까지 추천에 사용되지 않습니다.</p>
        </Card>

        <Card title="나의 요청 내역">
          {requests.length
            ? <table className="tc-table"><tbody>{requests.map((r, i) => <tr key={i}><td><span className="tc-badge">{r.type}</span></td><td>{r.target}</td><td className="muted">{r.at} · 처리 대기</td></tr>)}</tbody></table>
            : <p className="tc-p muted">아직 요청 내역이 없습니다. 수정 요청·이의제기는 공정성 센터의 처리율 지표에 집계됩니다.</p>}
        </Card>
      </div>
    </>
  );
}

/* ═══════════ 화면 6. 성장 로드맵 (역량 격차 · 교육 추천) ═══════════ */
/** 교육 이미지 — 스킬명 키워드로 분류한다. 위에서부터 먼저 맞는 것이 이긴다. */
const EDU_IMG = [
  [/채용|면접|선발|인사|HR|평가|온보딩|보상|노무/i, "hr", "채용·인사 교육"],
  [/리뷰|멘토|커뮤니케이션|이해관계자|리더|협업|워크숍|퍼실리/i, "people", "협업·리더십 교육"],
  [/AI|머신러닝|딥러닝|LLM|생성형|모델링|이상탐지/i, "ai", "AI·머신러닝 교육"],
  [/설비|공정|계측|검사|품질|신뢰성|수율|클린룸|안전/i, "process", "공정·설비 교육"],
  [/Kubernetes|MSA|아키텍처|대용량|인프라|클라우드|보안|MLOps|배포|서빙|컨테이너|하드웨어|회로|반도체/i, "infra", "시스템·인프라 교육"],
  [/Spark|Airflow|데이터|SQL|파이프라인|거버넌스|분석|시각화|통계|Python|원가|재무/i, "data", "데이터 분석 교육"],
];
function eduImg(skill, course) {
  // 스킬명으로 먼저 분류한다. 과정명에는 "AI 서비스 설계"처럼 다른 주제어가 섞여 오분류가 난다.
  const pick = (t) => (t ? EDU_IMG.find(([re]) => re.test(t)) : null);
  const hit = pick(skill) || pick(course);
  return hit ? { src: `/edu/${hit[1]}.jpg`, alt: hit[2] } : { src: "/edu/data.jpg", alt: "직무 교육" };
}

/* 같은 역량을 채우는 다른 방법 — 심층 인터뷰: 사내교육만으로는 직무개발을 지원하지 못한다 */
function meansOf(g) {
  return [
    { kind: "사내교육", name: g.course, hours: g.hours,
      note: "사내 교육과정으로 개설되어 있습니다" },
    { kind: "외부교육", name: `${g.skill} 심화 과정 (외부 전문기관)`, hours: g.hours + 8,
      note: "사내 과정보다 깊이 있게 다루며 수강료 지원 대상입니다" },
    { kind: "프로젝트·멘토링", name: `${g.skill} 적용 사내 과제 + 선임 멘토링`, hours: Math.round(g.hours * 1.5),
      note: "실제 과제에 투입되어 배우는 방식입니다. 멘토가 배정됩니다" },
  ];
}

function Training({ wantRole, me, courseState, setCourseState, toast }) {
  const gaps = GAPS_BY_ROLE[wantRole] || GAPS;
  const [altIdx, setAltIdx] = useState({});   // 역량별로 선택한 학습수단
  const set = (c, st, msg) => { setCourseState((x) => ({ ...x, [c]: st })); toast(msg); };
  const meanOf = (g) => meansOf(g)[altIdx[g.skill] || 0];
  const enrolled = gaps.filter((g) => courseState[g.course] === "enrolled");
  const totalHours = enrolled.reduce((a, g) => a + meanOf(g).hours, 0);
  // 준비도 = 현재 수준 합 / 목표 수준 합
  const ready = Math.round(
    (gaps.reduce((a, g) => a + g.cur, 0) / gaps.reduce((a, g) => a + g.target, 0)) * 100);
  const strengths = me.skills.filter(([, lv]) => lv >= 4).map(([sk]) => sk);

  return (
    <>
      {/* 요약 헤더 */}
      <section className="tc-goal has-photo">
        <div className="tc-goal-main">
          <div className="tc-goal-label">목표 직무 (내 프로필에서 설정한 값)</div>
          <div className="tc-goal-role">{wantRole}</div>
          <div className="tc-chips">
            {strengths.map((sk) => <span key={sk} className="tc-chip">{sk}</span>)}
          </div>
          <p className="tc-p muted" style={{ marginBottom: 0 }}>
            위는 현재 강점(숙련도 4 이상)입니다. 목표 직무를 바꾸면 아래 역량 격차와 추천 교육이 함께 바뀝니다.
          </p>
        </div>
        <div className="tc-goal-side">
          <Ring value={ready} label="목표 대비 준비도" />
          <div className="tc-goal-stat">
            <div><b>{gaps.length}</b><span>보완 필요 역량</span></div>
            <div><b>{enrolled.length}</b><span>신청한 교육</span></div>
            <div><b>{totalHours}<em>h</em></b><span>예상 학습시간</span></div>
          </div>
        </div>
      </section>

      <div className="tc-sec-head">
        <h3>보완이 필요한 역량 {gaps.length}개</h3>
        <span className="muted">우선순위는 목표 직무의 요구 수준과의 차이 순입니다. &lsquo;다른 방법&rsquo;을 누르면 사내교육 · 외부교육 · 프로젝트·멘토링으로 바뀝니다.</span>
      </div>

      <div className="tc-gaps">
        {gaps.map((g, i) => {
          const st = courseState[g.course];
          return (
            <article key={g.skill} className={`tc-gapcard${st === "enrolled" ? " on" : ""}${st === "dismissed" ? " off" : ""}`}>
              <div className="tc-gapthumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={eduImg(g.skill, g.course).src} alt={eduImg(g.skill, g.course).alt} loading="lazy" />
              </div>
              <header className="tc-gapcard-head">
                <div>
                  <span className="tc-rank">{String(i + 1).padStart(2, "0")}</span>
                  <b>{g.skill}</b>
                </div>
                {st === "enrolled" && <span className="tc-badge mint">신청 완료</span>}
                {st === "dismissed" && <span className="tc-badge">숨김</span>}
              </header>

              <div className="tc-levels">
                <span className="tc-lv-label">현재 {g.cur}</span>
                <div className="tc-dots">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <i key={n} className={n <= g.cur ? "has" : n <= g.target ? "need" : ""} />
                  ))}
                </div>
                <span className="tc-lv-label target">목표 {g.target}</span>
              </div>

              <p className="tc-p" style={{ margin: "10px 0 12px" }}>{g.why}</p>

              <div className="tc-course">
                <div className="tc-course-head">
                  <span className={`tc-badge ${["", "orange", "mint"][altIdx[g.skill] || 0]}`}>{meanOf(g).kind}</span>
                  <span className="muted small">{(altIdx[g.skill] || 0) + 1} / 3</span>
                </div>
                <div className="tc-course-name">{meanOf(g).name}</div>
                <dl className="tc-dl">
                  <div><dt>학습시간</dt><dd>약 {meanOf(g).hours}시간</dd></div>
                  <div><dt>완료 시</dt><dd>{g.link} 참여 가능</dd></div>
                </dl>
                <p className="tc-p muted" style={{ margin: "6px 0 0" }}>{meanOf(g).note}</p>
              </div>

              <div className="tc-row wrap" style={{ marginTop: "auto", paddingTop: 12 }}>
                {st ? (
                  <button className="tc-btn tiny ghost"
                          onClick={() => set(g.course, null, "선택을 취소했습니다.")}>되돌리기</button>
                ) : (
                  <>
                    <button className="tc-btn tiny" onClick={() => set(g.course, "enrolled", `'${g.course}' 수강 신청이 접수되었습니다.`)}>수강 신청</button>
                    <button className="tc-btn tiny ghost" onClick={() => set(g.course, "dismissed", "이 추천을 숨겼습니다. 사유는 추천 개선에 사용됩니다.")}>관심 없음</button>
                    <button className="tc-btn tiny ghost" onClick={() => {
                      const next = ((altIdx[g.skill] || 0) + 1) % 3;
                      setAltIdx((x) => ({ ...x, [g.skill]: next }));
                      toast(`'${g.skill}'을(를) ${meansOf(g)[next].kind} 방식으로 바꿨습니다.`);
                    }}>다른 방법</button>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <p className="tc-p muted">
        교육 추천은 목표 직무의 요구 역량과 내 프로필의 현재 수준을 비교한 규칙 기반 결과입니다.
        수강 여부는 본인이 선택하며, 신청·거절 이력은 인사평가에 사용되지 않습니다.
      </p>
    </>
  );
}

/* 준비도 링 (SVG) */
function Ring({ value, label }) {
  const R = 46, C = 2 * Math.PI * R;
  return (
    <div className="tc-ring">
      <svg viewBox="0 0 120 120" width="112" height="112">
        <circle cx="60" cy="60" r={R} fill="none" stroke="var(--grid)" strokeWidth="11" />
        <circle cx="60" cy="60" r={R} fill="none" stroke="var(--brand)" strokeWidth="11"
                strokeLinecap="round" strokeDasharray={`${(value / 100) * C} ${C}`}
                transform="rotate(-90 60 60)" />
        <text x="60" y="66" textAnchor="middle" fontSize="26" fontWeight="700" fill="var(--ink-1)">{value}%</text>
      </svg>
      <span>{label}</span>
    </div>
  );
}

/* ═══════════ 화면 7. 경력경로 ═══════════ */
function Career({ pathSel, setPathSel, toast }) {
  return (
    <>
      <div className="tc-sec-head">
        <h3>경력경로 제안</h3>
        <span className="muted">지금 보유한 역량에서 이어질 수 있는 방향 세 가지입니다. 고르는 것도 바꾸는 것도 본인이 합니다.</span>
      </div>
      <Notice>경력경로는 AI가 확정하는 것이 아니라 구성원이 참고하고 선택하는 추천정보입니다. 선택·수정 권한은 본인에게 있습니다.</Notice>
      <div className="tc-paths">
        {PATHS.map((p, i) => {
          const on = pathSel === p.key;
          return (
            <article key={p.key} className={`tc-path${on ? " on" : ""}`}>
              <header className="tc-path-head">
                <div>
                  <span className="tc-path-key">경로 {p.key}</span>
                  {i === 0 && <span className="tc-badge mint">추천 1순위</span>}
                  {on && <span className="tc-badge">선택함</span>}
                </div>
                <div className="tc-path-match">
                  <b>{p.match}</b><em>%</em>
                  <span>적합도</span>
                </div>
              </header>

              <ol className="tc-path-steps">
                {p.steps.map((st, j) => (
                  <li key={st} className={j === 0 ? "now" : j === p.steps.length - 1 ? "goal" : ""}>
                    <i />
                    <div>
                      <b>{st}</b>
                      <span>{j === 0 ? "현재" : j === p.steps.length - 1 ? "목표" : "중간 단계"}</span>
                    </div>
                  </li>
                ))}
              </ol>

              <dl className="tc-dl">
                <div><dt>필요 역량</dt><dd>{p.needs.join(", ")}</dd></div>
                <div><dt>추천 교육</dt><dd>{p.courses.join(", ")}</dd></div>
                <div><dt>필요 프로젝트</dt><dd>{p.projects.join(", ")}</dd></div>
                <div><dt>예상 준비기간</dt><dd>{p.period}</dd></div>
              </dl>

              <button className={`tc-btn ${on ? "ghost" : "primary"} tc-path-btn`}
                      onClick={() => { setPathSel(on ? null : p.key); toast(on ? `경로 ${p.key} 선택을 해제했습니다.` : `경로 ${p.key}를 나의 경력 목표로 설정했습니다. 언제든 변경할 수 있습니다.`); }}>
                {on ? "선택 해제" : "이 경로 선택"}
              </button>
            </article>
          );
        })}
      </div>
    </>
  );
}

/* ═══════════ 화면 4. 인재 유지관리 ═══════════ */
/* ── 관리자: 인재 프로필 ─────────────────────────────────────────
   개인별 상세가 아니라 "누가 무엇을 할 수 있는가"를 훑는 목록이다.
   AI 분석 미동의자는 추천에서 빠지지만 목록에서 지우지는 않는다(불이익 방지). */
function Profiles() {
  const [dept, setDept] = useState("전체");
  const [q, setQ] = useState("");
  const depts = ["전체", ...new Set(EMPLOYEES.map((e) => e.dept))];
  const list = EMPLOYEES.filter((e) => {
    if (dept !== "전체" && e.dept !== dept) return false;
    if (!q.trim()) return true;
    const t = `${e.name} ${e.role} ${e.dept} ${e.skills.map(([k]) => k).join(" ")}`;
    return t.toLowerCase().includes(q.trim().toLowerCase());
  });
  // 역량정보가 오래된 사람은 추천 품질이 떨어진다 — 갱신 요청 대상
  const stale = (u) => u < "2026.06.01";

  return (
    <>
      <Notice>역량 프로필은 구성원이 직접 입력·수정한 정보입니다. 인사평가 자료가 아니며, 열람 이력은 기록됩니다.</Notice>
      <div className="tc-filters">
        <label>부서
          <select value={dept} onChange={(e) => setDept(e.target.value)}>
            {depts.map((d) => <option key={d}>{d}</option>)}
          </select>
        </label>
        <label>검색
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름·직무·스킬" />
        </label>
        <span className="tc-filter-count">{list.length}명</span>
      </div>

      <div className="tc-cards three">
        {list.map((e) => (
          <div key={e.id} className="tc-person">
            <div className="tc-person-top">
              <div>
                <b>{e.name}</b>
                <span className="tc-sub">{e.dept} · {e.role} · {e.years}년차</span>
              </div>
              {!e.aiConsent && <span className="tc-badge">AI 분석 미동의</span>}
            </div>
            <div className="tc-chips small">
              {e.skills.slice(0, 4).map(([k, lv]) => (
                <span key={k} className="tc-chip">{k} <em>Lv.{lv}</em></span>
              ))}
            </div>
            <dl className="tc-dl">
              <div><dt>희망 직무</dt><dd>{e.wantRole}</dd></div>
              <div><dt>투입 가능</dt><dd>{e.available}</dd></div>
              <div><dt>정보 갱신</dt>
                <dd className={stale(e.updated) ? "warn" : ""}>
                  {e.updated}{stale(e.updated) ? " (갱신 요청 대상)" : ""}
                </dd></div>
            </dl>
          </div>
        ))}
      </div>
      <p className="tc-p muted">
        전체 {EMPLOYEES.length}명 중 AI 분석에 동의한 구성원은 {EMPLOYEES.filter((e) => e.aiConsent).length}명입니다.
        미동의자는 추천 대상에서 제외되며, 이 사실이 평가나 배치에 불이익으로 작용하지 않습니다.
      </p>
    </>
  );
}

/* ── 관리자: 스킬 갭 분석 ────────────────────────────────────────
   조직 전체에서 한 명만 보유한 스킬이 곧 이탈 리스크다. */
function SkillGap() {
  const [guide, setGuide] = useState(false);
  const holders = useMemo(() => {
    const m = new Map();
    for (const e of EMPLOYEES) {
      for (const [sk, lv] of e.skills) {
        if (!m.has(sk)) m.set(sk, []);
        m.get(sk).push({ id: e.id, name: e.name, dept: e.dept, lv });
      }
    }
    return [...m.entries()]
      .map(([skill, people]) => ({
        skill, people,
        expert: people.filter((p) => p.lv >= 4).length,
      }))
      .sort((a, b) => a.people.length - b.people.length || b.expert - a.expert);
  }, []);
  const solo = holders.filter((h) => h.people.length === 1);
  const thin = holders.filter((h) => h.people.length === 2);
  const max = Math.max(...holders.map((h) => h.people.length), 1);

  return (
    <>
      <div className="tc-topbar">
        <Notice>집계는 조직 단위로만 표시합니다. 개인별 숙련도 원자료는 본인과 본인이 동의한 범위에서만 열람됩니다.</Notice>
        <button className="tc-btn tiny ghost tc-guide-btn" onClick={() => setGuide(true)}>
          <span aria-hidden="true">?</span> 숙련도 기준
        </button>
      </div>
      {guide && <LevelGuide onClose={() => setGuide(false)} />}
      <div className="tc-kpis">
        <div className="tc-kpi"><b>{holders.length}</b><span>조직 보유 스킬 종류</span></div>
        <div className="tc-kpi warn"><b>{solo.length}</b><span>1인 의존 스킬</span></div>
        <div className="tc-kpi"><b>{thin.length}</b><span>2인 보유 스킬</span></div>
      </div>

      <div className="tc-sec-head">
        <h3>1인 의존 스킬 {solo.length}개</h3>
        <span className="muted">해당 구성원이 이탈하면 조직에서 사라지는 역량입니다.</span>
      </div>
      <div className="tc-cards three">
        {solo.slice(0, 9).map((h) => (
          <div key={h.skill} className="tc-person alert">
            <div className="tc-person-top">
              <b>{h.skill}</b>
              <span className="tc-badge warn">1명</span>
            </div>
            <p className="tc-p" style={{ margin: "6px 0 0" }}>
              보유자: {h.people[0].name} ({h.people[0].dept}) · 숙련도 Lv.{h.people[0].lv}
            </p>
            <p className="tc-p muted" style={{ margin: "6px 0 0" }}>
              후속 육성 또는 문서화가 필요합니다.
            </p>
          </div>
        ))}
      </div>

      {solo.length > 9 && (
        <p className="tc-p muted" style={{ marginTop: 10 }}>
          보유자가 1명인 스킬 {solo.length}개 중 9개만 표시했습니다. 이 데모의 가상 조직은 {EMPLOYEES.length}명 규모라
          1인 의존 비율이 실제 조직보다 높게 나타납니다.
        </p>
      )}

      <div className="tc-sec-head" style={{ marginTop: 22 }}>
        <h3>스킬별 보유 인원 (보유자가 적은 순 상위 24개)</h3>
        <span className="muted">막대가 짧을수록 조직 내 대체 가능성이 낮습니다.</span>
      </div>
      <div className="tc-card">
        <div className="tc-skilllist">
          {holders.slice(0, 24).map((h) => (
            <div key={h.skill} className="tc-skillrow">
              <span className="tc-skillname">{h.skill}</span>
              <div className="tc-gbar">
                <i style={{ width: `${(h.people.length / max) * 100}%` }}
                   className={h.people.length === 1 ? "warn" : ""} />
              </div>
              <span className="tc-skillnum">{h.people.length}명<em> · 숙련 {h.expert}</em></span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ── 관리자: 이탈 영향 시뮬레이션 ────────────────────────────────
   "이 사람이 나가면 무엇이 비는가"를 규칙 기반으로 계산해 보여준다. */
function Simulation() {
  const [target, setTarget] = useState(EMPLOYEES[0].id);
  const [fd, setFd] = useState("전체");
  const [q, setQ] = useState("");
  const me = empById(target);
  const others = EMPLOYEES.filter((e) => e.id !== target);
  const depts = ["전체", ...new Set(EMPLOYEES.map((e) => e.dept))];
  const picks = EMPLOYEES.filter((e) => {
    if (fd !== "전체" && e.dept !== fd) return false;
    if (!q.trim()) return true;
    const t = `${e.name} ${e.role} ${e.dept} ${e.skills.map(([k]) => k).join(" ")}`;
    return t.toLowerCase().includes(q.trim().toLowerCase());
  });

  // 직군별 이탈 위험: 이직률(예시값) × 조직 내 대체 가능성(보유 데이터로 계산)
  const families = useMemo(() => {
    // 대체 가능성은 '보유자가 있는가'가 아니라 '숙련자가 있는가'로 본다.
    // 이름만 걸쳐 있는 사람은 공백을 메우지 못한다는 인터뷰 지적을 반영했다.
    const hold = new Map();  // 스킬 → 숙련자(레벨 4 이상) 수
    EMPLOYEES.forEach((e) => e.skills.forEach(([k, lv]) => {
      if (lv >= 4) hold.set(k, (hold.get(k) || 0) + 1);
    }));
    const g = new Map();
    EMPLOYEES.forEach((e) => {
      const f = ROLE_FAMILY[e.role] || "기타";
      if (!g.has(f)) g.set(f, { name: f, n: 0, sk: new Set() });
      const o = g.get(f); o.n += 1; e.skills.forEach(([k]) => o.sk.add(k));
    });
    return [...g.values()]
      .filter((o) => FAMILY_RISK[o.name])
      .map((o) => {
        const sk = [...o.sk];
        const covered = sk.filter((k) => (hold.get(k) || 0) >= 2).length;
        return { ...o, repl: Math.round((covered / sk.length) * 100),
                 rate: FAMILY_RISK[o.name].rate, ...FAMILY_RISK[o.name] };
      })
      .sort((a, b) => (b.rate - b.repl / 20) - (a.rate - a.repl / 20));
  }, []);
  // 위험 판정 기준선: 가로 = 전 산업 평균 이직률(공표치), 세로 = 이 조직의 평균 숙련자 확보율
  const orgAvg = families.length
    ? Math.round(families.reduce((a, f) => a + f.repl, 0) / families.length) : 50;

  const result = useMemo(() => {
    const lost = [], weak = [];
    for (const [sk, lv] of me.skills) {
      const rest = others.filter((e) => e.skills.some(([k]) => k === sk));
      const restExpert = rest.filter((e) => e.skills.some(([k, l]) => k === sk && l >= 4));
      if (rest.length === 0) lost.push({ sk, lv });
      else if (lv >= 4 && restExpert.length === 0) weak.push({ sk, lv, rest: rest.length });
    }
    // 대체 후보: 겹치는 스킬 수와 숙련도로 점수화 (규칙 기반)
    const cand = others
      .map((e) => {
        let score = 0, shared = [];
        for (const [sk, lv] of me.skills) {
          const hit = e.skills.find(([k]) => k === sk);
          if (hit) { score += Math.min(hit[1], lv) * 2 + (hit[1] >= lv ? 3 : 0); shared.push(sk); }
        }
        if (e.role === me.role) score += 6;
        return { e, score, shared };
      })
      .filter((c) => c.shared.length > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    return { lost, weak, cand };
  }, [target, me, others]);

  return (
    <>
      <Notice>가정 시나리오입니다. 실제 이탈 예측이 아니며, 특정 구성원에 대한 판단 근거로 사용하지 않습니다.</Notice>

      {/* ── 1단계: 어느 직군이 위험한가 ── */}
      <div className="tc-sec-head">
        <h3>직군별 이탈 위험</h3>
        <span className="muted">자주 떠나는 직군일수록 오른쪽, 대체가 어려운 직군일수록 아래에 놓입니다.</span>
      </div>
      <Card>
        <RiskQuadrant items={families} yMid={orgAvg} />
        <p className="tc-p muted">
          가로축은 산업 동향 탭의 이직률 구조를 참고한 <b>직군별 예시값</b>이며 공표 통계가 아닙니다.
          세로축은 이 조직의 실제 보유 데이터로 계산했습니다. 해당 직군이 쓰는 스킬 중
          <b> 숙련자(레벨 4 이상)가 두 명 이상인 스킬의 비율</b>이며, 낮을수록 한 사람이 나갔을 때
          그 자리를 메울 사람이 없다는 뜻입니다. 기준선은 이 조직의 평균({orgAvg})입니다.
        </p>
      </Card>

      <Card title="직군별 대응 방향">
        <table className="tc-table lines">
          <thead>
            <tr><th>직군</th><th>인원</th><th>이직률</th><th>숙련자 확보율</th><th>왜 떠나는가</th><th>권고 대응</th></tr>
          </thead>
          <tbody>
            {families.map((f) => {
              const danger = f.rate >= 4.9 && f.repl < orgAvg;
              return (
                <tr key={f.name} className={danger ? "alt" : ""}>
                  <td><b>{f.name}</b>{danger && <span className="tc-badge orange" style={{ marginLeft: 6 }}>우선</span>}</td>
                  <td className="muted">{f.n}명</td>
                  <td className="num">{f.rate}%</td>
                  <td className="num">{f.repl}</td>
                  <td className="small muted">{f.why}</td>
                  <td className="small">{f.action}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* ── 2단계: 개인 단위 영향 ── */}
      <div className="tc-sec-head" style={{ marginTop: 22 }}>
        <h3>개인 단위 영향 확인</h3>
        <span className="muted">부서로 좁히거나 이름·기술로 검색해 대상을 고르세요.</span>
      </div>
      <div className="tc-filters">
        <label>부서
          <select value={fd} onChange={(e) => setFd(e.target.value)}>
            {depts.map((d) => <option key={d}>{d}</option>)}
          </select>
        </label>
        <label>검색
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름·직무·기술" />
        </label>
        <span className="tc-filter-count">{picks.length}명</span>
      </div>
      <div className="tc-picklist">
        {picks.map((e) => (
          <button key={e.id} className={`tc-pick${e.id === target ? " on" : ""}`} onClick={() => setTarget(e.id)}>
            <b>{e.name}</b>
            <span>{e.dept} · {e.role} · {e.years}년</span>
          </button>
        ))}
        {!picks.length && <p className="tc-p muted">검색 결과가 없습니다.</p>}
      </div>

      <div className="tc-kpis">
        <div className="tc-kpi warn"><b>{result.lost.length}</b><span>대체자가 없는 역량</span></div>
        <div className="tc-kpi"><b>{result.weak.length}</b><span>숙련 공백이 생기는 역량</span></div>
        <div className="tc-kpi"><b>{result.cand.length}</b><span>즉시 검토 가능한 대체 후보</span></div>
      </div>

      <div className="tc-sec-head">
        <h3>{me.name} 님이 이탈할 경우</h3>
        <span className="muted">{me.dept} · {me.role} · {me.years}년차</span>
      </div>
      <div className="tc-cards two">
        <div className="tc-card">
          <b>이 사람만 가진 역량</b>
          {result.lost.length ? (
            <div className="tc-chips small" style={{ marginTop: 8 }}>
              {result.lost.map(({ sk, lv }) => (
                <span key={sk} className="tc-chip warn">{sk} <em>Lv.{lv}</em></span>
              ))}
            </div>
          ) : <p className="tc-p muted" style={{ marginTop: 8 }}>이 사람만 가진 역량은 없습니다. 모두 다른 구성원도 보유하고 있습니다.</p>}
          <b style={{ display: "block", marginTop: 16 }}>숙련자가 이 사람뿐인 역량</b>
          {result.weak.length ? (
            <div className="tc-chips small" style={{ marginTop: 8 }}>
              {result.weak.map(({ sk, rest }) => (
                <span key={sk} className="tc-chip">{sk} <em>남는 사람 {rest}명 · 모두 숙련 미만</em></span>
              ))}
            </div>
          ) : <p className="tc-p muted" style={{ marginTop: 8 }}>없습니다. 각 역량마다 다른 숙련자가 있습니다.</p>}
        </div>
        <div className="tc-card">
          <b>대체 후보 (규칙 기반)</b>
          <p className="tc-p muted" style={{ margin: "4px 0 10px" }}>
            공유 스킬 수와 숙련도 차이로 계산한 값입니다. 확정 배치가 아니라 검토 출발점입니다.
          </p>
          {result.cand.map(({ e, shared }) => (
            <div key={e.id} className="tc-altrow">
              <div>
                <b>{e.name}</b>
                <span className="tc-sub">{e.dept} · {e.role}</span>
              </div>
              <span className="tc-sub">공유 스킬 {shared.slice(0, 3).join(", ")}</span>
            </div>
          ))}
          {!result.cand.length && <p className="tc-p muted">공유 스킬을 가진 구성원이 없습니다.</p>}
        </div>
      </div>
    </>
  );
}

function Retention() {
  return (
    <>
      <Notice>본 정보는 구성원에 대한 불이익이나 퇴사 가능성 판단에 사용되지 않으며, 성장기회와 경력지원을 제공하기 위한 참고정보입니다.</Notice>
      <Card title="성장지원 필요 신호">
        <p className="tc-p muted">확인 항목: 최근 프로젝트 기회 부족 · 희망 직무와 현재 업무 불일치 · 장기간 교육 참여 부재 · 보유역량 대비 낮은 역할 활용도 · 경력개발 면담 필요 · 본인이 제출한 성장 관련 의견</p>
        <table className="tc-table lines">
          <thead><tr><th>구성원</th><th>확인된 신호</th><th>상태</th><th>지원 방안</th></tr></thead>
          <tbody>
            {RETENTION.map((r) => {
              const e = empById(r.id);
              return (
                <tr key={r.id}>
                  <td><b>{e.name}</b><div className="muted small">{e.role} · {e.dept}</div></td>
                  <td>{e.signals.join(" · ") || "없음"}</td>
                  <td><span className="tc-badge orange">{r.status}</span></td>
                  <td>{r.support}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="tc-p muted">구성원을 위험점수로 줄 세우지 않고, 필요한 지원의 종류로만 분류합니다.</p>
      </Card>
    </>
  );
}

/* ═══════════ 화면 8. 공정성·신뢰센터 ═══════════ */
function Fairness({ toast }) {
  const metrics = [
    ["AI 추천 설명 제공률", 100], ["구성원 정보 확인률", 82], ["이의제기 처리율", 94],
    ["관리자 최종검토율", 100], ["추천 데이터 최신성(90일 내)", 82], ["개인정보 활용 동의율", 97],
  ];
  return (
    <>
      <div className="tc-grid2">
        <Card title="신뢰 지표">
          {metrics.map(([n, v]) => <Bar key={n} label={n} v={v} max={100} suffix="%" tone={v < 80 ? "orange" : "mint"} />)}
          <p className="tc-p muted">프로젝트 추천 기회 분포: 상위 20% 구성원에게 추천의 34%가 집중되어 있습니다. 아래 점검 결과를 참조하세요.</p>
        </Card>
        <Card title="추천 결과 편향 점검" tone="warn">
          <p className="tc-p"><span className="tc-badge orange big">전체 상태: 주의 필요</span></p>
          <ul className="tc-ul">
            <li>특정 부서(플랫폼개발팀)의 프로젝트 추천 기회 편중 가능성 발견</li>
            <li>역량정보가 90일 이상 갱신되지 않은 구성원 45명, 추천 정확도 저하 가능</li>
            <li>교육 참여 이력이 많은 구성원에게 추천이 집중될 가능성</li>
          </ul>
          <p className="tc-p"><b>개선조치</b>: 정보 업데이트 요청 발송, 추천 기준 재검토, 관리자 교차검토 시행</p>
        </Card>
        <Card title="AI 추천에 사용되는 데이터">
          <p className="tc-p">보유 기술·숙련도, 프로젝트 경험, 자격증, 교육 이력, 본인이 등록한 희망 직무·희망 프로젝트, 투입 가능 시점</p>
          <p className="tc-p"><b>사용하지 않는 민감정보</b>: 성별, 연령, 출신지역, 출신학교, 가족관계, 노조 가입 여부, 건강 정보, 평가·근태 기록</p>
          <p className="tc-p muted">추천 기준: 프로젝트 요구조건과 등록된 역량정보의 일치 정도(규칙 기반). 데이터 보유기간: 퇴직 후 3년, 이후 파기.</p>
        </Card>
        <Card title="구성원의 권리">
          <div className="tc-row wrap">
            {["내 정보 열람 요청", "정보 수정 요청", "정보 삭제 요청", "AI 추천 이의제기"].map((b) => (
              <button key={b} className="tc-btn ghost" onClick={() => toast(`'${b}'가 접수되었습니다. 담당자가 7일 이내에 처리합니다.`)}>{b}</button>
            ))}
          </div>
          <p className="tc-p muted">모든 추천은 인간의 최종검토를 거치며, 이의제기 시 재검토 절차가 진행됩니다.</p>
        </Card>
      </div>
    </>
  );
}

/* ═══════════ 화면. 시스템 안내 ═══════════ */
const FLOW = [
  ["기존 문제", "지금 무엇이 안 되는가",
    ["내부 인재정보가 흩어져 있다", "인력배치가 담당자 경험에 의존한다",
     "구성원별 경력개발 지원이 어렵다", "핵심역량이 활용되지 못한다",
     "AI 인사결정에 대한 우려가 있다"]],
  ["AI가 하는 일", "무엇을 자동화하는가",
    ["흩어진 역량정보를 하나로 모은다", "조건에 맞는 사내 인재를 찾는다",
     "프로젝트에 맞는 후보를 추천한다", "역량 격차와 교육·경력경로를 제시한다",
     "성장지원이 필요한 신호를 알린다"]],
  ["도입 조건", "무엇이 갖춰져야 하는가",
    ["구성원의 사전 동의", "설명 가능한 추천", "정보 열람·수정권",
     "정기적인 공정성 점검", "개인정보 최소 활용", "구성원의 선택권",
     "관리자의 최종검토", "이의제기·재검토 절차"]],
  ["기대 효과", "무엇이 달라지는가",
    ["내부 인재를 발견할 가능성이 커진다", "배치 의사결정에 근거가 생긴다",
     "개인에게 맞는 교육을 제공할 수 있다", "구성원의 경력개발을 지원한다",
     "조직의 역량 현황을 파악할 수 있다"]],
];

const LAYERS = [
  ["01", "수집", "인사·교육·프로젝트 시스템에서 데이터를 가져온다",
    "ERP · 그룹웨어 · 교육관리시스템 · 프로젝트 관리도구", "후속 과제"],
  ["02", "정규화", "서로 다르게 기록된 직무와 역량을 하나의 기준으로 잇는다",
    "스킬 온톨로지 (직무군–직무–과업–스킬)", "반영"],
  ["03", "추론", "역량 수준을 추정하고 적합한 인재·교육을 추천한다",
    "규칙 기반 매칭 (이 데모는 실제 AI를 호출하지 않는다)", "반영"],
  ["04", "검증", "구성원이 확인·수정하고 담당자가 최종 검토한다",
    "본인 확인 · 이의제기 · SME 검토 · 결정 기록", "반영"],
];

const PRINCIPLES = [
  ["모든 인물과 수치는 가상입니다", "실제 기업이나 개인의 데이터가 아닙니다."],
  ["아무 정보도 수집하지 않습니다", "이 화면에서 입력한 값은 브라우저 안에서만 처리됩니다."],
  ["인사평가에 쓰이지 않습니다", "진단 결과는 개인에 대한 확정적 판단이 아닙니다."],
  ["추천에는 근거가 따라옵니다", "적합도만 주지 않고 무엇을 보고 판단했는지 함께 보여줍니다."],
  ["최종 결정은 사람이 합니다", "AI 추천과 다른 결정을 내렸다면 사유를 기록합니다."],
];

function About({ setScreen }) {
  const map = [
    ["관리자 화면", "admin", [
      ["dash", "통합 대시보드", "조직 전체의 역량 현황과 지표"],
      ["search", "AI 인재 탐색", "조건에 맞는 사내 인재 찾기"],
      ["profiles", "인재 프로필", "구성원별 역량·경력 정보"],
      ["skillgap", "스킬 갭 분석", "1인 의존 역량과 보유 분포"],
      ["matching", "프로젝트 매칭", "팀 구성안과 공정성 점검"],
      ["decisions", "결정 기록", "AI 추천과 최종 결정의 차이"],
      ["sim", "이탈 영향 시뮬레이션", "직군별 위험과 개인 단위 영향"],
      ["retention", "인재 유지관리", "성장지원이 필요한 신호"],
    ]],
    ["구성원 화면", "emp", [
      ["profile", "내 역량 프로필", "내 정보 확인·수정·분석 제외"],
      ["training", "성장 로드맵", "목표 직무까지의 역량 격차와 학습 방법"],
      ["career", "경력경로", "지금 위치에서 갈 수 있는 방향"],
    ]],
    ["공통 화면", "all", [
      ["fairness", "공정성·신뢰센터", "추천 기준과 구성원의 권리"],
      ["research", "인터뷰 반영 내역", "현직자 요건이 어느 화면이 되었는지"],
    ]],
  ];

  return (
    <>
      <section className="ab-hero">
        <div className="ab-hero-main">
          <span className="ab-eyebrow">System Guide</span>
          <h2>사람의 가능성과 조직의 기회를 연결합니다</h2>
          <p>
            구성원의 스킬·경력·교육 이력을 하나로 모아 사내 인재를 찾고, 역량 격차를 진단하고,
            교육과 경력경로를 제안하는 시스템입니다. 이 화면들은 연구
            「AI 기반 인재관리 시스템 구축 방향 연구」의 결론을 사용자 경험으로 옮긴 데모입니다.
          </p>
          <p className="ab-note">
            AI는 의사결정을 대신하지 않습니다. 후보와 근거를 제시할 뿐이고, 최종 결정은 사람이 검토합니다.
          </p>
        </div>
        <dl className="ab-facts">
          <div><dt>연구 기관</dt><dd>성균관대학교 AI융합운영전공</dd></div>
          <div><dt>연구 방법</dt><dd>기업 사례 분석 · 실무자 심층 인터뷰 · 재직자 설문</dd></div>
          <div><dt>이론 모형</dt><dd>확장 UTAUT (＋프라이버시 우려 · 알고리즘 공정성 인식)</dd></div>
          <div><dt>데이터</dt><dd>전부 가상 · 업계 기준선만 공식 통계 인용</dd></div>
        </dl>
      </section>

      <div className="tc-sec-head">
        <h3>문제에서 효과까지</h3>
        <span className="muted">왼쪽에서 오른쪽으로 읽으면 이 시스템이 왜 필요한지가 이어집니다.</span>
      </div>
      <div className="ab-flow">
        {FLOW.map(([t, sub, items], i) => (
          <div key={t} className="ab-flowcol">
            <div className="ab-flowhead">
              <span className="ab-step">{i + 1}</span>
              <div><b>{t}</b><em>{sub}</em></div>
            </div>
            <ul>{items.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
        ))}
      </div>

      <div className="tc-sec-head" style={{ marginTop: 24 }}>
        <h3>데이터는 네 층을 지납니다</h3>
        <span className="muted">심층 인터뷰에서 나온 &lsquo;검증 없이는 신뢰할 수 없다&rsquo;는 요구를 구조에 넣었습니다.</span>
      </div>
      <div className="ab-layers">
        {LAYERS.map(([no, name, desc, src, st]) => (
          <div key={no} className={`ab-layer${st === "후속 과제" ? " todo" : ""}`}>
            <div className="ab-layer-no">{no}</div>
            <div className="ab-layer-body">
              <b>{name}</b>
              <p>{desc}</p>
              <span className="ab-src">{src}</span>
            </div>
            <span className={`tc-badge ${st === "반영" ? "mint" : "orange"}`}>{st}</span>
          </div>
        ))}
      </div>
      <p className="tc-p muted">
        네 번째 층(검증)을 부가 기능이 아니라 구조의 일부로 둔 것이 이 연구의 핵심 제언입니다.
      </p>

      <div className="tc-sec-head" style={{ marginTop: 24 }}>
        <h3>화면 안내</h3>
        <span className="muted">이름을 누르면 해당 화면으로 이동합니다.</span>
      </div>
      <div className="ab-map">
        {map.map(([label, aud, items]) => (
          <div key={label} className="ab-mapcol">
            <div className={`ab-maphead ${aud}`}>{label}</div>
            {items.map(([k, name, desc]) => (
              <button key={k} className="ab-mapitem" onClick={() => setScreen(k)}>
                <b>{name}</b>
                <span>{desc}</span>
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="tc-sec-head" style={{ marginTop: 24 }}>
        <h3>이 데모가 지키는 것</h3>
      </div>
      <div className="ab-rules">
        {PRINCIPLES.map(([t, d]) => (
          <div key={t} className="ab-rule">
            <i>✓</i>
            <div><b>{t}</b><span>{d}</span></div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ═══════════ 공용 컴포넌트 ═══════════ */
function Card({ title, tone, children }) {
  return (
    <section className={`tc-card${tone ? ` ${tone}` : ""}`}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}
function Notice({ children }) {
  return <div className="tc-notice">{children}</div>;
}
function Bar({ label, v, max, suffix = "", tone }) {
  return (
    <div className="tc-bar">
      <span className="l">{label}</span>
      <div className="t"><i className={tone || ""} style={{ width: `${(v / max) * 100}%` }} /></div>
      <span className="v">{v}{suffix}</span>
    </div>
  );
}
function Modal({ title, onClose, children }) {
  return (
    <div className="tc-overlay" onClick={onClose}>
      <div className="tc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tc-modal-head"><b>{title}</b><button onClick={onClose}>✕</button></div>
        {children}
      </div>
    </div>
  );
}

/* ═══════════ 스타일 ═══════════ */
const CSS = `
.tc { margin: 0 calc(50% - 50vw); background: var(--page); min-height: calc(100vh - 57px);
  font-size: 14px; word-break: keep-all;
  font-family: "Pretendard Variable", Pretendard, system-ui, -apple-system,
    "Apple SD Gothic Neo", "Segoe UI", "Noto Sans KR", sans-serif; }
.tc .tc-badge, .tc .tc-bar .l, .tc .tc-bar .v, .tc .tc-kpi span, .tc-side button { white-space: nowrap; }
.tc-title { font-family: "VanillaRavioli", "Pretendard Variable", sans-serif; font-weight: 400; }
.tc-head { display: flex; justify-content: space-between; align-items: center; gap: 14px; flex-wrap: wrap;
  padding: 16px 26px; background: var(--surface-1); border-bottom: 1px solid var(--border); }
.tc-title { font-size: 21px; letter-spacing: 0.2px; }
.tc-demo-tag { font-size: 11.5px; font-weight: 700; color: #b45f22; background: rgba(201,106,60,0.12);
  border-radius: 999px; padding: 3px 10px; vertical-align: 3px; margin-left: 6px; }
.tc-sub { font-size: 12.5px; color: var(--ink-muted); margin-top: 2px; }
.tc-head-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.tc-step-pill { display: flex; align-items: center; gap: 8px; font-size: 13px; background: var(--surface-2);
  border: 1px solid var(--border); border-radius: 999px; padding: 6px 8px 6px 14px; }
.tc-step-pill b { color: var(--brand); }
.tc-step-pill button { border: 1px solid var(--axis); background: var(--surface-1); border-radius: 999px;
  padding: 4px 12px; font: inherit; font-size: 12.5px; cursor: pointer; }
.tc-step-pill button:disabled { opacity: 0.4; cursor: default; }

.tc-body { display: flex; align-items: stretch; }
.tc-side { width: 208px; flex: none; background: var(--surface-1); border-right: 1px solid var(--border);
  padding: 14px 10px; display: flex; flex-direction: column; gap: 2px; }
.tc-side button { display: flex; gap: 9px; align-items: center; text-align: left; width: 100%;
  border: 0; background: none; font: inherit; font-size: 13.5px; color: var(--ink-2);
  padding: 9px 12px; border-radius: 9px; cursor: pointer; }
.tc-side button .no { font-size: 10.5px; font-weight: 700; color: var(--ink-muted); width: 18px; }
.tc-side button:hover { background: var(--surface-2); }
.tc-side button.on { background: color-mix(in srgb, var(--brand) 9%, var(--surface-1));
  color: var(--ink-1); font-weight: 700; }
.tc-side button.on .no { color: var(--brand); }
.tc-side-group { margin-bottom: 10px; }
.tc-side-label { font-size: 10.5px; font-weight: 800; letter-spacing: 0.6px; padding: 8px 12px 4px; }
.tc-side-label.admin { color: var(--brand); }
.tc-side-label.emp { color: #1d6a58; }
.tc-side-label.all { color: var(--ink-muted); }
.tc-side-note { margin-top: auto; font-size: 11.5px; color: var(--ink-muted); line-height: 1.5;
  padding: 12px; background: var(--surface-2); border-radius: 10px; }

.tc-aud { align-self: flex-start; font-size: 12.5px; font-weight: 800; letter-spacing: 0.2px;
  border-radius: 999px; padding: 6px 16px; }
.tc-aud.admin { background: var(--brand); color: #fff; }
.tc-aud.emp { background: #2e8b76; color: #fff; }
.tc-aud.all { background: var(--surface-2); color: var(--ink-2); border: 1px solid var(--border); }
.tc-main { flex: 1; min-width: 0; padding: 16px 26px 60px; display: flex; flex-direction: column; gap: 16px; }

.tc-notice { font-size: 13px; color: var(--ink-2); background: color-mix(in srgb, var(--brand) 7%, var(--surface-1));
  border: 1px solid color-mix(in srgb, var(--brand) 22%, transparent); border-radius: 12px; padding: 11px 16px; }

.tc-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
.tc-kpi { background: var(--surface-1); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; }
.tc-kpi b { display: block; font-size: 24px; letter-spacing: -0.8px; }
.tc-kpi span { font-size: 12px; color: var(--ink-muted); }
.tc-kpi.warn { border-color: rgba(201,106,60,0.5); } .tc-kpi.warn b { color: #b45f22; }

.tc-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 980px) { .tc-grid2 { grid-template-columns: 1fr; } .tc-side { width: 170px; } }

.tc-card { background: var(--surface-1); border: 1px solid var(--border); border-radius: 14px; padding: 18px 20px; }
.tc-card h3 { margin: 0 0 12px; font-size: 15px; letter-spacing: -0.3px; }
.tc-card.warn { border-color: rgba(201,106,60,0.45); }
.tc-card.mint { border-color: rgba(46,139,118,0.45); }
.tc-p.warn-text { color: #b45f22; font-weight: 600; }
.tc-sme-box { background: var(--surface-2); border-radius: 12px; padding: 14px 16px; margin: 10px 0 16px; }
.tc-sme-verdicts { display: flex; gap: 8px; flex-wrap: wrap; margin: 4px 0 14px; }
.tc-sme-v { border: 1px solid var(--axis); border-radius: 999px; padding: 7px 14px; cursor: pointer; }
.tc-sme-v.on { border-color: var(--brand); background: color-mix(in srgb, var(--brand) 10%, transparent); font-weight: 600; }

.tc-bar { display: grid; grid-template-columns: 150px 1fr 52px; gap: 10px; align-items: center; margin: 7px 0; }
.tc-bar .l { font-size: 12.5px; color: var(--ink-2); }
.tc-bar .t { height: 10px; background: var(--grid); border-radius: 99px; overflow: hidden; }
.tc-bar .t i { display: block; height: 100%; border-radius: 99px; background: var(--seq-550); }
.tc-bar .t i.mint { background: #2e8b76; } .tc-bar .t i.orange { background: #c96a3c; }
.tc-bar .v { font-size: 12.5px; font-variant-numeric: tabular-nums; color: var(--ink-2); text-align: right; }

.tc-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.tc-table td, .tc-table th { padding: 8px 8px; text-align: left; vertical-align: top; }
.tc-table.lines th { font-size: 12px; color: var(--ink-muted); border-bottom: 1px solid var(--axis); }
.tc-table.lines td { border-bottom: 1px solid var(--grid); }
.tc-table tr.alt td { background: color-mix(in srgb, var(--brand) 5%, transparent); }
.tc-table .small { font-size: 12px; }
/* 결정 기록 표 — 짧은 열은 가운데, 문장 열(프로젝트·사유)만 왼쪽. 행 높이와 여백을 통일한다 */
.tc-tablewrap { overflow-x: auto; }
.tc-dec { table-layout: fixed; }
.tc-dec th, .tc-dec td {
  text-align: center; vertical-align: middle;
  padding: 11px 10px; line-height: 1.55; word-break: keep-all;
}
.tc-dec tbody tr { height: 56px; }
.tc-dec .tl { text-align: left; }
.tc-dec .tc-badge { margin-left: 0; }
.tc-dec td b { font-weight: 700; }
.tc-dec .tl .small { margin-top: 3px; }

.tc-badge { display: inline-block; font-size: 11.5px; font-weight: 700; border-radius: 999px;
  padding: 2px 9px; background: var(--surface-2); color: var(--ink-2); margin-left: 4px; }
.tc-badge.mint { background: rgba(46,139,118,0.13); color: #1d6a58; }
.tc-badge.orange { background: rgba(201,106,60,0.13); color: #b45f22; }
.tc-badge.big { font-size: 13px; padding: 6px 14px; }

.tc-btn { border: 0; border-radius: 9px; padding: 9px 16px; font: inherit; font-size: 13.5px;
  font-weight: 600; cursor: pointer; background: var(--surface-2); color: var(--ink-1); }
.tc-btn.primary { background: var(--brand); color: #fff; }
.tc-btn.ghost { background: transparent; border: 1px solid var(--axis); }
.tc-btn.tiny { padding: 5px 11px; font-size: 12.5px; }
.tc-btn:disabled { opacity: 0.45; cursor: default; }
.tc-btn:not(:disabled):hover { filter: brightness(1.05); }

.tc-p { font-size: 13.5px; line-height: 1.62; margin: 8px 0; color: var(--ink-1); }
.muted { color: var(--ink-muted); } .warn-text { color: #b45f22; font-size: 12.5px; }
.tc-row { display: flex; gap: 8px; align-items: center; } .tc-row.wrap { flex-wrap: wrap; }
.tc-row-end { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; }
.tc-ol { margin: 6px 0; padding-left: 20px; font-size: 14px; line-height: 1.9; }
.tc-ul { margin: 6px 0; padding-left: 18px; font-size: 13.5px; line-height: 1.8; color: var(--ink-2); }

.tc-searchrow { display: flex; gap: 10px; align-items: stretch; }
.tc-searchrow .tc-btn { flex: none; align-self: center; }
.tc-input { width: 100%; font: inherit; font-size: 13.5px; border: 1px solid var(--axis);
  border-radius: 10px; padding: 10px 12px; background: var(--surface-1); color: var(--ink-1); resize: vertical; }
.tc-input.slim { width: auto; padding: 6px 10px; }
.tc-filters { display: flex; gap: 16px; margin-top: 10px; align-items: center; flex-wrap: wrap; font-size: 12.5px; color: var(--ink-2); }
.tc-filters select { margin-left: 6px; font: inherit; font-size: 12.5px; border: 1px solid var(--axis); border-radius: 8px; padding: 4px 8px; background: var(--surface-1); color: var(--ink-1); }

.tc-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.tc-cards.three { grid-template-columns: repeat(3, 1fr); }
@media (max-width: 980px) { .tc-cards, .tc-cards.three { grid-template-columns: 1fr; } }
.tc-person { background: var(--surface-1); border: 1px solid var(--border); border-radius: 14px; padding: 18px; }
.tc-person.path.sel { border-color: var(--brand); box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 12%, transparent); }
.tc-person-top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
.tc-fit { font-size: 26px; font-weight: 800; letter-spacing: -1px; color: var(--brand); }
.tc-fit em { font-style: normal; font-size: 14px; } .tc-fit.small { font-size: 20px; }
.tc-dl { margin: 0; } .tc-dl > div { display: flex; gap: 8px; font-size: 13px; padding: 2.5px 0; }
.tc-dl dt { flex: none; width: 86px; color: var(--ink-muted); } .tc-dl dd { margin: 0; }
.tc-dl.wide dt { width: 110px; }
.tc-why dt { font-size: 12px; font-weight: 700; color: var(--ink-muted); margin-top: 10px; }
.tc-why dd { margin: 2px 0 0; font-size: 13.5px; }

.tc-check { display: flex; gap: 8px; align-items: center; font-size: 13.5px; padding: 5px 0; cursor: pointer; }
.tc-check.tiny { font-size: 12px; color: var(--ink-2); padding: 0; }
.tc-skillrow { display: flex; justify-content: space-between; gap: 10px; align-items: center; flex-wrap: wrap; padding: 4px 0; border-bottom: 1px solid var(--grid); }
.tc-skillrow:last-child { border-bottom: 0; }
.tc-skillrow .tc-bar { flex: 1; min-width: 220px; margin: 0; }
.tc-skill-actions { display: flex; gap: 8px; align-items: center; }

/* ── 성장 로드맵 ── */
.tc-goal { display: flex; gap: 24px; flex-wrap: wrap; align-items: stretch;
  background: var(--surface-1); border: 1px solid var(--border); border-radius: 16px; padding: 22px 24px; }
/* 헤더 배경 사진 — 글자 대비를 해치지 않도록 흰 그라데이션을 덮는다 */
.tc-goal.has-photo { position: relative; overflow: hidden; isolation: isolate; }
.tc-goal.has-photo::before {
  content: ""; position: absolute; inset: 0; z-index: -2;
  background: url("/edu/header.jpg") center 38% / cover no-repeat;
  opacity: 0.34; filter: saturate(0.55);
}
.tc-goal.has-photo::after {
  content: ""; position: absolute; inset: 0; z-index: -1;
  background: linear-gradient(100deg, var(--surface-1) 26%, color-mix(in srgb, var(--surface-1) 82%, transparent) 55%, color-mix(in srgb, var(--surface-1) 42%, transparent) 100%);
}
.tc-goal-main { flex: 1; min-width: 280px; }
.tc-goal-label { font-size: 12px; font-weight: 700; color: var(--ink-muted); letter-spacing: 0.3px; }
.tc-goal-role { font-size: 26px; font-weight: 800; letter-spacing: -0.8px; margin: 4px 0 12px; color: var(--brand); }
/* ── 관리자 신규 화면(인재 프로필·스킬 갭·시뮬레이션) 공용 ── */
.tc-filters input { margin-left: 6px; font: inherit; font-size: 12.5px; border: 1px solid var(--axis);
  border-radius: 8px; padding: 4px 9px; background: var(--surface-1); color: var(--ink-1); min-width: 180px; }
.tc-filter-count { margin-left: auto; font-weight: 700; color: var(--ink-2); }
.tc-kpi.warn b { color: #b45f22; }
.tc-badge.warn { background: rgba(201,106,60,0.14); color: #b45f22; }
.tc-person.alert { border-color: rgba(201,106,60,0.4); background: rgba(201,106,60,0.035); }
.tc-chip.warn { color: #b45f22; background: rgba(201,106,60,0.12); }
.tc-chip em { font-style: normal; font-weight: 500; opacity: 0.72; margin-left: 3px; }
.tc-chips.small { margin-bottom: 10px; }
.tc-chips.small .tc-chip { font-size: 11.5px; padding: 3px 9px; }
.tc-dl dd.warn { color: #b45f22; }
.tc-skilllist { display: flex; flex-direction: column; }
.tc-skillname { flex: none; width: 150px; font-size: 12.5px; color: var(--ink-2); }
.tc-skillnum { flex: none; width: 108px; text-align: right; font-size: 12px;
  font-variant-numeric: tabular-nums; color: var(--ink-2); }
.tc-skillnum em { font-style: normal; color: var(--ink-muted); }
.tc-gbar { flex: 1; min-width: 180px; height: 10px; background: var(--grid);
  border-radius: 99px; overflow: hidden; }
.tc-gbar i { display: block; height: 100%; border-radius: 99px; background: var(--seq-550); }
.tc-gbar i.warn { background: #c96a3c; }
.tc-altrow { display: flex; justify-content: space-between; align-items: baseline; gap: 12px;
  padding: 9px 0; border-bottom: 1px solid var(--grid); }
.tc-altrow:last-child { border-bottom: 0; }
.tc-altrow > div b, .tc-person-top > div > b { display: block; }
/* 대상 구성원 고르기 — 인원이 늘어도 훑어보고 고를 수 있게 목록형으로 */
.tc-picklist { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px;
  max-height: 260px; overflow-y: auto; padding: 4px; margin-bottom: 4px; }
.tc-pick { text-align: left; font: inherit; cursor: pointer; padding: 9px 12px; border-radius: 10px;
  background: var(--surface-1); border: 1px solid var(--border); transition: border-color .14s, background .14s; }
.tc-pick:hover { border-color: color-mix(in srgb, var(--brand) 40%, transparent); }
.tc-pick.on { border-color: var(--brand); background: color-mix(in srgb, var(--brand) 7%, transparent); }
.tc-pick b { display: block; font-size: 13.5px; }
.tc-pick span { display: block; font-size: 11.5px; color: var(--ink-muted); margin-top: 2px; }
.tc-altrow .tc-sub { margin-top: 1px; }
@media (max-width: 1180px) { .tc-cards.three { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 760px) { .tc-cards, .tc-cards.three { grid-template-columns: 1fr; } }

.tc-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
.tc-chip { font-size: 12px; font-weight: 600; color: #1d6a58; background: rgba(46,139,118,0.12);
  border-radius: 999px; padding: 4px 11px; }
.tc-goal-side { display: flex; gap: 20px; align-items: center; flex-wrap: wrap;
  border-left: 1px solid var(--border); padding-left: 24px; }
@media (max-width: 900px) { .tc-goal-side { border-left: 0; padding-left: 0; } }
.tc-ring { text-align: center; }
.tc-ring span { display: block; font-size: 11.5px; color: var(--ink-muted); margin-top: 2px; }
.tc-goal-stat { display: grid; gap: 10px; }
.tc-goal-stat b { font-size: 20px; letter-spacing: -0.5px; }
.tc-goal-stat b em { font-style: normal; font-size: 13px; }
.tc-goal-stat span { display: block; font-size: 11.5px; color: var(--ink-muted); }

/* 경력경로 카드 */
.tc-paths { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
@media (max-width: 1100px) { .tc-paths { grid-template-columns: 1fr; } }
.tc-path { display: flex; flex-direction: column; background: var(--surface-1);
  border: 1px solid var(--border); border-radius: 16px; padding: 18px 20px 20px;
  transition: border-color .18s, box-shadow .18s; }
.tc-path:hover { border-color: color-mix(in srgb, var(--brand) 32%, transparent); }
.tc-path.on { border-color: var(--brand); box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 11%, transparent); }
.tc-path-head { display: flex; justify-content: space-between; align-items: flex-start;
  gap: 10px; padding-bottom: 14px; border-bottom: 1px solid var(--grid); }
.tc-path-key { font-size: 15px; font-weight: 800; letter-spacing: -0.3px; }
.tc-path-match { text-align: right; line-height: 1.15; }
.tc-path-match b { font-size: 24px; font-weight: 800; letter-spacing: -1px; color: var(--brand); }
.tc-path-match em { font-style: normal; font-size: 13px; font-weight: 700; color: var(--brand); }
.tc-path-match span { display: block; font-size: 11px; color: var(--ink-muted); }
.tc-path-steps { list-style: none; margin: 16px 0 14px; padding: 0 0 0 4px; }
.tc-path-steps li { position: relative; display: flex; gap: 10px; padding: 0 0 16px 16px; }
.tc-path-steps li:last-child { padding-bottom: 4px; }
.tc-path-steps li::before { content: ""; position: absolute; left: 4px; top: 14px; bottom: 0;
  width: 1px; background: var(--grid); }
.tc-path-steps li:last-child::before { display: none; }
.tc-path-steps li i { position: absolute; left: 0; top: 5px; width: 9px; height: 9px;
  border-radius: 99px; background: var(--surface-1); border: 2px solid var(--axis); }
.tc-path-steps li.now i { border-color: var(--ink-muted); background: var(--ink-muted); }
.tc-path-steps li.goal i { border-color: var(--brand); background: var(--brand); }
.tc-path-steps li b { display: block; font-size: 13.5px; }
.tc-path-steps li.now b { color: var(--ink-muted); font-weight: 500; }
.tc-path-steps li span { display: block; font-size: 11px; color: var(--ink-muted); margin-top: 1px; }
.tc-path-btn { margin-top: auto; width: 100%; }
.tc-path .tc-dl { margin-bottom: 16px; }

.tc-sec-head { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-top: 4px; }
.tc-sec-head h3 { margin: 0; font-size: 15px; }
.tc-sec-head span { font-size: 12.5px; }

.tc-gaps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
@media (max-width: 1180px) { .tc-gaps { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 760px) { .tc-gaps { grid-template-columns: 1fr; } }
.tc-gapcard { display: flex; flex-direction: column; background: var(--surface-1);
  border: 1px solid var(--border); border-radius: 14px; padding: 0 18px 16px;
  overflow: hidden; transition: border-color 0.25s, box-shadow 0.25s; }
/* 카드 상단 사진 — 좌우 패딩을 넘어 카드 폭을 꽉 채운다 */
.tc-course-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.tc-gapthumb { margin: 0 -18px 14px; height: 104px; overflow: hidden;
  background: linear-gradient(135deg, #dbe4f2, #eef2f8); }
.tc-gapthumb img { width: 100%; height: 100%; object-fit: cover; display: block;
  filter: saturate(0.86) contrast(1.02); transition: transform 0.5s ease; }
.tc-gapcard:hover .tc-gapthumb img { transform: scale(1.045); }
.tc-gapcard.off .tc-gapthumb img { filter: grayscale(1) opacity(0.6); }
.tc-gapcard > header { padding-top: 2px; }
.tc-gapcard:hover { border-color: color-mix(in srgb, var(--brand) 30%, transparent);
  box-shadow: 0 14px 30px -22px rgba(18,32,58,0.4); }
.tc-gapcard.on { border-color: rgba(46,139,118,0.5); background: rgba(46,139,118,0.04); }
.tc-gapcard.off { opacity: 0.55; }
.tc-gapcard-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.tc-gapcard-head b { font-size: 15px; letter-spacing: -0.3px; }
.tc-rank { font-size: 11px; font-weight: 800; color: var(--brand-soft); margin-right: 8px; }

.tc-levels { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
.tc-lv-label { font-size: 11.5px; color: var(--ink-muted); white-space: nowrap; }
.tc-lv-label.target { color: var(--brand); font-weight: 700; }
.tc-dots { display: flex; gap: 4px; flex: 1; }
.tc-dots i { flex: 1; height: 8px; border-radius: 99px; background: var(--grid); }
.tc-dots i.has { background: var(--brand); }
.tc-dots i.need { background: repeating-linear-gradient(45deg,
  rgba(46,139,118,0.55) 0 4px, rgba(46,139,118,0.2) 4px 8px); }

.tc-course { background: var(--surface-2); border-radius: 10px; padding: 12px 14px; }
.tc-course-name { font-size: 13.5px; font-weight: 700; margin-bottom: 6px; }
.tc-course .tc-dl > div { font-size: 12.5px; padding: 1px 0; }
.tc-course .tc-dl dt { width: 62px; }
.tc-gaphead { display: flex; justify-content: space-between; font-size: 13.5px; }
.tc-gapbar { position: relative; height: 10px; background: var(--grid); border-radius: 99px; margin: 8px 0 2px; overflow: hidden; }
.tc-gapbar i { position: absolute; inset: 0 auto 0 0; background: var(--seq-550); border-radius: 99px; }
.tc-gapbar em { position: absolute; top: 0; bottom: 0; background: repeating-linear-gradient(45deg, rgba(46,139,118,0.5) 0 5px, rgba(46,139,118,0.22) 5px 10px); }

.tc-steps { display: flex; gap: 6px; flex-wrap: wrap; font-size: 13px; margin: 6px 0 10px; align-items: center; }
.tc-steps i { font-style: normal; color: var(--ink-muted); margin-right: 6px; }

.tc-qrow { display: flex; justify-content: space-between; gap: 14px; align-items: center; padding: 9px 0; border-bottom: 1px solid var(--grid); flex-wrap: wrap; }
.tc-qtext { font-size: 13.5px; flex: 1; min-width: 260px; }
.tc-scale { display: flex; gap: 4px; }
.tc-scale label { width: 34px; height: 32px; display: grid; place-items: center; border: 1px solid var(--axis);
  border-radius: 8px; font-size: 13px; cursor: pointer; color: var(--ink-2); }
.tc-scale label.on { background: var(--brand); color: #fff; border-color: var(--brand); font-weight: 700; }
.tc-scale input { display: none; }

/* 상단 안내줄 + 우측 작은 버튼 */
.tc-topbar { display: flex; align-items: stretch; gap: 10px; }
.tc-topbar .tc-notice { flex: 1; }
.tc-guide-btn { flex: none; align-self: center; white-space: nowrap; display: inline-flex;
  align-items: center; gap: 6px; }
.tc-guide-btn span { display: inline-grid; place-items: center; width: 15px; height: 15px;
  border-radius: 99px; background: var(--surface-2); font-size: 10.5px; font-weight: 800; }
@media (max-width: 720px) { .tc-topbar { flex-direction: column; align-items: flex-start; } }
.lv-table td, .lv-table th { vertical-align: middle; }
.lv-no { font-weight: 800; color: var(--brand); font-variant-numeric: tabular-nums; }

/* ── 시스템 안내 ─────────────────────────────────────────────── */
.ab-hero { display: grid; grid-template-columns: 1.5fr 1fr; gap: 26px;
  background: var(--surface-1); border: 1px solid var(--border); border-radius: 18px; padding: 26px 28px; }
@media (max-width: 980px) { .ab-hero { grid-template-columns: 1fr; gap: 18px; } }
.ab-eyebrow { display: inline-block; font-size: 11px; font-weight: 800; letter-spacing: 1.4px;
  text-transform: uppercase; color: var(--brand); margin-bottom: 8px; }
.ab-hero-main h2 { margin: 0 0 12px; font-size: 24px; letter-spacing: -0.9px; line-height: 1.35; }
.ab-hero-main p { margin: 0 0 10px; font-size: 13.5px; line-height: 1.85; color: var(--ink-2); }
.ab-note { padding-left: 12px; border-left: 3px solid color-mix(in srgb, var(--brand) 40%, transparent);
  color: var(--ink-1) !important; font-weight: 600; }
.ab-facts { margin: 0; align-self: center; }
.ab-facts > div { display: flex; gap: 10px; padding: 7px 0; border-bottom: 1px solid var(--grid); font-size: 12.5px; }
.ab-facts > div:last-child { border-bottom: 0; }
.ab-facts dt { flex: none; width: 72px; color: var(--ink-muted); }
.ab-facts dd { margin: 0; color: var(--ink-2); }

.ab-flow { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
@media (max-width: 1080px) { .ab-flow { grid-template-columns: 1fr 1fr; } }
@media (max-width: 640px) { .ab-flow { grid-template-columns: 1fr; } }
.ab-flowcol { position: relative; background: var(--surface-1); border: 1px solid var(--border);
  border-radius: 14px; padding: 16px 18px 18px; }
.ab-flowcol::after { content: "→"; position: absolute; right: -13px; top: 50%; transform: translateY(-50%);
  color: var(--ink-muted); font-size: 14px; z-index: 1; }
.ab-flowcol:last-child::after { display: none; }
@media (max-width: 1080px) { .ab-flowcol::after { display: none; } }
.ab-flowhead { display: flex; gap: 10px; align-items: flex-start;
  padding-bottom: 10px; margin-bottom: 10px; border-bottom: 1px solid var(--grid); }
.ab-step { flex: none; width: 22px; height: 22px; border-radius: 99px; background: var(--brand); color: #fff;
  font-size: 11.5px; font-weight: 800; display: grid; place-items: center; }
.ab-flowhead b { display: block; font-size: 14px; letter-spacing: -0.3px; }
.ab-flowhead em { display: block; font-style: normal; font-size: 11.5px; color: var(--ink-muted); margin-top: 1px; }
.ab-flowcol ul { list-style: none; margin: 0; padding: 0; }
.ab-flowcol li { position: relative; padding-left: 13px; font-size: 12.5px; line-height: 1.65;
  color: var(--ink-2); margin-bottom: 6px; }
.ab-flowcol li::before { content: ""; position: absolute; left: 0; top: 8px; width: 4px; height: 4px;
  border-radius: 99px; background: var(--axis); }

.ab-layers { display: flex; flex-direction: column; gap: 8px; }
.ab-layer { display: flex; align-items: center; gap: 16px; background: var(--surface-1);
  border: 1px solid var(--border); border-radius: 13px; padding: 14px 18px; }
.ab-layer.todo { border-style: dashed; }
.ab-layer-no { flex: none; font-size: 15px; font-weight: 800; color: var(--brand);
  font-variant-numeric: tabular-nums; }
.ab-layer-body { flex: 1; min-width: 0; }
.ab-layer-body b { font-size: 14px; }
.ab-layer-body p { margin: 2px 0 4px; font-size: 12.5px; color: var(--ink-2); }
.ab-src { font-size: 11.5px; color: var(--ink-muted); }

.ab-map { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 12px; }
@media (max-width: 900px) { .ab-map { grid-template-columns: 1fr; } }
.ab-mapcol { background: var(--surface-1); border: 1px solid var(--border); border-radius: 14px; padding: 14px; }
.ab-maphead { font-size: 11px; font-weight: 800; letter-spacing: 0.6px; margin-bottom: 8px; padding: 0 6px; }
.ab-maphead.admin { color: var(--brand); }
.ab-maphead.emp { color: #1d6a58; }
.ab-maphead.all { color: var(--ink-muted); }
.ab-mapitem { display: block; width: 100%; text-align: left; font: inherit; cursor: pointer;
  background: none; border: 0; border-radius: 9px; padding: 8px 10px; }
.ab-mapitem:hover { background: var(--surface-2); }
.ab-mapitem b { display: block; font-size: 13px; }
.ab-mapitem span { display: block; font-size: 11.5px; color: var(--ink-muted); margin-top: 1px; }

.ab-rules { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 10px; }
.ab-rule { display: flex; gap: 11px; background: var(--surface-1); border: 1px solid var(--border);
  border-radius: 13px; padding: 14px 16px; }
.ab-rule i { flex: none; width: 20px; height: 20px; border-radius: 99px; font-style: normal;
  font-size: 11px; font-weight: 800; display: grid; place-items: center;
  background: rgba(46,139,118,0.14); color: #1d6a58; }
.ab-rule b { display: block; font-size: 13px; }
.ab-rule span { display: block; font-size: 12px; color: var(--ink-muted); line-height: 1.6; margin-top: 2px; }

.tc-overlay { position: fixed; inset: 0; background: rgba(12,18,32,0.45); z-index: 60;
  display: grid; place-items: start center; padding: 64px 20px 20px; overflow-y: auto; }
.tc-modal { background: var(--surface-1); border-radius: 16px; padding: 20px 22px; width: min(560px, 100%);
  max-height: 84vh; overflow: auto; box-shadow: 0 30px 70px -30px rgba(0,0,0,0.4); }
.tc-modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.tc-modal-head b { font-size: 15px; }
.tc-modal-head button { border: 0; background: none; font-size: 16px; cursor: pointer; color: var(--ink-muted); }

/* 토스트는 화면 위쪽 가운데 — 하단은 카드 버튼과 겹쳐 놓치기 쉽다 */
.tc-toasts { position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 8px; z-index: 70;
  width: max-content; max-width: calc(100vw - 32px); pointer-events: none; }
.tc-toast { background: #16273f; color: #fff; font-size: 13px; border-radius: 10px; padding: 11px 16px;
  max-width: 420px; text-align: center; box-shadow: 0 14px 34px -14px rgba(0,0,0,0.45);
  animation: tcToast 0.28s ease; }
@keyframes tcToast { from { opacity: 0; transform: translateY(-10px); } }

/* ── 모바일 ─────────────────────────────────────────────────── */
@media (max-width: 900px) {
  /* 사이드 메뉴를 상단 가로 스크롤 탭으로 */
  .tc-body { flex-direction: column; }
  .tc-side { width: 100%; border-right: 0; border-bottom: 1px solid var(--border);
    flex-direction: row; overflow-x: auto; gap: 6px; padding: 10px;
    -webkit-overflow-scrolling: touch; scrollbar-width: none; }
  .tc-side::-webkit-scrollbar { display: none; }
  .tc-side-group { display: flex; align-items: center; gap: 4px; margin-bottom: 0; }
  .tc-side-label { padding: 0 6px 0 2px; white-space: nowrap; }
  .tc-side button { width: auto; padding: 7px 12px; white-space: nowrap; }
  .tc-side button .no { display: none; }
  .tc-side-note { display: none; }
  .tc-main { padding: 14px 16px 48px; }

  /* 카드·표 */
  .tc-grid2, .tc-cards, .tc-cards.three, .tc-cards.two, .tc-paths,
  .tc-gaps, .tc-picklist { grid-template-columns: 1fr; }
  .tc-picklist { max-height: 220px; }
  .tc-kpis { grid-template-columns: 1fr 1fr; }
  .tc-tablewrap { overflow-x: auto; }
  .tc-dec { min-width: 720px; }
  .tc-table.lines { min-width: 640px; }
  .tc-filters { gap: 10px; }
  .tc-filters input { min-width: 140px; }
  .tc-filter-count { margin-left: 0; }
  .tc-goal-side { border-left: 0; padding-left: 0; }
  .tc-toasts { top: 10px; max-width: calc(100vw - 24px); }
  .tc-toast { font-size: 12.5px; padding: 10px 14px; }
  .tc-modal { padding: 16px; }
  .tc-overlay { padding: 40px 12px 20px; }
}
@media (max-width: 560px) {
  .tc-kpis { grid-template-columns: 1fr; }
  .tc-head h1 { font-size: 20px; }
  .tc-skillname { width: 110px; }
  .tc-skillnum { width: 88px; }
  .tc-gbar { min-width: 90px; }
}
`;
