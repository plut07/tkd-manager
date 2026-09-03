import type { MetadataRoute } from "next";

/**
 * What a judge installs.
 *
 * This describes the *judge's pad*, not the whole management system. A referee
 * at an event wants one thing on their home screen — the buttons — and putting
 * the admin app there instead would open a login screen they have no account
 * for. So `start_url` goes to the sign-in-by-code page and the scope is
 * narrowed to it.
 *
 * Installed rather than bookmarked because it runs full-screen with no address
 * bar to fat-finger mid-bout, and because a phone treats an installed app's
 * storage as worth keeping — which is where presses live when the hall's wifi
 * drops.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TKD Judge",
    short_name: "TKD Judge",
    description: "Scoring pad for ITF Taekwon-Do ring judges.",
    start_url: "/public/judge",
    scope: "/public/judge",
    display: "standalone",
    // Judges hold a phone upright at a ring table. Letting it flip to landscape
    // mid-bout moves every button under their thumb.
    orientation: "portrait",
    background_color: "#09090b",
    theme_color: "#09090b",
    icons: [
      { src: "/icons/judge-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/judge-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/judge-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
