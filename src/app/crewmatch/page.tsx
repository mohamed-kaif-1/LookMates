import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Users, AlertCircle, ArrowLeft, Sparkles } from "lucide-react";

export default function CrewMatchPlaceholderPage() {
  return (
    <div className="min-h-screen flex flex-col grid-background">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto px-4 py-16 flex flex-col items-center justify-center text-center">
        <div className="bg-white border-2 border-[#111827] rounded-[4px] p-8 sm:p-12 max-w-2xl shadow-[4px_4px_0px_#080B10]">
          {/* Header Tag */}
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#F0F4F8] border border-[#111827] rounded-[2px] text-xs font-mono font-bold uppercase tracking-wider text-[#647084] mb-6">
            <Users className="w-3.5 h-3.5 text-[#1764FF]" />
            Intentionally Unimplemented Placeholder
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-[#080B10] mb-4 tracking-tight">
            CrewMatch — Group Styling
          </h1>

          <div className="p-4 bg-[#F7F9FC] border-2 border-dashed border-[#DCE3EF] text-left text-sm text-[#647084] space-y-3 mb-8 rounded-[4px]">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
              <div>
                <strong className="text-[#080B10] block">Mandatory Hackathon Scope Constraint:</strong>
                As instructed in the project architecture guidelines, the hackathon deliverable is strictly focused on perfecting the <strong>DuoMatch (CoupleMatch)</strong> end-to-end user journey with real YouCam apparel VTO and side-by-side couple composition.
              </div>
            </div>
            <p className="text-xs text-[#647084] font-mono pl-6">
              CrewMatch (multi-person group coordination for 3–5 users) is intentionally reserved for post-hackathon releases and contains no functional group-matching features.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/duomatch"
              className="lm-btn-primary !py-2.5 !px-6 text-sm font-bold flex items-center gap-2 w-full sm:w-auto shadow-[2px_2px_0px_#080B10]"
            >
              <Sparkles className="w-4 h-4" />
              <span>Go to Active DuoMatch</span>
            </Link>

            <Link
              href="/"
              className="lm-btn-secondary !py-2.5 !px-6 text-sm font-bold flex items-center gap-2 w-full sm:w-auto shadow-[2px_2px_0px_#080B10]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return Home</span>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
