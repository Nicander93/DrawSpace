# StorageProvider

`StorageProvider` 是画伴文件业务的统一边界，接口位于 `src/main/storage/StorageProvider.ts`。

V0 的 `LocalStorageProvider` 提供：

- 初始化根目录
- 递归或分页列举
- 读取
- 带预期版本的原子写入
- 文件状态
- 移动、复制和删除
- 创建目录
- 文件变化监听

所有相对路径在使用前都会解析并确认仍位于工作区根目录内。绝对路径和 `..` 路径穿越会被拒绝。

递归扫描排除：

```text
.canvasdesk/
node_modules/
.git/
其他隐藏目录
```

## 原子写入

本地写入流程：

1. 在目标文件同目录创建随机 `.tmp`
2. 写入完整内容
3. 对文件执行 `fsync`
4. 关闭临时文件
5. 使用 rename 替换正式文件
6. 失败时删除临时文件

写入前可传入 `expectedVersion`。版本由 mtime 和文件大小组成，用于阻止检查之后发生的并发覆盖。

V1 可增加 `S3StorageProvider`，但 `DocumentService` 不需要改变文件业务语义。
