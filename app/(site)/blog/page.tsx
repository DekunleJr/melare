import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHero, Photo } from "@/components/ui/misc";
import { getPosts } from "@/features/content/queries";
import { formatShortDate } from "@/lib/time";

export const metadata: Metadata = {
  title: "Hair care blog",
  description: "Hair care advice, styling ideas and news.",
};

export default async function BlogPage() {
  const posts = await getPosts();
  return (
    <>
      <PageHero eyebrow="Journal" title="Hair care blog">
        Advice, styling ideas and news from the salon.
      </PageHero>
      <div className="container-page py-14">
        {!posts.length && <EmptyState title="Articles are coming soon" />}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, i) => (
            <article key={post.id} className="group">
              <Link href={`/blog/${post.slug}`} prefetch={false} className="block">
                <Photo src={post.coverImage} alt={post.title} eager={i < 3} className="aspect-[3/2] rounded-2xl" sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" />
                {post.publishedAt && (
                  <p className="mt-3 text-xs text-muted">{formatShortDate(post.publishedAt)}</p>
                )}
                <h2 className="font-display text-2xl group-hover:text-clay">{post.title}</h2>
                <p className="mt-1 text-sm text-muted">{post.excerpt}</p>
              </Link>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}
