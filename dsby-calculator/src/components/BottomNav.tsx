"use client";

import Link from "next/link";

interface BottomNavProps {
  active: "calc" | "login" | "score" | "profile";
}

export function BottomNav({ active }: BottomNavProps) {
  return (
    <nav className="bottom-nav">
      <Link href="/" className="nav-item" aria-label="计算器">
        <button className={active === "calc" ? "active" : ""}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="4" y="2" width="16" height="20" rx="2" />
            <line x1="8" y1="6" x2="16" y2="6" />
            <line x1="8" y1="10" x2="8" y2="14" />
            <line x1="12" y1="10" x2="12" y2="14" />
            <line x1="16" y1="10" x2="16" y2="14" />
            <line x1="8" y1="16" x2="8" y2="18" />
            <line x1="12" y1="16" x2="12" y2="18" />
            <line x1="16" y1="16" x2="16" y2="18" />
          </svg>
          <span>计算器</span>
        </button>
      </Link>
      <Link href="/score" className="nav-item" aria-label="比分表">
        <button className={active === "score" ? "active" : ""}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="3" y1="15" x2="21" y2="15" />
            <line x1="9" y1="3" x2="9" y2="21" />
            <line x1="15" y1="3" x2="15" y2="21" />
          </svg>
          <span>比分表</span>
        </button>
      </Link>
      <Link href="/profile" className="nav-item" aria-label="我的">
        <button className={active === "profile" ? "active" : ""}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span>我的</span>
        </button>
      </Link>
    </nav>
  );
}
