// Country reference data: name, ISO 3166-1 alpha-2 code, and continent.
//
// The ISO code drives flag images (see flagUrl) and the continent drives the
// grouped country pickers. A native <select> can't render images inside its
// options, so pickers group by continent with <optgroup> and flags are shown
// wherever a country is *displayed* rather than chosen.
//
// Transcontinental countries follow sporting convention rather than strict
// geography: Armenia, Azerbaijan, Cyprus, Georgia, Russia and Turkey are listed
// under Europe, since that is where their federations compete. Move an entry to
// a different continent here and every picker and grouping follows.
//
// Antarctica is omitted — the seven-continent model includes it, but it has no
// countries to select.

export type Continent = "Africa" | "Asia" | "Europe" | "North America" | "South America" | "Oceania";

export type CountryInfo = { name: string; code: string; continent: Continent; dial: string };

export const CONTINENTS: Continent[] = ["Africa", "Asia", "Europe", "North America", "South America", "Oceania"];

export const COUNTRY_DATA: CountryInfo[] = [
  { name: "Algeria", code: "DZ", continent: "Africa" , dial: "213" },
  { name: "Angola", code: "AO", continent: "Africa" , dial: "244" },
  { name: "Benin", code: "BJ", continent: "Africa" , dial: "229" },
  { name: "Botswana", code: "BW", continent: "Africa" , dial: "267" },
  { name: "Burkina Faso", code: "BF", continent: "Africa" , dial: "226" },
  { name: "Burundi", code: "BI", continent: "Africa" , dial: "257" },
  { name: "Cabo Verde", code: "CV", continent: "Africa" , dial: "238" },
  { name: "Cameroon", code: "CM", continent: "Africa" , dial: "237" },
  { name: "Central African Republic", code: "CF", continent: "Africa" , dial: "236" },
  { name: "Chad", code: "TD", continent: "Africa" , dial: "235" },
  { name: "Comoros", code: "KM", continent: "Africa" , dial: "269" },
  { name: "Congo", code: "CG", continent: "Africa" , dial: "242" },
  { name: "Democratic Republic of the Congo", code: "CD", continent: "Africa" , dial: "243" },
  { name: "Djibouti", code: "DJ", continent: "Africa" , dial: "253" },
  { name: "Egypt", code: "EG", continent: "Africa" , dial: "20" },
  { name: "Equatorial Guinea", code: "GQ", continent: "Africa" , dial: "240" },
  { name: "Eritrea", code: "ER", continent: "Africa" , dial: "291" },
  { name: "Eswatini", code: "SZ", continent: "Africa" , dial: "268" },
  { name: "Ethiopia", code: "ET", continent: "Africa" , dial: "251" },
  { name: "Gabon", code: "GA", continent: "Africa" , dial: "241" },
  { name: "Gambia", code: "GM", continent: "Africa" , dial: "220" },
  { name: "Ghana", code: "GH", continent: "Africa" , dial: "233" },
  { name: "Guinea", code: "GN", continent: "Africa" , dial: "224" },
  { name: "Guinea-Bissau", code: "GW", continent: "Africa" , dial: "245" },
  { name: "Ivory Coast", code: "CI", continent: "Africa" , dial: "225" },
  { name: "Kenya", code: "KE", continent: "Africa" , dial: "254" },
  { name: "Lesotho", code: "LS", continent: "Africa" , dial: "266" },
  { name: "Liberia", code: "LR", continent: "Africa" , dial: "231" },
  { name: "Libya", code: "LY", continent: "Africa" , dial: "218" },
  { name: "Madagascar", code: "MG", continent: "Africa" , dial: "261" },
  { name: "Malawi", code: "MW", continent: "Africa" , dial: "265" },
  { name: "Mali", code: "ML", continent: "Africa" , dial: "223" },
  { name: "Mauritania", code: "MR", continent: "Africa" , dial: "222" },
  { name: "Mauritius", code: "MU", continent: "Africa" , dial: "230" },
  { name: "Morocco", code: "MA", continent: "Africa" , dial: "212" },
  { name: "Mozambique", code: "MZ", continent: "Africa" , dial: "258" },
  { name: "Namibia", code: "NA", continent: "Africa" , dial: "264" },
  { name: "Niger", code: "NE", continent: "Africa" , dial: "227" },
  { name: "Nigeria", code: "NG", continent: "Africa" , dial: "234" },
  { name: "Rwanda", code: "RW", continent: "Africa" , dial: "250" },
  { name: "Sao Tome and Principe", code: "ST", continent: "Africa" , dial: "239" },
  { name: "Senegal", code: "SN", continent: "Africa" , dial: "221" },
  { name: "Seychelles", code: "SC", continent: "Africa" , dial: "248" },
  { name: "Sierra Leone", code: "SL", continent: "Africa" , dial: "232" },
  { name: "Somalia", code: "SO", continent: "Africa" , dial: "252" },
  { name: "South Africa", code: "ZA", continent: "Africa" , dial: "27" },
  { name: "South Sudan", code: "SS", continent: "Africa" , dial: "211" },
  { name: "Sudan", code: "SD", continent: "Africa" , dial: "249" },
  { name: "Tanzania", code: "TZ", continent: "Africa" , dial: "255" },
  { name: "Togo", code: "TG", continent: "Africa" , dial: "228" },
  { name: "Tunisia", code: "TN", continent: "Africa" , dial: "216" },
  { name: "Uganda", code: "UG", continent: "Africa" , dial: "256" },
  { name: "Zambia", code: "ZM", continent: "Africa" , dial: "260" },
  { name: "Zimbabwe", code: "ZW", continent: "Africa" , dial: "263" },
  { name: "Afghanistan", code: "AF", continent: "Asia" , dial: "93" },
  { name: "Bahrain", code: "BH", continent: "Asia" , dial: "973" },
  { name: "Bangladesh", code: "BD", continent: "Asia" , dial: "880" },
  { name: "Bhutan", code: "BT", continent: "Asia" , dial: "975" },
  { name: "Brunei", code: "BN", continent: "Asia" , dial: "673" },
  { name: "Cambodia", code: "KH", continent: "Asia" , dial: "855" },
  { name: "China", code: "CN", continent: "Asia" , dial: "86" },
  { name: "Hong Kong", code: "HK", continent: "Asia" , dial: "852" },
  { name: "India", code: "IN", continent: "Asia" , dial: "91" },
  { name: "Indonesia", code: "ID", continent: "Asia" , dial: "62" },
  { name: "Iran", code: "IR", continent: "Asia" , dial: "98" },
  { name: "Iraq", code: "IQ", continent: "Asia" , dial: "964" },
  { name: "Israel", code: "IL", continent: "Asia" , dial: "972" },
  { name: "Japan", code: "JP", continent: "Asia" , dial: "81" },
  { name: "Jordan", code: "JO", continent: "Asia" , dial: "962" },
  { name: "Kazakhstan", code: "KZ", continent: "Asia" , dial: "7" },
  { name: "Kuwait", code: "KW", continent: "Asia" , dial: "965" },
  { name: "Kyrgyzstan", code: "KG", continent: "Asia" , dial: "996" },
  { name: "Laos", code: "LA", continent: "Asia" , dial: "856" },
  { name: "Lebanon", code: "LB", continent: "Asia" , dial: "961" },
  { name: "Macau", code: "MO", continent: "Asia" , dial: "853" },
  { name: "Malaysia", code: "MY", continent: "Asia" , dial: "60" },
  { name: "Maldives", code: "MV", continent: "Asia" , dial: "960" },
  { name: "Mongolia", code: "MN", continent: "Asia" , dial: "976" },
  { name: "Myanmar", code: "MM", continent: "Asia" , dial: "95" },
  { name: "Nepal", code: "NP", continent: "Asia" , dial: "977" },
  { name: "North Korea", code: "KP", continent: "Asia" , dial: "850" },
  { name: "Oman", code: "OM", continent: "Asia" , dial: "968" },
  { name: "Pakistan", code: "PK", continent: "Asia" , dial: "92" },
  { name: "Palestine", code: "PS", continent: "Asia" , dial: "970" },
  { name: "Philippines", code: "PH", continent: "Asia" , dial: "63" },
  { name: "Qatar", code: "QA", continent: "Asia" , dial: "974" },
  { name: "Saudi Arabia", code: "SA", continent: "Asia" , dial: "966" },
  { name: "Singapore", code: "SG", continent: "Asia" , dial: "65" },
  { name: "South Korea", code: "KR", continent: "Asia" , dial: "82" },
  { name: "Sri Lanka", code: "LK", continent: "Asia" , dial: "94" },
  { name: "Syria", code: "SY", continent: "Asia" , dial: "963" },
  { name: "Taiwan", code: "TW", continent: "Asia" , dial: "886" },
  { name: "Tajikistan", code: "TJ", continent: "Asia" , dial: "992" },
  { name: "Thailand", code: "TH", continent: "Asia" , dial: "66" },
  { name: "Timor-Leste", code: "TL", continent: "Asia" , dial: "670" },
  { name: "Turkmenistan", code: "TM", continent: "Asia" , dial: "993" },
  { name: "United Arab Emirates", code: "AE", continent: "Asia" , dial: "971" },
  { name: "Uzbekistan", code: "UZ", continent: "Asia" , dial: "998" },
  { name: "Vietnam", code: "VN", continent: "Asia" , dial: "84" },
  { name: "Yemen", code: "YE", continent: "Asia" , dial: "967" },
  { name: "Albania", code: "AL", continent: "Europe" , dial: "355" },
  { name: "Andorra", code: "AD", continent: "Europe" , dial: "376" },
  { name: "Armenia", code: "AM", continent: "Europe" , dial: "374" },
  { name: "Austria", code: "AT", continent: "Europe" , dial: "43" },
  { name: "Azerbaijan", code: "AZ", continent: "Europe" , dial: "994" },
  { name: "Belarus", code: "BY", continent: "Europe" , dial: "375" },
  { name: "Belgium", code: "BE", continent: "Europe" , dial: "32" },
  { name: "Bosnia and Herzegovina", code: "BA", continent: "Europe" , dial: "387" },
  { name: "Bulgaria", code: "BG", continent: "Europe" , dial: "359" },
  { name: "Croatia", code: "HR", continent: "Europe" , dial: "385" },
  { name: "Cyprus", code: "CY", continent: "Europe" , dial: "357" },
  { name: "Czechia", code: "CZ", continent: "Europe" , dial: "420" },
  { name: "Denmark", code: "DK", continent: "Europe" , dial: "45" },
  { name: "Estonia", code: "EE", continent: "Europe" , dial: "372" },
  { name: "Finland", code: "FI", continent: "Europe" , dial: "358" },
  { name: "France", code: "FR", continent: "Europe" , dial: "33" },
  { name: "Georgia", code: "GE", continent: "Europe" , dial: "995" },
  { name: "Germany", code: "DE", continent: "Europe" , dial: "49" },
  { name: "Greece", code: "GR", continent: "Europe" , dial: "30" },
  { name: "Hungary", code: "HU", continent: "Europe" , dial: "36" },
  { name: "Iceland", code: "IS", continent: "Europe" , dial: "354" },
  { name: "Ireland", code: "IE", continent: "Europe" , dial: "353" },
  { name: "Italy", code: "IT", continent: "Europe" , dial: "39" },
  { name: "Kosovo", code: "XK", continent: "Europe" , dial: "383" },
  { name: "Latvia", code: "LV", continent: "Europe" , dial: "371" },
  { name: "Liechtenstein", code: "LI", continent: "Europe" , dial: "423" },
  { name: "Lithuania", code: "LT", continent: "Europe" , dial: "370" },
  { name: "Luxembourg", code: "LU", continent: "Europe" , dial: "352" },
  { name: "Malta", code: "MT", continent: "Europe" , dial: "356" },
  { name: "Moldova", code: "MD", continent: "Europe" , dial: "373" },
  { name: "Monaco", code: "MC", continent: "Europe" , dial: "377" },
  { name: "Montenegro", code: "ME", continent: "Europe" , dial: "382" },
  { name: "Netherlands", code: "NL", continent: "Europe" , dial: "31" },
  { name: "North Macedonia", code: "MK", continent: "Europe" , dial: "389" },
  { name: "Norway", code: "NO", continent: "Europe" , dial: "47" },
  { name: "Poland", code: "PL", continent: "Europe" , dial: "48" },
  { name: "Portugal", code: "PT", continent: "Europe" , dial: "351" },
  { name: "Romania", code: "RO", continent: "Europe" , dial: "40" },
  { name: "Russia", code: "RU", continent: "Europe" , dial: "7" },
  { name: "San Marino", code: "SM", continent: "Europe" , dial: "378" },
  { name: "Serbia", code: "RS", continent: "Europe" , dial: "381" },
  { name: "Slovakia", code: "SK", continent: "Europe" , dial: "421" },
  { name: "Slovenia", code: "SI", continent: "Europe" , dial: "386" },
  { name: "Spain", code: "ES", continent: "Europe" , dial: "34" },
  { name: "Sweden", code: "SE", continent: "Europe" , dial: "46" },
  { name: "Switzerland", code: "CH", continent: "Europe" , dial: "41" },
  { name: "Turkey", code: "TR", continent: "Europe" , dial: "90" },
  { name: "Ukraine", code: "UA", continent: "Europe" , dial: "380" },
  { name: "United Kingdom", code: "GB", continent: "Europe" , dial: "44" },
  { name: "Vatican City", code: "VA", continent: "Europe" , dial: "39" },
  { name: "Antigua and Barbuda", code: "AG", continent: "North America" , dial: "1" },
  { name: "Bahamas", code: "BS", continent: "North America" , dial: "1" },
  { name: "Barbados", code: "BB", continent: "North America" , dial: "1" },
  { name: "Belize", code: "BZ", continent: "North America" , dial: "501" },
  { name: "Canada", code: "CA", continent: "North America" , dial: "1" },
  { name: "Costa Rica", code: "CR", continent: "North America" , dial: "506" },
  { name: "Cuba", code: "CU", continent: "North America" , dial: "53" },
  { name: "Dominica", code: "DM", continent: "North America" , dial: "1" },
  { name: "Dominican Republic", code: "DO", continent: "North America" , dial: "1" },
  { name: "El Salvador", code: "SV", continent: "North America" , dial: "503" },
  { name: "Grenada", code: "GD", continent: "North America" , dial: "1" },
  { name: "Guatemala", code: "GT", continent: "North America" , dial: "502" },
  { name: "Haiti", code: "HT", continent: "North America" , dial: "509" },
  { name: "Honduras", code: "HN", continent: "North America" , dial: "504" },
  { name: "Jamaica", code: "JM", continent: "North America" , dial: "1" },
  { name: "Mexico", code: "MX", continent: "North America" , dial: "52" },
  { name: "Nicaragua", code: "NI", continent: "North America" , dial: "505" },
  { name: "Panama", code: "PA", continent: "North America" , dial: "507" },
  { name: "Saint Kitts and Nevis", code: "KN", continent: "North America" , dial: "1" },
  { name: "Saint Lucia", code: "LC", continent: "North America" , dial: "1" },
  { name: "Saint Vincent and the Grenadines", code: "VC", continent: "North America" , dial: "1" },
  { name: "Trinidad and Tobago", code: "TT", continent: "North America" , dial: "1" },
  { name: "United States", code: "US", continent: "North America" , dial: "1" },
  { name: "Argentina", code: "AR", continent: "South America" , dial: "54" },
  { name: "Bolivia", code: "BO", continent: "South America" , dial: "591" },
  { name: "Brazil", code: "BR", continent: "South America" , dial: "55" },
  { name: "Chile", code: "CL", continent: "South America" , dial: "56" },
  { name: "Colombia", code: "CO", continent: "South America" , dial: "57" },
  { name: "Ecuador", code: "EC", continent: "South America" , dial: "593" },
  { name: "Guyana", code: "GY", continent: "South America" , dial: "592" },
  { name: "Paraguay", code: "PY", continent: "South America" , dial: "595" },
  { name: "Peru", code: "PE", continent: "South America" , dial: "51" },
  { name: "Suriname", code: "SR", continent: "South America" , dial: "597" },
  { name: "Uruguay", code: "UY", continent: "South America" , dial: "598" },
  { name: "Venezuela", code: "VE", continent: "South America" , dial: "58" },
  { name: "Australia", code: "AU", continent: "Oceania" , dial: "61" },
  { name: "Fiji", code: "FJ", continent: "Oceania" , dial: "679" },
  { name: "Kiribati", code: "KI", continent: "Oceania" , dial: "686" },
  { name: "Marshall Islands", code: "MH", continent: "Oceania" , dial: "692" },
  { name: "Micronesia", code: "FM", continent: "Oceania" , dial: "691" },
  { name: "Nauru", code: "NR", continent: "Oceania" , dial: "674" },
  { name: "New Zealand", code: "NZ", continent: "Oceania" , dial: "64" },
  { name: "Palau", code: "PW", continent: "Oceania" , dial: "680" },
  { name: "Papua New Guinea", code: "PG", continent: "Oceania" , dial: "675" },
  { name: "Samoa", code: "WS", continent: "Oceania" , dial: "685" },
  { name: "Solomon Islands", code: "SB", continent: "Oceania" , dial: "677" },
  { name: "Tonga", code: "TO", continent: "Oceania" , dial: "676" },
  { name: "Tuvalu", code: "TV", continent: "Oceania" , dial: "688" },
  { name: "Vanuatu", code: "VU", continent: "Oceania" , dial: "678" },
];

