import type { Metadata } from "next";
import { prisma } from "@ucrm/db";
import { requireUser } from "../../../../../lib/session";
import { requireOrg } from "../../../../../lib/org";
import { detectAiCapabilities } from "../../../../../lib/ai/capabilities";
import { getLlmConfigView } from "../../../../../lib/actions/llmConfig";
import { Card, PageHeader, Badge, Th, Td } from "../../../../../components/ui/primitives";
import { AiDispatchConsole } from "../../../../../components/ai/ai-dispatch-console";
import { AiDraftGenerator } from "../../../../../components/ai/ai-draft-generator";
import { AiProviderSettings } from "../../../../../components/ai/ai-provider-settings";
import { fmtDate } from "../../../../../lib/fmt";

export const metadata: Metadata = { title: "AI 能力" };
export const dynamic = "force-dynamic";

const AI_AGENTS = ["lead-enrich", "company-enrich"];

export default async function AiSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const org = await requireOrg(slug, user.id);

  const caps = await detectAiCapabilities();
  const llmView = await getLlmConfigView();
  const runs = await prisma.agentRun.findMany({
    where: { orgId: org.id, agentName: { in: AI_AGENTS } },
    orderBy: { startedAt: "desc" },
    take: 10,
  });
  const [proposed, applied] = await Promise.all([
    prisma.aiFact.count({ where: { orgId: org.id, status: "PROPOSED" } }),
    prisma.aiFact.count({ where: { orgId: org.id, status: "APPLIED" } }),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <PageHeader
        title="AI 能力"
        desc="AI 只产出提案，采纳后才写入业务数据；所有写入保留证据与来源，可回放"
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <h2 className="text-[14px] font-medium text-slate-900">当前模式</h2>
            <Badge tone={caps.degraded ? "amber" : "green"}>{caps.degraded ? "降级（规则推断）" : "LLM"}</Badge>
          </div>
          <dl className="mt-3 space-y-1.5 text-[13px] text-slate-600">
            <div className="flex justify-between">
              <dt>Provider</dt>
              <dd className="text-slate-900">{caps.provider ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt>模型</dt>
              <dd className="text-slate-900">{caps.model}</dd>
            </div>
            <div className="flex justify-between">
              <dt>端点</dt>
              <dd className="max-w-56 truncate text-slate-900">{caps.baseUrl ?? "—"}</dd>
            </div>
          </dl>
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[12px] leading-relaxed text-slate-500">
            {caps.note}
          </p>
          {caps.degraded && (
            <p className="mt-2 text-[12px] text-slate-400">
              在下方「模型供应商配置」填写 Key 保存即生效；或在后端 .env 配置
              <code className="rounded bg-slate-100 px-1">DASHSCOPE_API_KEY</code> 等（重启生效）。
              未配置时系统仍可完整演示。
            </p>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-[14px] font-medium text-slate-900">提案概况</h2>
          <dl className="mt-3 space-y-1.5 text-[13px] text-slate-600">
            <div className="flex justify-between">
              <dt>待确认提案</dt>
              <dd>
                <Badge tone="amber">{proposed}</Badge>
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>已采纳写入</dt>
              <dd>
                <Badge tone="green">{applied}</Badge>
              </dd>
            </div>
          </dl>
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[12px] leading-relaxed text-slate-500">
            置信度由证据权重表合成（官网 0.85 / 工商 0.9 / 模型先验 0.45 / 本地规则 0.4），
            不采信模型自评；低于 0.3 的提案直接丢弃，不入库。
          </p>
        </Card>
      </div>

      <div className="mt-4">
        <h2 className="mb-2 text-[14px] font-medium text-slate-900">模型供应商配置</h2>
        <AiProviderSettings slug={slug} initial={llmView} />
      </div>

      <div className="mt-4">
        <h2 className="mb-2 text-[14px] font-medium text-slate-900">Agent 调度台</h2>
        <AiDispatchConsole slug={slug} />
      </div>

      <div className="mt-4">
        <h2 className="mb-2 text-[14px] font-medium text-slate-900">邮件草稿</h2>
        <AiDraftGenerator slug={slug} />
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3 text-[14px] font-medium text-slate-900">
          最近运行
        </div>
        {runs.length === 0 ? (
          <p className="px-5 py-8 text-center text-[13px] text-slate-500">
            暂无运行记录。在「企业客户」或「销售线索」列表点「AI 建档」即可触发。
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead className="bg-slate-50">
                <tr>
                  <Th>Agent</Th>
                  <Th>模式</Th>
                  <Th>模型</Th>
                  <Th>耗时</Th>
                  <Th>结果</Th>
                  <Th>时间</Th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => {
                  const res = r.result as { mode?: string; factCount?: number; summary?: string } | null;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/60">
                      <Td className="text-[13px]">{r.agentName}</Td>
                      <Td>
                        <Badge tone={res?.mode === "llm" ? "green" : "amber"}>
                          {res?.mode === "llm" ? "LLM" : "规则"}
                        </Badge>
                      </Td>
                      <Td className="text-[13px] text-slate-500">{r.modelId ?? "—"}</Td>
                      <Td className="text-[13px] text-slate-500">{r.durationMs != null ? `${r.durationMs}ms` : "—"}</Td>
                      <Td className="text-[13px]">
                        {r.status === "FAILED" ? (
                          <span className="text-rose-600">{r.error ?? "失败"}</span>
                        ) : (
                          res?.summary ?? `产出 ${res?.factCount ?? 0} 条`
                        )}
                      </Td>
                      <Td className="text-xs text-slate-400">{fmtDate(r.startedAt)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
