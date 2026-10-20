import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import AdminShell from "@/components/admin/AdminShell";
import "../admin.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "后台管理 · 好宝宝育儿知识库",
};

// 受保护的布局：非管理员一律跳登录页
export default function AdminDashboardLayout({ children }: { children: ReactNode }) {
  const admin = getAdminUser();
  if (!admin) redirect("/admin/login");

  return (
    <AdminShell user={{ nickname: admin.nickname, email: admin.email }}>{children}</AdminShell>
  );
}
