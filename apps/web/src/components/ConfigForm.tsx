import { useId, useState } from "react";
import type { ConfigField } from "@clubplay/core";
import { Button, Input, Switch } from "@clubplay/ui";
import { configDefaults, configValue, fieldControl } from "./config-fields";
export function ConfigForm({
  fields,
  defaults,
  config,
  onSave,
  disabled = false,
}: {
  fields: ConfigField[];
  defaults: Record<string, unknown>;
  config: Record<string, unknown>;
  onSave: (value: Record<string, unknown>) => Promise<boolean>;
  disabled?: boolean;
}) {
  const [values, setValues] = useState(() => configDefaults(fields, defaults, config));
  const [saving, setSaving] = useState(false);
  const id = useId();
  const change = (field: ConfigField, value: string | boolean) =>
    setValues((old) => ({ ...old, [field.key]: configValue(field, value) }));
  return (
    <form
      className="cp-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
          await onSave(values);
        } finally {
          setSaving(false);
        }
      }}
    >
      {fields.map((field) => {
        const control = fieldControl(field),
          fieldId = `${id}-${field.key}`,
          value = values[field.key];
        return (
          <div className="cp-field" key={field.key}>
            {control === "switch" ? (
              <Switch
                label={field.label}
                checked={value === true}
                onCheckedChange={(value) => change(field, value)}
                disabled={disabled}
              />
            ) : control === "textarea" ? (
              <>
                <label htmlFor={fieldId}>{field.label}</label>
                <textarea
                  id={fieldId}
                  className="cp-input"
                  value={String(value)}
                  maxLength={field.max}
                  onChange={(e) => change(field, e.target.value)}
                  disabled={disabled}
                />
              </>
            ) : control === "select" ? (
              <>
                <label htmlFor={fieldId}>{field.label}</label>
                <select
                  id={fieldId}
                  className="cp-input"
                  value={String(value)}
                  onChange={(e) => change(field, e.target.value)}
                  disabled={disabled}
                >
                  {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <Input
                id={fieldId}
                label={`${field.label}${field.unit ? ` (${field.unit})` : ""}`}
                type={control}
                min={field.min}
                max={field.max}
                step={field.step}
                value={String(value)}
                onChange={(e) => change(field, e.target.value)}
                disabled={disabled}
              />
            )}
            {field.help && <small>{field.help}</small>}
          </div>
        );
      })}
      <Button type="submit" disabled={saving || disabled}>
        {saving ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}
