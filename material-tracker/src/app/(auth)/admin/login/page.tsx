import { AuthForm } from "@/components/AuthForm";

export const metadata = { title: "Admin sign in · Material Tracker" };

export default function AdminLoginPage() {
  return <AuthForm mode="admin-login" />;
}
