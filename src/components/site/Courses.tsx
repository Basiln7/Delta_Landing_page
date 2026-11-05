"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Award,
  BarChart3,
  BookOpen,
  Check,
  ChevronDown,
  Clock,
  Globe2,
  PlayCircle,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Star,
  Users,
  X,
} from "lucide-react";
import { SectionHeader } from "@/components/site/fin";
import { SmartImage } from "@/components/site/SmartImage";
import { lockScroll } from "@/components/motion/SmoothScroll";
import { CATALOG_EVENT, cart, useCart, type CartItem, type CatalogFilter } from "@/components/site/cart/store";
import { coursePrice, discountPercent, formatPrice, type Currency } from "@/lib/commerce";
import { cn } from "@/lib/utils";
import type { Course, FacultyMember } from "@/lib/types";

const ease = [0.16, 1, 0.3, 1] as const;
const ALL = "All courses";

const SORTS = {
  popular: { label: "Most popular", fn: (a: Course, b: Course) => b.students - a.students },
  rating: { label: "Highest rated", fn: (a: Course, b: Course) => b.rating - a.rating || b.reviews - a.reviews },
  "price-asc": { label: "Price: low to high", fn: (a: Course, b: Course) => coursePrice(a) - coursePrice(b) },
  "price-desc": { label: "Price: high to low", fn: (a: Course, b: Course) => coursePrice(b) - coursePrice(a) },
} as const;
type SortKey = keyof typeof SORTS;

export function courseToCartItem(c: Course): CartItem {
  const price = coursePrice(c);
  return {
    kind: "course",
    id: c.id,
    title: c.title,
    price,
    compareAt: price < c.price ? c.price : undefined,
    image: c.image,
    subtitle: `${c.instructor} · ${c.format}`,
  };
}

const compact = (n: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export function Stars({ rating, className, tone = "dark" }: { rating: number; className?: string; tone?: "dark" | "light" }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`Rated ${rating} out of 5`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, rating - i));
        return (
          <span key={i} className="relative inline-block h-3.5 w-3.5">
            <Star className={cn("absolute inset-0 h-3.5 w-3.5", tone === "dark" ? "text-white/15" : "text-ink/15")} fill="currentColor" strokeWidth={0} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className={cn("h-3.5 w-3.5", tone === "dark" ? "text-brass-light" : "text-[#d4a106]")} fill="currentColor" strokeWidth={0} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

function AddButton({ course, className, onAdded }: { course: Course; className?: string; onAdded?: () => void }) {
  const { items } = useCart();
  const inCart = items.some((i) => i.kind === "course" && i.id === course.id);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (inCart) cart.open();
        else {
          cart.add(courseToCartItem(course));
          onAdded?.();
        }
      }}
      className={cn(
        inCart ? "btn-ghost-dark h-10 px-4 text-sm text-brass-light" : "btn-primary h-10 px-4 text-sm",
        className,
      )}
    >
      {inCart ? (
        <>
          <Check className="h-4 w-4" /> In cart
        </>
      ) : (
        <>
          <ShoppingBag className="h-4 w-4" /> Add to cart
        </>
      )}
    </button>
  );
}

