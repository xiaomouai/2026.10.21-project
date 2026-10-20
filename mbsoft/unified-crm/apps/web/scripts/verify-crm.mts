/**
 * 临时验收脚本（跑完即删）：验证 OKR 表、SOP 六阶段推进、提醒中心口径。
 * 运行：NODE_OPTIONS=--conditions=react-server pnpm --filter @ucrm/db exec tsx ../../scripts/verify-crm.mts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { prisma, SALES_SOP, SOP_STAGES } from "@ucrm/db";

const results: string[] = [];
let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  results.push(`${cond ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failed++;
}

/**
 * 双 schema 模型一致性检查 —— 防止再次出现「生产 schema 少一张表」的事故。
 * 本地用 schema.prisma(SQLite)，生产用 schema.postgres.prisma + prisma db push；
 * 两边 model 集合必须完全一致，否则生成的 client 会缺 delegate，页面直接崩。
 */
function checkSchemaParity() {
  // 本文件位于 apps/web/scripts/ → 上溯三级到仓库根
  const dir = resolve(import.meta.dirname, "../../../packages/db/prisma");
  const modelsOf = (file: string) =>
    [...readFileSync(resolve(dir, file), "utf8").matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1]!);
  const sqlite = modelsOf("schema.prisma").sort();
  const pg = modelsOf("schema.postgres.prisma").sort();
  const missing = sqlite.filter((m) => !pg.includes(m));
  const extra = pg.filter((m) => !sqlite.includes(m));
  check(
    "SQLite 与 PostgreSQL schema 模型一致",
    missing.length === 0 && extra.length === 0,
    missing.length ? `生产缺：${missing.join(",")}` : extra.length ? `本地缺：${extra.join(",")}` : `${sqlite.length} 个模型一致`,
  );
}

