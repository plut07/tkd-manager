import { findCountry, flagUrl } from "@/lib/countries";

/**
 * A country's flag next to its name.
 *
 * Plain <img> rather than next/image so no remote-image configuration is
 * needed; these are tiny cached PNGs. If the country isn't in our list the flag
 * is skipped and the raw text is shown, so nothing disappears from a page just
 * because a name doesn't match.
 */
export default function CountryFlag({
  country,
  showName = true,
  width = 20,
  className = "",
}: {
  country: string | null | undefined;
  showName?: boolean;
  width?: number;
  className?: string;
}) {
  if (!country) return <span className="text-gray-400">—</span>;

  const info = findCountry(country);
  const src = flagUrl(country, 24);
  const height = Math.round((width * 3) / 4);

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} title={info?.name ?? country}>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          width={width}
          height={height}
          loading="lazy"
          className="shrink-0 rounded-sm border border-gray-200 object-cover"
        />
      )}
      {showName && <span>{info?.name ?? country}</span>}
    </span>
  );
}
