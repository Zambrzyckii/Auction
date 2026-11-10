export function timeLeft(endsOn: string, now: number = Date.now()): string {
  const ms = new Date(endsOn).getTime() - now;
  if (Number.isNaN(ms)) {
    return '';
  }
  if (ms <= 0) {
    return 'ending…';
  }
  const totalMinutes = Math.floor(ms / 60_000);
  const seconds = Math.floor(ms / 1000) % 60;
  if (totalMinutes >= 60) {
    return `${Math.floor(totalMinutes / 60)} h ${totalMinutes % 60} min`;
  }
  return `${totalMinutes} min ${seconds} s`;
}
