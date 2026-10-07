const segments = ["Design studios", "Agencies", "Startups", "Product teams", "Remote crews", "Consultancies"];

export function SocialProof() {
  return (
    <section aria-label="Who uses Loopify" className="border-y bg-muted/30">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-10 sm:px-6">
        <p className="text-center text-sm font-medium text-muted-foreground">
          Teams at studios, agencies &amp; startups close their loop with Loopify
        </p>
        <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {segments.map((segment) => (
            <li
              key={segment}
              className="font-heading text-lg font-bold tracking-tight text-foreground/35 transition-colors hover:text-foreground/70"
            >
              {segment}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
