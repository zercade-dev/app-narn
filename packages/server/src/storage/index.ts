//
// Public storage seam. A cloud composition root can swap the default PG
// adapter for a multi-tenant one at boot:
//   import { setProjectStore } from '@zercade-dev/narn-server/storage';
//   setProjectStore(new CloudProjectStore(...));
//   const { start } = await import('@zercade-dev/narn-server');  // importing no longer auto-listens
//   await start();
//
export type {
  ProjectStore,
  TemplateStore,
  GlobalConfigStore,
  TranslationMemory,
  GlossaryStore,
  IncompleteGlossary,
  StringStore,
  StringQueryFilters,
  RunStore,
  SourceReviewRecord,
  ReviewOrderStore,
  NotificationStore,
  DeviceVaultStore,
  DeviceVaultRecord,
  MemberStore,
  ProjectMember,
  CollabRoutingConfig,
  CollabRoutingStore,
  FreewayLedgerStore,
  FreewayUsageDelta,
  FreewayWindowRef,
  FreewayWindowUsage,
  FreewayBucketState,
  FreewayBucketStats,
} from './types.js';
export { PgProjectStore } from './pg-project-store.js';
export { PgTemplateStore } from './pg-template-store.js';
export { PgCollabRoutingStore } from './pg-collab-routing-store.js';
export { PgFreewayLedgerStore } from './pg-freeway-ledger-store.js';
export { PgGlobalConfigStore } from './pg-global-config-store.js';
export { PgTranslationMemory } from './pg-translation-memory.js';
export { PgGlossaryStore } from './pg-glossary-store.js';
export { PgStringStore } from './pg-string-store.js';
export { PgRunStore } from './pg-run-store.js';
export { PgReviewOrderStore } from './pg-review-order-store.js';
export { PgMemberStore } from './pg-member-store.js';
// PgNotificationStore is the user-facing read/ack/dismiss surface;
// insertNotificationForUser is the explicit-tenant broadcast-fan-out helper
// for a future admin/ops path. Both re-exported here — this barrel is the
// ONLY path by which code outside this package can reach them.
export {
  PgNotificationStore,
  insertNotificationForUser,
  type NewNotificationInput,
} from './pg-notification-store.js';
// Devices sub-section (Account -> Security -> Devices): PgDeviceVaultStore is
// the ambient-tenant device_vaults METADATA store (mirrors PgNotificationStore).
export { PgDeviceVaultStore } from './pg-device-vault-store.js';
export {
  getProjectStore,
  setProjectStore,
  getTemplateStore,
  setTemplateStore,
  getGlobalConfigStore,
  setGlobalConfigStore,
  getTranslationMemory,
  setTranslationMemory,
  getGlossaryStore,
  setGlossaryStore,
  getStringStore,
  setStringStore,
  getRunStore,
  setRunStore,
  getReviewOrderStore,
  setReviewOrderStore,
  getMemberStore,
  setMemberStore,
  getNotificationStore,
  setNotificationStore,
  getDeviceVaultStore,
  setDeviceVaultStore,
  getCollabRoutingStore,
  setCollabRoutingStore,
  getFreewayLedgerStore,
  setFreewayLedgerStore,
  // listDeviceVaultsForCurrentUser/deleteDeviceVaultForCurrentUser are the
  // free-function import surface the cloud composition root's `/auth/devices`
  // routes use directly — same direct-barrel-import pattern as
  // collectTenantExport/teardownTenant/mintDeletionToken/consumeDeletionToken.
  // Defined in registry.ts (not pg-device-vault-store.ts) because they
  // resolve THROUGH getDeviceVaultStore.
  listDeviceVaultsForCurrentUser,
  deleteDeviceVaultForCurrentUser,
  __resetStorageForTests,
} from './registry.js';
export {
  getPool,
  getMigrationPool,
  getPoolStats,
  setPoolForTests,
  closePool,
  withTransaction,
  withTenantTransaction,
  TenantDb,
  APP_ROLE,
} from './pg/pool.js';
export type { Queryable } from './pg/pool.js';
// The ambient tenant-context accessors. A cloud composition root's
// CloudVaultStore (and its tests) read the current tenant —
// `requireTenant().userId` and `getCurrentTenant()?.deviceId` — to scope the
// per-device vault, and need to establish/override context in tests; expose
// them on the public barrel so cloud code imports from
// `@zercade-dev/narn-server/storage`, not a deep pg path.
export {
  runWithTenant,
  getCurrentTenant,
  requireTenant,
  __setTestTenant,
} from './pg/tenant-context.js';
export type { TenantContext } from './pg/tenant-context.js';
export { runMigrations } from './pg/migrate.js';
// RLS-enforced per-user data erase (account deletion) + the one-time
// deletion-token mint/consume a cloud account-deletion flow calls. Re-exported
// here so cloud code imports them from the whitelisted
// `@zercade-dev/narn-server/storage` barrel (deep subpaths like `…/modules/x`
// do not resolve outside this package).
export { teardownTenant } from './teardown-tenant.js';
// Read-only single-JSON tenant data export (the cloud export route's payload
// source). Re-exported here so cloud code imports it from the whitelisted
// `@zercade-dev/narn-server/storage` barrel, not a deep subpath.
export { collectTenantExport, type TenantExport } from './collect-tenant-export.js';
export { mintDeletionToken, consumeDeletionToken } from '../modules/account-deletion-tokens.js';
export { dumpProject, restoreProject } from './project-snapshot.js';
export type { ProjectSnapshot, RunSnapshot } from './project-snapshot.js';
// Tenant provisioning. `initTenant` is the per-tenant init (boot runs it for
// 'local'); `ensureTenantProvisioned` is the lazy, per-process guard a cloud
// composition root's CloudIdentityProvider.resolve() calls on the first
// authenticated request.
export { initTenant } from '../startup.js';
export { ensureTenantProvisioned, __resetProvisionedForTests } from './ensure-provisioned.js';
