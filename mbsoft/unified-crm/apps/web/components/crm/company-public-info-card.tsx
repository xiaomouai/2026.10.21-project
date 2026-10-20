import { Card } from "../ui/primitives";
import { QueryError } from "../ui/query-error";
import {
  BLOCKED_LABEL,
  type PublicSearchLink,
  type PublicSiteInfo,
} from "../../lib/crm/public-info";
import { Globe, Search, ShieldAlert, Mail, Phone } from "lucide-react";

/**
 * 企业公开信息卡片（服务端组件）
 * ----------------------------------------------------------------------------
 * 展示两部分：
 *   1. 公开搜索入口 —— 按企业名称 / 官网生成的搜索引擎链接，跳转后人工查阅
 *   2. 官网公开页读取结果 —— 只读抓取标题、描述与页面公开联系方式
 *
 * 合规边界：需要登录 / 验证码 / 付费才能看的内容一律显示「已停止读取」，不绕过。
 */
export function CompanyPublicInfoCard({
  companyName,
  website,
  searchLinks,
  site,
  error,
}: {
  companyName: string;
  website: string | null;
  searchLinks: PublicSearchLink[];
  site: PublicSiteInfo | null;
  error?: string | null;
}) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <Globe className="size-4 text-indigo-500" />
        <h2 className="text-sm font-semibold text-slate-800">公开信息</h2>
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
          仅读取公开内容
        </span>
      </div>

      {error && <QueryError title="公开信息读取失败" error={error} />}

      <div className="space-y-3">
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-500">官网</p>
          {website ? (
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[13px] text-indigo-600 hover:underline"
            >
              <Globe className="size-3.5" />
              {website}
            </a>
          ) : (
            <p className="text-[13px] text-slate-400">
              未填写官网 —— 可在「编辑」中补充，补充后自动读取公开页面信息
            </p>
          )}
        </div>

        <div>
          <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-slate-500">
            <Search className="size-3" />
            公开搜索入口
          </p>
          <div className="flex flex-wrap gap-1.5">
            {searchLinks.map((l) => (
              <a
                key={l.url}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-200"
              >
                {l.label}
              </a>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            搜索关键词取「{companyName}」，点击后在外部搜索引擎人工查阅。
          </p>
        </div>

        {site && (
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
            {site.ok ? (
              <div className="space-y-1.5">
                {site.title && (
                  <p className="text-[13px] font-medium text-slate-800">{site.title}</p>
                )}
                {site.description && (
                  <p className="text-xs leading-relaxed text-slate-500">{site.description}</p>
                )}
                {(site.emails.length > 0 || site.phones.length > 0) && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                    {site.emails.map((e) => (
                      <span key={e} className="flex items-center gap-1 text-[11px] text-slate-600">
                        <Mail className="size-3 text-slate-400" />
                        {e}
                      </span>
                    ))}
                    {site.phones.map((p) => (
                      <span key={p} className="flex items-center gap-1 text-[11px] text-slate-600">
                        <Phone className="size-3 text-slate-400" />
                        {p}
                      </span>
                    ))}
                  </div>
                )}
                {!site.title && !site.description && site.emails.length === 0 && (
                  <p className="text-xs text-slate-400">公开页未解析到标题、描述或联系方式。</p>
                )}
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
                <div>
                  <p className="text-[13px] font-medium text-amber-700">
                    {site.blocked ? BLOCKED_LABEL[site.blocked] : "无法读取"}
                  </p>
                  <p className="text-xs text-slate-500">{site.note ?? "该页面内容不可公开读取。"}</p>
                </div>
              </div>
            )}
            <p className="mt-2 text-[11px] text-slate-400">读取时间：{site.fetchedAt.slice(0, 19).replace("T", " ")}</p>
          </div>
        )}

        <p className="text-[11px] text-slate-400">
          合规说明：只读取无需登录即可访问的公开页面；遇到登录、验证码或付费内容即停止，不做任何绕过；
          抓取结果仅用于展示，不会自动写回客户资料。
        </p>
      </div>
    </Card>
  );
}
