import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import {
  ArrowRight,
  Play,
  Sparkles,
  Camera,
  Bookmark,
  Users,
  Link2,
  Star,
  Gem,
  Plus
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col grid-background">
      {/* Top Navbar */}
      <Navbar />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-6">
        {/* ========================================================= */}
        {/* HERO SECTION — EXACT REFERENCE EDITORIAL LAYOUT           */}
        {/* ========================================================= */}
        <section className="bg-white border-2 border-black rounded-[4px] p-6 lg:p-8 shadow-neo relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Left & Middle Column (Headline, CTA, Features + Couple Graphic) */}
            <div className="lg:col-span-7 flex flex-col justify-between h-full space-y-8">
              
              {/* Upper Content: Text & Couple Image */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
                {/* Left Text */}
                <div className="sm:col-span-7 space-y-4">
                  {/* Badge */}
                  <div className="inline-block bg-blue text-white text-[11px] font-extrabold font-mono tracking-wider px-2.5 py-1 rounded-[2px] uppercase">
                    AI-POWERED FASHION
                  </div>

                  {/* Main Headline */}
                  <h1 className="text-4xl sm:text-5xl font-black text-black leading-[1.08] tracking-tight">
                    Two people.<br />
                    One perfect<br />
                    <span className="text-blue">look.</span>
                  </h1>

                  {/* Subtitle */}
                  <p className="text-xs sm:text-sm text-muted leading-relaxed max-w-sm">
                    Tell us the occasion, style and preferences. We&apos;ll help you coordinate outfits and visualize your looks together using YouCam&apos;s virtual try-on.
                  </p>

                  {/* Action Buttons */}
                  <div className="pt-2 flex items-center gap-3 flex-wrap">
                    <Link
                      href="/duomatch"
                      className="lm-btn-primary !py-2.5 !px-5 !text-xs !font-bold flex items-center gap-2 shadow-neo-sm"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span>Start DuoMatch</span>
                    </Link>

                    <a
                      href="#explore"
                      className="lm-btn-secondary !py-2.5 !px-4 !text-xs !font-bold flex items-center gap-1.5 shadow-neo-sm"
                    >
                      <span>Explore How It Works</span>
                      <Play className="w-3 h-3 fill-current ml-0.5" />
                    </a>
                  </div>
                </div>

                {/* Couple Cutout & Blue Graphic Frame */}
                <div className="sm:col-span-5 relative flex items-center justify-center py-2 pr-3 pt-3">
                  <div className="relative w-full max-w-[230px] aspect-[4/5]">
                    {/* Blue Geometric Backdrop Frame */}
                    <div className="absolute -top-3 -right-3 w-full h-full bg-blue border border-black rounded-[2px]">
                      {/* Top-Right Plus Accent */}
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-black border border-white text-white flex items-center justify-center font-bold text-xs shadow-sm">
                        <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    </div>

                    {/* Fashion Couple Portrait */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/images/hero_fashion_couple.jpg"
                      alt="Coordinated Couple"
                      className="relative z-10 w-full h-full object-cover object-top border-2 border-black shadow-neo-sm"
                    />

                    {/* Bottom-Right "COORDINATED STYLES" Black Badge */}
                    <div className="absolute -bottom-2 -right-2 z-20 bg-black text-white border border-white px-2.5 py-1 text-right shadow-md">
                      <div className="text-[9px] font-mono font-bold tracking-wider uppercase leading-none">
                        COORDINATED
                      </div>
                      <div className="text-[9px] font-mono font-bold tracking-wider uppercase leading-none mt-0.5 text-blue">
                        STYLES
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lower Section: 3-Feature Strip */}
              <div className="pt-6 border-t border-light grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Feature 1 */}
                <div className="flex items-center gap-3 sm:border-r border-light sm:pr-3">
                  <div className="w-8 h-8 rounded-full border border-light bg-surface flex items-center justify-center text-blue shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-black">AI Style Suggestions</h4>
                    <p className="text-[11px] text-muted">Personalized for both of you</p>
                  </div>
                </div>

                {/* Feature 2 */}
                <div className="flex items-center gap-3 sm:border-r border-light sm:pr-3">
                  <div className="w-8 h-8 rounded-full border border-light bg-surface flex items-center justify-center text-blue shrink-0">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-black">Virtual Try-On</h4>
                    <p className="text-[11px] text-muted">Powered by YouCam API</p>
                  </div>
                </div>

                {/* Feature 3 */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full border border-light bg-surface flex items-center justify-center text-blue shrink-0">
                    <Bookmark className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-black">Save & Share</h4>
                    <p className="text-[11px] text-muted">Your lookbook, anytime</p>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column (Featured DuoMatch Card) */}
            <div className="lg:col-span-5">
              <div className="bg-white border-2 border-black rounded-[4px] overflow-hidden shadow-neo relative">
                {/* Black Top Header */}
                <div className="bg-black px-4 py-2.5 flex items-center justify-between text-white border-b-2 border-black">
                  <span className="font-mono font-bold text-xs tracking-wider uppercase">
                    FEATURED DUOMATCH
                  </span>
                  <span className="bg-blue text-white text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-[2px] uppercase">
                    TRENDING
                  </span>
                </div>

                {/* Two Side-by-Side Person Cards */}
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Person 1 Card */}
                    <div className="space-y-2">
                      <div className="relative aspect-[3/4] bg-surface border border-black rounded-[3px] overflow-hidden">
                        {/* Person 1 Badge */}
                        <div className="absolute top-2 left-2 z-10 bg-black text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-[2px]">
                          PERSON 1
                        </div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=600&q=80"
                          alt="Person 1 Look"
                          className="w-full h-full object-cover object-top"
                        />
                      </div>

                      {/* Label & Arrow Button */}
                      <div className="flex items-center justify-between gap-1 pt-1">
                        <div className="min-w-0">
                          <p className="text-xs font-black text-black truncate">Midnight Navy Blazer</p>
                          <p className="text-[10px] text-muted truncate">Pleated Ivory Trousers</p>
                        </div>
                        <Link
                          href="/duomatch"
                          className="w-6 h-6 bg-blue hover:bg-blue-hover text-white rounded-[2px] flex items-center justify-center shrink-0 border border-black transition-colors"
                          title="View Outfit"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>

                    {/* Person 2 Card */}
                    <div className="space-y-2">
                      <div className="relative aspect-[3/4] bg-surface border border-black rounded-[3px] overflow-hidden">
                        {/* Person 2 Badge */}
                        <div className="absolute top-2 left-2 z-10 bg-black text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-[2px]">
                          PERSON 2
                        </div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=600&q=80"
                          alt="Person 2 Look"
                          className="w-full h-full object-cover object-top"
                        />
                      </div>

                      {/* Label & Arrow Button */}
                      <div className="flex items-center justify-between gap-1 pt-1">
                        <div className="min-w-0">
                          <p className="text-xs font-black text-black truncate">Sapphire Silk Gown</p>
                          <p className="text-[10px] text-muted truncate">Cobalt Accent Clutch</p>
                        </div>
                        <Link
                          href="/duomatch"
                          className="w-6 h-6 bg-blue hover:bg-blue-hover text-white rounded-[2px] flex items-center justify-center shrink-0 border border-black transition-colors"
                          title="View Outfit"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Metadata Bar */}
                  <div className="p-2.5 bg-surface border border-light rounded-[4px] flex items-center justify-between gap-2 text-left">
                    {/* Coordination */}
                    <div className="flex items-center gap-1.5 flex-1 min-w-0 border-r border-light pr-2">
                      <Link2 className="w-3.5 h-3.5 text-blue shrink-0" />
                      <div className="min-w-0">
                        <span className="block text-[9px] text-muted font-medium leading-none">Coordination</span>
                        <span className="text-[11px] font-bold text-black leading-tight block truncate">98% Harmonious</span>
                      </div>
                    </div>

                    {/* Occasion */}
                    <div className="flex items-center gap-1.5 flex-1 min-w-0 border-r border-light pr-2">
                      <Star className="w-3.5 h-3.5 text-blue shrink-0" />
                      <div className="min-w-0">
                        <span className="block text-[9px] text-muted font-medium leading-none">Occasion</span>
                        <span className="text-[11px] font-bold text-black leading-tight block truncate">Wedding Guest</span>
                      </div>
                    </div>

                    {/* Style */}
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <Gem className="w-3.5 h-3.5 text-blue shrink-0" />
                      <div className="min-w-0">
                        <span className="block text-[9px] text-muted font-medium leading-none">Style</span>
                        <span className="text-[11px] font-bold text-black leading-tight block truncate">Modern & Elegant</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Electric Blue Bottom-Right Corner Triangle Accent */}
                <div
                  className="absolute bottom-0 right-0 w-6 h-6 bg-blue pointer-events-none"
                  style={{ clipPath: "polygon(100% 0, 0 100%, 100% 100%)" }}
                />
              </div>
            </div>

          </div>
        </section>

        {/* ========================================================= */}
        {/* "WHY LOOKMATES?" SECTION — EXACT 4 HORIZONTAL CARDS       */}
        {/* ========================================================= */}
        <section id="explore" className="pt-4 pb-12 space-y-4">
          {/* Section Header */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-5 h-1.5 bg-blue inline-block rounded-[1px]"></span>
              <span className="text-[11px] font-mono font-bold tracking-wider text-blue uppercase">
                EXPLORE THE POSSIBILITIES
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
              Why <span className="text-blue">LookMates?</span>
            </h2>
          </div>

          {/* 4 Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: DuoMatch */}
            <Link
              href="/duomatch"
              className="bg-white border-2 border-black rounded-[4px] p-4 flex items-center gap-3.5 shadow-neo-sm hover:-translate-y-0.5 hover:shadow-neo transition-all group"
            >
              <div className="w-10 h-10 rounded-[4px] bg-blue-soft border border-blue/30 flex items-center justify-center text-blue shrink-0 group-hover:bg-blue group-hover:text-white transition-colors">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-black uppercase tracking-wide">
                  DuoMatch
                </h3>
                <p className="text-[11px] text-muted mt-0.5">
                  Coordinate outfits for two people
                </p>
              </div>
            </Link>

            {/* Card 2: AI Recommendations */}
            <Link
              href="/duomatch"
              className="bg-white border-2 border-black rounded-[4px] p-4 flex items-center gap-3.5 shadow-neo-sm hover:-translate-y-0.5 hover:shadow-neo transition-all group"
            >
              <div className="w-10 h-10 rounded-[4px] bg-blue-soft border border-blue/30 flex items-center justify-center text-blue shrink-0 group-hover:bg-blue group-hover:text-white transition-colors">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-black uppercase tracking-wide">
                  AI Recommendations
                </h3>
                <p className="text-[11px] text-muted mt-0.5">
                  Occasion-aware styling
                </p>
              </div>
            </Link>

            {/* Card 3: YouCam VTO */}
            <Link
              href="/duomatch"
              className="bg-white border-2 border-black rounded-[4px] p-4 flex items-center gap-3.5 shadow-neo-sm hover:-translate-y-0.5 hover:shadow-neo transition-all group"
            >
              <div className="w-10 h-10 rounded-[4px] bg-blue-soft border border-blue/30 flex items-center justify-center text-blue shrink-0 group-hover:bg-blue group-hover:text-white transition-colors">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-black uppercase tracking-wide">
                  YouCam VTO
                </h3>
                <p className="text-[11px] text-muted mt-0.5">
                  Real virtual try-on results
                </p>
              </div>
            </Link>

            {/* Card 4: Lookbook */}
            <Link
              href="/lookbook"
              className="bg-white border-2 border-black rounded-[4px] p-4 flex items-center gap-3.5 shadow-neo-sm hover:-translate-y-0.5 hover:shadow-neo transition-all group"
            >
              <div className="w-10 h-10 rounded-[4px] bg-blue-soft border border-blue/30 flex items-center justify-center text-blue shrink-0 group-hover:bg-blue group-hover:text-white transition-colors">
                <Bookmark className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-black uppercase tracking-wide">
                  Lookbook
                </h3>
                <p className="text-[11px] text-muted mt-0.5">
                  Save, revisit, share
                </p>
              </div>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 border-t border-light flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-black">LookMates.</span>
          <span>© 2026 Different styles. One perfect moment.</span>
        </div>
        <div className="font-mono text-[11px]">
          YouCam API Skin AI & eCommerce VTO Hackathon • DuoMatch Mode
        </div>
      </footer>
    </div>
  );
}
