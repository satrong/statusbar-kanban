import { setTimeout as setTimeoutPromise } from 'node:timers/promises';
import * as vscode from 'vscode';
import { toFixed, debounce } from './utils';
import { fetchData, isClosed, outputChannel, GitlabMergeRequestsService, ZentaoService } from './shared/index';
import { extName } from './config';

let myStatusBarItem: vscode.StatusBarItem;
let ac: AbortController;

export async function activate (context: vscode.ExtensionContext) {
	myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);

	// 监听用户修改配置项
	vscode.workspace.onDidChangeConfiguration(debounce(e => {
		if (e.affectsConfiguration(extName)) {
			ac && ac.abort();
			updateStatusBarItem(context, true);
		}
	}));

	updateStatusBarItem(context, true);

	new GitlabMergeRequestsService(context);
	new ZentaoService(context);
}

/**
 * @param isInit 是否是初始化，如果是初始化则忽略非交易时间
 */
async function updateStatusBarItem (context: vscode.ExtensionContext, isInit = false) {
	const userConfig = vscode.workspace.getConfiguration(extName);
	const stock = userConfig.get<string[]>('stock');
	const mapped = userConfig.get<Record<string, string>>('map');
	const tpl = userConfig.get<string>('barTpl')!;
	const interval = userConfig.get<number>('interval')!;
	const separator = userConfig.get<string>('separator')!;

	function next (t = interval) {
		ac && ac.abort();
		ac = new AbortController();
		setTimeoutPromise(t * 1000, 'updateStatusBarItem', { signal: ac.signal })
			.then(() => updateStatusBarItem(context));
	}

	const getAlias = (code: string, name: string) => {
		if (mapped && mapped[code]) {
			return mapped[code];
		}
		return name;
	};

	if (!isInit && await isClosed(context)) {
		return next(30);
	}

	if (Array.isArray(stock) && stock.length > 0) {
		if (isInit && stock.length > 4) {
			vscode.window.showInformationMessage('提示：气泡详情中最多只能展示4个股票');
		}

		fetchData(stock).then(res => {
			const text = res.map(el => {
				const obj = {
					price: el.price.toFixed(2),
					change: el.price ? getSign(el.price - el.yesterdayPrice, 'char') : '0',
					percent: el.price ? getSign((el.price - el.yesterdayPrice) / el.yesterdayPrice * 100, 'char') + '%' : '0%',
				};
				return getAlias(el.code, el.name) + tpl.replace(/{[a-z]+}/ig, (match) => {
					const key = match.slice(1, -1) as keyof typeof obj;
					return obj[key] ?? match;
				});
			}).join(separator);
			const tooltip = res.map(el => tooltipTemplate(el)).join('\n');
			myStatusBarItem.text = text;
			myStatusBarItem.tooltip = new vscode.MarkdownString(tooltip);
			myStatusBarItem.show();
		})
			.catch(err => outputChannel.appendLine(err))
			.finally(() => next());
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