function CourseCard({ course, currency, onOpen }: { course: Course; currency: Currency; onOpen: () => void }) {
  const price = coursePrice(course);
  const off = discountPercent(course);
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease }}
      className="card-dark group flex flex-col overflow-hidden transition-colors duration-300 hover:border-white/20"
    >
      <button type="button" onClick={onOpen} className="relative block aspect-[16/9] overflow-hidden bg-night-3 text-left" aria-label={`View details for ${course.title}`}>
        <SmartImage
          src={course.image}
          alt=""
          fill
          sizes="(min-width:1280px) 30vw, (min-width:640px) 45vw, 100vw"
          className="object-cover opacity-80 transition-[transform,opacity] duration-700 group-hover:scale-[1.03] group-hover:opacity-95"
        />
        <span className="absolute inset-0 bg-gradient-to-t from-night-2 via-night-2/10 to-transparent" />
        <span className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {course.badge && <span className="rounded-full bg-brass-light px-2.5 py-1 text-[0.68rem] font-semibold text-ink">{course.badge}</span>}
          <span className="rounded-full border border-white/15 bg-night/70 px-2.5 py-1 text-[0.68rem] text-white/85 backdrop-blur-md">{course.format}</span>
        </span>
        {off > 0 && <span className="num absolute right-3 top-3 rounded-full bg-emerald/90 px-2.5 py-1 text-[0.68rem] font-semibold text-night">−{off}%</span>}
      </button>

      <div className="flex flex-1 flex-col p-5">
        <p className="eyebrow text-[0.6rem] text-mute">{course.category}</p>
        <h3 className="mt-2">
          <button type="button" onClick={onOpen} className="display text-left text-[1.4rem] leading-[1.15] text-white transition-colors hover:text-brass-light">
            {course.title}
          </button>
        </h3>
        <p className="mt-1.5 text-sm text-mute">with {course.instructor}</p>

        <div className="mt-3 flex items-center gap-2 text-sm">
          <span className="num font-semibold text-white">{course.rating.toFixed(1)}</span>
          <Stars rating={course.rating} />
          <span className="num text-xs text-mute">({course.reviews.toLocaleString("en-IN")})</span>
        </div>

        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-mute">
          <li className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /><span className="num">{course.hours}</span> hrs</li>
          <li className="inline-flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /><span className="num">{course.lessons}</span> lessons</li>
          <li className="inline-flex items-center gap-1"><BarChart3 className="h-3.5 w-3.5" />{course.level}</li>
        </ul>

        <div className="mt-auto pt-5">
          <div className="flex items-end justify-between gap-3 border-t border-edge pt-4">
            <div>
              <p className="num text-2xl font-semibold leading-none text-white">{formatPrice(price, currency)}</p>
              {price < course.price && <p className="num mt-1 text-xs text-mute line-through">{formatPrice(course.price, currency)}</p>}
            </div>
            <AddButton course={course} />
          </div>
        </div>
      </div>
    </motion.article>
  );
}

