import "./globals.css";
import type { ReactNode } from "react";
import type { Viewport } from "next";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/store";
import NavBar from "@/components/NavBar";

// 全局依赖会话与 SQLite，禁止构建期静态化（避免构建期打开数据库）
export const dynamic = "force-dynamic";

export const metadata = {
  title: "好宝宝育儿知识库 · 会员专区",
  description: "3-8月龄宝宝睡眠排查、抱睡落地醒、夜奶戒断——系统化教程 + 打卡积分 + 妈妈论坛",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // 适配 iPhone 刘海/底部安全区
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const user = getCurrentUser();
  const checkIns = user ? db.getCheckInsByUser(user.id) : [];
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const checkedToday = checkIns.some((c) => c.date === todayStr);

  return (
    <html lang="zh-CN">
      <body>
        <NavBar user={user} checkedToday={checkedToday} />
        <main className="app-shell">{children}</main>
        <footer className="footer">
          好宝宝育儿知识库 为中国智慧妈妈培养好宝宝 | 内容为健康教育参考，不替代儿科医生评估
        </footer>
      </body>
    </html>
  );
}
