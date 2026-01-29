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

    /// Fetches all cached hashes for a set of paths to minimize DB roundtrips.
    /// Note: Returns ALL hashes in the DB for easier bulk processing if needed.
    pub fn get_all_cached_hashes(&self) -> Result<std::collections::HashMap<String, (u64, u64, Option<String>, Option<String>)>> {
        let mut stmt = self.conn.prepare("SELECT path, size, modified, partial_hash, full_hash FROM scan_cache")?;
        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                (
                    row.get::<_, u64>(1)?,
                    row.get::<_, u64>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, Option<String>>(4)?
                )
            ))
        })?;

        let mut map = std::collections::HashMap::new();
        for row in rows {
            let (path, data) = row?;
            map.insert(path, data);
        }
        Ok(map)
    }

    pub fn batch_upsert(&mut self, updates: Vec<(String, u64, u64, Option<String>, Option<String>)>) -> Result<()> {
        let tx = self.conn.transaction()?;
        {
            let mut stmt = tx.prepare(
                "INSERT INTO scan_cache (path, size, modified, partial_hash, full_hash)
                 VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT(path) DO UPDATE SET
                    size = excluded.size,
                    modified = excluded.modified,
                    partial_hash = COALESCE(excluded.partial_hash, scan_cache.partial_hash),
                    full_hash = COALESCE(excluded.full_hash, scan_cache.full_hash)"
            )?;
            for (path, size, mod_time, ph, fh) in updates {
                stmt.execute(params![path, size, mod_time, ph, fh])?;
            }
        }
        tx.commit()
    }

    pub fn clear_cache(&self) -> Result<()> {
        self.conn.execute("DELETE FROM scan_cache", [])?;
        // Optional: VACUUM to reclaim space, though WAL mode usually handles it well enough.
        // self.conn.execute("VACUUM", [])?; 
        Ok(())
    }
}
