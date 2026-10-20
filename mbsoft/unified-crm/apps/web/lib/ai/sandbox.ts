import { prisma } from "@ucrm/db";

/**
 * 浏览器 Agent 沙箱适配器 [AI·NEW · P3-3]
 * --------------------------------------------------------------------------
 * E2B 类沙箱用于「让 Agent 在隔离环境里跑代码 / 抓网页 / 调 API」，其产出的事实
 * 仍走 AiFact 证据闸门（PROPOSED → 人采纳才落主表），与本地建档引擎完全一致。
 *
 * 本文件是可插拔骨架：
 *   - 未配置 E2B_API_KEY：runInSandbox 返回 disabled，提示降级（不破坏 dev）
 *   - 已配置 E2B_API_KEY：在 runInSandbox 内接入 @e2b/sdk（需 npm i @e2b/sdk），
 *     把沙箱结果规整为 SandboxFact[]，再经 persistSandboxFacts 写入 AiFact
 *
 * 关键约束：沙箱产出绝不直接写主表，必须过 AiFact 闸门（humanOwns / 置信带 / 无 Key 降级）。
 */

export type SandboxFact = {
  entityType: "COMPANY" | "LEAD" | "CONTACT";
  entityId: string;
  field: string;
  value: string;
  confidence: number;
  evidence: { type: string; sourceUrl?: string; snippet?: string }[];
};

function bandFor(c: number): string {
  if (c >= 0.85) return "VERIFIED";
  if (c >= 0.6) return "PROBABLE";
  return "POSSIBLE";
}

export type SandboxTask = {
  orgId: string;
  prompt: string;
  entityType?: "COMPANY" | "LEAD" | "CONTACT";
  entityId?: string;
};

export type SandboxResult = {
  ok: boolean;
  mode: "e2b" | "disabled";
  message: string;
  facts?: SandboxFact[];
};

/**
 * 在沙箱中执行 Agent 任务。
 * 当前为降级骨架：无 SDK 时不实际执行，仅返回降级说明；接入点已预留。
 */
export async function runInSandbox(task: SandboxTask): Promise<SandboxResult> {
  const key = process.env.E2B_API_KEY;
  if (!key) {
    return {
      ok: false,
      mode: "disabled",
      message:
        "E2B 未配置（E2B_API_KEY 缺失）：沙箱型 Agent 在本环境降级为不可用。" +
        "产出事实仍可通过 AiFact 闸门手动写入（调用 persistSandboxFacts）。",
    };
  }

  // —— 接入点（需 npm i @e2b/sdk）——
  // import { Sandbox } from "@e2b/sdk";
  // const sb = await Sandbox.create({ apiKey: key });
  // const out = await sb.runCode(task.prompt);  // 或 sb.commands.run(...)
  // const facts: SandboxFact[] = normalize(out);  // 把沙箱结果规整为 SandboxFact[]
  // await persistSandboxFacts(task.orgId, facts);
  // await sb.close();
  // return { ok: true, mode: "e2b", message: "沙箱执行完成", facts };
  return {
    ok: false,
    mode: "e2b",
    message:
      "E2B_API_KEY 已配置，但 @e2b/sdk 未安装。请 `npm i @e2b/sdk` 并在 runInSandbox 内取消注释接入代码。" +
      "产出仍经 AiFact 闸门（persistSandboxFacts）写入 PROPOSED 提案。",
  };
}

/**
 * 把沙箱产出写入 AiFact 证据账本（PROPOSED，不碰主表）。
 * 与本地建档引擎共用同一张表 / 同一套闸门，人采纳后才落主表。
 */
export async function persistSandboxFacts(orgId: string, facts: SandboxFact[]): Promise<{ count: number }> {
  let count = 0;
  for (const f of facts) {
    const band = bandFor(f.confidence);
    await prisma.aiFact.create({
      data: {
        orgId,
        entityType: f.entityType,
        entityId: f.entityId,
        field: f.field,
        value: f.value,
        currentValue: null,
        confidence: f.confidence,
        band,
        evidence: f.evidence as never,
        status: "PROPOSED",
        reason: null,
      },
    });
    count += 1;
  }
  return { count };
}
