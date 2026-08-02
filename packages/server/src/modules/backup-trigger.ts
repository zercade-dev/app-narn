/**
 * Backup trigger taxonomy shared by M13 BackupManager, the auto-snapshot
 * helper and the backup routes.
 *
 * The trigger is encoded in the zip FILENAME (between the `-backup-` marker
 * and the trailing timestamp) because the backup listing endpoint works from
 * `fs.readdir` + `stat` alone and never opens archives. It is also mirrored
 * as an optional manifest field for archives that leave the machine.
 *
 * Manual backups keep the legacy `<slug>-backup-<timestamp>.zip` shape, so
 * every pre-existing archive parses as `'manual'`.
 */
export type BackupTrigger = 'manual' | 'pre-import' | 'pre-retranslate' | 'pre-accept';

export const AUTOMATIC_BACKUP_TRIGGERS = [
  'pre-import',
  'pre-retranslate',
  // Taken right before accepted AI glossary/category suggestions are persisted,
  // so a bad batch of suggestions can be rolled back.
  'pre-accept',
] as const satisfies readonly BackupTrigger[];

export type AutomaticBackupTrigger = (typeof AUTOMATIC_BACKUP_TRIGGERS)[number];

// Anchored right before the timestamp + extension so a project slug that
// happens to contain "pre-import" can never be mistaken for a trigger token.
const TRIGGER_PATTERN =
  /-backup-(pre-import|pre-retranslate|pre-accept)-\d{4}-\d{2}-\d{2}-\d{6}\.zip$/;

/** Filename fragment inserted between `-backup-` and the timestamp. */
export function backupFilenameTriggerToken(trigger: BackupTrigger): string {
  return trigger === 'manual' ? '' : `${trigger}-`;
}

/** Derives the trigger from a backup zip filename; unknown shapes ⇒ manual. */
export function parseBackupTrigger(filename: string): BackupTrigger {
  const match = TRIGGER_PATTERN.exec(filename);
  return (match?.[1] as AutomaticBackupTrigger | undefined) ?? 'manual';
}
