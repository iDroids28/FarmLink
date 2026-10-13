import {
  Sprout,
  Store,
  UserPlus,
  ClipboardList,
  Link2,
  Bell,
  MessageSquare,
  ShieldCheck,
  MapPin,
  CalendarDays,
  Scale,
  Check,
} from "lucide-react";
import GlassCard from "../components/GlassCard.jsx";

/* Public homepage. All content is static and explanatory: no invented
   statistics, sales, matches, or database numbers. */

const PAGE_BG = {
  background:
    "radial-gradient(900px 600px at 12% -10%, rgba(76,175,80,0.22) 0%, rgba(76,175,80,0) 60%)," +
    "radial-gradient(800px 600px at 105% 40%, rgba(46,125,50,0.16) 0%, rgba(46,125,50,0) 60%)," +
    "#FFFFFF",
};
const BUTTON_STYLE = {
  background: "linear-gradient(90deg, #4CAF50, #2E7D32)",
  boxShadow: "0 10px 22px rgba(46,125,50,0.30)",
};

const PROBLEMS = [
  {
    icon: Scale,
    title: "Supply and demand are scattered",
    text: "Farmers know what they can harvest. Businesses know what they need. The two rarely see each other's information in one place.",
  },
  {
    icon: MapPin,
    title: "Finding the right partner takes effort",
    text: "Looking for a nearby supplier or buyer often depends on word of mouth and personal contacts.",
  },
  {
    icon: CalendarDays,
    title: "Quantity, timing and location must line up",
    text: "A possible match only works when the product, amount, date and place fit together.",
  },
];

const STEPS = [
  { icon: UserPlus, title: "Create an account", text: "Sign up and choose your role: Farmer or Business / Buyer." },
  { icon: ClipboardList, title: "Post supply or demand", text: "Farmers post what they can supply. Businesses post what they need." },
  { icon: Link2, title: "FarmLink organizes it", text: "Product, quantity, date and location are kept in one consistent format." },
  { icon: Bell, title: "Get notified of possible matches", text: "When a supply and a demand fit each other, both sides are notified." },
  { icon: MessageSquare, title: "Coordinate directly", text: "View the details and arrange the next steps with the other party." },
];

const FARMER_POINTS = [
  "Create an account and manage your profile",
  "Post your agricultural supply",
  "Provide the product, quantity, availability date and location",
  "Receive possible match notifications",
  "Coordinate with potential buyers",
];

const BUSINESS_POINTS = [
  "Create an account and manage your profile",
  "Post the agricultural products you need",
  "Provide the quantity, schedule and location",
  "View the agricultural supply that is available",
  "Identify possible farmer suppliers and get match notifications",
];

