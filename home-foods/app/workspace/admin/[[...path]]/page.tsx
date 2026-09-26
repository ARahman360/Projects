import { redirect } from "next/navigation";
import { getSession } from "@/src/lib/auth";
import AdminWorkspace from "@/src/components/admin-workspace";

export default async function AdminPage({ params }: { params: Promise<{ path?: string[] }> }) {
  const session = await getSession();
  if (!session) redirect("/signin");
  if (session.role !== "ADMIN") redirect("/workspace");
  const { path = [] } = await params;
  return <AdminWorkspace section={path[0] ?? "overview"} recordId={path[1] ? Number(path[1]) : undefined}/>;
}
