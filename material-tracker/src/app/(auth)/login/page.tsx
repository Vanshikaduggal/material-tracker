import { AuthForm } from "@/components/AuthForm";

export const metadata = { title: "Sign in · Material Tracker" };

export default function LoginPage() {
  return <AuthForm mode="user-login" />;
}
