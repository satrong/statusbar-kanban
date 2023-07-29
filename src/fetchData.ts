import axios from 'axios';
import { decode } from 'iconv-lite';

// 保留小数位数
export function toFixed (num: number | string, fixed = 2) {
  const re = new RegExp(`^-?\\d+(?:\.\\d{0,${fixed || -1}})?`);
  const matched = num.toString().match(re);
  if (!matched) {
    return Number(num);
  }
  return Number(matched[0]);
}

export async function fetchData (stockCode: string[]) {
  return axios<Buffer>({
    url: `https://hq.sinajs.cn/list=${stockCode.join(',')}`,
    headers: {
      acceptLanguage: 'zh-CN,zh;q=0.9,en;q=0.8',
      referer: 'https://sina.com.cn',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
    },
    responseType: 'arraybuffer',
  }).then(res => {
    const data = decode(res.data, 'gbk');
    return data.split(/\n/).flatMap(el => {
      const matched = el.match(/(?<=var hq_str_)(\w+)="([^"]+)/);
      if (!matched) {
        return [];
      }
      const [, code, content] = matched;
      const values = content.split(',');
      return {
        name: values[0],
        code,
        price: toFixed(values[3]),
        maxPrice: toFixed(values[4]),
        minPrice: toFixed(values[5]),
        openPrice: toFixed(values[1]),
        yesterdayPrice: toFixed(values[2]),
        date: values[values.length - 3],
        time: values[values.length - 2],
        turnover: toFixed(values[9]),
      };
    });
  });
}