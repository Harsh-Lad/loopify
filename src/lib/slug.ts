export function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** "Product Design" → "PD", "Sales" → "SAL". Used for card ids like PD-12. */
export function boardKeyFrom(name: string) {
  const words = name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "BRD";
  if (words.length === 1) return words[0]!.slice(0, 3);
  return words
    .slice(0, 4)
    .map((w) => w[0])
    .join("");
}
