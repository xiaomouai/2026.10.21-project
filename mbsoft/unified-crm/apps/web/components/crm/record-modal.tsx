"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal, FormMessage } from "../ui/modal";
import { Field, inputClass, buttonClass } from "../ui/primitives";

export type FieldCfg = {
  name: string;
  label: string;
  type?: "text" | "textarea" | "select" | "number" | "date" | "datetime-local" | "email" | "url";
  required?: boolean;
  placeholder?: string;
  hint?: string;
  options?: { value: string; label: string }[];
  defaultValue?: string;
  colSpan?: 1 | 2;
};

export type ServerActionLike = (fd: FormData) => Promise<{ ok: boolean; error?: string }>;

export function RecordModal({
  slug,
  title,
  desc,
  triggerText,
  fields,
  action,
  submitText = "保存",
}: {
  slug: string;
  title: string;
  desc?: string;
  triggerText: string;
  fields: FieldCfg[];
  action: ServerActionLike;
  submitText?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(fd: FormData) {
    start(async () => {
      const res = await action(fd);
      if (!res.ok) {
        setError(res.error || "保存失败");
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
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setError(null);
      }}
      title={title}
      desc={desc}
      trigger={
        <button type="button" className={buttonClass("indigo")}>
          ＋ {triggerText}
        </button>
      }
    >
      <form ref={formRef} action={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-x-3 gap-y-4">
          {fields.map((f) => {
            const input = (
              <Field key={f.name} label={f.label} hint={f.hint}>
                {f.type === "textarea" ? (
                  <textarea name={f.name} rows={3} placeholder={f.placeholder} className={inputClass} defaultValue={f.defaultValue} />
                ) : f.type === "select" ? (
                  <select name={f.name} className={inputClass} defaultValue={f.defaultValue ?? ""}>
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    name={f.name}
                    type={f.type ?? "text"}
                    required={f.required}
                    placeholder={f.placeholder}
                    defaultValue={f.defaultValue}
                    className={inputClass}
                    min={f.type === "number" ? 0 : undefined}
                    step={f.type === "number" ? "any" : undefined}
                  />
                )}
              </Field>
            );
            return (
              <div key={f.name} className={f.colSpan === 2 ? "col-span-2" : ""}>
                {input}
              </div>
            );
          })}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={buttonClass("slate")} onClick={() => setOpen(false)}>
            取消
          </button>
          <button type="submit" disabled={pending} className={buttonClass("indigo")}>
            {pending ? "保存中…" : submitText}
          </button>
        </div>
        <FormMessage text={error} />
      </form>
    </Modal>
  );
}
