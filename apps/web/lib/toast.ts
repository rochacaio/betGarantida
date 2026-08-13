export type ToastKind = "success" | "error";

export function showToast(
  kind: ToastKind,
  title: string,
  message: string,
): void {
  if (typeof document === "undefined") return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${kind}`;
  toast.setAttribute("role", kind === "error" ? "alert" : "status");
  const icon = document.createElement("span");
  icon.textContent = kind === "success" ? "✓" : "!";
  const content = document.createElement("div");
  const heading = document.createElement("strong");
  heading.textContent = title;
  const detail = document.createElement("p");
  detail.textContent = message;
  content.append(heading, detail);
  toast.append(icon, content);
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 5000);
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
