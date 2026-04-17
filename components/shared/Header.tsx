import Link from "next/link";

/**
 * Kip It Real — top-level site header.
 *
 * Mirrors the Bat Intentions shell: sticky, minimal, brand left, nav right,
 * one primary CTA. The "Powered by Sweet Spotter" microtag lives here so it
 * shows on every page without cluttering the hero.
 */
export function Header() {
  return (
    <header
      className="sticky top-0 z-40 border-b border-brand-bg-deep
                 bg-brand-bg/85 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-content items-center justify-between px-4 py-4 md:px-8">
        {/* Brand mark ------------------------------------------------------ */}
        <Link
          href="/"
          className="flex items-center gap-3 group"
          aria-label="Kip It Real home"
        >
          <span
            className="inline-flex h-9 w-9 items-center justify-center
                       rounded-xl bg-brand-primary text-brand-accent
                       font-display text-lg font-bold
                       group-hover:bg-brand-primary-soft transition-colors"
            aria-hidden="true"
          >
            K
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-display text-lg font-bold text-brand-primary">
              Kip It Real
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-support">
              Powered by Sweet Spotter
            </span>
          </span>
        </Link>

        {/* Nav ------------------------------------------------------------- */}
        <nav className="flex items-center gap-2 md:gap-4">
          <Link
            href="/browse"
            className="hidden md:inline-flex btn-ghost"
          >
            Browse
          </Link>
          <Link
            href="/contact"
            className="hidden md:inline-flex btn-ghost"
          >
            Contact
          </Link>
          <Link
            href="/quiz"
            className="btn-primary text-sm py-2 px-4 md:text-base md:py-3 md:px-6"
          >
            Start quiz
          </Link>
        </nav>
      </div>
    </header>
  );
}
