"use client";

export default function ErrorPage({ unstable_retry }: { error: Error; unstable_retry: () => void }) {
  return (
    <div className="grid flex-1 place-items-center px-4 py-24 text-center">
      <div>
        <h1 className="font-display text-4xl">Something went wrong</h1>
        <p className="mt-3 text-muted">Please try again in a moment.</p>
        <button type="button" className="btn btn-primary mt-7" onClick={() => unstable_retry()}>
          Try again
        </button>
      </div>
    </div>
  );
}
