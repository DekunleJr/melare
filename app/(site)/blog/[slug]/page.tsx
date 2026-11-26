import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Loading, Photo } from "@/components/ui/misc";
import { getPosts, getSettings } from "@/features/content/queries";
import { env } from "@/lib/env";
import { RichText } from "@/lib/richtext";
import { formatShortDate } from "@/lib/time";

const find = async (slug: string) => (await getPosts()).find((p) => p.slug === slug);

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const post = await find((await params).slug);
  return post
    ? {
        title: post.title,
        description: post.excerpt || post.body.slice(0, 160),
        openGraph: {
          type: "article",
          ...(post.coverImage ? { images: [post.coverImage] } : {}),
        },
      }
    : {};
}

export default function PostPage({ params }: PageProps<"/blog/[slug]">) {
  return (
    <Suspense fallback={<Loading />}>
      {params.then(({ slug }) => (
        <Post slug={slug} />
      ))}
    </Suspense>
  );
}

async function Post({ slug }: { slug: string }) {
  const post = await find(slug);
  if (!post) notFound();
  const settings = await getSettings();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    datePublished: post.publishedAt?.toISOString(),
    author: { "@type": "Organization", name: settings.businessName },
    url: `${env.siteUrl}/blog/${post.slug}`,
  };
  return (
    <article className="container-page max-w-3xl py-12">
      <script
        type="application/ld+json"
        // "<" is escaped so a title can never close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <Link href="/blog" className="link text-sm">
        All articles
      </Link>
      <h1 className="mt-4 font-display text-4xl sm:text-5xl">{post.title}</h1>
      {post.publishedAt && (
        <p className="mt-2 text-sm text-muted">{formatShortDate(post.publishedAt)}</p>
      )}
      {post.coverImage && (
        <Photo src={post.coverImage} alt={post.title} preload className="mt-6 aspect-[3/2] rounded-3xl" sizes="(min-width: 768px) 768px, 100vw" />
      )}
      <div className="mt-8">
        <RichText source={post.body} />
      </div>
    </article>
  );
}
