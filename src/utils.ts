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
export function getTodayDate () {
  const date = new Date();
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
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
