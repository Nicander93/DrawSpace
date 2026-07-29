# 测试与验收

## 自动测试

```bash
npm run typecheck
npm test
npm run lint
```

Electron E2E 为可选验收项，运行方式：

```bash
npm run test:e2e
```

当前测试覆盖：

- 工作区路径逃逸
- 原子写入
- 预期版本冲突
- 扫描过滤
- IPC 路径和文件名校验
- Excalidraw 文件结构校验
- 创建、重命名、复制、删除和恢复
- 外部修改冲突副本
- 异常会话恢复快照
- 保存协调器的 5 秒防抖、30 秒最长等待、失败和 dispose
- App 关闭握手的 requestId 去重、取消复位和过期响应
- editorStore 多标签顺序、状态隔离和恢复

后 3 项使用 better-sqlite3 集成运行时。完整执行 `npm install` 后自动运行；依赖安装不完整时会明确标记为 skipped。

`npm run test:e2e` 会先构建应用，再使用 Playwright 启动 Electron，在临时工作区验证创建、保存、重启、回收站、外部修改冲突、异常恢复、多标签和原生剪贴板主线。

如果 Electron 在启动阶段报告 `crashpad_client_win.cc:867 not connected` 或窗口进程立即退出，属于运行时环境阻塞；此时不应将 E2E 结果当作业务断言失败，也不影响本地 typecheck、单元/集成测试和构建验证。

## 手工核心流程

1. 启动应用并选择空目录
2. 新建画布并插入图片
3. 等待顶部显示“已保存”
4. 返回工作区并确认缩略图
5. 关闭并重新启动
6. 从最近打开进入，确认内容和图片存在
7. 重命名、移动、复制和收藏
8. 删除后从回收站恢复
9. 拖入标准 `.excalidraw`
10. 用外部编辑器修改当前文件，再在画伴中保存，确认生成冲突副本
11. 强制结束编辑进程，再次启动，确认出现恢复提示
12. 用原版 Excalidraw 打开画伴生成的文件

## Windows 安装验收

在 Windows 完整安装依赖后运行：

```powershell
npm run package:win
```

安装、启动、卸载后确认用户工作区文件仍存在。
