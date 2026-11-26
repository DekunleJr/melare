/*
 *   npm run backup
 * Writes the database and uploaded files into a new folder under backups/.
 */
import { closeDb } from "@/db";
import { backupDir, createBackup } from "@/lib/backup";

createBackup()
  .then((name) => console.log(`Backup saved in ${backupDir()} as ${name}`))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closeDb);
