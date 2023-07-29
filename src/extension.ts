import * as vscode from 'vscode';
import { fetchData, toFixed } from './fetchData';

const extName = 'statusbar-kanban';
let myStatusBarItem: vscode.StatusBarItem;
let f: ReturnType<typeof setTimeout>;

export function activate () {
	myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);

	// 监听用户修改配置项
	vscode.workspace.onDidChangeConfiguration(e => {
		if (e.affectsConfiguration(extName)) {
			clearTimeout(f);
			updateStatusBarItem(true);
		}
	});

	updateStatusBarItem(true);
}

/**
 * @param isInit 是否是初始化，如果是初始化则忽略非交易时间
 */
function updateStatusBarItem (isInit = false) {
	const userConfig = vscode.workspace.getConfiguration(extName);
	const stock = userConfig.get<string[]>('stock');
	const mapped = userConfig.get<Record<string, string>>('map');
	const tpl = userConfig.get<string>('barTpl')!;
	const interval = userConfig.get<number>('interval')!;

	function next (t = interval) {
		f = setTimeout(() => {
			updateStatusBarItem();
		}, t * 1000);
	}

	const getAlias = (code: string, name: string) => {
		if (mapped && mapped[code]) {
			return mapped[code];
		}
		return name;
	};

	const hour = new Date().getHours();
	const minute = new Date().getMinutes();
	const weekday = new Date().getDay();

	if (!isInit) {
		// 周六日不更新, 不在 9:00 - 15:10 时间内不更新
		if ([0, 6].includes(weekday) || hour < 9 || (hour > 15 && minute > 10)) {
			return next(30);
		}
	}

	if (Array.isArray(stock) && stock.length > 0) {
		fetchData(stock).then(res => {
			const text = res.map(el => {
				const obj = {
					price: el.price.toFixed(2),
					change: getSign(el.price - el.yesterdayPrice, 'char'),
					percent: getSign((el.price - el.yesterdayPrice) / el.yesterdayPrice * 100, 'char') + '%',
				};
				return getAlias(el.code, el.name) + tpl.replace(/{[a-z]+}/ig, (match) => {
					const key = match.slice(1, -1) as keyof typeof obj;
					return obj[key] ?? match;
				});
			}).join('$(debug-stackframe-dot)');
			const tooltip = res.map(el => tooltipTemplate(el)).join('\n');
			myStatusBarItem.text = text;
			myStatusBarItem.tooltip = new vscode.MarkdownString(tooltip);
			myStatusBarItem.show();
		}).finally(() => next());
	}
}

function tooltipTemplate (data: Awaited<ReturnType<typeof fetchData>>[number]) {
	const space = '&nbsp;&nbsp;';
	return `|${data.name}|&nbsp;|&nbsp;|&nbsp;|
|:---|:---|:---|:---|
|${space}最新价：${data.price.toFixed(2)}|${space}涨跌额：${getSign(data.price - data.yesterdayPrice, 'emoji')}|${space}涨跌幅：${getSign((data.price - data.yesterdayPrice) / data.yesterdayPrice * 100, 'char')}%|${space}成交量：${getUnit(data.turnover)}|
|${space}今开价：${data.openPrice.toFixed(2)}|${space}最高价：${data.maxPrice.toFixed(2)}|${space}最低价：${data.minPrice.toFixed(2)}|${space}时间：${data.date} ${data.time}|
> 
`;
}

// 显示数值的正负号
function getSign (num: number, type: 'icon' | 'char' | 'emoji') {
	const map = {
		icon: {
			'up': '$(chevron-up)',
			'down': '$(chevron-down)',
		},
		char: {
			'up': '+',
			'down': '-',
		},
		emoji: {
			'up': '😍',
			'down': '🤢',
		},
	};
	return map[type][num > 0 ? 'up' : 'down'] + (Math.abs(num)).toFixed(2);
};

// 数值转换 亿万
function getUnit (num: number) {
	if (num >= 100000000) {
		return toFixed(num / 100000000) + ' 亿';
	}
	if (num >= 10000) {
		return toFixed(num / 10000) + ' 万';
	}
	return num;
};

// This method is called when your extension is deactivated
export function deactivate () { }
