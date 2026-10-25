const SPOTIFY_TYPES = new Set([
  "track",
  "album",
  "playlist",
  "episode",
  "show",
  "artist",
]);

/** Turn a Spotify URL or URI into a safe official embed URL. */
export function spotifyEmbedUrl(
  value: string | null | undefined
): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const uri = trimmed.match(
    /^spotify:(track|album|playlist|episode|show|artist):([A-Za-z0-9]+)$/i
  );
  if (uri)
    return `https://open.spotify.com/embed/${uri[1].toLowerCase()}/${uri[2]}?utm_source=generator&theme=0`;

  try {
    const url = new URL(trimmed);
    if (
      !new Set(["open.spotify.com", "www.open.spotify.com"]).has(
        url.hostname.toLowerCase()
      )
    )
      return null;
    const parts = url.pathname.split("/").filter(Boolean);
    const typeIndex = parts.findIndex(part =>
      SPOTIFY_TYPES.has(part.toLowerCase())
    );
    if (typeIndex < 0) return null;
    const type = parts[typeIndex].toLowerCase();
    const id = parts[typeIndex + 1];
    if (!id || !/^[A-Za-z0-9]+$/.test(id)) return null;
    return `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`;
  } catch {
    return null;
  }
}
