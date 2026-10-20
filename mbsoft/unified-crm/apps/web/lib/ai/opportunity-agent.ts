import { prisma } from "@ucrm/db";

type GithubIssue = { title?: string; html_url?: string; user?: { login?: string }; repository_url?: string };

export async function runGithubOpportunityAgent(o: {
  orgId: string;
  taskId?: string | null;
  query: string;
  limit?: number;
}) {
  const startedAt = Date.now();
  const run = await prisma.agentRun.create({
    data: { orgId: o.orgId, taskId: o.taskId ?? null, agentName: "github-opportunity", source: "api", status: "STARTED", idempotencyKey: `github-opportunity:${o.orgId}:${o.query}` },
  });
  try {
    await prisma.agentRunEvent.create({ data: { runId: run.id, type: "tool_call", name: "github.search.issues", payload: { query: o.query } as never } });
    const url = `https://api.github.com/search/issues?q=${encodeURIComponent(`${o.query} is:issue`)}&per_page=${Math.min(o.limit ?? 10, 30)}`;
    const res = await fetch(url, { headers: { Accept: "application/vnd.github+json", ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) }, cache: "no-store" });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const body = (await res.json()) as { items?: GithubIssue[] };
    const issues = body.items ?? [];
    let created = 0;
    for (const issue of issues) {
      const title = String(issue.title ?? "").trim();
      const issueUrl = String(issue.html_url ?? "").trim();
      if (!title || !issueUrl) continue;
      const exists = await prisma.lead.findFirst({ where: { orgId: o.orgId, source: "GitHub", note: { contains: issueUrl } }, select: { id: true } });
      if (exists) continue;
      await prisma.lead.create({ data: { orgId: o.orgId, name: title, company: issue.repository_url?.split("/").pop() ?? null, source: "GitHub", score: 0, note: `公开需求信号，需人工确认是否构成商机。URL: ${issueUrl}\n作者: ${issue.user?.login ?? "unknown"}` } });
      created += 1;
    }
    const result = { query: o.query, fetched: issues.length, created, mode: "public-github-signal" };
    await prisma.agentRun.update({ where: { id: run.id }, data: { status: "COMPLETED", durationMs: Date.now() - startedAt, finishedAt: new Date(), result: result as never } });
    await prisma.agentRunEvent.create({ data: { runId: run.id, type: "milestone", name: "summary", payload: result as never } });
    return { ok: true, runId: run.id, ...result };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await prisma.agentRun.update({ where: { id: run.id }, data: { status: "FAILED", error, durationMs: Date.now() - startedAt, finishedAt: new Date() } });
    return { ok: false, runId: run.id, error, fetched: 0, created: 0 };
  }
}