/** Country names only, alphabetically — the shape older callers expect. */
export const COUNTRIES: string[] = [...COUNTRY_DATA].map((c) => c.name).sort((a, b) => a.localeCompare(b));

const BY_NAME = new Map(COUNTRY_DATA.map((c) => [c.name.trim().toLowerCase(), c]));

/** Look up a country by name, case-insensitively. */
export function findCountry(name: string | null | undefined): CountryInfo | null {
  if (!name) return null;
  return BY_NAME.get(String(name).trim().toLowerCase()) ?? null;
}

/** ISO alpha-2 code for a country name, lowercased for URLs. */
export function countryCode(name: string | null | undefined): string | null {
  return findCountry(name)?.code.toLowerCase() ?? null;
}

/**
 * Flag image URL from flagcdn.com. Only the widths in the signature exist on
 * the CDN — any other number (w24, say) 404s and shows a broken image.
 *
 * Returns null for an unknown country so
 * callers can fall back to showing just the name.
 *
 * Flag *emoji* would avoid the external request, but Windows renders them as
 * two letters rather than a flag, so images it is.
 */
export function flagUrl(name: string | null | undefined, width: 20 | 40 | 80 | 160 = 40): string | null {
  const code = countryCode(name);
  return code ? `https://flagcdn.com/w${width}/${code}.png` : null;
}

/** Countries grouped by continent, for building grouped pickers. */
export const COUNTRIES_BY_CONTINENT: { continent: Continent; countries: CountryInfo[] }[] = CONTINENTS.map((continent) => ({
  continent,
  countries: COUNTRY_DATA.filter((c) => c.continent === continent).sort((a, b) => a.name.localeCompare(b.name)),
}));

/**
 * International dialling prefix for a country, e.g. "+65".
 *
 * Shown beside a phone field so a number is unambiguous once clubs span several
 * countries. Some prefixes are shared (all NANP countries are +1), which is
 * expected rather than a mistake.
 */
export function dialCode(name: string | null | undefined): string | null {
  const info = findCountry(name);
  return info?.dial ? `+${info.dial}` : null;
}
