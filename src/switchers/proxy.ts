import * as vscode from 'vscode';
import { extName } from '../config';

export default class ProxySwitcher {
	private statusBarItem: vscode.StatusBarItem;

	constructor(priority: number) {
    const command = `${extName}.switchProxy`;

		this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, priority);
    this.statusBarItem.command = command;

    // 注册点击状态栏的事件
    vscode.commands.registerCommand(command, () => this.switch());
  }

  public init() {
    const proxyList = vscode.workspace.getConfiguration(extName).get<{ label: string, url: string }[]>('proxy-list') || [];
    const currentProxy = vscode.workspace.getConfiguration('http').get<string>('proxy');
    const currentProxyConfig = proxyList?.find(el => el.url === currentProxy) || null;

    if (proxyList.length > 0) {
      this.statusBarItem.text = currentProxyConfig?.label || '😧';
      this.statusBarItem.tooltip = currentProxyConfig?.url || '';
      this.statusBarItem.show();
    }
  }

  private switch() {
    const proxyList = vscode.workspace.getConfiguration(extName).get<{ label: string, url: string }[]>('proxy-list') || [];
    const currentProxy = vscode.workspace.getConfiguration('http').get<string>('proxy');
    let index = proxyList.findIndex(el => el.url === currentProxy);
  
    if (index === -1) {
      vscode.workspace.getConfiguration('http').update('proxy', proxyList[0].url, vscode.ConfigurationTarget.Global);
    } else {
      index = index === proxyList.length - 1 ? 0 : index + 1;
      vscode.workspace.getConfiguration('http').update('proxy', proxyList[index].url, vscode.ConfigurationTarget.Global);
    }
    this.statusBarItem.text = proxyList[index].label;
    this.statusBarItem.tooltip = proxyList[index].url;
  }
}
