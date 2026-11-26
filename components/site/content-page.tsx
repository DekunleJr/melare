import { PageHero } from "@/components/ui/misc";
import { getPage } from "@/features/content/queries";
import type { PageSlug } from "@/lib/default-pages";
import { RichText } from "@/lib/richtext";

/** An information page whose text the owner edits under Admin > Pages. */
export async function ContentPage({ slug }: { slug: PageSlug }) {
  const page = await getPage(slug);
  return (
    <>
      <PageHero title={page.title} />
      <div className="container-page max-w-3xl py-14">
        <RichText source={page.body} />
      </div>
    </>
  );
}
