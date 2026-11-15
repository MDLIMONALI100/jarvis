import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata: Metadata = { title: "Control Panel — J.A.R.V.I.S." };

export default function AdminPage() {
  return <AdminShell />;
}
