import { NextResponse } from "next/server";
import {
  enrichEntityAction,
  applyFactAction,
  dismissFactAction,
  listFactsAction,
} from "../../../../lib/actions/aiFact";

/**
 * AI 建档 dev 接口 [AI·NEW]
 *
 * 与 /api/dev/agent-jobs 同属开发/外部上报通道，用途：
 *   - 外部系统或调度器（P1 租约队列）触发建档
 *   - 冒烟与自动化验证
 * 鉴权：使用当前登录会话（cookie），并校验该用户属于 orgSlug 对应组织。
 *
 * GET    ?orgSlug=&entityType=&entityId=           → 列出提案与最近运行
 * POST   { orgSlug, entityType, entityId, force? } → 触发建档（只产出 PROPOSED）
 * PATCH  { orgSlug, factId, action }               → apply / dismiss
 */

const ENTITIES = new Set(["LEAD", "COMPANY"]);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get("orgSlug") ?? "";
  const entityType = (url.searchParams.get("entityType") ?? "").toUpperCase();
  const entityId = url.searchParams.get("entityId") ?? "";
  if (!orgSlug || !ENTITIES.has(entityType) || !entityId) {
    return NextResponse.json({ error: "orgSlug / entityType / entityId 必填" }, { status: 400 });
  }
  const r = await listFactsAction(orgSlug, entityType, entityId);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}

export async function POST(req: Request) {
  let body: { orgSlug?: string; entityType?: string; entityId?: string; force?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON 解析失败" }, { status: 400 });
  }
  const { orgSlug, entityType, entityId, force } = body;
  if (!orgSlug || !entityType || !entityId) {
    return NextResponse.json({ error: "orgSlug / entityType / entityId 必填" }, { status: 400 });
  }
  const type = entityType.toUpperCase();
  if (!ENTITIES.has(type)) {
    return NextResponse.json({ error: "entityType 只能是 LEAD / COMPANY" }, { status: 400 });
  }
  const r = await enrichEntityAction(orgSlug, type, entityId, Boolean(force));
  return NextResponse.json(r, { status: r.ok ? 201 : 400 });
}

export async function PATCH(req: Request) {
  let body: { orgSlug?: string; factId?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON 解析失败" }, { status: 400 });
  }
  const { orgSlug, factId, action } = body;
  if (!orgSlug || !factId || !action) {
    return NextResponse.json({ error: "orgSlug / factId / action 必填" }, { status: 400 });
  }
  const r =
    action === "apply"
      ? await applyFactAction(orgSlug, factId)
      : action === "dismiss"
        ? await dismissFactAction(orgSlug, factId)
        : { ok: false as const, error: "action 只能是 apply / dismiss" };
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
