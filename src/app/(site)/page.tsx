import { getSiteContent } from "@/lib/db";
import { DEFAULT_CURRENCY, coursePrice, formatPrice } from "@/lib/commerce";
import { razorpayConfig } from "@/lib/payments/razorpay";
import { whatsappHref } from "@/lib/utils";
import { Header } from "@/components/site/Header";
import { Hero } from "@/components/site/Hero";
import { ProofStrip } from "@/components/site/ProofStrip";
import { Problem } from "@/components/site/Problem";
import { Comparison } from "@/components/site/Comparison";
import { Flagship } from "@/components/site/Flagship";
import { Projects, ToolsMarquee } from "@/components/site/Projects";
import { Calculators } from "@/components/site/Calculators";
import { Courses } from "@/components/site/Courses";
import { Faculty } from "@/components/site/Faculty";
import { Testimonials } from "@/components/site/Testimonials";
import { Pricing } from "@/components/site/Pricing";
import { Events } from "@/components/site/Events";
import { Faq } from "@/components/site/Faq";
import { Enquire } from "@/components/site/Enquire";
import { Footer } from "@/components/site/Footer";
import { MobileCta } from "@/components/site/MobileCta";
import { WhatsAppChat } from "@/components/site/WhatsAppChat";
import { CartDrawer } from "@/components/site/cart/CartDrawer";

// Statically rendered, refreshed on demand when the admin saves (revalidatePath("/")), with a safety net.
export const revalidate = 300;

/**
 * v4 finance landing page — section order follows plan.md §3:
 * pain → proof → alternatives → program → product → tools → catalogue → people → price → guarantees.
 */
export default async function HomePage() {
  const content = await getSiteContent();
  const { settings, courses } = content;
  const currency = settings.currency ?? DEFAULT_CURRENCY;

  const flagship = courses.find((c) => c.id === settings.flagshipCourseId) ?? courses.find((c) => c.featured);
  const shortCourses = courses.filter((c) => c.id !== flagship?.id);
  const flagshipPlan = content.plans.find((p) => p.courseId && p.courseId === flagship?.id);
  const ctaLabel = flagship ? `Join now · ${formatPrice(coursePrice(flagship), currency)}` : settings.hero.primaryCta;

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = content.events.filter((e) => e.date >= today);
  const nextEvent = upcoming.find((e) => e.kind === "New Batch") ?? upcoming[0];
  const wa = whatsappHref(settings.contact.whatsapp, settings.contact.whatsappMessage);
  const rzp = razorpayConfig();
  const payments = { provider: rzp.enabled ? ("razorpay" as const) : ("demo" as const), testMode: rzp.mode === "test" };

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "EducationalOrganization",
      name: settings.name,
      slogan: settings.tagline,
      email: settings.contact.email,
      telephone: settings.contact.phone,
      sameAs: settings.socials.map((s) => s.href).filter((h) => h.startsWith("http")),
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: courses.map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "Course",
          name: c.title,
          description: c.subtitle,
          provider: { "@type": "Organization", name: settings.name },
          aggregateRating: { "@type": "AggregateRating", ratingValue: c.rating, reviewCount: c.reviews },
          offers: { "@type": "Offer", price: coursePrice(c), priceCurrency: currency.code, category: "Paid", availability: "https://schema.org/InStock" },
          hasCourseInstance: { "@type": "CourseInstance", courseMode: c.format.toLowerCase().includes("self") ? "Online" : "Blended", inLanguage: "en" },
        },
      })),
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Header settings={settings} ctaLabel={ctaLabel} />
      <main id="main">
        <Hero settings={settings} nextEvent={nextEvent} faces={content.testimonials} flagship={flagship} currency={currency} />
        <ProofStrip stats={content.stats} brandName={settings.name} />
        <ToolsMarquee tools={content.tools} />
        <Problem />
        <Comparison brandName={settings.name} />
        {flagship && (
          <Flagship
            course={flagship}
            modules={content.modules}
            plan={flagshipPlan}
            settings={settings}
            currency={currency}
            projectCount={content.projects.length}
            toolCount={content.tools.length}
          />
        )}
        <Projects projects={content.projects} />
        <Calculators currency={currency} />
        <Courses courses={shortCourses} faculty={content.faculty} currency={currency} />
        <Faculty faculty={content.faculty} />
        <Testimonials items={content.testimonials} />
        <Pricing plans={content.plans} courses={courses} currency={currency} />
        <Events events={upcoming} />
        <Faq faqs={content.faqs} contact={settings.contact} />
        <Enquire settings={settings} />
      </main>
      <Footer settings={settings} />
      <MobileCta label={ctaLabel} href="#learn" />
      <WhatsAppChat number={settings.contact.whatsapp} message={settings.contact.whatsappMessage} schoolName={settings.name} />
      <CartDrawer currency={currency} whatsappHref={wa} payments={payments} brandName={settings.name} />
    </>
  );
}
