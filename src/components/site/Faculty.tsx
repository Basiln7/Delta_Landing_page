import { Clock3, Languages, MessageCircle } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { SectionHeader } from "@/components/site/fin";
import { SmartImage } from "@/components/site/SmartImage";
import type { FacultyMember } from "@/lib/types";

export function Faculty({ faculty }: { faculty: FacultyMember[] }) {
  return (
    <section id="faculty" className="bg-snow py-24 text-ink sm:py-32">
      <div className="container-x">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <SectionHeader tone="light" eyebrow="Mentors" title="Learn from people who *invest and trade*." />
          </div>
          <Reveal delay={0.1} className="lg:col-span-5">
            <p className="text-lg leading-relaxed text-ink/65">
              Every mentor invests or trades their own money, teaches live every week and reviews your projects personally — in English,
              with Malayalam support.
            </p>
          </Reveal>
        </div>

        <div role="list" className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {faculty.map((f, i) => (
            <Reveal key={f.id} role="listitem" delay={i * 0.06}>
              <article className="card-light flex h-full flex-col overflow-hidden">
                <div className="relative aspect-[4/4] overflow-hidden bg-cloud">
                  <SmartImage
                    src={f.image}
                    alt={`Portrait of ${f.name}`}
                    fill
                    sizes="(min-width:1024px) 25vw, (min-width:640px) 50vw, 100vw"
                    className="object-cover"
                  />
                  {f.origin && (
                    <span className="absolute left-3 top-3 rounded-full border border-line bg-white/90 px-2.5 py-1 text-xs text-ink/70 backdrop-blur">
                      {f.origin}
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="display text-xl">{f.name}</h3>
                  <p className="mt-1 text-sm font-medium text-emerald">{f.role}</p>
                  <p className="mt-3 text-sm leading-relaxed text-ink/60">{f.bio}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1}>
          <div className="card-light mt-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-3 text-sm font-medium">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#25D366]/12 text-[#128C4B]">
                <MessageCircle className="h-4 w-4" />
              </span>
              Mentors reply on WhatsApp in minutes
            </p>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink/60">
              <li className="inline-flex items-center gap-2">
                <Languages className="h-4 w-4 text-ink/40" /> English &amp; Malayalam
              </li>
              <li className="inline-flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-ink/40" /> Mon–Sat
              </li>
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
