import { useMemo, useState } from "react";
import type { CanvasDocument } from "@shared/types";
import { Modal } from "./Modal";

interface MoveDocumentDialogProps {
  document: CanvasDocument;
  directories: string[];
  onClose(): void;
  onMoved(document?: CanvasDocument): Promise<void>;
}

export interface DirectoryNode { name: string; path: string; children: DirectoryNode[] }

export const buildDirectoryTree = (directories: string[]): DirectoryNode[] => {
  const roots: DirectoryNode[] = [];
  for (const path of directories) {
    let nodes = roots;
    let current = "";
    for (const part of path.split("/").filter(Boolean)) {
      current = current ? `${current}/${part}` : part;
      let node = nodes.find((item) => item.name === part);
      if (!node) { node = { name: part, path: current, children: [] }; nodes.push(node); }
      nodes = node.children;
    }
  }
  return roots;
};

export function MoveDocumentDialog({ document, directories, onClose, onMoved }: MoveDocumentDialogProps) {
  const [selected, setSelected] = useState(document.relativePath.split("/").slice(0, -1).join("/"));
  const [creating, setCreating] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const tree = useMemo(() => buildDirectoryTree(directories), [directories]);
  const renderNodes = (nodes: DirectoryNode[]) => nodes.map((node) => <div className="move-directory-node" key={node.path}><button type="button" className={selected === node.path ? "is-selected" : ""} onClick={() => setSelected(node.path)}>○ {node.name}</button>{renderNodes(node.children)}</div>);
  const createFolder = async () => {
    const name = folderName.trim();
    if (!name) return;
    const path = selected ? `${selected}/${name}` : name;
    await window.desktopApi.workspace.createDirectory(path);
    setSelected(path); setFolderName(""); setCreating(false); await onMoved();
  };
  const move = async () => {
    if (selected === document.relativePath.split("/").slice(0, -1).join("/")) return;
    setSubmitting(true);
    try { const updated = await window.desktopApi.documents.move(document.id, selected); await onMoved(updated); onClose(); }
    finally { setSubmitting(false); }
  };
  return <Modal title={`移动“${document.name}”`} onClose={onClose} footer={<><button className="button" type="button" onClick={onClose}>取消</button><button className="button button--primary" type="button" disabled={submitting || selected === document.relativePath.split("/").slice(0, -1).join("/")} onClick={() => void move()}>移动</button></>}> 
    <p>选择目标文件夹：</p>
    <div className="move-directory-tree"><button type="button" className={selected === "" ? "is-selected" : ""} onClick={() => setSelected("")}>○ 工作区根目录</button>{renderNodes(tree)}</div>
    {creating ? <div className="move-directory-create"><input autoFocus value={folderName} placeholder="新文件夹名称" onChange={(event) => setFolderName(event.target.value)} /><button className="button" type="button" onClick={() => void createFolder()}>创建</button></div> : <button className="button" type="button" onClick={() => setCreating(true)}>新建文件夹</button>}
  </Modal>;
}
