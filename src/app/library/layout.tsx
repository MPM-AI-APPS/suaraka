import { AppShell } from "@/components/app-shell";

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