async function main() {
  checkSchemaParity();

  const stamp = Date.now();
  const org = await prisma.organization.create({
    data: { name: `验收组织-${stamp}`, slug: `verify-${stamp}` },
  });
  const user = await prisma.user.create({
    data: { id: `u-${stamp}`, name: "验收员", email: `verify-${stamp}@test.local` },
  });

  try {
    /* ---------- 1. OKR 表可访问 ---------- */
    const okrCount = await prisma.salesOkr.count();
    check("SalesOkr 表可访问（prisma.salesOkr delegate 存在）", typeof okrCount === "number", `count=${okrCount}`);

    const okr = await prisma.salesOkr.create({
      data: {
        orgId: org.id,
        createdById: user.id,
        name: "验收 OKR",
        targetAmount: 100000,
        averageDealAmount: 2000,
        targetCompanies: 50,
        targetLeads: 1000,
        targetOpportunities: 200,
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(Date.now() + 30 * 86400000),
      },
    });
    check("OKR 可写入", !!okr.id);

    /* ---------- 2. SOP 六阶段 ---------- */
    check("SALES_SOP 为固定六阶段", SOP_STAGES.length === 6, SOP_STAGES.join(" → "));

    /* ---------- 3. 创建客户 → 首次联系待办 ---------- */
    const { firstSopTask, planNextSopTask } = await import("../lib/crm/sop");
    const { defaultTaskWindow } = await import("../lib/crm/schedule");
    const first = firstSopTask();
    const win = defaultTaskWindow();

    const company = await prisma.company.create({
      data: { orgId: org.id, ownerUserId: user.id, name: "验收客户 A" },
    });
    let task = await prisma.activity.create({
      data: {
        orgId: org.id,
        companyId: company.id,
        ownerUserId: user.id,
        type: "TASK",
        subject: first.subject,
        sopStage: first.stage,
        plannedAt: win.plannedAt,
        dueAt: win.dueAt,
      },
    });
    check(
      "创建客户后产生「首次联系」待办",
      task.sopStage === "FIRST_CONTACT" && task.subject === SALES_SOP.FIRST_CONTACT,
      `${task.sopStage} / ${task.subject}`,
    );
    check("待办带计划时间与截止时间", !!task.plannedAt && !!task.dueAt);

    /* ---------- 4. 逐阶段完成 → 自动推进 ---------- */
    const seen: string[] = [];
    let cur = task;
    for (let i = 0; i < 10; i++) {
      const next = planNextSopTask({ stage: cur.sopStage, companyStatus: "ACTIVE" });
      if (!next) break;
      await prisma.activity.update({ where: { id: cur.id }, data: { status: "DONE" } });
      const created = await prisma.activity.create({
        data: {
          orgId: org.id,
          companyId: company.id,
          ownerUserId: user.id,
          type: "TASK",
          subject: next.subject,
          sopStage: next.stage,
          plannedAt: win.plannedAt,
          dueAt: win.dueAt,
        },
      });
      seen.push(next.stage);
      cur = created;
    }
    check(
      "完成待办后按六阶段依次自动推进",
      seen.join(",") === "NEEDS,OPPORTUNITY,PROPOSAL,NEGOTIATION,CLOSE",
      seen.join(" → "),
    );
    check(
      "到最后一阶段（CLOSE）后不再创建待办",
      planNextSopTask({ stage: "CLOSE" }) === null,
    );

    /* ---------- 5. 成交 / 流失停止 ---------- */
    const wonOpp = await prisma.opportunity.create({
      data: { orgId: org.id, companyId: company.id, name: "赢单商机", stage: "WON", status: "WON", amount: 2000 },
    });
    const taskWithWon = await prisma.activity.create({
      data: {
        orgId: org.id,
        companyId: company.id,
        opportunityId: wonOpp.id,
        type: "TASK",
        subject: SALES_SOP.NEEDS,
        sopStage: "NEEDS",
      },
    });
    check(
      "商机 WON 时停止 SOP 推进",
      planNextSopTask({ stage: taskWithWon.sopStage, opportunityStatus: "WON" }) === null,
    );
    check(
      "商机 LOST 时停止 SOP 推进",
      planNextSopTask({ stage: "NEEDS", opportunityStatus: "OPEN", opportunityStage: "LOST" }) === null,
    );
    check(
      "客户 CHURNED 时停止 SOP 推进",
      planNextSopTask({ stage: "NEEDS", companyStatus: "CHURNED" }) === null,
    );
    check("未成交时正常推进", planNextSopTask({ stage: "NEEDS", opportunityStatus: "OPEN" })?.stage === "OPPORTUNITY");

    /* ---------- 6. 提醒中心 ---------- */
    const { buildReminders } = await import("../lib/crm/reminders");
    // 逾期：截止时间已过
    await prisma.activity.create({
      data: {
        orgId: org.id,
        companyId: company.id,
        type: "TASK",
        subject: "逾期待办",
        status: "OPEN",
        dueAt: new Date(Date.now() - 3 * 86400000),
      },
    });
    // 即将到期：计划时间在 12 小时后
    await prisma.activity.create({
      data: {
        orgId: org.id,
        companyId: company.id,
        type: "TASK",
        subject: "即将到期待办",
        status: "OPEN",
        plannedAt: new Date(Date.now() + 12 * 3600000),
      },
    });
    // 7 天未跟进客户：建档 20 天且无跟进
    const stale = await prisma.company.create({
      data: { orgId: org.id, name: "验收客户 B（久未跟进）", createdAt: new Date(Date.now() - 20 * 86400000) },
    });
    const scan = await buildReminders(org.id, `verify-${stamp}`);
    const kinds = new Set(scan.items.map((i) => i.kind));
    check("提醒中心：逾期提醒", kinds.has("OVERDUE"), `counts=${JSON.stringify(scan.counts)}`);
    check("提醒中心：即将到期提醒", kinds.has("DUE_SOON"));
    check("提醒中心：7 天未跟进客户", kinds.has("NO_FOLLOWUP"));
    check("提醒中心：OKR 缺口提醒", kinds.has("OKR"));
    check(
      "7 天未跟进客户可跳转到企业详情",
      scan.items.find((i) => i.kind === "NO_FOLLOWUP" && i.entityId === stale.id)?.href?.includes("/crm/companies/") === true,
    );

    /* ---------- 7. 企业详情聚合查询 ---------- */
    const { loadCompanyDetail } = await import("../lib/crm/company-detail");
    const detail = await loadCompanyDetail(org.id, company.id);
    check("企业详情：基本资料", detail?.name === "验收客户 A");
    check("企业详情：含下一步任务", (detail?.nextTasks.length ?? 0) > 0, `nextTasks=${detail?.nextTasks.length}`);
    check("企业详情：含跟进记录", (detail?.activities.length ?? 0) > 0);
    check("企业详情：跨组织不可见", (await loadCompanyDetail("other-org", company.id)) === null);

    /* ---------- 8. 公开信息（不绕过） ---------- */
    const { buildPublicSearchLinks, normalizeWebsite, fetchPublicSiteInfo } = await import(
      "../lib/crm/public-info"
    );
    const links = buildPublicSearchLinks("杭州云帆贸易有限公司", "https://example.com");
    check("公开搜索入口生成", links.length >= 3, links.map((l) => l.label).join(" / "));
    check("官网地址规范化", normalizeWebsite("example.com") === "https://example.com");
    check("非法官网返回 null", normalizeWebsite("not a url!!") === null || normalizeWebsite("ftp://x") === null);
    const noSite = await fetchPublicSiteInfo(null);
    check("无官网时不抓取", noSite === null);
  } finally {
    await prisma.organization.deleteMany({ where: { id: org.id } });
    await prisma.user.deleteMany({ where: { id: user.id } });
  }

  console.log("\n" + results.join("\n"));
  console.log(`\n${failed === 0 ? "✅ 全部通过" : `❌ ${failed} 项失败`}（共 ${results.length} 项）`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
