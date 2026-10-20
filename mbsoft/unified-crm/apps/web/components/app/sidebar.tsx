"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  Magnet,
  Target,
  PhoneCall,
  Bot,
  ClipboardList,
  Settings,
  Activity,
  Sparkles,
  BarChart3,
} from "lucide-react";
import { cn } from "../../lib/cn";

const navGroups: {
  label: string;
  items: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
}[] = [
  {
    label: "",
    items: [{ href: "/dashboard", label: "销售总览", icon: LayoutDashboard }],
  },
  {
    label: "客户管理",
    items: [
      { href: "/crm/companies", label: "企业客户", icon: Building2 },
      { href: "/crm/contacts", label: "联系人", icon: Users },
      { href: "/crm/leads", label: "销售线索", icon: Magnet },
      { href: "/crm/opportunities", label: "商机", icon: Target },
      { href: "/crm/activities", label: "跟进活动", icon: PhoneCall },
      { href: "/sales/okr", label: "销售 OKR", icon: BarChart3 },
    ],
  },
  {
    label: "AI Agent 协作",
    items: [
      { href: "/dev/agent-jobs", label: "编码任务日志", icon: ClipboardList },
      { href: "/dev/agent-runs", label: "Agent 运行记录", icon: Bot },
      { href: "/settings/ai", label: "AI 能力", icon: Sparkles },
    ],
  },
  {
    label: "组织",
    items: [{ href: "/settings/members", label: "成员与组织", icon: Settings }],
  },
];

export function Sidebar({ slug }: { slug: string }) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-border bg-surface">
      <Link href={`/w/${slug}/dashboard`} className="flex items-center gap-2 px-5 py-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
          U
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight text-slate-900">UniCRM</p>
          <p className="text-[11px] leading-tight text-slate-400">SME · SaaS</p>
        </div>
      </Link>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
        {navGroups.map((g, i) => (
          <div key={i}>
            {g.label && (
              <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {g.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {g.items.map((item) => {
                const href = `/w/${slug}${item.href}`;
                const active =
                  pathname === href ||
                  (item.href !== "/dashboard" && pathname.startsWith(href));
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                        active
                          ? "bg-indigo-50 text-indigo-700"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      )}
                    >
                      <Icon className={cn("size-4", active ? "text-indigo-600" : "text-slate-400")} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2">
          <Activity className="size-3.5 text-emerald-500" />
          <span className="text-xs text-slate-500">数据隔离：按组织</span>
        </div>
      </div>
    </aside>
  );
}
