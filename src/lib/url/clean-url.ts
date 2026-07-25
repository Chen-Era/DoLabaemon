function cleanText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function cleanUrlText(value: string | null | undefined) {
  let next = cleanText(value);
  while (
    next
    && next.length >= 2
    && ((next.startsWith("`") && next.endsWith("`"))
      || (next.startsWith("\"") && next.endsWith("\""))
      || (next.startsWith("'") && next.endsWith("'")))
  ) {
    next = cleanText(next.slice(1, -1));
  }
  return next;
}
