import { Bell, Bot, FileCheck2, FileText } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { Marquee } from "@/components/motion/Marquee";
import { SampleTag, SectionHeader, Sparkline } from "@/components/site/fin";
import { SmartImage } from "@/components/site/SmartImage";
import { cn } from "@/lib/utils";
import type { Project, Tool } from "@/lib/types";

const KIND_DOT: Record<Tool["kind"], string> = {
  AI: "bg-brass-light",
  Market: "bg-sky",
  Automation: "bg-[#f9a8d4]",
  Data: "bg-white/70",
};

/** "12 AI & market tools" strip under the proof numbers. */
export function ToolsMarquee({ tools }: { tools: Tool[] }) {
  if (!tools.length) return null;
  return (
    <section aria-label="Tools you'll master" className="border-b border-edge bg-night py-7">
      <div className="container-x mb-4 flex items-center justify-between gap-4">
        <p className="text-sm text-mute">
          <span className="num text-white">{tools.length}</span> AI &amp; market tools you&apos;ll use hands-on
        </p>
        <p className="hidden items-center gap-4 text-xs text-mute sm:flex">
          {(["AI", "Market", "Data", "Automation"] as const).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className={cn("h-1.5 w-1.5 rounded-full", KIND_DOT[k])} />
              {k}
            </span>
          ))}
        </p>
      </div>
      <Marquee duration={55}>
        {tools.map((t) => (
          <span key={t.id} className="mx-1.5 inline-flex items-center gap-2.5 rounded-full border border-edge bg-white/[0.03] px-4 py-2.5" title={t.use}>
            <span className={cn("h-2 w-2 rounded-full", KIND_DOT[t.kind])} />
            <span className="whitespace-nowrap font-medium text-white">{t.name}</span>
            <span className="hidden whitespace-nowrap text-xs text-mute lg:inline">{t.use}</span>
          </span>
        ))}
      </Marquee>
    </section>
  );
}

/* ───────────── Product-UI mockups (fictional sample data) ───────────── */

