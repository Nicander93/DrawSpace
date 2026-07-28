# SQLite 数据库

数据库位于 Electron `userData/canvasdesk.db`，使用 WAL 模式。SQLite 只保存索引和应用元数据，不保存画布正文。

## 表

- `workspaces`：工作区路径、类型和最近打开时间
- `documents`：文件名、相对路径、时间、哈希、收藏、缩略图和状态
- `trash_records`：原路径、回收站路径和删除时间
- `app_sessions`：编辑会话开始、结束和退出状态

数据库 Schema 与 PRD 一致，并为工作区、删除状态、最近打开和名称建立索引。

## 重建

工作区中的 `.excalidraw` 是权威数据源。删除或损坏 SQLite 后，重新选择工作区即可递归扫描并重建文档索引。扫描不会进入 `.canvasdesk`、`.git`、`node_modules` 或隐藏目录。

## 查询

搜索只查询 `documents.name` 和 `documents.relative_path`，不会每次重新扫描磁盘。列表采用每页 60 条分页，最近打开最多 20 条。
