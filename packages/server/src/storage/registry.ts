import { getPool, TenantDb } from './pg/pool.js';
import { PgBackupStore } from './pg-backup-store.js';
import { PgCollabRoutingStore } from './pg-collab-routing-store.js';
import { PgDeviceVaultStore } from './pg-device-vault-store.js';
import { PgFreewayLedgerStore } from './pg-freeway-ledger-store.js';
import { PgGlobalConfigStore } from './pg-global-config-store.js';
import { PgGlossaryStore } from './pg-glossary-store.js';
import { PgMemberStore } from './pg-member-store.js';
import { PgNotificationStore } from './pg-notification-store.js';
import { PgProjectStore } from './pg-project-store.js';
import { PgReviewOrderStore } from './pg-review-order-store.js';
import { PgRunStore } from './pg-run-store.js';
import { PgStringStore } from './pg-string-store.js';
import { PgTemplateStore } from './pg-template-store.js';
import { PgTranslationMemory } from './pg-translation-memory.js';
// Referenced only inside the default deepLModuleProvider closure below — i.e. at
// call-time, not module-eval time — so the M6↔registry import cycle (M6 imports
// getGlobalConfigStore from here) resolves via live bindings without an order trap.
import { moduleRegistry as defaultModuleRegistry } from '../modules/M6-module-registry.js';
import type {
  BackupStore,
  CollabRoutingStore,
  DeviceVaultRecord,
  DeviceVaultStore,
  FreewayLedgerStore,
  GlobalConfigStore,
  GlossaryStore,
  MemberStore,
  NotificationStore,
  ProjectStore,
  ReviewOrderStore,
  RunStore,
  StringStore,
  TemplateStore,
  TranslationMemory,
} from './types.js';

let projectStore: ProjectStore | undefined;
let templateStore: TemplateStore | undefined;
let globalConfigStore: GlobalConfigStore | undefined;
let translationMemory: TranslationMemory | undefined;
let glossaryStore: GlossaryStore | undefined;
let stringStore: StringStore | undefined;
let runStore: RunStore | undefined;
let reviewOrderStore: ReviewOrderStore | undefined;
let memberStore: MemberStore | undefined;
let backupStore: BackupStore | undefined;
let notificationStore: NotificationStore | undefined;
let deviceVaultStore: DeviceVaultStore | undefined;
let collabRoutingStore: CollabRoutingStore | undefined;
let freewayLedgerStore: FreewayLedgerStore | undefined;

export function getProjectStore(): ProjectStore {
  if (!projectStore) projectStore = new PgProjectStore(new TenantDb(getPool()));
  return projectStore;
}
export function setProjectStore(store: ProjectStore): void {
  projectStore = store;
}

export function getTemplateStore(): TemplateStore {
  if (!templateStore) templateStore = new PgTemplateStore(new TenantDb(getPool()));
  return templateStore;
}
export function setTemplateStore(store: TemplateStore): void {
  templateStore = store;
}

export function getGlobalConfigStore(): GlobalConfigStore {
  if (!globalConfigStore) globalConfigStore = new PgGlobalConfigStore(new TenantDb(getPool()));
  return globalConfigStore;
}
export function setGlobalConfigStore(store: GlobalConfigStore): void {
  globalConfigStore = store;
}

export function getTranslationMemory(): TranslationMemory {
  if (!translationMemory) translationMemory = new PgTranslationMemory(new TenantDb(getPool()));
  return translationMemory;
}
export function setTranslationMemory(store: TranslationMemory): void {
  translationMemory = store;
}

export function getGlossaryStore(): GlossaryStore {
  if (!glossaryStore) {
    glossaryStore = new PgGlossaryStore(new TenantDb(getPool()), {
      // Mirror M8's old default provider. Resolved lazily here (closure body runs
      // at call-time) so the M6↔registry import cycle never bites at eval.
      deepLModuleProvider: (config, sessionId) =>
        defaultModuleRegistry.createWithConfig('deepl', config ?? {}, sessionId),
    });
  }
  return glossaryStore;
}
export function setGlossaryStore(store: GlossaryStore): void {
  glossaryStore = store;
}

