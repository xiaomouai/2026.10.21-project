import { NextResponse } from "next/server";
import { z } from "zod";
import { enqueueGithubOpportunityTask, dispatchOnce } from "../../../../lib/ai/dispatch";
import { resolveApiOrg } from "../../../../lib/api-auth";

const schema = z.object({ orgSlug: z.string().min(1).optional(), query: z.string().min(2).max(120), runNow: z.boolean().default(true) });

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message }, { status: 400 });
  const auth = await resolveApiOrg(req, parsed.data.orgSlug);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  const task = await enqueueGithubOpportunityTask({ orgId: auth.orgId, query: parsed.data.query });
  if (!parsed.data.runNow) return NextResponse.json({ ok: true, task });
  const result = await dispatchOnce({ orgId: auth.orgId, lane: "fast", limit: 1 });
  return NextResponse.json({ ok: true, task, result });
}
