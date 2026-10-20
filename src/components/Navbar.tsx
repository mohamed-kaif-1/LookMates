"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Rocket, User } from "lucide-react";

export function Navbar() {
  const pathname = usePathname();

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-3">
      <header className="w-full bg-white border-2 border-black rounded-[4px] px-4 sm:px-6 py-3 flex items-center justify-between shadow-neo-sm">
        {/* Brand / Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          {/* Custom Geometric Logo from Reference */}
          <div className="w-9 h-9 shrink-0 flex items-center justify-center">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="36" height="36" rx="3" fill="#1764FF" />
              <path d="M8 8H14V28H8V8Z" fill="white" />
              <path d="M14 22H28V28H14V22Z" fill="white" />
              <rect x="20" y="10" width="8" height="8" fill="white" />
            </svg>
          </div>

          <div className="flex flex-col">
            <span className="font-extrabold text-xl tracking-tight text-black leading-none">
              LookMates<span className="text-blue">.</span>
            </span>
            <span className="text-[11px] text-muted font-medium leading-tight mt-0.5">
              Different styles. One perfect moment.
            </span>
          </div>
        </Link>

        {/* Center Navigation Links */}
        <nav className="hidden md:flex items-center gap-8">
          {/* Home */}
          <Link
            href="/"
            className="flex flex-col items-center text-decoration-none group pt-1"
          >
            <span
              className={`text-xs font-bold tracking-wider uppercase transition-colors ${
                pathname === "/" ? "text-blue" : "text-black hover:text-blue"
              }`}
            >
              HOME
            </span>
            {pathname === "/" ? (
              <span className="w-8 h-[2.5px] bg-blue mt-1 rounded-full"></span>
            ) : (
              <span className="w-8 h-[2.5px] bg-transparent mt-1"></span>
            )}
          </Link>

          {/* DuoMatch */}
          <Link
            href="/duomatch"
            className="flex flex-col items-center group pt-1"
          >
            <span
              className={`text-xs font-bold tracking-wider uppercase transition-colors ${
                pathname === "/duomatch" ? "text-blue" : "text-black hover:text-blue"
              }`}
            >
              DUOMATCH
            </span>
            {pathname === "/duomatch" ? (
              <span className="w-8 h-[2.5px] bg-blue mt-1 rounded-full"></span>
            ) : (
              <span className="w-8 h-[2.5px] bg-transparent mt-1"></span>
            )}
          </Link>

          {/* CrewMatch (Intentional Placeholder) */}
          <Link
            href="/crewmatch"
            className="flex flex-col items-center group pt-1"
          >
            <span
              className={`text-xs font-bold tracking-wider uppercase transition-colors ${
                pathname === "/crewmatch" ? "text-blue" : "text-muted hover:text-black"
              }`}
            >
              CREWMATCH
            </span>
            {pathname === "/crewmatch" ? (
              <span className="w-8 h-[2.5px] bg-blue mt-1 rounded-full"></span>
            ) : (
              <span className="w-8 h-[2.5px] bg-transparent mt-1"></span>
            )}
          </Link>

          {/* Lookbook */}
          <Link
            href="/lookbook"
            className="flex flex-col items-center group pt-1"
          >
            <span
              className={`text-xs font-bold tracking-wider uppercase transition-colors ${
                pathname === "/lookbook" ? "text-blue" : "text-black hover:text-blue"
              }`}
            >
              LOOKBOOK
            </span>
            {pathname === "/lookbook" ? (
              <span className="w-8 h-[2.5px] bg-blue mt-1 rounded-full"></span>
            ) : (
              <span className="w-8 h-[2.5px] bg-transparent mt-1"></span>
            )}
          </Link>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {/* User profile avatar icon */}
          <Link
            href="/lookbook"
            className="w-9 h-9 rounded-full border border-black flex items-center justify-center text-black hover:bg-surface transition-colors"
            title="User Profile / Sessions"
          >
            <User className="w-4 h-4 text-black" />
          </Link>

          {/* Launch DuoMatch CTA */}
          <Link
            href="/duomatch"
            className="lm-btn-primary !py-2 !px-4 !text-xs !font-bold flex items-center gap-1.5 shadow-neo-sm"
          >
            <Rocket className="w-3.5 h-3.5 fill-white" />
            <span>Launch DuoMatch</span>
          </Link>
        </div>
      </header>
    </div>
  );
}
