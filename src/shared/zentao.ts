import { setTimeout as setTimeoutPromise } from 'node:timers/promises';
import { URLSearchParams } from 'node:url';
import * as vscode from 'vscode';
import axios, { type RawAxiosResponseHeaders } from 'axios';
import { getInterval, md5 } from '../utils';
import { extName } from '../config';
import { outputChannel } from './outputLog';

interface ITask {
  id: string;
  project: string;
  parent: string;
  execution: string;
  module: string;
  design: string;
  story: string;
  storyVersion: string;
  designVersion: string;
  fromBug: string;
  name: string;
  type: string;
  pri: string;
  estimate: string;
  consumed: string;
  left: string;
  deadline: string;
  status: 'wait' | 'doing' | 'undone' | 'done' | 'closed' | 'cancel';
  subStatus: string;
  color: string;
  mailto: string;
  desc: string;
  version: string;
  openedBy: string;
  openedDate: string;
  assignedTo: string;
  assignedDate: string;
  estStarted: string;
  realStarted: string;
  finishedBy: string;
  finishedDate: string;
  finishedList: string;
  canceledBy: string;
  canceledDate: string;
  closedBy: string;
  closedDate: string;
  realDuration: string;
  planDuration: string;
  closedReason: string;
  lastEditedBy: string;
  lastEditedDate: string;
  activatedDate: string;
  deleted: string;
  executionID: string;
  executionName: string;
  storyID?: any;
  storyTitle?: any;
  storyStatus?: any;
  latestStoryVersion?: any;
  needConfirm: boolean;
  progress: number;
  children?: ITask[];
}

interface IZentaoUser { account: string, password: string }

export class ZentaoService {
  cookie = '';
  zentaoUrl = '';
  zentaoUser: IZentaoUser | null = null;
  interval = getInterval(null);
  /** 记录是否登录失败过 */
  loginFailed = false;
  tpl = '';
  statusBarItem: vscode.StatusBarItem;
  openCommand = 'kanban-bar.open-zentao';
  stateKey = 'zentao-cookie';
  ac: AbortController | null = null;
  context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 98);
    this.statusBarItem.command = this.openCommand;

    context.subscriptions.push(
      vscode.commands.registerCommand(this.openCommand, () => vscode.env.openExternal(vscode.Uri.parse('https://zentaopms.izehui.com/my-work-task-assignedTo-status_asc-0-20-1.html')))
    );

    this.updateConfig();
    this.start();

    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(extName)) {

        // 如果用户修改了账号密码，则重置登录失败状态
        const { account, password } = vscode.workspace.getConfiguration(extName).get<IZentaoUser>('zentao') ?? {};
        if (account && password && (account !== this.zentaoUser?.account || password !== this.zentaoUser?.password)) {
          this.loginFailed = false;
        }

        this.updateConfig();
        this.start(true);
      }
    });
  }

  private async start (abort = false) {
    if (abort && this.ac) {
      this.ac.abort();
    }

    if (!this.zentaoUrl) {
      outputChannel.appendLine(`[禅道] 未配置禅道地址`);
      return;
    }
    if (!this.zentaoUser || this.zentaoUser.account === '' || this.zentaoUser.password === '') {
      outputChannel.appendLine(`[禅道] 未配置禅道账号密码`);
      return;
    }

    this.cookie = this.context.globalState.get(this.getStateKey()) || '';

    if (!this.cookie && !this.loginFailed) {
      this.cookie = await this.login();
      this.context.globalState.update(this.getStateKey(), this.cookie);
    }

    this.updateStatusBar().finally(() => {
      this.ac = new AbortController();
      setTimeoutPromise(this.interval, 'ok', { signal: this.ac.signal }).then(() => {
        this.start();
      });
    });
  }

  private async updateStatusBar () {
    let wait = 0;
    let doing = 0;
    const taskList = this.cookie ? (await this.getTaskList() ?? []) : [];

    const computed = (data: ITask[]) => {
      data.forEach(el => {
        if (el.status === 'wait') {
          wait++;
        } else if (el.status === 'doing') {
          doing++;
        }
        if (Array.isArray(el.children)) {
          computed(el.children);
        }
      });
    };

    computed(taskList);

    this.statusBarItem.text = this.tpl.replace(/{wait}/g, String(wait)).replace(/{doing}/g, String(doing));
    this.statusBarItem.tooltip = new vscode.MarkdownString(`#### 禅道任务\n- 未开始 ${wait} 个\n- 进行中 ${doing} 个`);
    this.statusBarItem.show();
  }

  private async getTaskList () {
    return axios({
      baseURL: this.zentaoUrl,
      url: '/my-work-task-assignedTo-status_asc-0-50-1.html',
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": this.cookie,
      },
    }).then(res => {
      if (res.data.includes(`</style><script>self.location='/user-login`)) {
        this.cookie = '';
        this.context.globalState.update(this.getStateKey(), '');
        outputChannel.appendLine(`[禅道] 登录失效，重新登录`);
        return null;
      }

      try {
        const result = res.data.match(/(?<=<script>tasks = ).+(?=;<\/script>)/g);
        if (result) {
          const data = Object.values(JSON.parse(result[0]) as Record<string, ITask>);
          outputChannel.appendLine(`[禅道] 获取到 ${data.length} 个任务`);
          return data;
        }
      } catch (err) {
        outputChannel.appendLine(`[禅道] 获取任务失败。 ${err}`);
      }
      return null;
    });
  }

  private async login () {
    return axios({
      baseURL: this.zentaoUrl,
      url: '/user-refreshRandom.html',
      headers: {
        'Content-Type': 'text/html; charset=utf-8' // 此处需要修改 content-type ，不然拿不到 verifyRand
      },
    }).then(async res1 => {
      const params = new URLSearchParams({
        account: this.zentaoUser!.account,
        password: md5(md5(this.zentaoUser!.password) + res1.data),
        passwordStrength: '1',
        referer: '/',
        verifyRand: res1.data,
        keepLogin: '1',
        captcha: ''
      });
      return axios<string>({
        baseURL: this.zentaoUrl,
        url: '/user-login.html',
        method: 'post',
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Cookie": this.getCookie(res1.headers),
        },
        data: params
      }).then(res2 => {
        if (res2.data.includes(`<html><meta charset='utf-8'/><style>body{background:white}</style><script>self.location='/';`)) {
          this.loginFailed = false;
          const cookie = this.getCookie(res1.headers, res2.headers);
          outputChannel.appendLine(`[禅道] 登录成功 ${cookie}`);
          return cookie;
        }
        this.loginFailed = true;
        outputChannel.appendLine(`[禅道] 登录失败`);
        return '';
      });
    });
  }

  private updateConfig () {
    const userConfig = vscode.workspace.getConfiguration(extName);
    this.interval = getInterval(userConfig.get<number>('interval'));
    this.zentaoUrl = userConfig.get<string>('zentao-url') || '';
    this.zentaoUser = userConfig.get<IZentaoUser>('zentao') ?? null;
    this.tpl = userConfig.get<string>('zentao-tpl') || '$(tasklist) {wait} / {doing}';
  }

  /** 传递多个 headers 则会合并 */
  private getCookie (...args: RawAxiosResponseHeaders[]) {
    const arr = args.flatMap(el => el['set-cookie'] ?? []).map(el => el.split(';')[0]);
    return Array.from(new Set(arr)).join('; ');
  }

  private getStateKey () {
    return `${this.stateKey}:${this.zentaoUser?.account}`;
  }
}
