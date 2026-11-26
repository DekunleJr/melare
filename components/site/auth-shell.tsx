import { Suspense, type ReactNode } from "react";
import { Loading } from "@/components/ui/misc";

export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="container-page max-w-md py-16">
      <h1 className="mb-6 text-center font-display text-4xl">{title}</h1>
      <div className="card">
        <Suspense fallback={<Loading />}>{children}</Suspense>
      </div>
    </div>
  );
}
