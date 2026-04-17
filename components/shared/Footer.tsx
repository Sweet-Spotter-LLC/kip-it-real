import Link from "next/link";

/**
 * Kip It Real — site footer.
 *
 * Keeps the Bat Intentions footer rhythm: slim, premium, brand mark + credits.
 * "Powered by Sweet Spotter" is repeated here intentionally so it shows up
 * on every page below the fold.
 */
export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-brand-bg-deep bg-brand-bg">
      <div className="mx-auto max-w-content px-4 py-10 md:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          {/* Brand block -------------------------------------------------- */}
          <div className="max-w-sm">
            <div className="flex items-center gap-3">
              <span
                className="inline-flex h-9 w-9 items-center justify-center
                           rounded-xl bg-brand-primary text-brand-accent
                           font-display text-lg font-bold"
                aria-hidden="true"
              >
                K
              </span>
              <span className="font-display text-lg font-bold text-brand-primary">
                Kip It Real
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-brand-support">
              Independent ball glove matching for baseball, fastpitch, and
              slowpitch players. No affiliates. No placements. Just your best
              fit.
            </p>
          </div>

          {/* Link columns ------------------------------------------------- */}
          <div className="grid grid-cols-2 gap-10 md:gap-16 text-sm">
            <div>
              <p className="eyebrow mb-3">Product</p>
              <ul className="space-y-2">
                <li>
                  <Link
                    href="/"
                    className="text-brand-text hover:text-brand-primary transition-colors"
                  >
                    Home
                  </Link>
                </li>
                <li>
                  <Link
                    href="/quiz"
                    className="text-brand-text hover:text-brand-primary transition-colors"
                  >
                    Find my glove
                  </Link>
                </li>
                <li>
                  <Link
                    href="/browse"
                    className="text-brand-text hover:text-brand-primary transition-colors"
                  >
                    Browse gloves
                  </Link>
                </li>
                <li>
                  <Link
                    href="/contact"
                    className="text-brand-text hover:text-brand-primary transition-colors"
                  >
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="eyebrow mb-3">Ecosystem</p>
              <ul className="space-y-2">
                <li>
                  <a
                    href="https://bat-intentions.vercel.app/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-text hover:text-brand-primary transition-colors"
                  >
                    Bat Intentions
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.linkedin.com/company/sweetspotter-llc/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-text hover:text-brand-primary transition-colors"
                  >
                    Sweet Spotter
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Divider + fine print ---------------------------------------- */}
        <div className="mt-10 flex flex-col gap-3 border-t border-brand-bg-deep pt-6 text-xs text-brand-support md:flex-row md:items-center md:justify-between">
          <p>© {year} Kip It Real. Powered by Sweet Spotter.</p>
          <p className="font-semibold uppercase tracking-[0.18em]">
            Find your sweet spot.
          </p>
        </div>
      </div>
    </footer>
  );
}
