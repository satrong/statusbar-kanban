import { setTimeout as setTimeoutPromise } from 'node:timers/promises';
import * as vscode from 'vscode';
import axios from 'axios';
import { extName } from '../config';

interface GitlabConfig {
  url: string;
  id: string;
  token: string;
}

interface MergeRequest {
  id: number;
  project_id: number;
  title: string;
  description: string;
  state: string;
  author: {
    id: number;
    name: string;
    username: string;
    state: string;
    avatar_url: string;
  };
  created_at: string;
  target_branch: string;
  source_branch: string;
  web_url: string;
  merge_status: string;
}

export class GitlabMergeRequestsService {
  gitlabConfig: GitlabConfig[] = [];
  gitlabTpl: string = '';
  interval = 5;
  myStatusBarItem: vscode.StatusBarItem;
  ac: AbortController | null = null;
  openCommand = 'kanban-bar.open';
  firstMergeRequestLink = '';
  /** 上一次请求的数据 */
  prevRequestDataIds: number[] = [];

  constructor(context: vscode.ExtensionContext) {
    this.myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
    this.myStatusBarItem.command = this.openCommand;

    const disposable = vscode.commands.registerCommand(this.openCommand, () => this.openLink());
    context.subscriptions.push(disposable);

    vscode.workspace.onDidChangeConfiguration(() => {
      this.start(true);
    });
  }

  start (abort = false) {
    abort && this.ac?.abort();
    this.updateConfig();
    this.updateStatusBarItem();

    this.ac = new AbortController();

    setTimeoutPromise(this.interval, { signal: this.ac.signal }).then(() => {
      this.start();
    });
  }

  private openLink () {
    if (this.firstMergeRequestLink) {
      vscode.env.openExternal(vscode.Uri.parse(this.firstMergeRequestLink));
    }
  }

  private updateConfig () {
    const userConfig = vscode.workspace.getConfiguration(extName);
    this.interval = userConfig.get<number>('interval') ?? 5;
    this.gitlabConfig = userConfig.get<GitlabConfig[]>('gitlab-merge') ?? [];
    this.gitlabTpl = userConfig.get<string>('gitlab-merge-tpl') ?? '$(merge) {count}';
  }

  private showMessage (text: string) {
    vscode.window.showInformationMessage(text);
  }

  private async fetch () {
    if (this.gitlabConfig.length === 0) {
      return;
    }

    const p = this.gitlabConfig.map(async (config) => {
      const id = /^\d+$/.test(config.id) ? config.id : encodeURIComponent(config.id);
      const apiUrl = `${config.url}/api/v4/projects/${id}/merge_requests?state=opened`;
      return axios.get<MergeRequest[]>(apiUrl, {
        headers: {
          'Private-Token': `${config.token}`
        }
      }).then(res => res.data);
    });

    return Promise.all(p);
  }

  private async updateStatusBarItem () {
    const data = await this.fetch();
    if (!data) {
      return;
    }

    const flatData = data.flat();
    const count = flatData.length;

    // 只取最新的一个合并请求的链接
    if (flatData.length > 0) {
      flatData.sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      this.firstMergeRequestLink = flatData[0].web_url;
    } else {
      this.firstMergeRequestLink = '';
    }
    let text = this.gitlabTpl.replace(/{count}/g, String(count));
    let tooltipContent = data.filter(el => el.length > 0).map((el) => {
      // 从 web_url 中提取项目名
      const projectName = el[0].web_url.split('/').slice(3, 5).join('/');
      let str = `#### ${projectName}\n`;
      str += el.map((item) => {
        let s = `- ${item.author.name}： ${item.source_branch} -> ${item.target_branch}`;
        if (item.merge_status === 'cannot_be_merged') {
          s += ' (冲突)';
        }
        return s;
      }).join('\n');
      return str;
    }).join('\n> \n');

    // 如果没有新增新数据，则不显示通知
    const newData = flatData.filter(el => !this.prevRequestDataIds.includes(el.id));
    if (newData.length > 0) {
      this.showMessage(`有 ${newData.length} 个新的合并请求`);
      this.prevRequestDataIds = flatData.map(el => el.id);
    }

    this.myStatusBarItem.text = text;
    this.myStatusBarItem.tooltip = new vscode.MarkdownString(tooltipContent);
    this.myStatusBarItem.show();
  }
}
