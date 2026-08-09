/**
 * Map preview for a venue address.
 *
 * Uses Google's keyless embed endpoint, so there's no API key, no billing
 * account and nothing to configure. The pin is only as precise as the address
 * text, which is the trade-off for not needing Places search.
 */
export default function VenueMap({ address, className = "" }: { address: string | null | undefined; className?: string }) {
  const query = (address ?? "").trim();
  if (!query) return null;
  const encoded = encodeURIComponent(query);
  return (
    <div className={className}>
      <iframe
        title={`Map of ${query}`}
        src={`https://maps.google.com/maps?q=${encoded}&output=embed`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="h-64 w-full rounded-md border border-gray-200"
      />
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${encoded}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline"
      >
        Open in Google Maps
      </a>
    </div>
  );
}
