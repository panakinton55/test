const jpy = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

const dateFormat = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "Asia/Tokyo",
});

export function formatJpy(amount: number) {
  return jpy.format(amount);
}

export function formatDate(isoDate: string) {
  return dateFormat.format(new Date(`${isoDate}T00:00:00+09:00`));
}
