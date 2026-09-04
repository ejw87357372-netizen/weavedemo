import Link from "next/link";
import { SKILLS, SKILL_EDGES, EMPLOYEES, TEAMS, PROJECTS, teamSkillMatrix, skillName } from "@/lib/data";
import { QUESTIONS } from "@/lib/survey";
import { TARGET_ROLES } from "@/lib/skillcheck";
import { OntologyGraph, Heatmap, HBarChart } from "@/components/charts";
import Reveal from "@/components/Reveal";
import HeroMark from "@/components/HeroMark";
import WeaveVeil from "@/components/WeaveVeil";

// status: "done" 완료 · "now" 진행 중 · "todo" 예정 — 단계가 바뀌면 여기만 고치면 된다
const PROCESS = [
  ["01", "문헌 검토", "UTAUT·프라이버시·알고리즘 공정성 선행연구", "done"],
  ["02", "프로토타입", "수용성·스킬 진단 웹 도구 구현", "done"],
  ["03", "심층 인터뷰", "인사·인적자원개발 담당자 대상 질적 조사", "done"],
  ["04", "설문조사", "도입 전 구성원 수용 요인, 목표 150명", "done"],
  ["05", "분석·제언", "위계적 회귀 후 시스템 구축 방향 도출", "done"],
];

const FEATURES = [
  { kicker: "직원 관점", title: "수용성 진단", href: "/survey",
    desc: "확장 UTAUT 24문항에 답하면 수용 의도와 6개 요인 프로필, 가장 큰 저해 요인에 대한 개선 권고를 즉시 돌려줍니다." },
  { kicker: "직원 관점", title: "스킬 진단", href: "/skill-check",
    desc: "희망 직무를 고르고 보유 스킬을 입력하면 과업별 충족도, 부족 스킬과 추천 교육, 목표까지의 경력 경로를 제시합니다." },
  { kicker: "HR 관점", title: "조직 대시보드", href: "/dashboard",
    desc: "팀×스킬 히트맵으로 현황을 읽고, 한 명에게만 있는 스킬을 자동 탐지합니다. 퇴사 영향과 12개월 인력 전망도 계산합니다.",
    sub: [["인재 프로필", "/people"], ["시뮬레이션", "/simulation"], ["스킬 갭 분석", "/gap"]] },
];

