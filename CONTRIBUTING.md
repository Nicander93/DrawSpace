# 贡献指南

感谢你为 DrawSpace 提交改进。

## 开始开发

1. Fork 仓库并从 `main` 创建分支。
2. 使用 Node.js 22 和 npm 10 或更高版本。
3. 执行 `npm ci` 安装依赖。
4. 执行 `npm run dev` 启动开发环境。

提交前请运行：

```bash
npm run typecheck
npm test
npm run lint
```

涉及用户操作流程的改动，建议补充或更新 `tests/e2e/` 中的测试。

## 提交 Issue

提交 Bug 时请说明：

- DrawSpace 版本和 Windows 版本
- 可复现的操作步骤
- 预期结果与实际结果
- 相关日志或截图，提交前请移除个人路径和画布内容等敏感信息

安全漏洞不要提交公开 Issue，请按照 [SECURITY.md](SECURITY.md) 私下报告。

## 提交 Pull Request

- 每个 Pull Request 聚焦一个问题。
- 说明改动原因、验证方式和用户可见影响。
- 不要提交 `node_modules/`、`out/`、`release/` 或个人工作区数据。
- 新增行为应尽量包含对应测试。
- 确保 CI 全部通过。

## 发布流程

发布由维护者执行：

1. 确认 `main` 分支的 CI 通过。
2. 使用 `npm version patch|minor|major` 更新版本并创建 Tag。
3. 推送提交和 `v*` Tag。
4. 检查 GitHub Actions 生成的安装程序和 SHA-256 文件。
5. 在干净的 Windows 环境完成安装、启动、保存、重启和卸载验证。
6. 必要时补充 GitHub Release 说明。

版本号遵循语义化版本规则。
