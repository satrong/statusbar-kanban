import { setTimeout as setTimeoutPromise } from 'node:timers/promises';
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
export function formateDate(date: null | Date = null, format = 'YYYY-MM-DD') {
  const d = date ?? new Date();
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();

  const hour = d.getHours();
  const minute = d.getMinutes();
  const second = d.getSeconds();

  const padLeftZero = (str: string | number) => {
    return String(str).padStart(2, '0');
  };

  const time = {
    YYYY: year,
    MM: padLeftZero(month),
    DD: padLeftZero(day),
    HH: padLeftZero(hour),
    mm: padLeftZero(minute),
    ss: padLeftZero(second),
  };

  return format.replace(/(YYYY|MM|DD|HH|mm|ss)/g, (result, key) => {
    return String(time[key as keyof typeof time]);
  });
}

/**
 * @param fn 
 * @param delay 默认 `1000`，单位：`ms`
 */
export function debounce<T extends any[]> (fn: (...args: T) => void, delay = 500) {
  let ac: AbortController;
  return function (...args: T) {
    if (ac) { ac.abort(); }
    ac = new AbortController();
    setTimeoutPromise(delay, 'debounce', { signal: ac.signal })
      .then(() => fn(...args))
      .catch(() => { });
  };
}
