use rusqlite::{params, Connection, Result};
use std::path::Path;

pub struct CacheManager {
    conn: Connection,
}

impl CacheManager {
    pub fn new<P: AsRef<Path>>(path: P) -> Result<Self> {
        let conn = Connection::open(path)?;
        let manager = Self { conn };
        manager.init_table()?;
        Ok(manager)
    }

    fn init_table(&self) -> Result<()> {
        let _ = self.conn.pragma_update(None, "journal_mode", "WAL");
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS scan_cache (
                path TEXT PRIMARY KEY,
                size INTEGER NOT NULL,
                modified INTEGER NOT NULL,
                partial_hash TEXT,
                full_hash TEXT
            )",
            [],
        )?;
        // Index for performance
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_path_size_mod ON scan_cache (path, size, modified)",
            [],
        )?;
        Ok(())
    }

    pub fn get_hashes(&self, path: &str, size: u64, modified: u64) -> Result<Option<(Option<String>, Option<String>)>> {
        let mut stmt = self.conn.prepare(
            "SELECT partial_hash, full_hash FROM scan_cache WHERE path = ? AND size = ? AND modified = ?"
        )?;
        
        let mut rows = stmt.query(params![path, size, modified])?;

        if let Some(row) = rows.next()? {
            Ok(Some((row.get(0)?, row.get(1)?)))
        } else {
            Ok(None)
        }
    }

    pub fn upsert_partial(&self, path: &str, size: u64, modified: u64, partial_hash: &str) -> Result<()> {
        self.conn.execute(
            "INSERT INTO scan_cache (path, size, modified, partial_hash)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(path) DO UPDATE SET
                size = excluded.size,
                modified = excluded.modified,
                partial_hash = excluded.partial_hash",
            params![path, size, modified, partial_hash],
        )?;
        Ok(())
    }

    pub fn upsert_full(&self, path: &str, size: u64, modified: u64, full_hash: &str) -> Result<()> {
        self.conn.execute(
            "INSERT INTO scan_cache (path, size, modified, full_hash)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(path) DO UPDATE SET
                size = excluded.size,
                modified = excluded.modified,
                full_hash = excluded.full_hash",
            params![path, size, modified, full_hash],
        )?;
        Ok(())
    }
}
