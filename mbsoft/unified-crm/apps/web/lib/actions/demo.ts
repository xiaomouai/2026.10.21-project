"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@ucrm/db";
import { requireUser } from "../session";
import { requireOrg } from "../org";
import { DEMO_AGENT_JOBS } from "../demo-data";

/**
 * 一键载入演示数据（仅当前组织）：
 *  - 少量 CRM 业务样例（企业/联系人/线索/商机/跟进）
 *  - 「两套源码整合」真实多 Agent 任务记录（编码任务日志模块首播）
 * 幂等：已有任务则不重复载入 AgentJob；CRM 样例允许重复（便于体验）。
 */
export async function loadDemoData(slug: string): Promise<void> {
  const user = await requireUser();
  const org = await requireOrg(slug, user.id);
  const now = Date.now();

  const jobCount = await prisma.agentJob.count({ where: { orgId: org.id } });

  // ---- CRM 样例 ----
  if ((await prisma.company.count({ where: { orgId: org.id } })) === 0) {
    const c1 = await prisma.company.create({
      data: {
        orgId: org.id, name: "杭州云帆贸易有限公司", industry: "贸易 / 零售",
        website: "https://example.com", phone: "0571-8888 6666", email: "contact@yunfan.example",
        address: "杭州市西湖区文三路 100 号", status: "ACTIVE",
      },
    });
    const c2 = await prisma.company.create({
      data: {
        orgId: org.id, name: "苏州精工设备制造", industry: "制造",
        phone: "0512-6666 8888", status: "ACTIVE",
      },
    });
    const c3 = await prisma.company.create({
      data: { orgId: org.id, name: "某潜在客户(展厅名单)", industry: "专业服务", status: "PROSPECT" },
    });

    const [ct1, ct2, ct3] = await Promise.all([
      prisma.contact.create({ data: { orgId: org.id, companyId: c1.id, name: "陈敏", title: "采购总监", email: "chenmin@yunfan.example", phone: "13800000001" } }),
      prisma.contact.create({ data: { orgId: org.id, companyId: c1.id, name: "李强", title: "IT 经理", phone: "13800000002" } }),
      prisma.contact.create({ data: { orgId: org.id, companyId: c2.id, name: "王芳", title: "总经理", phone: "13800000003" } }),
    ]);
    void ct1; void ct2; void ct3;

    await prisma.lead.createMany({
      data: [
        { orgId: org.id, name: "张伟", company: "上海某连锁零售", phone: "13900000001", source: "转介绍", score: 80, status: "NEW" },
        { orgId: org.id, name: "赵敏", company: "南京物流公司", email: "zhaomin@example.com", source: "网站留资", score: 55, status: "CONTACTED" },
        { orgId: org.id, name: "孙浩", company: "无锡电子厂", source: "展会", score: 30, status: "NEW" },
        { orgId: org.id, name: "旧线索(已流失)", company: "未知", source: "电话陌拜", score: 0, status: "LOST" },
      ],
    });

    const op1 = await prisma.opportunity.create({
      data: { orgId: org.id, companyId: c1.id, contactId: ct1.id, name: "Q4 进销存系统采购", amount: 180000, stage: "NEGOTIATION", status: "OPEN", probability: 70, expectedCloseAt: new Date(now + 30 * 86400000) },
    });
    const op2 = await prisma.opportunity.create({
      data: { orgId: org.id, companyId: c2.id, name: "MES 项目二期", amount: 320000, stage: "ANALYSIS", status: "OPEN", probability: 40, expectedCloseAt: new Date(now + 60 * 86400000) },
    });
    const op3 = await prisma.opportunity.create({
      data: { orgId: org.id, name: "官网改版(赢单样例)", amount: 30000, stage: "WON", status: "WON", probability: 100 },
    });
    void op1; void op2; void op3;

    await prisma.activity.createMany({
      data: [
        { orgId: org.id, type: "CALL", subject: "跟进报价异议", detail: "客户对实施周期有疑虑，已约下周现场演示", companyId: c1.id, status: "DONE", happenedAt: new Date(now - 2 * 86400000) },
        { orgId: org.id, type: "MEETING", subject: "苏州工厂调研", detail: "产线负责人带看，确认数据接口范围", companyId: c2.id, status: "DONE", happenedAt: new Date(now - 86400000) },
        { orgId: org.id, type: "TASK", subject: "准备竞品对比表", detail: "发给采购陈总参考", companyId: c1.id, status: "OPEN", happenedAt: new Date(now + 86400000) },
      ],
    });
  }

  // ---- AgentJob 首播（幂等：组织已有任务则跳过）----
  if (jobCount === 0) {
    await prisma.agentJob.createMany({
      data: DEMO_AGENT_JOBS.map((j) => ({
        orgId: org.id,
        agentRole: j.agentRole,
        taskCode: j.taskCode,
        title: j.title,
        description: j.description,
        branch: j.branch,
        status: j.status,
        progress: j.progress,
        priority: j.taskCode === "TASK-000" ? "P1" : "P2",
        tags: j.tags,
        createdById: user.id,
        startedAt: new Date(now - j.offsetMin * 60_000),
        finishedAt: j.status === "DONE" ? new Date(now - j.offsetMin * 60_000 + (j.durationMs ?? 0)) : null,
        durationMs: j.status === "DONE" ? j.durationMs : null,
        resultSummary: j.resultSummary ?? null,
        error: j.error ?? null,
      })),
    });
  }

  revalidatePath(`/w/${slug}/dashboard`);
}