export default function Home() {
  const matrix = teamSkillMatrix();

  return (
    <>
      {/* ── 히어로 ── */}
      <section className="hero-light">
        <WeaveVeil />
        <div className="aurora"><i /><i /><i /></div>
        <div className="grain" />
        <div className="hero-inner">
          <div className="trust-row">
            <span className="trust"><i />성균관대 AI융합운영전공 학술연구</span>
            <span className="trust"><i />확장 UTAUT 모형</span>
            <span className="trust"><i />공식 통계 기반 · 가상 데이터 시연</span>
          </div>
          <div className="hero-logo"><HeroMark /></div>
          <h1 className="hero-en">People leave.<br /><span className="grad">Skills weave.</span></h1>
          <div className="hero-sub-ko">조직의 스킬을 실시간으로 읽는다</div>
          <p className="lede">
            AI 기반 인재관리 시스템의 프로토타입을 만들었습니다.<br />
            이제 남은 질문은, 구성원이 이 시스템을 받아들이는가입니다.
          </p>
          <div className="cta-row">
            <div className="cta-group">
              <span className="cta-group-label">직원</span>
              <div style={{ display: "flex", gap: 8 }}>
                <Link href="/survey" className="btn btn-pill">수용성 진단</Link>
                <Link href="/skill-check" className="btn btn-ghost btn-pill">스킬 진단</Link>
              </div>
            </div>
            <div className="cta-group">
              <span className="cta-group-label">인사담당자</span>
              <div style={{ display: "flex", gap: 8 }}>
                <Link href="/dashboard" className="btn btn-ghost btn-pill">조직 대시보드</Link>
                <Link href="/gap" className="btn btn-ghost btn-pill">스킬 갭 분석</Link>
              </div>
            </div>
          </div>

          <div className="stat-strip on-light">
            <div><div className="big">{QUESTIONS.length}<em>문항</em></div><div className="cap">확장 UTAUT 측정도구</div></div>
            <div><div className="big">6<em>요인</em></div><div className="cap">+ 종속변수 수용 의도</div></div>
            <div><div className="big">150<em>명</em></div><div className="cap">본조사 목표 표본</div></div>
            <div><div className="big">{SKILLS.length}<em>개</em></div><div className="cap">온톨로지 스킬 노드</div></div>
          </div>
        </div>
      </section>

      {/* 패널 경계를 가로지르는 제품 화면 */}
      <div className="hero-shot-wrap">
        <Reveal>
          <div className="hero-shot">
            <div className="hero-shot-bar">
              <span className="hero-shot-dot" /><span className="hero-shot-dot" /><span className="hero-shot-dot" />
              <span className="hero-shot-url">weave · 조직 대시보드</span>
            </div>
            <div className="hero-shot-body" style={{ textAlign: "left" }}>
              <div className="grid grid-4" style={{ marginBottom: 16 }}>
                {[[EMPLOYEES.length, "가상 직원"], [TEAMS.length, "팀"],
                  [TARGET_ROLES.length, "직무"], [PROJECTS.length, "진행 프로젝트"]].map(([v, label]) => (
                  <div key={label}>
                    <div className="stat-value num">{v}</div>
                    <div className="stat-label">{label}</div>
                  </div>
                ))}
              </div>
              <Heatmap rows={matrix} cols={SKILLS} colLabel={(c) => skillName(c.id)} />
            </div>
          </div>
        </Reveal>
      </div>

      {/* ── 연구 프로세스 ── */}
      <Reveal>
        <div className="section-head">
          <div className="eyebrow">Research Process</div>
          <h2>연구는 다섯 단계로 진행되었습니다</h2>
        </div>
        <div className="process">
          {PROCESS.map(([no, title, desc]) => (
            <div key={no} className="step">
              <span className="step-dot">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                     strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7" />
                </svg>
              </span>
              <div className="step-body">
                <div className="step-no">Step {no}</div>
                <strong>{title}</strong>
                <span>{desc}</span>
              </div>
            </div>
          ))}
        </div>
      </Reveal>

      {/* ── 온톨로지 ── */}
      <Reveal>
        <div className="section-head">
          <div className="eyebrow">Skill Ontology</div>
          <h2>스킬은 서로 연결되어 있다</h2>
          <p style={{ maxWidth: "none" }}>
            AI 인재관리 시스템의 데이터 기반이 되는 직무군–직무–과업–스킬 계층을 구조화했습니다.<br />
            배치는 연결 구조가 스스로 만든 것이고, 노드 크기는 연결 수에 비례합니다.<br />
            가장 큰 노드가 곧 이 조직에서 전이 가능성이 가장 높은 스킬입니다.
          </p>
        </div>
        <div className="card">
          <OntologyGraph skills={SKILLS} edges={SKILL_EDGES} />
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8 }}>
            <span className="badge"><i style={dot("var(--series-1)")} />설계</span>
            <span className="badge"><i style={dot("var(--series-2)")} />공정</span>
            <span className="badge"><i style={dot("var(--series-3)")} />품질</span>
            <span className="badge"><i style={dot("var(--series-7)")} />데이터·AI</span>
            <span className="badge"><i style={dot("var(--series-4)")} />경영지원</span>
          </div>
          <p className="hint" style={{ marginTop: 10 }}>
            NCS 분류 원리를 기준으로 ESCO·O*NET 구조를 참고해 구성했습니다. 가상의 반도체 기업
            &lsquo;세미코어&rsquo;를 예시로 한 데이터이며, 실제 NCS 코드와 1:1로 매핑되지는 않습니다.
          </p>
        </div>
      </Reveal>

      {/* ── 만든 것 ── */}
      <Reveal>
        <div className="section-head">
          <div className="eyebrow">What We Built</div>
          <h2>직원이 보는 화면과 회사가 보는 화면</h2>
          <p>같은 시스템을 양쪽에서 만들어 보면, 바로 그 비대칭이 프라이버시·공정성 우려의 출처라는 것이 드러납니다.</p>
        </div>
      </Reveal>
      <div className="grid grid-3">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={i * 90}>
            <div className="feature-wrap">
            <Link href={f.href} className="feature-card" style={{ display: "block" }}>
              <div className="kicker">{f.kicker}</div>
              <strong>{f.title}</strong>
              <p>{f.desc}</p>
              <span className="feature-go">바로 해보기 →</span>
            </Link>
            {f.sub && (
              <div className="feature-sub">
                {f.sub.map(([label, href]) => (
                  <Link key={href} href={href}>{label}</Link>
                ))}
              </div>
            )}
            </div>
          </Reveal>
        ))}
      </div>

      {/* ── 산업 동향 ── */}
      <Reveal>
        <div className="section-head">
          <div className="eyebrow">Labor Market</div>
          <h2>이직이 잦은 산업일수록 효용이 커집니다</h2>
          <p style={{ maxWidth: "none" }}>전체 취업자 2,915.4만명(2026.6), 전 산업 월 이직률 4.9%(2026.5)는 국가데이터처·고용노동부 공표치입니다. 아래 산업별 수치는 상대 수준을 보이기 위한 예시값입니다.</p>
        </div>
        <div className="card">
          <HBarChart
            items={[
              { label: "숙박·음식점업", value: 8.1 },
              { label: "건설업", value: 7.9 },
              { label: "예술·스포츠·여가", value: 5.9 },
              { label: "전 산업 평균", value: 4.9, color: "var(--brand-soft)" },
              { label: "제조업", value: 2.9 },
              { label: "공공행정·교육", value: 2.0 },
            ]}
            unit="%"
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 6 }}>
            <span className="hint">산업별 월 이직률(전 산업 평균만 공표치, 나머지는 예시값). 출처와 국제 비교는 산업 동향에서 확인할 수 있습니다.</span>
            <Link href="/industry" className="btn btn-ghost btn-pill">산업 동향 보기 →</Link>
          </div>
        </div>
      </Reveal>

    </>
  );
}

function dot(color) {
  return { display: "inline-block", width: 9, height: 9, borderRadius: 99, background: color };
}