export function getStringStore(): StringStore {
  if (!stringStore) stringStore = new PgStringStore(new TenantDb(getPool()));
  return stringStore;
}
export function setStringStore(store: StringStore): void {
  stringStore = store;
}

export function getRunStore(): RunStore {
  if (!runStore) runStore = new PgRunStore(new TenantDb(getPool()));
  return runStore;
}
export function setRunStore(store: RunStore): void {
  runStore = store;
}

export function getReviewOrderStore(): ReviewOrderStore {
  if (!reviewOrderStore) reviewOrderStore = new PgReviewOrderStore(new TenantDb(getPool()));
  return reviewOrderStore;
}
export function setReviewOrderStore(store: ReviewOrderStore): void {
  reviewOrderStore = store;
}

export function getMemberStore(): MemberStore {
  if (!memberStore) memberStore = new PgMemberStore(new TenantDb(getPool()));
  return memberStore;
}
export function setMemberStore(store: MemberStore): void {
  memberStore = store;
}

export function getBackupStore(): BackupStore {
  if (!backupStore) backupStore = new PgBackupStore(new TenantDb(getPool()));
  return backupStore;
}
export function setBackupStore(store: BackupStore): void {
  backupStore = store;
}

export function getNotificationStore(): NotificationStore {
  if (!notificationStore) notificationStore = new PgNotificationStore(new TenantDb(getPool()));
  return notificationStore;
}
export function setNotificationStore(store: NotificationStore): void {
  notificationStore = store;
}

export function getDeviceVaultStore(): DeviceVaultStore {
  if (!deviceVaultStore) deviceVaultStore = new PgDeviceVaultStore(new TenantDb(getPool()));
  return deviceVaultStore;
}
export function setDeviceVaultStore(store: DeviceVaultStore): void {
  deviceVaultStore = store;
}

export function getCollabRoutingStore(): CollabRoutingStore {
  if (!collabRoutingStore) collabRoutingStore = new PgCollabRoutingStore(new TenantDb(getPool()));
  return collabRoutingStore;
}
export function setCollabRoutingStore(store: CollabRoutingStore): void {
  collabRoutingStore = store;
}

export function getFreewayLedgerStore(): FreewayLedgerStore {
  if (!freewayLedgerStore) freewayLedgerStore = new PgFreewayLedgerStore(new TenantDb(getPool()));
  return freewayLedgerStore;
}
export function setFreewayLedgerStore(store: FreewayLedgerStore): void {
  freewayLedgerStore = store;
}

/**
 * Ambient-tenant convenience wrappers — the cloud composition root's
 * `/auth/devices` routes import surface (via the `storage/index.ts` barrel).
 * Both resolve THROUGH {@link getDeviceVaultStore} (not a freshly-constructed
 * store), mirroring `packages/server/src/routes/notifications.ts`'s
 * `getNotificationStore().listForCurrentUser()` call and
 * `collect-tenant-export.ts`'s registry-getter resolution — so
 * {@link setDeviceVaultStore} is a real test-injection seam for these, exactly
 * like every other `setXStore`. Each still requires an ALREADY-ESTABLISHED
 * ambient tenant (narn's identityMiddleware wraps the whole `/auth/*` request
 * in `runWithTenant`); with none, the store's underlying `requireTenant()`
 * throws (fail-closed).
 */
export async function listDeviceVaultsForCurrentUser(): Promise<DeviceVaultRecord[]> {
  return getDeviceVaultStore().listForCurrentUser();
}
/** See {@link listDeviceVaultsForCurrentUser}. A foreign/missing deviceId is a silent no-op. */
export async function deleteDeviceVaultForCurrentUser(deviceId: string): Promise<void> {
  return getDeviceVaultStore().delete(deviceId);
}

export function __resetStorageForTests(): void {
  projectStore = undefined;
  templateStore = undefined;
  globalConfigStore = undefined;
  translationMemory = undefined;
  glossaryStore = undefined;
  stringStore = undefined;
  runStore = undefined;
  reviewOrderStore = undefined;
  memberStore = undefined;
  backupStore = undefined;
  notificationStore = undefined;
  deviceVaultStore = undefined;
  collabRoutingStore = undefined;
  freewayLedgerStore = undefined;
}
