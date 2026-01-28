use std::fs::File;
use std::io::{Read, BufReader};
use blake3::Hasher;

use serde::Serialize;
use std::time::SystemTime;
use std::collections::HashSet;
use std::io::Seek;
use std::io::SeekFrom;

#[derive(Serialize, Clone, Debug)]
pub struct FileMetadata {
    pub path: String,
    pub size: u64,
    pub modified: u64,
    pub partial_hash: Option<String>,
    pub full_hash: Option<String>,
}

const XATTR_HASH_KEY: &str = "user.dedupe.hash";

pub fn get_partial_hash(path: &str) -> Option<String> {
    // 1. Try to read from xattr first for instant "verification"
    if let Ok(Some(cached_hash)) = xattr::get(path, XATTR_HASH_KEY) {
        if let Ok(hash_str) = String::from_utf8(cached_hash) {
            // Optimization: If we have ANY hash stored, we can potentially use it 
            // but for partial we usually want fresh check or specific partial key.
            // For now, let's just proceed to compute to be safe, or we can use a different key.
        }
    }

    let mut file = File::open(path).ok()?;
    let metadata = file.metadata().ok()?;
    let size = metadata.len();
    
    if size == 0 { return None; }

    let mut hasher = Hasher::new();
    let mut buffer = [0u8; 16384]; // 16KB
    
    // Hash the head
    let n = file.read(&mut buffer).ok()?;
    hasher.update(&buffer[..n]);

    // If file is large enough, hash the tail to reduce collisions
    // This is vital for video files that share the same headers
    if size > 32768 {
        let _ = file.seek(SeekFrom::End(-16384)).ok()?;
        let n = file.read(&mut buffer).ok()?;
        hasher.update(&buffer[..n]);
    }
    
    Some(hasher.finalize().to_hex().to_string())
}

pub fn get_full_hash(path: &str) -> Option<String> {
    // 1. Check xattr for existing hash
    if let Ok(Some(cached_hash)) = xattr::get(path, XATTR_HASH_KEY) {
        if let Ok(hash_str) = String::from_utf8(cached_hash) {
            return Some(hash_str);
        }
    }

    let file = File::open(path).ok()?;
    let mut reader = BufReader::new(file);
    let mut hasher = Hasher::new();
    let mut buffer = [0u8; 131072]; // 128KB buffer for NVMe optimization
    
    while let Ok(n) = reader.read(&mut buffer) {
        if n == 0 { break; }
        hasher.update(&buffer[..n]);
    }
    
    let hash = hasher.finalize().to_hex().to_string();
    
    // 2. Persist hash to xattr for "Automatic Verification" in future runs
    let _ = xattr::set(path, XATTR_HASH_KEY, hash.as_bytes());
    
    Some(hash)
}

pub fn scan_directory(
    path: &str, 
    scan_hidden: bool,
    scan_images: bool,
    scan_videos: bool,
    scan_zips: bool
) -> Vec<FileMetadata> {


    // Comprehensive Blacklist
    let blacklist = [
        "/System", "/Library", "/Windows", "/bin", "/usr/bin", "/usr/sbin",
        "/dev", "/proc", "/sys", "/etc", "/var/lib", "/var/cache",
        ".Trash", "$RECYCLE.BIN"
    ];

    // Developer / High-Entropy Folder Exclusions
    let dev_black_names = [
        "node_modules", "venv", ".venv", "env", "target", "dist", "build",
        "__pycache__", ".git", ".hg", ".svn", ".vscode", ".idea"
    ];

    // Build Whitelist dynamically (Using HashSet for O(1) lookup)
    let mut whitelist_exts = HashSet::new();
    
    if scan_images {
        for ext in ["jpg", "jpeg", "png", "gif", "webp", "heic", "tiff", "bmp"] {
            whitelist_exts.insert(ext.to_string());
        }
    }
    
    if scan_videos {
        for ext in ["mp4", "mov", "avi", "mkv", "wmv", "flv", "webm"] {
            whitelist_exts.insert(ext.to_string());
        }
    }
    
    if scan_zips {
        for ext in ["zip", "tar", "gz", "7z", "rar"] {
            whitelist_exts.insert(ext.to_string());
        }
    }

    // Always include documents and audio
    for ext in ["pdf", "docx", "xlsx", "pptx", "txt", "md", "mp3", "wav", "flac", "m4a", "ogg"] {
        whitelist_exts.insert(ext.to_string());
    }


    
    jwalk::WalkDirGeneric::<((), ())>::new(path)
        .skip_hidden(!scan_hidden)
        .follow_links(false) // Core protection: never follow symlinks to avoid recursion or duplication
        .parallelism(jwalk::Parallelism::RayonNewPool(0))
        .into_iter()
        .filter_map(|e| e.ok())
        .filter_map(|entry| {
            let path_buf = entry.path();
            let path_str = path_buf.to_string_lossy();

            // 1. Absolute Path Blacklist Check
            if blacklist.iter().any(|b| path_str.starts_with(b)) {
                return None;
            }

            // 2. Folder Name Blacklist Check (for Dev tools/Libraries)
            if entry.file_type.is_dir() {
                if let Some(name) = path_buf.file_name() {
                    let name_str = name.to_string_lossy();
                    if dev_black_names.iter().any(|&b| name_str == b) {
                        return None; 
                    }
                }
            }

            if entry.file_type.is_file() {
                // Optimization: Use a simpler check for parent folders
                let mut components = path_buf.components();
                while let Some(comp) = components.next() {
                    if let Some(name) = comp.as_os_str().to_str() {
                        if dev_black_names.contains(&name) {
                            return None;
                        }
                    }
                }

                // 3. Extension Whitelist Check (O(1))
                let ext = path_buf.extension()
                    .and_then(|s| s.to_str())
                    .unwrap_or("")
                    .to_lowercase();
                
                if !whitelist_exts.contains(&ext) {
                    return None;
                }

                if let Ok(metadata) = entry.metadata() {
                    return Some(FileMetadata {
                        path: path_str.into_owned(),
                        size: metadata.len(),
                        modified: metadata.modified()
                            .unwrap_or(SystemTime::UNIX_EPOCH)
                            .duration_since(SystemTime::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_secs(),
                        partial_hash: None,
                        full_hash: None,
                    });
                }
            }
            None
        })
        .collect()
}