function CourseDetail({
  course,
  instructor,
  currency,
  onClose,
}: {
  course: Course;
  instructor?: FacultyMember;
  currency: Currency;
  onClose: () => void;
}) {
  const price = coursePrice(course);
  const off = discountPercent(course);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    lockScroll(true);
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      lockScroll(false);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[64] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={course.title}>
      <motion.button
        type="button"
        tabIndex={-1}
        aria-label="Close details"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-night/80 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.45, ease }}
        className="relative flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[24px] border border-edge bg-night-2 text-white shadow-2xl sm:rounded-[24px]"
      >
        <div className="overflow-y-auto overscroll-contain" data-lenis-prevent>
          {/* Header image */}
          <div className="relative h-52 sm:h-64">
            <SmartImage src={course.image} alt="" fill sizes="(min-width:1024px) 64rem, 100vw" className="object-cover opacity-70" />
            <div className="absolute inset-0 bg-gradient-to-t from-night-2 via-night-2/60 to-night-2/10" />
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-edge bg-night/80 text-white backdrop-blur transition-colors hover:bg-night-3"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
              <div className="flex flex-wrap gap-2">
                {course.badge && <span className="rounded-full bg-brass-light px-2.5 py-1 text-xs font-semibold text-ink">{course.badge}</span>}
                <span className="rounded-full border border-edge bg-night/60 px-2.5 py-1 text-xs text-white/80">{course.category}</span>
              </div>
              <h2 className="display mt-3 text-3xl sm:text-4xl">{course.title}</h2>
              <p className="mt-2 max-w-2xl text-mute">{course.subtitle}</p>
            </div>
          </div>

          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_20rem]">
            <div className="space-y-8">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-mute">
                <span className="inline-flex items-center gap-1.5">
                  <span className="num font-semibold text-white">{course.rating.toFixed(1)}</span>
                  <Stars rating={course.rating} /> (<span className="num">{course.reviews.toLocaleString("en-IN")}</span> reviews)
                </span>
                <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" /> <span className="num">{compact(course.students)}</span> learners</span>
                <span className="inline-flex items-center gap-1.5"><Globe2 className="h-4 w-4" /> {course.language}</span>
              </div>

              <section>
                <h3 className="eyebrow text-mute">What you&apos;ll learn</h3>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {course.outcomes.map((o) => (
                    <li key={o} className="flex gap-2.5 text-[0.95rem] text-white/90">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brass-light" /> {o}
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="eyebrow text-mute">
                  Curriculum · <span className="num">{course.curriculum.length}</span> modules · <span className="num">{course.lessons}</span> lessons
                </h3>
                <ol className="mt-4 divide-y divide-edge overflow-hidden rounded-2xl border border-edge bg-night">
                  {course.curriculum.map((m, i) => (
                    <li key={m} className="flex items-center gap-4 px-4 py-3.5 text-sm">
                      <span className="num text-xs text-mute">{String(i + 1).padStart(2, "0")}</span>
                      <span className="flex-1 text-white/90">{m}</span>
                      <PlayCircle className="h-4 w-4 text-white/25" />
                    </li>
                  ))}
                </ol>
              </section>

              {instructor && (
                <section className="flex gap-4 rounded-2xl border border-edge bg-night-3/60 p-5">
                  <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-night-3">
                    <SmartImage src={instructor.image} alt={instructor.name} fill sizes="64px" className="object-cover" />
                  </span>
                  <div>
                    <p className="eyebrow text-mute">Your mentor</p>
                    <p className="display mt-1 text-xl">{instructor.name}</p>
                    <p className="text-sm text-brass-light">{instructor.role}</p>
                    <p className="mt-2 text-sm leading-relaxed text-mute">{instructor.bio}</p>
                  </div>
                </section>
              )}
            </div>

            {/* Price box */}
            <aside className="lg:sticky lg:top-0 lg:self-start">
              <div className="card-dark p-6">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="num text-4xl font-semibold">{formatPrice(price, currency)}</span>
                  {price < course.price && <span className="num text-mute line-through">{formatPrice(course.price, currency)}</span>}
                </div>
                {off > 0 && <p className="mt-1 text-sm font-medium text-emerald"><span className="num">{off}%</span> off · launch price</p>}
                <p className="mt-2 text-xs text-mute">Education only — not investment advice.</p>
                <div className="mt-5 grid gap-2">
                  <AddButton course={course} className="h-12 w-full" onAdded={onClose} />
                  <button
                    type="button"
                    onClick={() => {
                      cart.add(courseToCartItem(course), { open: false });
                      onClose();
                      cart.open("checkout");
                    }}
                    className="btn-ghost-dark h-12 w-full"
                  >
                    Buy now
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[0.7rem] text-mute">
                  <span className="inline-flex items-center gap-1"><RotateCcw className="h-3 w-3" /> 7-day refund</span>
                  <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Secure via Razorpay</span>
                </div>
                <ul className="mt-5 space-y-2.5 border-t border-edge pt-5 text-sm text-white/80">
                  <li className="flex items-center gap-2.5"><Clock className="h-4 w-4 text-mute" /><span className="num">{course.hours}</span> hours of content</li>
                  <li className="flex items-center gap-2.5"><BookOpen className="h-4 w-4 text-mute" /><span className="num">{course.lessons}</span> lessons · {course.format}</li>
                  <li className="flex items-center gap-2.5"><BarChart3 className="h-4 w-4 text-mute" />{course.level}</li>
                  {course.certificate && <li className="flex items-center gap-2.5"><Award className="h-4 w-4 text-mute" />Certificate with a unique ID</li>}
                  <li className="flex items-center gap-2.5"><Check className="h-4 w-4 text-mute" />Lifetime access to recordings</li>
                </ul>
              </div>
            </aside>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/** Course catalogue: category tabs, live search, sorting, animated grid and a detail modal. */
export function Courses({ courses, faculty, currency }: { courses: Course[]; faculty: FacultyMember[]; currency: Currency }) {
  const [category, setCategory] = useState<string>(ALL);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("popular");
  const [openId, setOpenId] = useState<string | null>(null);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    courses.forEach((c) => counts.set(c.category, (counts.get(c.category) ?? 0) + 1));
    return [[ALL, courses.length] as const, ...Array.from(counts.entries())];
  }, [courses]);

  // Hero search and Learning-path tiles drive the catalogue through a window event.
  useEffect(() => {
    const onFilter = (e: Event) => {
      const { category: cat, query: q } = (e as CustomEvent<CatalogFilter>).detail ?? {};
      setCategory(cat && categories.some(([c]) => c === cat) ? cat : ALL);
      setQuery(q ?? "");
    };
    window.addEventListener(CATALOG_EVENT, onFilter);
    return () => window.removeEventListener(CATALOG_EVENT, onFilter);
  }, [categories]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return courses
      .filter((c) => category === ALL || c.category === category)
      .filter((c) => !q || `${c.title} ${c.subtitle} ${c.category} ${c.instructor} ${c.outcomes.join(" ")}`.toLowerCase().includes(q))
      .sort(SORTS[sort].fn);
  }, [courses, category, query, sort]);

  const selected = courses.find((c) => c.id === openId);
  const closeDetail = useCallback(() => setOpenId(null), []);

  return (
    <section id="courses" className="relative bg-night py-24 text-white sm:py-32">
      <div className="container-x">
        <div className="flex flex-col justify-between gap-10 lg:flex-row lg:items-end">
          <SectionHeader
            tone="dark"
            eyebrow="Short courses"
            title="Go deeper with *short courses*."
            lede="Focused courses on trading, investing and automation — buy one on its own, or get every course with the Pro Trader Pass."
          />
          <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
            <label className="relative flex-1 lg:w-80">
              <span className="sr-only">Search courses</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search options, SIP, n8n…"
                className="h-12 w-full rounded-full border border-edge bg-night-2 pl-11 pr-4 text-sm text-white outline-none transition-colors placeholder:text-mute/70 focus:border-brass-light/60 focus:ring-2 focus:ring-brass-light/20"
              />
            </label>
            <label className="relative">
              <span className="sr-only">Sort courses</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="h-12 w-full appearance-none rounded-full border border-edge bg-night-2 pl-5 pr-10 text-sm text-white outline-none focus:border-brass-light/60 focus:ring-2 focus:ring-brass-light/20 sm:w-auto"
              >
                {Object.entries(SORTS).map(([k, v]) => (
                  <option key={k} value={k} className="bg-night-2 text-white">
                    {v.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
            </label>
          </div>
        </div>

        {/* Category tabs — segmented control */}
        <LayoutGroup id="catalog-tabs">
          <div
            role="tablist"
            aria-label="Course categories"
            className="no-scrollbar mt-10 flex w-full gap-1 overflow-x-auto rounded-full border border-edge bg-night-2 p-1 sm:w-fit"
            data-lenis-prevent
          >
            {categories.map(([name, count]) => {
              const active = category === name;
              return (
                <button
                  key={name}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setCategory(name)}
                  className={cn("relative shrink-0 rounded-full px-4 py-2 text-sm transition-colors", active ? "text-ink" : "text-mute hover:text-white")}
                >
                  {active && <motion.span layoutId="catalog-pill" className="absolute inset-0 rounded-full bg-brass-light" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
                  <span className="relative">
                    {name} <span className={cn("num ml-1 text-xs", active ? "text-ink/60" : "text-mute/70")}>{count}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </LayoutGroup>

        <p className="mt-6 text-sm text-mute" aria-live="polite">
          Showing <span className="num">{visible.length}</span> of <span className="num">{courses.length}</span> courses{query && <> for “{query}”</>}
        </p>

        <motion.div layout className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {visible.map((c) => (
              <CourseCard key={c.id} course={c} currency={currency} onOpen={() => setOpenId(c.id)} />
            ))}
          </AnimatePresence>
        </motion.div>

        {visible.length === 0 && (
          <div className="mt-6 rounded-[20px] border border-dashed border-edge p-12 text-center">
            <p className="display text-2xl">No courses match that search.</p>
            <p className="mt-2 text-mute">Try another keyword, or talk to a mentor for a personal recommendation.</p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setCategory(ALL);
              }}
              className="btn-ghost-dark mt-6"
            >
              Show all courses
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selected && (
          <CourseDetail
            key={selected.id}
            course={selected}
            instructor={faculty.find((f) => f.name === selected.instructor)}
            currency={currency}
            onClose={closeDetail}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