function Bullets({ items }) {
  return (
    <ul className="mt-4 space-y-2.5">
      {items.map((t) => (
        <li key={t} className="flex items-start gap-2.5 text-[13.5px] text-gray-700">
          <Check size={16} strokeWidth={3} className="mt-0.5 shrink-0 text-[#4CAF50]" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

function SectionTitle({ id, eyebrow, title, intro }) {
  return (
    <div className="mx-auto mb-8 max-w-2xl text-center">
      <p className="text-[12px] font-bold uppercase tracking-widest text-[#4CAF50]">{eyebrow}</p>
      <h2 id={id} className="mt-1 text-[24px] font-extrabold tracking-tight text-[#16301F] sm:text-[28px]">
        {title}
      </h2>
      {intro && <p className="mt-2 text-[14px] text-gray-600">{intro}</p>}
    </div>
  );
}

export default function Home({ onGoToLogin, onGoToSignup }) {
  return (
    <div
      className="min-h-screen w-full text-[#16301F]"
      style={{ fontFamily: "'Inter', system-ui, sans-serif", ...PAGE_BG }}
    >
      {/* ---------- Top bar ---------- */}
      <header className="sticky top-0 z-20 border-b border-black/5 bg-white/75 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-5">
          <img src="/logo.png" alt="" className="h-9 w-9 object-contain" />
          <span className="text-[18px] font-extrabold tracking-tight text-[#1B5E20]">
            Farm<span className="text-[#4CAF50]">Link</span>
          </span>
          <nav className="ml-8 hidden items-center gap-6 text-[13.5px] font-medium text-gray-600 md:flex" aria-label="Page sections">
            <a href="#how-it-works" className="hover:text-[#2E7D32]">How it works</a>
            <a href="#farmers" className="hover:text-[#2E7D32]">For Farmers</a>
            <a href="#businesses" className="hover:text-[#2E7D32]">For Businesses</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onGoToLogin}
              className="rounded-full px-4 py-2 text-[13px] font-semibold text-[#2E7D32] hover:bg-[#F4F7F3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50]"
            >
              Log In
            </button>
            <button
              type="button"
              onClick={onGoToSignup}
              className="rounded-full px-4 py-2 text-[13px] font-bold text-white transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] focus-visible:ring-offset-2"
              style={BUTTON_STYLE}
            >
              Sign Up
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* ---------- Hero: what is FarmLink, who is it for ---------- */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-12 lg:grid-cols-2 lg:pt-20" aria-labelledby="hero-title">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-[#DCE7DC] bg-white/80 px-3 py-1 text-[12px] font-semibold text-[#2E7D32]">
              <Sprout size={14} /> Agricultural Supply &amp; Demand Coordination System
            </p>
            <h1 id="hero-title" className="mt-4 text-[34px] font-extrabold leading-tight tracking-tight text-[#16301F] sm:text-[44px]">
              Connect farm supply with business demand.
            </h1>
            <p className="mt-4 max-w-xl text-[15.5px] leading-relaxed text-gray-600">
              FarmLink helps farmers and businesses share what they can supply and what they need,
              so possible matches are easy to find and both sides can coordinate.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onGoToSignup}
                className="rounded-full px-6 py-3 text-[14px] font-bold tracking-wide text-white transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] focus-visible:ring-offset-2"
                style={BUTTON_STYLE}
              >
                Create an account
              </button>
              <button
                type="button"
                onClick={onGoToLogin}
                className="rounded-full border border-[#DCE7DC] bg-white px-6 py-3 text-[14px] font-semibold text-[#2E7D32] hover:bg-[#F4F7F3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50]"
              >
                Log In
              </button>
            </div>
            <p className="mt-4 flex items-center gap-2 text-[12.5px] text-gray-500">
              <ShieldCheck size={15} className="text-[#4CAF50]" />
              FarmLink is for coordination and matching. It does not process payments.
            </p>
            <p className="mt-3 max-w-xl rounded-xl border border-[#DCE7DC] bg-white/80 px-4 py-2.5 text-[12.5px] leading-relaxed text-gray-600">
              <strong className="text-[#16301F]">Current status:</strong> account
              registration and login are available. Supply and demand posting,
              matching and notifications are still being added.
            </p>
          </div>

          <GlassCard opacity={0.8} padding="p-6" className="space-y-5">
            <h2 className="text-[15px] font-semibold text-[#16301F]">FarmLink at a glance</h2>
            <div className="flex items-start gap-3">
              <Sprout size={20} className="mt-0.5 shrink-0 text-[#4CAF50]" />
              <p className="text-[13.5px] text-gray-700"><strong className="text-[#16301F]">Farmers</strong> post the agricultural supply they have available.</p>
            </div>
            <div className="flex items-start gap-3">
              <Store size={20} className="mt-0.5 shrink-0 text-[#4CAF50]" />
              <p className="text-[13.5px] text-gray-700"><strong className="text-[#16301F]">Businesses / Buyers</strong> post the agricultural products they need.</p>
            </div>
            <div className="flex items-start gap-3">
              <Link2 size={20} className="mt-0.5 shrink-0 text-[#4CAF50]" />
              <p className="text-[13.5px] text-gray-700"><strong className="text-[#16301F]">FarmLink</strong> organizes both sides and points out possible matches.</p>
            </div>
            <div className="flex items-start gap-3">
              <Bell size={20} className="mt-0.5 shrink-0 text-[#4CAF50]" />
              <p className="text-[13.5px] text-gray-700"><strong className="text-[#16301F]">Everyone</strong> is notified and can coordinate the next steps.</p>
            </div>
          </GlassCard>
        </section>

        {/* ---------- Problem ---------- */}
        <section className="mx-auto max-w-6xl px-5 py-12" aria-labelledby="problem-title">
          <SectionTitle
            id="problem-title"
            eyebrow="The problem"
            title="Supply and demand need a common place"
            intro="FarmLink exists to close the information gap between the people who grow produce and the people who need it."
          />
          <div className="grid gap-4 md:grid-cols-3">
            {PROBLEMS.map(({ icon: Icon, title, text }) => (
              <GlassCard key={title} opacity={0.8} padding="p-6">
                <Icon size={22} className="text-[#4CAF50]" />
                <h3 className="mt-3 text-[15px] font-semibold">{title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-gray-600">{text}</p>
              </GlassCard>
            ))}
          </div>
        </section>

        {/* ---------- How it works ---------- */}
        <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-12" aria-labelledby="how-title">
          <SectionTitle
            id="how-title"
            eyebrow="How it works"
            title="From sign-up to coordination in five steps"
          />
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title}>
                <GlassCard opacity={0.8} padding="p-5" className="h-full">
                  <div className="flex items-center justify-between">
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold text-white"
                      style={{ background: "linear-gradient(90deg, #4CAF50, #2E7D32)" }}
                    >
                      {i + 1}
                    </span>
                    <Icon size={18} className="text-[#4CAF50]" />
                  </div>
                  <h3 className="mt-3 text-[14px] font-semibold">{title}</h3>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-gray-600">{text}</p>
                </GlassCard>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------- Farmers / Businesses ---------- */}
        <section className="mx-auto grid max-w-6xl gap-5 px-5 py-12 md:grid-cols-2" aria-label="What each role can do">
          <div id="farmers" className="scroll-mt-20">
            <GlassCard opacity={0.85} padding="p-7" className="h-full">
              <div className="flex items-center gap-2.5">
                <Sprout size={22} className="text-[#4CAF50]" />
                <h2 className="text-[19px] font-bold">For Farmers</h2>
              </div>
              <p className="mt-1 text-[13.5px] text-gray-600">Share what you can supply and reach businesses that need it.</p>
              <Bullets items={FARMER_POINTS} />
            </GlassCard>
          </div>
          <div id="businesses" className="scroll-mt-20">
            <GlassCard opacity={0.85} padding="p-7" className="h-full">
              <div className="flex items-center gap-2.5">
                <Store size={22} className="text-[#4CAF50]" />
                <h2 className="text-[19px] font-bold">For Businesses / Buyers</h2>
              </div>
              <p className="mt-1 text-[13.5px] text-gray-600">Tell farmers what you need and see what supply is available.</p>
              <Bullets items={BUSINESS_POINTS} />
            </GlassCard>
          </div>
        </section>

        {/* ---------- Coordination ---------- */}
        <section className="mx-auto max-w-4xl px-5 py-12" aria-labelledby="match-title">
          <GlassCard opacity={0.85} padding="p-8">
            <h2 id="match-title" className="text-[21px] font-bold">How FarmLink helps coordinate supply and demand</h2>
            <p className="mt-3 text-[14px] leading-relaxed text-gray-600">
              Every supply and demand post uses the same details: the product, the
              quantity, the date and the location. Because the information is organized
              the same way, FarmLink can compare the two sides and point out possible
              matches.
            </p>
            <p className="mt-3 text-[14px] leading-relaxed text-gray-600">
              FarmLink is designed to match on a first-posted, first-allocated basis,
              with farmer confirmation. Supply from several farmers can add up to cover
              one demand. For example, a business that needs 200 kg could be covered by
              farmers offering 30 kg, 25 kg and 145 kg. Each farmer confirms their part,
              and if a farmer declines, FarmLink looks for the next compatible supply.
            </p>
            <p className="mt-3 text-[14px] leading-relaxed text-gray-600">
              FarmLink stays focused on coordination and matching. Payments are not
              part of the system.
            </p>
          </GlassCard>
        </section>

        {/* ---------- Final call to action ---------- */}
        <section className="mx-auto max-w-6xl px-5 pb-20 pt-6 text-center" aria-labelledby="cta-title">
          <h2 id="cta-title" className="text-[24px] font-extrabold tracking-tight">Ready to get started?</h2>
          <p className="mt-2 text-[14px] text-gray-600">Create an account and choose whether you are a Farmer or a Business / Buyer.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={onGoToSignup}
              className="rounded-full px-6 py-3 text-[14px] font-bold tracking-wide text-white transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] focus-visible:ring-offset-2"
              style={BUTTON_STYLE}
            >
              Sign Up
            </button>
            <button
              type="button"
              onClick={onGoToLogin}
              className="rounded-full border border-[#DCE7DC] bg-white px-6 py-3 text-[14px] font-semibold text-[#2E7D32] hover:bg-[#F4F7F3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50]"
            >
              I already have an account
            </button>
          </div>
        </section>
      </main>

      <footer className="border-t border-black/5 bg-white/70 py-5 text-center text-[12.5px] text-gray-500">
        FarmLink · Agricultural Supply &amp; Demand Coordination System
      </footer>
    </div>
  );
}