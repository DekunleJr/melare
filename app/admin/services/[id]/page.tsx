import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { AddonForm } from "@/components/admin/addon-form";
import { ServiceForm } from "@/components/admin/service-form";
import { ActionButton, AdminHeader, BackButton, Created } from "@/components/admin/ui";
import { Photo } from "@/components/ui/misc";
import { db } from "@/db";
import {
  categories,
  serviceAddons,
  serviceImages,
  services,
  staff,
  staffServices,
} from "@/db/schema";
import {
  deleteAddon,
  deleteService,
  removeServicePhoto,
} from "@/features/admin/catalog-actions";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Edit service" };

export default async function EditServicePage({ params, searchParams }: PageProps<"/admin/services/[id]">) {
  await requireAdmin();
  const id = Number((await params).id) || 0;
  const [service] = await db.select().from(services).where(eq(services.id, id));
  if (!service) notFound();
  const people = await db.select().from(staff).orderBy(asc(staff.name));
  const links = await db.select().from(staffServices).where(eq(staffServices.serviceId, id));
  const productCategories = await db.select().from(categories).orderBy(asc(categories.name));
  const addons = await db
    .select()
    .from(serviceAddons)
    .where(eq(serviceAddons.serviceId, id))
    .orderBy(asc(serviceAddons.sortOrder), asc(serviceAddons.id));
  const photos = await db.select().from(serviceImages).where(eq(serviceImages.serviceId, id));

  return (
    <>
      {/* Outside the narrow column, so the buttons sit at the right edge of the page. */}
      <AdminHeader title={service.name}>
        <ActionButton action={deleteService.bind(null, id)} confirm="Delete this service?" danger>
          Delete
        </ActionButton>
        <BackButton href="/admin/services" />
      </AdminHeader>
      <div className="max-w-3xl space-y-6">
        <Created show={(await searchParams).created} />
        {service.imagePath && (
          <Photo src={service.imagePath} alt={service.name} className="aspect-[3/2] max-w-sm rounded-2xl" sizes="384px" eager />
        )}
        <ServiceForm
          service={service}
          people={people}
          assigned={links.map((l) => l.staffId)}
          productCategories={productCategories}
        />
        {photos.length > 0 && (
          <section className="card">
            <h2 className="mb-4 font-display text-2xl">Hairstyle photos</h2>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {photos.map((photo) => (
                <li key={photo.id} className="space-y-2">
                  <Photo src={photo.path} alt={service.name} className="aspect-square rounded-xl" sizes="200px" />
                  <ActionButton action={removeServicePhoto.bind(null, photo.id)} confirm="Remove this photo?" danger>
                    Remove
                  </ActionButton>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="card space-y-4">
          <div>
            <h2 className="font-display text-2xl">Optional extras</h2>
            <p className="text-sm text-muted">
              Additional charges the customer can tick while booking, such as extra length.
            </p>
          </div>
          {addons.map((addon) => (
            <div key={addon.id} className="space-y-2 border-b border-line pb-4">
              <AddonForm serviceId={id} addon={addon} />
              <ActionButton action={deleteAddon.bind(null, addon.id)} confirm="Remove this extra?" danger>
                Remove
              </ActionButton>
            </div>
          ))}
          <AddonForm serviceId={id} />
        </section>
      </div>
    </>
  );
}