function ReportMock() {
  return (
    <div className="rounded-xl border border-edge bg-night-3/70 p-4">
      <div className="flex items-center gap-2 text-[0.7rem] text-mute">
        <FileText className="h-3.5 w-3.5 text-sky" /> Zentek Systems · research note
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-brass-light/15 px-2 py-0.5 text-brass-light">
          <Bot className="h-3 w-3" /> AI draft · you verify
        </span>
      </div>
      <p className="mt-3 text-sm font-medium text-white">Thesis: steady compounder, watch the debt</p>
      <div className="mt-3 space-y-1.5" aria-hidden="true">
        {[92, 78, 85, 60].map((w, i) => (
          <span key={i} className="block h-1.5 rounded-full bg-white/10" style={{ width: `${w}%` }} />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2">
        {[
          ["P/E", "21.4"],
          ["ROE", "17.2%"],
          ["D/E", "0.62"],
          ["Fair value", "₹1,710"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-edge px-2 py-1.5">
            <p className="text-[0.6rem] text-mute">{k}</p>
            <p className="num text-xs text-white">{v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function JournalMock() {
  const rows = [
    ["12 Oct", "Breakout", "1 : 2.4", "+2.1R", true],
    ["15 Oct", "Pullback", "1 : 2.0", "−1.0R", false],
    ["19 Oct", "Breakout", "1 : 3.1", "+2.8R", true],
    ["24 Oct", "Range", "1 : 1.8", "−1.0R", false],
  ] as const;
  return (
    <div className="rounded-xl border border-edge bg-night-3/70 p-4">
      <div className="flex items-center justify-between text-[0.7rem] text-mute">
        <span>Trading journal · paper account</span>
        <span className="num rounded-full bg-emerald/15 px-2 py-0.5 text-emerald">Win rate 50% · Avg +0.7R</span>
      </div>
      <table className="mt-3 w-full text-left text-[0.72rem]">
        <thead className="text-mute">
          <tr>
            <th className="pb-1.5 font-normal">Date</th>
            <th className="pb-1.5 font-normal">Setup</th>
            <th className="pb-1.5 font-normal">Planned R:R</th>
            <th className="pb-1.5 text-right font-normal">Result</th>
          </tr>
        </thead>
        <tbody className="num text-white/85">
          {rows.map(([d, s, rr, res, win]) => (
            <tr key={d} className="border-t border-edge">
              <td className="py-1.5">{d}</td>
              <td className="py-1.5 font-sans">{s}</td>
              <td className="py-1.5">{rr}</td>
              <td className={cn("py-1.5 text-right", win ? "text-emerald" : "text-pin")}>{res}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BacktestMock() {
  return (
    <div className="rounded-xl border border-edge bg-night-3/70 p-4">
      <div className="flex items-center justify-between text-[0.7rem] text-mute">
        <span>Backtest · 20-EMA trend rule · 2015–2025</span>
        <SampleTag>Sample</SampleTag>
      </div>
      <Sparkline seed={41} points={60} trend={0.9} className="mt-3 h-24 w-full" stroke="var(--color-brass-light)" />
      <div className="mt-3 grid grid-cols-4 gap-2">
        {[
          ["CAGR", "14.2%", "text-emerald"],
          ["Max DD", "−9.8%", "text-pin"],
          ["Win rate", "46%", "text-white"],
          ["Trades", "212", "text-white"],
        ].map(([k, v, c]) => (
          <div key={k} className="rounded-lg border border-edge px-2 py-1.5">
            <p className="text-[0.6rem] text-mute">{k}</p>
            <p className={cn("num text-xs", c)}>{v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AlertsMock() {
  const alerts = [
    { t: "ZENTEK closed above its 20-EMA", s: "Setup A · your watchlist", time: "09:42" },
    { t: "NOVA volume 2.1× its 20-day average", s: "Unusual activity", time: "11:05" },
    { t: "Your daily market brief is ready", s: "AI summary · 6 stories", time: "15:35" },
  ];
  return (
    <div className="space-y-2">
      {alerts.map((a, i) => (
        <div
          key={a.t}
          className="flex items-start gap-3 rounded-xl border border-edge bg-night-3/80 p-3 backdrop-blur"
          style={{ marginLeft: `${i * 6}%`, opacity: 1 - i * 0.12 }}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f9a8d4]/15 text-[#f9a8d4]">
            <Bell className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-2 text-[0.72rem] text-mute">
              n8n · Telegram <span className="num">{a.time}</span>
            </span>
            <span className="block truncate text-sm text-white">{a.t}</span>
            <span className="block text-[0.7rem] text-mute">{a.s}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

const MOCKS = [ReportMock, JournalMock, BacktestMock, AlertsMock];

/** The four capstone projects, shown as the product UI learners actually build. */
export function Projects({ projects }: { projects: Project[] }) {
  return (
    <section id="projects" className="bg-night py-24 sm:py-32">
      <div className="container-x">
        <SectionHeader
          eyebrow="Projects you keep"
          title={`${projects.length} real projects. *Not toy exercises.*`}
          lede="Every module ends with something you build, a mentor reviews, and you keep using long after the course."
        />
        <div className="mt-14 grid gap-5 md:grid-cols-2">
          {projects.map((p, i) => {
            const Mock = MOCKS[i];
            return (
              <Reveal key={p.id} delay={(i % 2) * 0.08} className="h-full">
                <article className="card-dark flex h-full flex-col overflow-hidden p-6 sm:p-7">
                  <div className="flex items-center gap-3">
                    <span className="num flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-sm text-brass-light">0{i + 1}</span>
                    <h3 className="display text-2xl text-white sm:text-[1.7rem]">{p.title}</h3>
                  </div>
                  <p className="mt-3 leading-relaxed text-mute">{p.summary}</p>
                  <div className="mt-6">
                    {Mock ? (
                      <Mock />
                    ) : (
                      <div className="relative aspect-[16/8] overflow-hidden rounded-xl">
                        <SmartImage src={p.image} alt="" fill sizes="(min-width:768px) 45vw, 100vw" className="object-cover" />
                      </div>
                    )}
                  </div>
                  <div className="mt-auto pt-6">
                    <p className="flex items-start gap-2.5 text-sm text-white/85">
                      <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-brass-light" />
                      <span>
                        <span className="text-mute">You finish with: </span>
                        {p.deliverable}
                      </span>
                    </p>
                    <ul className="mt-4 flex flex-wrap gap-1.5">
                      {p.tools.map((t) => (
                        <li key={t} className="rounded-full border border-edge px-2.5 py-1 text-xs text-mute">
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
        <p className="mt-5 text-xs text-mute/70">Mock-ups use fictional companies and sample numbers for illustration.</p>
      </div>
    </section>
  );
}
