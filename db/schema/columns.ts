import { datetime } from "drizzle-orm/mysql-core";

/** All datetimes are stored in UTC and set by the application, never by the DB clock. */
export const utc = (name: string) => datetime(name, { mode: "date", fsp: 3 });

export const createdAt = () =>
  utc("created_at")
    .notNull()
    .$defaultFn(() => new Date());

export const updatedAt = () =>
  utc("updated_at")
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date());
