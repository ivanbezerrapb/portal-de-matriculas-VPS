const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Monta o link público do formulário: curto quando o slug já é um nome legível. */
export function publicFormUrl(origin: string, slug: string) {
  return UUID_RE.test(slug) ? `${origin}/f/${slug}` : `${origin}/${slug}`;
}
