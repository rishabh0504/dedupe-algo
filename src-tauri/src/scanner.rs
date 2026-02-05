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


pub fn get_partial_hash(path: &str) -> Option<String> {
    // xattr caching removed for reliability. 
    // Moving files does not update xattr, leading to stale hashes.
    // We strictly use the SQLite DB for caching now.

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
    // xattr caching removed for reliability.

    let file = File::open(path).ok()?;
    let mut reader = BufReader::new(file);
    let mut hasher = Hasher::new();
    let mut buffer = [0u8; 1048576]; // 1MB buffer for NVMe/SSD optimization
    
    while let Ok(n) = reader.read(&mut buffer) {
        if n == 0 { break; }
        hasher.update(&buffer[..n]);
    }
    
    let hash = hasher.finalize().to_hex().to_string();
    
    // Cache update disabled to prevent stale data on move.
    
    Some(hash)
}

pub fn scan_directory_shell(
    path: &str,
    script_path: &str,
    min_file_size: u64,
    whitelist_exts: &HashSet<String>,
    scan_hidden: bool,
) -> Option<Vec<FileMetadata>> {
    use std::process::Command;

    let exts_csv = whitelist_exts.iter().cloned().collect::<Vec<String>>().join(",");
    
    let output = Command::new(script_path)
        .args([path, &min_file_size.to_string(), &exts_csv, &scan_hidden.to_string()])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut files = Vec::new();

    for line in stdout.lines() {
        let parts: Vec<&str> = line.splitn(3, ' ').collect();
        if parts.len() == 3 {
            let size = parts[0].parse::<u64>().unwrap_or(0);
            let modified = parts[1].parse::<u64>().unwrap_or(0);
            let path = parts[2].trim().to_string();

            files.push(FileMetadata {
                path,
                size,
                modified,
                partial_hash: None,
                full_hash: None,
            });
        }
    }

    Some(files)
}

pub fn scan_directory(
    path: &str, 
    script_path: Option<&str>,
    scan_hidden: bool,
    scan_images: bool,
    scan_videos: bool,
    scan_zips: bool,
    min_file_size: u64
) -> Vec<FileMetadata> {
    // Whitelist setup
    let mut whitelist_exts = HashSet::new();
    if scan_images {
        for ext in ["jpg", "jpeg", "png", "gif", "webp", "heic", "tiff", "bmp", "arw", "cr2", "nef", "dng", "orf", "rw2", "svg", "psd", "ai", "ico"] {
            whitelist_exts.insert(ext.to_string());
        }
    }
    if scan_videos {
        for ext in ["mp4", "mov", "avi", "mkv", "wmv", "flv", "webm", "m4v", "ts", "mts", "m2ts", "3gp", "divx", "vob"] {
            whitelist_exts.insert(ext.to_string());
        }
    }
    if scan_zips {
        for ext in ["zip", "tar", "gz", "7z", "rar"] {
            whitelist_exts.insert(ext.to_string());
        }
    }
    for ext in ["pdf", "docx", "xlsx", "pptx", "txt", "md", "mp3", "wav", "flac", "m4a", "ogg"] {
        whitelist_exts.insert(ext.to_string());
    }

    // Attempt shell discovery first (Fastest)
    if let Some(sp) = script_path {
        if let Some(files) = scan_directory_shell(path, sp, min_file_size, &whitelist_exts, scan_hidden) {
            if !files.is_empty() {
                return files;
            }
        }
    }

    // Comprehensive Blacklist for fallback
    let blacklist = [
        "/System", "/Library", "/Windows", "/bin", "/usr/bin", "/usr/sbin",
        "/dev", "/proc", "/sys", "/etc", "/var/lib", "/var/cache",
        ".Trash", "$RECYCLE.BIN"
    ];

    let dev_black_names: HashSet<&str> = [
        "node_modules", "venv", ".venv", "env", "target", "dist", "build",
        "__pycache__", ".git", ".hg", ".svn", ".vscode", ".idea"
    ].iter().cloned().collect();

    jwalk::WalkDirGeneric::<((), ())>::new(path)
        .skip_hidden(!scan_hidden)
        .follow_links(false)
        .parallelism(jwalk::Parallelism::RayonNewPool(0))
        .process_read_dir(move |_, _, _, children| {
            children.retain(|child| {
                if let Ok(entry) = child {
                    if entry.file_type.is_dir() {
                        let name = entry.file_name.to_string_lossy();
                        if dev_black_names.contains(&*name) {
                            return false;
                        }
                    }
                }
                true
            });
        })
        .into_iter()
        .filter_map(|e| e.ok())
        .filter_map(|entry| {
            let path_buf = entry.path();
            let path_str = path_buf.to_string_lossy();
            
            if blacklist.iter().any(|b| path_str.starts_with(b)) {
                return None;
            }

            if entry.file_type.is_file() {
                let ext = path_buf.extension()
                    .and_then(|s| s.to_str())
                    .unwrap_or("")
                    .to_lowercase();
                
                if !whitelist_exts.contains(&ext) {
                    return None;
                }

                if let Ok(metadata) = entry.metadata() {
                    if metadata.len() < min_file_size {
                        return None;
                    }

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
