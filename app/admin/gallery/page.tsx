import { asc, desc } from "drizzle-orm";
import { ActionButton, AdminHeader } from "@/components/admin/ui";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { Photo } from "@/components/ui/misc";
import { db } from "@/db";
import { galleryImages } from "@/db/schema";
import { addGalleryImages, deleteGalleryImage, saveGalleryImage } from "@/features/admin/content-actions";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Gallery" };

export default async function GalleryAdminPage() {
  await requireAdmin();
  const images = await db.select().from(galleryImages).orderBy(asc(galleryImages.sortOrder), desc(galleryImages.id));

  return (
    <div className="space-y-6">
      <AdminHeader title="Gallery" />
      <ActionForm action={addGalleryImages} resetOnSuccess className="card grid max-w-3xl gap-4 sm:grid-cols-2">
        <Field name="images" label="Photos" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple required hint="Up to 5 MB in total per upload." />
        <Field name="caption" label="Caption (optional)" />
        <div className="sm:col-span-2">
          <SubmitButton>Upload</SubmitButton>
        </div>
      </ActionForm>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {images.map((image) => (
          <li key={image.id} className="card space-y-3">
            <Photo src={image.path} alt={image.caption || "Gallery photo"} className="aspect-square rounded-xl" sizes="300px" />
            <ActionForm action={saveGalleryImage.bind(null, image.id)} className="space-y-2">
              <Field name="caption" label="Caption" defaultValue={image.caption} />
              <Field name="sortOrder" label="Order" type="number" min={0} defaultValue={image.sortOrder} />
              <SubmitButton className="btn btn-outline btn-sm">Save</SubmitButton>
            </ActionForm>
            <ActionButton action={deleteGalleryImage.bind(null, image.id)} confirm="Delete this photo?" danger>
              Delete
            </ActionButton>
          </li>
        ))}
      </ul>
    </div>
  );
}
