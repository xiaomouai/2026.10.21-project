"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AGENT_ROLES, AGENT_ROLE_LABELS, type AgentRole } from "@ucrm/db/constants";
import { createJob } from "../../lib/actions/agentJob";
import { Modal, FormMessage } from "../ui/modal";
import { Field, inputClass, buttonClass } from "../ui/primitives";

export function NewJobModal({ slug }: { slug: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(fd: FormData) {
    start(async () => {
      const res = await createJob(slug, fd);
      if (!res.ok) {
        setError(res.error || "创建失败");
        return;
      }
      setOpen(false);
      setError(null);
      router.refresh();
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="下达编码任务"
      desc="登记一条任务给指定 agent 角色，任务将进入日志看板并可通过 API 汇报进度"
      trigger={
        <button type="button" className={buttonClass("indigo")}>
          ＋ 下达任务
        </button>
      }
    >
      <form action={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Agent 角色">
            <select name="agentRole" className={inputClass} defaultValue="fe-ui">
              {AGENT_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r} · {AGENT_ROLE_LABELS[r as AgentRole]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="优先级">
            <select name="priority" className={inputClass} defaultValue="P2">
              <option value="P0">P0 紧急</option>
              <option value="P1">P1 高</option>
              <option value="P2">P2 中</option>
              <option value="P3">P3 低</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="任务编号" hint="可选，如 TASK-001">
            <input name="taskCode" placeholder="TASK-003" className={inputClass} />
          </Field>
          <Field label="代码分支" hint="可选，如 agent/fe-ui/...">
            <input name="branch" placeholder="agent/fe-ui/TASK-003-x" className={inputClass} />
          </Field>
        </div>
        <Field label="任务标题">
          <input name="title" required placeholder="例如：实现商机看板按阶段筛选" className={inputClass} />
        </Field>
        <Field label="任务说明">
          <textarea name="description" rows={3} placeholder="目标 / 范围 / 验收要点" className={inputClass} />
        </Field>
        <Field label="标签" hint="逗号分隔，如 schema,merge,ui">
          <input name="tags" placeholder="ui,crm,list" className={inputClass} />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={buttonClass("slate")} onClick={() => setOpen(false)}>
            取消
          </button>
          <button type="submit" disabled={pending} className={buttonClass("indigo")}>
            {pending ? "提交中…" : "下达"}
          </button>
        </div>
        <FormMessage text={error} />
      </form>
    </Modal>
  );
}
