import { ActionForm, Checkbox, Field, Select, SubmitButton, TextArea } from "@/components/ui/form";
import type { categories, productVariants, products } from "@/db/schema";
import { saveProduct, saveVariant } from "@/features/admin/catalog-actions";
import { penceToInput } from "@/lib/money";

export function ProductForm({
  product,
  categoryList,
}: {
  product?: typeof products.$inferSelect;
  categoryList: (typeof categories.$inferSelect)[];
}) {
  return (
    <ActionForm action={saveProduct.bind(null, product?.id ?? null)} className="card grid gap-4 sm:grid-cols-2">
      <Field name="name" label="Product name" required defaultValue={product?.name} wrapperClass="sm:col-span-2" />
      <TextArea name="description" label="Description" rows={6} required defaultValue={product?.description} wrapperClass="sm:col-span-2" />
      <Select name="categoryId" label="Category" defaultValue={product?.categoryId ?? 0}>
        <option value={0}>No category</option>
        {categoryList.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <Select name="status" label="Visibility" defaultValue={product?.status ?? "active"}>
        <option value="active">Active (on sale)</option>
        <option value="draft">Draft (hidden)</option>
        <option value="archived">Archived</option>
      </Select>
      {!product && (
        <fieldset className="grid gap-4 rounded-xl border border-line p-4 sm:col-span-2 sm:grid-cols-2">
          <legend className="px-2 text-sm font-semibold">Price and stock</legend>
          <Field name="price" label="Price (£)" inputMode="decimal" required />
          <Field name="stock" label="Quantity in stock" type="number" min={0} required defaultValue={0} />
          <p className="text-xs text-muted sm:col-span-2">
            If it comes in several colours, lengths, textures or sizes, describe the first here and
            add the others after saving. Otherwise leave these empty.
          </p>
          <Field name="colour" label="Colour (optional)" />
          <Field name="length" label="Length (optional)" />
          <Field name="texture" label="Texture (optional)" />
          <Field name="size" label="Size (optional)" />
        </fieldset>
      )}
      <div className="sm:col-span-2">
        <Checkbox name="featured" label="Feature on the home page" defaultChecked={product?.featured} />
      </div>
      <Field
        name="images"
        label={product ? "Add images" : "Images"}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        hint="JPG, PNG, WebP or AVIF. Up to 5 MB in total per save."
        wrapperClass="sm:col-span-2"
      />
      <div className="sm:col-span-2">
        <SubmitButton>{product ? "Save changes" : "Create product"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function VariantForm({
  productId,
  variant,
}: {
  productId: number;
  variant?: typeof productVariants.$inferSelect;
}) {
  return (
    <ActionForm
      action={saveVariant.bind(null, productId, variant?.id ?? null)}
      resetOnSuccess={!variant}
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
    >
      <Field name="colour" label="Colour" defaultValue={variant?.colour} />
      <Field name="length" label="Length" defaultValue={variant?.length} />
      <Field name="texture" label="Texture" defaultValue={variant?.texture} />
      <Field name="size" label="Size" defaultValue={variant?.size} />
      <Field name="price" label="Price (£)" inputMode="decimal" required defaultValue={variant ? penceToInput(variant.pricePence) : ""} />
      <Field name="salePrice" label="Sale price (£)" inputMode="decimal" defaultValue={variant?.salePricePence ? penceToInput(variant.salePricePence) : ""} />
      <Field name="stock" label="Stock" type="number" min={0} required defaultValue={variant?.stock ?? 0} />
      <Field name="lowStockThreshold" label="Low stock at" type="number" min={0} required defaultValue={variant?.lowStockThreshold ?? 3} />
      <Field name="sku" label="Your code (SKU)" defaultValue={variant?.sku} />
      <Field name="sortOrder" label="Order" type="number" min={0} required defaultValue={variant?.sortOrder ?? 0} />
      <Field name="image" label={variant?.imagePath ? "Replace photo" : "Photo for this option"} type="file" accept="image/jpeg,image/png,image/webp,image/avif" wrapperClass="col-span-2" />
      <div className="col-span-2 flex items-center gap-4 sm:col-span-4">
        <Checkbox name="active" label="On sale" defaultChecked={variant?.active ?? true} />
        <SubmitButton className={`btn btn-sm ${variant ? "btn-outline" : "btn-primary"}`}>
          {variant ? "Save option" : "Add option"}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
