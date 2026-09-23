import type { ReactNode } from "react";

export default function AuthenticationLayout({ children }: { children: ReactNode }) {
  return <div className="auth-route-shell">{children}</div>;
}
