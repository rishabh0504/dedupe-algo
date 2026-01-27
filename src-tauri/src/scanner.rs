use std::fs::File;
use std::io::{Read, BufReader};
use blake3::Hasher;

use serde::Serialize;
use std::time::SystemTime;

#[derive(Serialize, Clone, Debug)]
pub struct FileMetadata {
    pub path: String,
    pub size: u64,
    pub modified: u64,
    pub partial_hash: Option<String>,
    pub full_hash: Option<String>,
}

pub fn get_partial_hash(path: &str) -> Option<String> {
    let mut file = File::open(path).ok()?;
    let mut buffer = [0u8; 16384]; // 16KB
    let n = file.read(&mut buffer).ok()?;
    if n == 0 { return None; }
    
    let mut hasher = Hasher::new();
    hasher.update(&buffer[..n]);
    Some(hasher.finalize().to_hex().to_string())
}

pub fn get_full_hash(path: &str) -> Option<String> {
    let file = File::open(path).ok()?;
    let mut reader = BufReader::new(file);
    let mut hasher = Hasher::new();
    let mut buffer = [0u8; 65536]; // 64KB buffer
    
    while let Ok(n) = reader.read(&mut buffer) {
        if n == 0 { break; }
        hasher.update(&buffer[..n]);
    }
    
    Some(hasher.finalize().to_hex().to_string())
}

pub fn scan_directory(path: &str, scan_hidden: bool) -> Vec<FileMetadata> {


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

    // User-Data Extension Whitelist
    let whitelist_exts = [
        "jpg", "jpeg", "png", "gif", "webp", "heic", "tiff", "bmp", // Images
        "mp4", "mov", "avi", "mkv", "wmv", "flv", "webm",           // Videos
        "zip", "tar", "gz", "7z", "rar",                           // Archives
        "pdf", "docx", "xlsx", "pptx", "txt", "md",                // Documents
        "mp3", "wav", "flac", "m4a", "ogg"                         // Audio
    ];

    // Use the global Rayon thread pool to avoid per-call pool overhead
    rayon::spawn(move || {}); // Ensure pool is initialized
    
    jwalk::WalkDirGeneric::<((), ())>::new(path)
        .skip_hidden(!scan_hidden)
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

                // 3. Extension Whitelist Check
                let ext = path_buf.extension()
                    .and_then(|s| s.to_str())
                    .unwrap_or("")
                    .to_lowercase();
                
                if !whitelist_exts.iter().any(|&w| w == ext) {
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
