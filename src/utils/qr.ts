export function getDailyToken(restaurantId: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const raw  = `${restaurantId}:${date}:odesagra`;
  let h = 0;
  for (let i = 0; i < raw.length; i++) {
    h = Math.imul(31, h) + raw.charCodeAt(i) | 0;
  }
  return Math.abs(h).toString(36).slice(0, 6).toUpperCase();
}

export function isValidDailyToken(restaurantId: string, token: string | null | undefined): boolean {
  if (!token) return false;
  return getDailyToken(restaurantId) === token.toUpperCase();
}
