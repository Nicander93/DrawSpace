import { useMemo, useState } from "react";
import type { CanvasDocument } from "@shared/types";
import { buildDirectoryTree, type DirectoryNode } from "./MoveDocumentDialog";
import { Modal } from "./Modal";

interface MoveDocumentsDialogProps {
  documents: CanvasDocument[];
  directories: string[];
  onClose(): void;
  onMoved(): Promise<void>;
}

export function MoveDocumentsDialog({ documents, directories, onClose, onMoved }: MoveDocumentsDialogProps) {
  const [selected, setSelected] = useState("");
  const [creating, setCreating] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const tree = useMemo(() => buildDirectoryTree(directories), [directories]);
  const renderNodes = (nodes: DirectoryNode[]) => nodes.map((node) => (
    <div className="move-directory-node" key={node.path}>
      <button type="button" className={selected === node.path ? "is-selected" : ""} onClick={() => setSelected(node.path)}>○ {node.name}</button>
      {renderNodes(node.children)}
    </div>
  ));
  const move = async () => {
    setSubmitting(true);
    try {
      for (const document of documents) await window.desktopApi.documents.move(document.id, selected);
      await onMoved();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };
  const createFolder = async () => {
    const name = folderName.trim();
    if (!name) return;
    const path = selected ? `${selected}/${name}` : name;
    setSubmitting(true);
    try {
      await window.desktopApi.workspace.createDirectory(path);
      setSelected(path);
      setFolderName("");
      setCreating(false);
      await onMoved();
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <Modal title={`移动 ${documents.length} 个画布`} onClose={onClose} footer={<><button className="button" type="button" onClick={onClose}>取消</button><button className="button button--primary" type="button" disabled={submitting} onClick={() => void move()}>移动</button></>}>
      <p>选择目标文件夹：</p>
      <div className="move-directory-tree">
        <button type="button" className={selected === "" ? "is-selected" : ""} onClick={() => setSelected("")}>○ 工作区根目录</button>
        {renderNodes(tree)}
      </div>
      {creating ? (
        <div className="move-directory-create">
          <input autoFocus value={folderName} placeholder="新文件夹名称" onChange={(event) => setFolderName(event.target.value)} />
          <button className="button" type="button" disabled={submitting || !folderName.trim()} onClick={() => void createFolder()}>创建</button>
        </div>
      ) : (
        <button className="button" type="button" disabled={submitting} onClick={() => setCreating(true)}>新建文件夹</button>
      )}
    </Modal>
  );
}
