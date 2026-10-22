import { useId, useState } from "react";
import type { ConfigField } from "@cangsplayground/core";
import { toast } from "sonner";
import { Button, Input, Switch } from "@cangsplayground/ui";
import { configDefaults, configValue, fieldControl, visibleFields } from "./config-fields";
export function ConfigForm({
  fields,
  defaults,
  config,
  onSave,
  disabled = false,
  onValuesChange,
}: {
  fields: ConfigField[];
  defaults: Record<string, unknown>;
  config: Record<string, unknown>;
  onSave: (value: Record<string, unknown>) => Promise<boolean>;
  disabled?: boolean;
  onValuesChange?: (values: Record<string, unknown>) => void;
}) {
  const [values, setValues] = useState(() => configDefaults(fields, defaults, config));
  const [saving, setSaving] = useState(false);
  const id = useId();
  const change = (field: ConfigField, value: string | boolean) => {
    const next = { ...values, [field.key]: configValue(field, value) };
    setValues(next);
    onValuesChange?.(next);
  };
  return (
    <form
      className="cp-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
          if (await onSave(values)) toast.success("Settings saved");
        } finally {
          setSaving(false);
        }
      }}
    >
      {visibleFields(fields, values).map((field) => {
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
            ) : control === "select" && field.display === "chips" ? (
              <fieldset className="config-chip-field" disabled={disabled || saving}>
                <legend>{field.label}</legend>
                <div className="config-chips">
                  {field.options?.map((option) => (
                    <label key={option.value} className="config-chip">
                      <input
                        type="radio"
                        name={fieldId}
                        value={option.value}
                        checked={value === option.value}
                        onChange={() => change(field, option.value)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : control === "number" && field.display === "stepper" ? (
              <>
                <label id={`${fieldId}-label`}>
                  {field.label}
                  {field.unit ? ` (${field.unit})` : ""}
                </label>
                <div className="config-stepper">
                  <Button
                    aria-label={`Decrease ${field.label}`}
                    disabled={disabled || saving || Number(value) <= (field.min ?? -Infinity)}
                    onClick={() =>
                      change(
                        field,
                        String(Math.max(field.min ?? -Infinity, Number(value) - (field.step ?? 1))),
                      )
                    }
                  >
                    −
                  </Button>
                  <span
                    role="spinbutton"
                    tabIndex={disabled || saving ? -1 : 0}
                    aria-labelledby={`${fieldId}-label`}
                    aria-valuenow={Number(value)}
                    aria-valuemin={field.min}
                    aria-valuemax={field.max}
                    aria-disabled={disabled || saving}
                    onKeyDown={(event) => {
                      if (
                        disabled ||
                        saving ||
                        !["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)
                      )
                        return;
                      event.preventDefault();
                      const next =
                        event.key === "Home"
                          ? (field.min ?? Number(value))
                          : event.key === "End"
                            ? (field.max ?? Number(value))
                            : Number(value) +
                              (event.key === "ArrowUp" ? 1 : -1) * (field.step ?? 1);
                      change(
                        field,
                        String(
                          Math.max(field.min ?? -Infinity, Math.min(field.max ?? Infinity, next)),
                        ),
                      );
                    }}
                  >
                    {String(value)}
                  </span>
                  <Button
                    aria-label={`Increase ${field.label}`}
                    disabled={disabled || saving || Number(value) >= (field.max ?? Infinity)}
                    onClick={() =>
                      change(
                        field,
                        String(Math.min(field.max ?? Infinity, Number(value) + (field.step ?? 1))),
                      )
                    }
                  >
                    +
                  </Button>
                </div>
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
