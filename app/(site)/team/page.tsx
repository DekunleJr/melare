import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHero, Photo } from "@/components/ui/misc";
import { getTeam } from "@/features/content/queries";

export const metadata: Metadata = { title: "Our team" };

export default async function TeamPage() {
  const team = await getTeam();
  return (
    <>
      <PageHero eyebrow="Our people" title="Meet the team" />
      <div className="container-page py-14">
        {!team.length && <EmptyState title="Team profiles are coming soon" />}
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {team.map((person) => (
            <article key={person.id}>
              <Photo src={person.imagePath} alt={person.name} className="aspect-[3/4] rounded-t-[8rem] rounded-b-2xl" />
              <h2 className="mt-4 font-display text-3xl">{person.name}</h2>
              <p className="text-sm text-clay">{person.title}</p>
              <p className="mt-2 text-sm leading-6 whitespace-pre-line text-muted">{person.bio}</p>
              {person.services.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {person.services.map((s) => (
                    <li key={s.id}>
                      <Link href={`/services/${s.slug}`} prefetch={false} className="chip text-xs">
                        {s.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      </div>
    </>
  );
}
