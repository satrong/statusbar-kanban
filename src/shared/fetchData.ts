import axios from 'axios';
import { decode } from 'iconv-lite';
import { toFixed, formateDate } from '../utils';
import { outputChannel } from './outputLog';

export async function fetchData (stockCode: string[]) {
  return axios<Buffer>({
    url: `https://hq.sinajs.cn/list=${stockCode.join(',')}`,
    headers: {
      referer: 'https://sina.com.cn',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
    },
    responseType: 'arraybuffer',
    timeout: 5000,
  }).then(res => {
    const data = decode(res.data, 'gbk');
    const result = data.split(/\n/).flatMap(el => {
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
    const logInfo = result.map(el => `${el.name} 最新：${el.price.toFixed(2)} 昨收：${el.yesterdayPrice.toFixed(2)}`).join('\n');
    outputChannel.appendLine(`[fetchStock] ${formateDate(null, 'YYYY-MM-DD HH:mm:ss')}\n${logInfo}\n------`);
    return result;
  });
}
