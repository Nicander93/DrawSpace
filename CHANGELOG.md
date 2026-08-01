# 更新日志

本文件记录 DrawSpace 的重要版本变化，版本号遵循语义化版本规则。

## [Unreleased]

### Changed

- 去掉坚果云作为独立工作区类型的 UI 与入口；当前统一为本地目录工作区（同步盘目录仍可直接选用）。
- 内部标识由 `canvasdesk` 统一为 `drawspace`（协议、数据库、工作区元数据目录、日志等）；此为破坏性变更，不兼容旧路径。
- 项目正式更名为 DrawSpace。
- 补充 GitHub CI、自动 Release 和开源协作文件。

## [0.1.5] - 2026-07-30

### Fixed

- 修复冷启动后打开已有画布会被误判为未保存，并在关闭时错误提示的问题。

## [0.1.0] - 2026-07-30

### Added

- 本地工作区与 `.excalidraw` 文件索引。
- 画布创建、编辑、搜索、移动、收藏和回收站。
- 自动保存、冲突处理、恢复快照和缩略图。
- Windows 托盘、自定义标题栏与 NSIS 打包配置。

[Unreleased]: https://github.com/Nicander93/DrawSpace/compare/v0.1.5...HEAD
[0.1.5]: https://github.com/Nicander93/DrawSpace/compare/v0.1.4...v0.1.5
[0.1.0]: https://github.com/Nicander93/DrawSpace/releases/tag/v0.1.0
