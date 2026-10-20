import { readLlmConfig, readSiteSettings, PROVIDER_PRESETS } from "@/lib/admin";
import LlmSettingsForm from "@/components/admin/LlmSettingsForm";

export const dynamic = "force-dynamic";

export default function AdminSettingsPage() {
  const llm = readLlmConfig();
  const site = readSiteSettings();
  const hasApiKey = !!llm.apiKey;

  return (
    <div className="a-stack">
      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-ico" aria-hidden>🤖</span>
          <span className="stat-label">大模型状态</span>
          <span className="stat-value" style={{ fontSize: 18 }}>
            {llm.enabled ? "已启用" : "未启用"}
          </span>
          <span className="stat-delta">
            {llm.enabled ? (
              <>
                模型 <b>{llm.model}</b>
              </>
            ) : (
              <>配置完成并开启开关后生效</>
            )}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-ico" aria-hidden>🔑</span>
          <span className="stat-label">API Key</span>
          <span className="stat-value" style={{ fontSize: 18 }}>
            {hasApiKey ? "已配置" : "未配置"}
          </span>
          <span className="stat-delta">
            {hasApiKey ? (llm.apiKey ? "••••••" + llm.apiKey.slice(-4) : "已保存") : "尚未填写密钥"}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-ico" aria-hidden>🌐</span>
          <span className="stat-label">接口地址</span>
          <span className="stat-value" style={{ fontSize: 13, fontWeight: 600, wordBreak: "break-all", lineHeight: 1.5 }}>
            {llm.baseUrl || "—"}
          </span>
          <span className="stat-delta">{PROVIDER_PRESETS[llm.provider]?.label ?? llm.provider}</span>
        </div>
        <div className="stat-card">
          <span className="stat-ico" aria-hidden>🎁</span>
          <span className="stat-label">积分规则</span>
          <span className="stat-value" style={{ fontSize: 17 }}>
            注册 {site.registerBonus} · 打卡 {site.checkInPoints} · 发帖 {site.postPoints}
          </span>
          <span className="stat-delta">可在下方随时调整</span>
        </div>
      </div>

      <LlmSettingsForm llm={llm} site={site} presets={PROVIDER_PRESETS} hasApiKey={hasApiKey} />
    </div>
  );
}
