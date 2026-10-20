"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AGE_BANDS,
  AGE_LABELS,
  PAIN_OPTIONS,
  FEEDING_OPTIONS,
  GOAL_OPTIONS,
} from "@/lib/recommend";

const STEPS = ["宝宝月龄", "当前困扰", "喂养与目标"];

export default function SurveyModal({
  onClose,
  skippable = true,
}: {
  onClose: () => void;
  skippable?: boolean;
}) {
  const [step, setStep] = useState(0);
  const [ageBand, setAgeBand] = useState("");
  const [pains, setPains] = useState<string[]>([]);
  const [feeding, setFeeding] = useState("");
  const [goal, setGoal] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  function togglePain(p: string) {
    setPains((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : prev.length >= 3 ? prev : [...prev, p]
    );
  }

  function skip() {
    sessionStorage.setItem("survey_skipped", "1");
    onClose();
  }

  async function submit() {
    if (!ageBand) { setStep(0); setError("请先选择宝宝月龄"); return; }
    if (pains.length === 0) { setStep(1); setError("请至少选择一个困扰"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ageBand, pains, feeding: feeding || undefined, goal: goal || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "保存失败");
        setSaving(false);
        return;
      }
      onClose();
      router.refresh();
    } catch {
      setError("网络错误，请重试");
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {/* 头部：标题 + 进度点 */}
        <div className="row between" style={{ marginBottom: 6 }}>
          <h3 style={{ margin: 0 }}>👶 宝宝情况调研</h3>
          {skippable && (
            <button
              onClick={skip}
              style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 13, cursor: "pointer" }}
            >
              跳过
            </button>
          )}
        </div>
        <div className="hint" style={{ marginBottom: 12 }}>
          花 30 秒告诉我们宝宝的情况，为你精准推荐教程（可随时在菜单中修改）
        </div>
        <div className="survey-dots">
          {STEPS.map((s, i) => (
            <div key={s} className={`survey-dot ${i === step ? "current" : ""} ${i < step ? "done" : ""}`}>
              <span className="survey-dot-index">{i < step ? "✓" : i + 1}</span>
              <span className="survey-dot-label">{s}</span>
            </div>
          ))}
        </div>

        {/* 第 1 步：月龄 */}
        {step === 0 && (
          <div className="survey-step">
            <p className="survey-q">宝宝现在多大了？</p>
            <div className="survey-options">
              {AGE_BANDS.map((a) => (
                <button
                  key={a}
                  className={`survey-opt ${ageBand === a ? "active" : ""}`}
                  onClick={() => setAgeBand(a)}
                >
                  {AGE_LABELS[a]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 第 2 步：困扰（多选 ≤3） */}
        {step === 1 && (
          <div className="survey-step">
            <p className="survey-q">目前最困扰你的是？（可多选，最多 3 个）</p>
            <div className="survey-options">
              {PAIN_OPTIONS.map((p) => (
                <button
                  key={p}
                  className={`survey-opt ${pains.includes(p) ? "active" : ""}`}
                  onClick={() => togglePain(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 第 3 步：喂养 + 目标（选填） */}
        {step === 2 && (
          <div className="survey-step">
            <p className="survey-q">喂养方式（选填）</p>
            <div className="survey-options">
              {FEEDING_OPTIONS.map((f) => (
                <button
                  key={f}
                  className={`survey-opt ${feeding === f ? "active" : ""}`}
                  onClick={() => setFeeding(feeding === f ? "" : f)}
                >
                  {f}
                </button>
              ))}
            </div>
            <p className="survey-q" style={{ marginTop: 18 }}>最想先改善什么？（选填）</p>
            <div className="survey-options">
              {GOAL_OPTIONS.map((g) => (
                <button
                  key={g}
                  className={`survey-opt ${goal === g ? "active" : ""}`}
                  onClick={() => setGoal(goal === g ? "" : g)}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <div className="alert alert-error">{error}</div>}

        {/* 底部按钮 */}
        <div className="row gap-2 mt-4">
          {step > 0 && (
            <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setStep(step - 1)} disabled={saving}>
              ← 上一步
            </button>
          )}
          {step < 2 ? (
            <button
              className="btn btn-primary"
              style={{ flex: 2 }}
              onClick={() => {
                if (step === 0 && !ageBand) { setError("请选择宝宝月龄"); return; }
                if (step === 1 && pains.length === 0) { setError("请至少选择一个困扰"); return; }
                setError("");
                setStep(step + 1);
              }}
            >
              下一步 →
            </button>
          ) : (
            <button className="btn btn-primary" style={{ flex: 2 }} onClick={submit} disabled={saving}>
              {saving ? "保存中..." : "✅ 完成，看我的推荐"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
