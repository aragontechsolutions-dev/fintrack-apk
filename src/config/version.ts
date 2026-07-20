/** App-wide version constants used by the backup subsystem. */

/** Magic marker identifying a FinTrack portable backup container. */
export const BACKUP_MAGIC = 'FINTRACK-BACKUP';

/** Container format version. Bump when the container envelope changes. */
export const BACKUP_FORMAT_VERSION = 1;

/**
 * Logical data-schema version. Bump whenever a DB migration changes the shape
 * of the exported tables, so restore can detect incompatible backups.
 */
export const SCHEMA_VERSION = 1;

/** File extension for portable backups. */
export const BACKUP_EXT = 'ftbk';
