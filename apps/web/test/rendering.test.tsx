import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SecretCard, HostSecretRow } from "@cangsplayground/ui";
import { ConfigForm } from "../src/components/ConfigForm";
import type { ConfigField } from "@cangsplayground/core";

describe("catalog config form rendering", () => {
  it("renders all field kinds with accessible labels and catalog bounds/options", () => {
    const fields: ConfigField[] = [
      { key: "time", label: "Turn time", kind: "number", min: 15, max: 300, step: 5, unit: "sec" },
      { key: "name", label: "Title", kind: "text" },
      { key: "prompt", label: "Question", kind: "textarea" },
      { key: "hints", label: "Show hints", kind: "boolean" },
      {
        key: "level",
        label: "Level",
        kind: "select",
        options: [
          { value: "a2", label: "Easy" },
          { value: "b1", label: "Medium" },
        ],
      },
    ];
    const html = renderToStaticMarkup(
      <ConfigForm
        fields={fields}
        defaults={{ time: 60, name: "Free Talk", prompt: "Speak!", hints: false, level: "b1" }}
        config={{}}
        onSave={async () => true}
      />,
    );
    expect(html).toContain("Turn time (sec)");
    expect(html).toContain('min="15"');
    expect(html).toContain('max="300"');
    expect(html).toContain('step="5"');
    expect(html).toContain('type="text"');
    expect(html).toContain("<textarea");
    expect(html).toContain("Speak!");
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain("<select");
    expect(html).toContain('<option value="b1" selected="">Medium</option>');
  });
});
describe("hidden secrets", () => {
  it("never mounts player secret content before a hold", () => {
    const html = renderToStaticMarkup(
      <SecretCard>
        <span>PRIVATE WORD</span>
      </SecretCard>,
    );
    expect(html).toContain("Hold to see your card");
    expect(html).not.toContain("PRIVATE WORD");
  });
  it("never mounts host details before a hold or explicit reveal", () => {
    expect(
      renderToStaticMarkup(<HostSecretRow teamIndex={0}>SECRET HOST DATA</HostSecretRow>),
    ).not.toContain("SECRET HOST DATA");
    expect(
      renderToStaticMarkup(
        <HostSecretRow teamIndex={0} revealed>
          SECRET HOST DATA
        </HostSecretRow>,
      ),
    ).toContain("SECRET HOST DATA");
  });
});
