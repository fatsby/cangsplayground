import { CircleAlert } from "lucide-react";
import { Toaster } from "sonner";

export function MobileToaster() {
  return (
    <Toaster
      position="top-center"
      theme="dark"
      icons={{ error: <CircleAlert strokeWidth={2.25} color="var(--cp-danger)" /> }}
      toastOptions={{
        style: {
          background: "var(--cp-surface-2)",
          color: "var(--cp-ink)",
          border: "1px solid var(--cp-border)",
          borderRadius: "var(--cp-r)",
          boxShadow: "var(--cp-elev-2)",
          fontFamily: "var(--cp-font-body)",
          fontSize: 14,
        },
      }}
    />
  );
}
