/** Maxbot só aceita date_time com minuto 00 ou 30. Retorna a meia hora em curso (Brasília, UTC-3). */
export function maxbotSlot(now: Date = new Date(), addMinutes = 0): string {
  const d = new Date(now.getTime() - 3 * 3600_000);
  d.setUTCSeconds(0, 0);
  d.setUTCMinutes(d.getUTCMinutes() < 30 ? 0 : 30);
  d.setUTCMinutes(d.getUTCMinutes() + addMinutes);
  return d.toISOString().slice(0, 19).replace("T", " ");
}
