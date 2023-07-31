
/** 保留小数位数 */
export function toFixed (num: number | string, fixed = 2) {
  const re = new RegExp(`^-?\\d+(?:\.\\d{0,${fixed || -1}})?`);
  const matched = num.toString().match(re);
  if (!matched) {
    return Number(num);
  }
  return Number(matched[0]);
}

/** 格式化日期 */
export function getTodayDate () {
  const date = new Date();
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}
