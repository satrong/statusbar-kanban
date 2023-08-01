import * as vscode from 'vscode';
import axios from 'axios';
import { formateDate } from '../utils';
import { outputChannel } from './outputLog';

interface IHoliday {
  holiday: boolean;
  name: string;
  wage: number;
  date: string;
  rest: number;
}

// {
//   "code": 0,
//   "holiday": {
//     "01-01": {
//       "holiday": true,
//       "name": "元旦",
//       "wage": 3,
//       "date": "2023-01-01",
//       "rest": 1
//     },
//     "01-02": {
//       "holiday": true,
//       "name": "元旦",
//       "wage": 2,
//       "date": "2023-01-02",
//       "rest": 1
//     }
//   }
// }

export async function getHolidayData (): Promise<string[]> {
  const year = new Date().getFullYear();
  return axios<{ code: number; holiday: Record<string, IHoliday> }>({
    url: 'https://timor.tech/api/holiday/year/' + year,
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    },
    timeout: 5000,
  })
    .then(res => res.data)
    .then(res => {
      if (res.code === 0) {
        return Object.values(res.holiday).flatMap(el => el.holiday ? el.date : []);
      }
      return [];
    })
    .catch((err) => {
      outputChannel.appendLine(`[fetchHoliday] 获取节假日数据失败 ${err}`);
      return [];
    });
}

export async function isClosed (context: vscode.ExtensionContext): Promise<boolean> {
  const holidayStoreKey = 'holiday';
  let holidays = context.globalState.get<string[]>(holidayStoreKey) ?? [];
  const todayDate = formateDate();

  if (holidays.length === 0) {
    holidays = await getHolidayData();
    context.globalState.update(holidayStoreKey, holidays);
  }

  if (holidays.includes(todayDate)) {
    return true;
  }

  const openedTime = [
    [new Date(`${todayDate} 09:25:00`), new Date(`${todayDate} 11:35:00`)],
    [new Date(`${todayDate} 13:00:00`), new Date(`${todayDate} 15:05:00`)],
  ];

  // 周六日不更新, 不在 9:05 - 11:35, 13:00 - 15:05 时间内不更新
  if (
    [0, 6].includes(new Date().getDay())
    ||
    openedTime.some(([start, end]) => start.getTime() > Date.now() || Date.now() > end.getTime())
  ) {
    return true;
  }

  return false;
}