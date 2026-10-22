import type { ConfigField } from "@cangsplayground/core";
export function fieldControl(field: ConfigField) {
  return field.kind === "boolean" ? "switch" : field.kind;
}
export function configValue(field: ConfigField, value: string | boolean) {
  return field.kind === "boolean"
    ? value === true
    : field.kind === "number"
      ? Number(value)
      : String(value);
}
export function configDefaults(
  fields: ConfigField[],
  defaults: Record<string, unknown>,
  existing: Record<string, unknown> = {},
) {
  return Object.fromEntries(
    fields.map((field) => [
      field.key,
      existing[field.key] ??
        defaults[field.key] ??
        (field.kind === "boolean"
          ? false
          : field.kind === "number"
            ? (field.min ?? 0)
            : field.kind === "select"
              ? (field.options?.[0]?.value ?? "")
              : ""),
    ]),
  );
}

export function visibleFields(
  fields: ConfigField[],
  values: Record<string, unknown>,
): ConfigField[] {
  return fields.filter((f) => !f.showWhen || values[f.showWhen.key] === f.showWhen.equals);
}
