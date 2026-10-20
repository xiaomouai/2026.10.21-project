import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";

export async function POST() {
  clearSession();
  return NextResponse.json({ message: "已退出登录" });
}
