import type { Metadata } from "next";
import { requireUser } from "../../../../../lib/session";
import { requireOrg } from "../../../../../lib/org";
import { safeQuery } from "../../../../../lib/safe";
import { loadOkrProgress } from "../../../../../lib/crm/okr";
import { createSalesOkr } from "../../../../../lib/actions/crm";
import { Card, PageHeader, EmptyState } from "../../../../../components/ui/primitives";
import { QueryError } from "../../../../../components/ui/query-error";
import { OkrForm } from "../../../../../components/crm/okr-form";
import { OkrProgressList } from "../../../../../components/crm/okr-progress-list";

export const metadata: Metadata = { title: "销售 OKR" };
export const dynamic = "force-dynamic";

export default async function SalesOkrPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const org = await requireOrg(slug, user.id);

  const result = await safeQuery("销售 OKR 查询", () => loadOkrProgress(org.id));

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <PageHeader title="销售 OKR" desc="把销售额拆解为客户、线索、商机，并统计 CRM 实际进度" />

      <Card className="mb-5 p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">新建销售目标</h2>
        <OkrForm slug={slug} action={createSalesOkr} />
      </Card>

      {!result.ok ? (
        <QueryError
          title="销售 OKR 数据加载失败"
          error={result.error}
          hint="若提示数据模型未就绪，请在服务端执行一次数据库结构同步（Docker 部署会在容器启动时自动 db push），再刷新本页。"
        />
      ) : result.data.length === 0 ? (
        <EmptyState
          icon={<span className="text-3xl">📈</span>}
          title="还没有销售 OKR"
          desc="先创建一个销售额与漏斗数量目标"
        />
      ) : (
        <OkrProgressList rows={result.data} />
      )}
    </div>
  );
}
