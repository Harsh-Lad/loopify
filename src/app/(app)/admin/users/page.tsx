import type { Metadata } from "next";
import { AdminUsers } from "@/components/admin/admin-users";
import { AdminGate } from "@/components/admin/admin-shared";
import { ClientView } from "@/components/common/client-view";

export const metadata: Metadata = { title: "Users · Platform admin" };

export default function AdminUsersPage() {
  return (
    <ClientView>
      <AdminGate>
        <AdminUsers />
      </AdminGate>
    </ClientView>
  );
}
