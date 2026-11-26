import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Loading } from "@/components/ui/misc";
import { unsubscribe } from "@/features/site/actions";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };

export default function UnsubscribePage({ params }: PageProps<"/unsubscribe/[token]">) {
  return (
    <div className="container-page max-w-md py-20 text-center">
      <h1 className="font-display text-4xl">Unsubscribe</h1>
      <p className="mt-3 mb-6 text-muted">Stop receiving our news and offers by email.</p>
      <Suspense fallback={<Loading />}>
        {params.then(({ token }) => (
          <ActionForm action={unsubscribe.bind(null, decodeURIComponent(token))}>
            <SubmitButton>Unsubscribe me</SubmitButton>
          </ActionForm>
        ))}
      </Suspense>
    </div>
  );
}
