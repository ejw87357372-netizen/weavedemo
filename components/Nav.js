"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Mark from "@/components/Mark";

/* 그룹 라벨 없이 평평하게 — 설문 참여(수용성 진단)만 CTA 버튼으로 분리 */
const LINKS = [
  { href: "/", label: "소개" },
  { href: "/system", label: "AI 시스템" },
  { href: "/dashboard", label: "대시보드" },
  { href: "/industry", label: "산업 동향" },
  { href: "/skill-check", label: "스킬 진단" },
];

export default function Nav() {
  const path = usePathname();
  const active = (href) => path === href || (href !== "/" && path.startsWith(href));
  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/" className="nav-logo">
          <Mark size={20} style={{ verticalAlign: "-4px", marginRight: 8, color: "var(--series-1)" }} />
          <span>Weave</span>
        </Link>
        <div className="nav-links">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={active(l.href) ? "active" : ""}>
              {l.label}
            </Link>
          ))}
        </div>
        <Link href="/survey" className="nav-cta">수용성 진단</Link>
      </div>
    </nav>
  );
}
