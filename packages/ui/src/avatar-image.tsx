import { useMemo } from "react";
import { Avatar, Style } from "@dicebear/core";
import bigSmile from "@dicebear/styles/big-smile.json";
import { avatarChoices, type AvatarConfig } from "@cangsplayground/core";

const style = new Style(bigSmile);

export default function AvatarImage({ config, label }: { config: string; label: string }) {
  const src = useMemo(() => {
    const { accessoriesVariant, ...options } = JSON.parse(config) as AvatarConfig;
    return new Avatar(style, {
      ...options,
      backgroundColor: options.backgroundColor
        ? [options.backgroundColor]
        : avatarChoices.backgroundColor,
      ...(accessoriesVariant === "none"
        ? { accessoriesProbability: 0 }
        : accessoriesVariant
          ? { accessoriesVariant, accessoriesProbability: 100 }
          : {}),
    }).toDataUri();
  }, [config]);
  return (
    <img
      src={src}
      alt={label}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      draggable={false}
      style={{ display: "block", width: "100%", height: "100%" }}
    />
  );
}
