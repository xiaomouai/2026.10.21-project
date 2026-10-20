"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@ucrm/db";
import { requireUser } from "../../../lib/session";

export type OrgFormState = { error?: string } | undefined;

function slugify(name: string): string {
  // slug 必须纯 ASCII：redirect() 会把目标 URL 写入 x-action-redirect header，
  // 含中文会触发 ERR_INVALID_CHAR 500。中文直接丢弃，只保留英数片段。
  const ascii =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "org";
  // 追加短随机串保证唯一（中文名或重名时兜底）
  return `${ascii}-${Math.random().toString(36).slice(2, 6)}`;
}

/** 注册后创建组织（租户），创建人自动为 OWNER */
export async function createOrgAction(_prev: OrgFormState, formData: FormData): Promise<OrgFormState> {
  const user = await requireUser();
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "请填写组织/公司名称" };
  if (name.length > 60) return { error: "名称过长（≤60 字）" };

  const slug = slugify(name);
  const org = await prisma.organization.create({
    data: {
      name,
      slug,
      industry: String(formData.get("industry") || "") || null,
      size: String(formData.get("size") || "") || null,
      // 演示环境默认 FREE + 30 天试用
      plan: "FREE",
      status: "TRIALING",
      trialEndsAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      members: {
        create: { userId: user.id, role: "OWNER" },
      },
    },
  });
  revalidatePath("/");
  redirect(`/w/${org.slug}/dashboard`);
}
