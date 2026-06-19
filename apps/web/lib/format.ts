export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "Unpublished";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}

export function truncateMiddle(value: string, size = 54): string {
  if (value.length <= size) return value;
  const edge = Math.floor((size - 3) / 2);
  return `${value.slice(0, edge)}...${value.slice(-edge)}`;
}
