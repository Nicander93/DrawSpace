/** 内部标识用小写 slug；展示品牌名为 DrawSpace */
export const APP_SLUG = "drawspace";

export const PROTOCOL_SCHEME = APP_SLUG;
export const WORKSPACE_META_DIR = `.${APP_SLUG}`;
export const DATABASE_FILENAME = `${APP_SLUG}.db`;
export const LOG_FILENAME = `${APP_SLUG}.log`;
export const LOG_ROTATED_FILENAME = `${APP_SLUG}.1.log`;
export const BACKUP_SUFFIX = `.${APP_SLUG}-backup`;
export const E2E_WORKSPACE_ENV = "DRAWSPACE_E2E_WORKSPACE";
