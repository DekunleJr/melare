import type { Metadata } from "next";
import { EmptyState, PageHero, Photo } from "@/components/ui/misc";
import { getGallery } from "@/features/content/queries";

export const metadata: Metadata = { title: "Gallery" };

export default async function GalleryPage() {
  const images = await getGallery();
  return (
    <>
      <PageHero eyebrow="Recent work" title="Gallery" />
      <div className="container-page py-14">
        {!images.length && <EmptyState title="Photos are coming soon" />}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {images.map((image) => (
            <figure key={image.id} className="group">
              <Photo src={image.path} alt={image.caption || "Salon work"} className="aspect-square rounded-2xl" sizes="(min-width: 768px) 33vw, 50vw" />
              {image.caption && (
                <figcaption className="mt-2 text-sm text-muted">{image.caption}</figcaption>
              )}
            </figure>
          ))}
        </div>
      </div>
    </>
  );
}
