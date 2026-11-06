import { MotionProvider } from "@/components/motion/MotionProvider";
import { ScrollProgress } from "@/components/motion/ScrollProgress";
import { PageReady } from "@/components/motion/PageReady";
import { VisitTracker } from "@/components/site/VisitTracker";

/**
 * Finance landing shell — motion restraint by design (see plan.md §1 #8):
 * no preloader, custom cursor, film grain or scroll hijacking; native smooth anchors.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <MotionProvider>
      <div className="bg-night text-white">
        <a
          href="#main"
          className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-full bg-brass-light px-5 py-3 text-sm font-semibold text-ink transition-transform focus:translate-y-0"
        >
          Skip to content
        </a>
        <PageReady />
        <ScrollProgress />
        <VisitTracker />
        {children}
      </div>
    </MotionProvider>
  );
}
