/**
 * CLI seed（migrate dev 新建库后自动执行）。
 * 本系统演示数据走「工作台 → ✨ 载入演示数据」按组织灌入（apps/web/lib/actions/demo.ts），
 * 该动作同时写入「两套源码整合」真实多 Agent 任务记录。
 */
import { prisma } from "../src/index.js";

const counts = {
  organization: await prisma.organization.count(),
  user: await prisma.user.count(),
  company: await prisma.company.count(),
  agentJob: await prisma.agentJob.count(),
};

console.log("[db:seed] UniCRM 数据就绪：", counts);
console.log("[db:seed] 提示：注册账号并创建组织后，在销售总览页点「载入演示数据」体验完整数据。");

await prisma.$disconnect();
