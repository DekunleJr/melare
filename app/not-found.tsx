import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid flex-1 place-items-center px-4 py-24 text-center">
      <div>
        <p className="eyebrow">404</p>
        <h1 className="font-display text-4xl">We could not find that page</h1>
        <Link href="/" className="btn btn-primary mt-7">
          Back home
        </Link>
      </div>
    </div>
  );
}
