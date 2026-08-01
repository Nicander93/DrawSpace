import {
  documentIdSchema,
  recoverySnapshotSchema
} from "@shared/schemas";
import { IPC_CHANNELS } from "@shared/channels";
import type { DocumentService } from "../services/DocumentService";
import type { RecoveryService } from "../services/RecoveryService";
import type { IpcHandle } from "./types";

interface RecoveryHandlerDeps {
  documentService: DocumentService;
  recoveryService: RecoveryService;
}

/** 注册 recovery:* 通道：崩溃恢复快照的列举、保存、还原、丢弃 */
export const registerRecoveryHandlers = (
  handle: IpcHandle,
  { documentService, recoveryService }: RecoveryHandlerDeps
): void => {
  handle(IPC_CHANNELS.recoveryList, () => recoveryService.list());

  handle(IPC_CHANNELS.recoverySave, (snapshotInput) =>
    documentService.saveRecoverySnapshot(
      recoverySnapshotSchema.parse(snapshotInput)
    )
  );

  handle(IPC_CHANNELS.recoveryRestore, (documentIdInput) =>
    documentService.restoreRecovery(documentIdSchema.parse(documentIdInput))
  );

  handle(IPC_CHANNELS.recoveryDiscard, (documentIdInput) =>
    recoveryService.discard(documentIdSchema.parse(documentIdInput))
  );
};
