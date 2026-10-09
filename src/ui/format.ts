/** Number and date formats shared by every view, in the viewer's locale. */

export const integer = new Intl.NumberFormat();
export const decimal = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
});
export const percent = new Intl.NumberFormat(undefined, {
  style: "percent",
  maximumFractionDigits: 0,
});
export const dateFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
});
