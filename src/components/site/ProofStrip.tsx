import { Counter } from "@/components/motion/Counter";
import { Reveal } from "@/components/motion/Reveal";
import type { Stat } from "@/lib/types";

/** Numeric proof directly after the hero (finance pattern: scale numbers near the first CTA). */
export function ProofStrip({ stats, brandName = "Delta Markets Academy" }: { stats: Stat[]; brandName?: string }) {
  return (
    <section aria-label={`${brandName} in numbers`} className="border-y border-edge bg-night-2">
      <dl className="container-x grid grid-cols-2 divide-edge sm:grid-cols-3 lg:grid-cols-5 lg:divide-x">
        {stats.slice(0, 5).map((s, i) => (
          <Reveal key={s.id} delay={i * 0.05} className="flex flex-col px-2 py-7 lg:px-8">
            <dt className="order-2 text-sm text-mute">{s.label}</dt>
            <dd className="num text-[clamp(1.9rem,3.2vw,2.6rem)] font-semibold leading-tight text-white">
              <Counter value={s.value} prefix={s.prefix} suffix={s.suffix} decimals={s.decimals ?? 0} />
            </dd>
            {s.note && <dd className="order-3 mt-0.5 text-xs text-mute/70">{s.note}</dd>}
          </Reveal>
        ))}
      </dl>
    </section>
  );
}
