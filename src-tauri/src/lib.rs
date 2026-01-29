mod scanner;
mod cache;

use sysinfo::{Disks};
use serde::Serialize;
use scanner::{FileMetadata, scan_directory};
use cache::CacheManager;
use tauri::{Manager, State};
use std::sync::Mutex;

struct AppState {
    cache: Mutex<Option<CacheManager>>,
}

use std::collections::HashMap;
use rayon::prelude::*;

#[derive(Serialize)]
struct ScanResult {
    groups: Vec<Vec<FileMetadata>>,
}

#[derive(Serialize, Clone)]
struct ProgressPayload {
    current: usize,
    total: usize,
    file: String,
}

#[tauri::command]
fn start_scan(
    app: tauri::AppHandle,
    paths: Vec<String>, 
    scan_hidden: bool, 
    scan_images: bool,
    scan_videos: bool,
    scan_zips: bool,
    min_file_size: u64,
    state: State<AppState>
) -> ScanResult {
    use tauri::Emitter;

    // Phase 1: Traversal (Parallel across root paths)
    println!("Starting scan for paths: {:?}", paths);
    let all_files: Vec<FileMetadata> = paths.par_iter()
        .flat_map(|path| {
            let found = scan_directory(path, scan_hidden, scan_images, scan_videos, scan_zips, min_file_size);
            println!("Scanned path: {}. Found {} files.", path, found.len());
            found
        })
        .collect();
    println!("Total files found in Phase 1: {}", all_files.len());

    // Pass 1: Group by Size
    let mut size_groups: HashMap<u64, Vec<FileMetadata>> = HashMap::new();
    for file in all_files {
        size_groups.entry(file.size).or_default().push(file);
    }

    // Discard unique sizes
    let potential_dupes: Vec<FileMetadata> = size_groups.into_iter()
        .filter(|(_, group)| group.len() > 1)
        .flat_map(|(_, group)| group)
        .collect();

    println!("Phase 1 Complete. Potential duplicates by size: {}", potential_dupes.len());

    if potential_dupes.is_empty() { return ScanResult { groups: Vec::new() }; }

    // Optimization: Pre-fetch all hashes from DB to avoid locking inside parallel pass
    let cached_hashes = {
        let cache_lock = state.cache.lock().unwrap();
        cache_lock.as_ref().and_then(|c| c.get_all_cached_hashes().ok()).unwrap_or_default()
    };

    let total_files = potential_dupes.len();
    let processed_count = std::sync::atomic::AtomicUsize::new(0);

    // Pass 2: Partial Hash (Parallel)
    // To emit events from parallel iterators, we can use map_with or inspect, but emitting from threads requires thread-safe app handle.
    // AppHandle is Clone + Send + Sync? Yes.
    
    let hashed_files_p2: Vec<FileMetadata> = potential_dupes.into_par_iter()
        .map(|mut f| {
            // Emit progress (throttled to avoid IPC flood, e.g. every 10 files or simply always if low count)
            // Ideally we'd optimize this, but for now simple emission:
            let current = processed_count.fetch_add(1, std::sync::atomic::Ordering::Relaxed) + 1;
            if current % 5 == 0 { // Emit every 5 files to reduce overhead
                 let _ = app.emit("scan-progress", ProgressPayload {
                    current,
                    total: total_files,
                    file: f.path.clone(),
                });
            }

            // Check in-memory cache first
            if let Some((size, mod_time, Some(ph), _)) = cached_hashes.get(&f.path) {
                if *size == f.size && *mod_time == f.modified {
                    f.partial_hash = Some(ph.clone());
                    return f;
                }
            }
            // Not in cache, compute it
            f.partial_hash = scanner::get_partial_hash(&f.path);
            f
        })
        .collect();

    // Grouping by (Size, Partial Hash)
    let mut partial_groups: HashMap<(u64, String), Vec<FileMetadata>> = HashMap::new();
    for f in &hashed_files_p2 {
        if let Some(ph) = &f.partial_hash {
            partial_groups.entry((f.size, ph.clone())).or_default().push(f.clone());
        }
    }

    // Pass 3: Full Hash (Parallel)
    let potential_dupes_p3: Vec<FileMetadata> = partial_groups.into_iter()
        .filter(|(_, group)| group.len() > 1)
        .flat_map(|(_, group)| group)
        .collect();

    if potential_dupes_p3.is_empty() { return ScanResult { groups: Vec::new() }; }

    // Reset progress for full hash phase? Or continue? Let's just treat it as a second stage.
    // Ideally we update "total" but for simplicity let's just create a new counter.
    let total_full = potential_dupes_p3.len();
    let processed_count_full = std::sync::atomic::AtomicUsize::new(0);

    let hashed_files_p3: Vec<FileMetadata> = potential_dupes_p3.into_par_iter()
        .map(|mut f| {
             let current = processed_count_full.fetch_add(1, std::sync::atomic::Ordering::Relaxed) + 1;
             if current % 1 == 0 { // Emit every file for full hash as it's slower
                 let _ = app.emit("scan-progress", ProgressPayload {
                    current,
                    total: total_full,
                    file: f.path.clone(),
                });
            }

            // Check in-memory cache first
            if let Some((size, mod_time, _, Some(fh))) = cached_hashes.get(&f.path) {
                if *size == f.size && *mod_time == f.modified {
                    f.full_hash = Some(fh.clone());
                    return f;
                }
            }
            // Not in cache, compute it
            f.full_hash = scanner::get_full_hash(&f.path);
            f
        })
        .collect();

    // Final Grouping by (Size, Full Hash)
    let mut final_groups: HashMap<(u64, String), Vec<FileMetadata>> = HashMap::new();
    let mut updates_to_cache = Vec::new();

    for f in hashed_files_p3 {
        if let Some(fh) = &f.full_hash {
            final_groups.entry((f.size, fh.clone())).or_default().push(f.clone());
            // Collect updates for DB
            updates_to_cache.push((f.path, f.size, f.modified, f.partial_hash, Some(fh.clone())));
        } else if let Some(ph) = &f.partial_hash {
            // Even if full hash was skipped, we might want to cache partial
            updates_to_cache.push((f.path, f.size, f.modified, Some(ph.clone()), None));
        }
    }

    // Batch Update Cache at the very end (Efficient transaction)
    if !updates_to_cache.is_empty() {
        let mut cache_lock = state.cache.lock().unwrap();
        if let Some(cache) = cache_lock.as_mut() {
            let _ = cache.batch_upsert(updates_to_cache);
        }
    }

    ScanResult {
        groups: final_groups.into_values()
            .filter(|group| group.len() > 1)
            .collect()
    }
}

#[derive(Serialize)]
pub struct DriveInfo {
    name: String,
    mount_point: String,
    total_space: u64,
    available_space: u64,
    is_removable: bool,
}

#[derive(Serialize)]
struct DeletionReport {
    success_count: usize,
    fail_count: usize,
}

#[tauri::command]
fn delete_selections(paths: Vec<String>) -> DeletionReport {
    // OPTIMIZATION: Try batch delete first (Atomic OS Operation)
    // This sends all files to trash in one go, which is much faster/cleaner for the OS
    if trash::delete_all(&paths).is_ok() {
         return DeletionReport {
            success_count: paths.len(),
            fail_count: 0,
        };
    }

    // FALLBACK: If batch fails (e.g. one file locked), try to delete individually
    // so we can at least clean up what is possible.
    let mut success_count = 0;
    let mut fail_count = 0;

    for path in paths {
        match trash::delete(&path) {
            Ok(_) => success_count += 1,
            Err(_) => fail_count += 1,
        }
    }

    DeletionReport {
        success_count,
        fail_count,
    }
}

use std::process::Command;

#[tauri::command]
fn get_available_drives_bash() -> Vec<DriveInfo> {
    // macOS 'df -k' output parsing
    let output = Command::new("df")
        .arg("-k")
        .output()
        .expect("failed to execute df");
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut drives = Vec::new();
    
    // Skip header and parse lines
    for line in stdout.lines().skip(1) {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 9 {
            let mount_point = parts[8..].join(" ");
            let total_k = parts[1].parse::<u64>().unwrap_or(0);
            let available_k = parts[3].parse::<u64>().unwrap_or(0);
            
            let mut name = parts[0].to_string();
            // macOS Friendly Name Extraction
            if mount_point.starts_with("/Volumes/") {
                if let Some(vol_name) = mount_point.strip_prefix("/Volumes/") {
                    if !vol_name.is_empty() {
                        name = vol_name.to_string();
                    }
                }
            }
            
            drives.push(DriveInfo {
                name,
                mount_point,
                total_space: total_k * 1024,
                available_space: available_k * 1024,
                is_removable: parts[0].contains("external") || parts[8].starts_with("/Volumes"),
            });
        }
    }
    drives
}

#[tauri::command]
fn get_system_nodes(app: tauri::AppHandle) -> Vec<DriveInfo> {
    use tauri::path::BaseDirectory;
    let mut nodes = Vec::new();
    let disks = Disks::new_with_refreshed_list();

    let targets = vec![
        (BaseDirectory::Desktop, "Desktop"),
        (BaseDirectory::Document, "Documents"),
        (BaseDirectory::Download, "Downloads"),
    ];

    for (dir, label) in targets {
        if let Ok(path) = app.path().resolve("", dir) {
            let path_str = path.to_string_lossy();
            
            // Find the disk that contains this path (longest matching prefix)
            let matching_disk = disks.iter().filter(|d| {
                path_str.starts_with(&*d.mount_point().to_string_lossy())
            }).max_by_key(|d| d.mount_point().to_string_lossy().len());

            nodes.push(DriveInfo {
                name: label.to_string(),
                mount_point: path_str.into_owned(),
                total_space: matching_disk.map(|d| d.total_space()).unwrap_or(0),
                available_space: matching_disk.map(|d| d.available_space()).unwrap_or(0),
                is_removable: false,
            });
        }
    }
    nodes
}

#[tauri::command]
fn get_folder_size(path: String) -> u64 {
    jwalk::WalkDir::new(&path)
        .skip_hidden(false)
        .parallelism(jwalk::Parallelism::RayonNewPool(0))
        .into_iter()
        .filter_map(|e| e.ok())
        .filter_map(|e| e.metadata().ok())
        .filter(|m| m.is_file())
        .map(|m| m.len())
        .sum()
}

#[tauri::command]
fn reveal_in_finder(path: String) {
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("open")
            .arg("-R")
            .arg(path)
            .spawn();
    }
}

#[tauri::command]
fn allow_folder_access(app: tauri::AppHandle, path: String) {
    #[cfg(target_os = "macos")]
    {
        let _ = app.asset_protocol_scope().allow_directory(&path, true);
    }
}

#[tauri::command]
fn reset_cache(state: State<AppState>) -> Result<(), String> {
    let match_res = state.cache.lock().map_err(|_| "Failed to lock cache mutex".to_string())?;
    
    if let Some(cache) = match_res.as_ref() {
        cache.clear_cache().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn get_subdirectories(path: String) -> Vec<DriveInfo> {
    let mut folders = Vec::new();
    // Common system folders to ignore
    let ignored_names = [
        "$RECYCLE.BIN", "System Volume Information", "Recovery", 
        "Config.Msi", "$WinREAgent", ".Trashes", ".fseventsd", 
        ".Spotlight-V100", ".DocumentRevisions-V100", ".TemporaryItems"
    ];

    if let Ok(entries) = std::fs::read_dir(&path) {
        for entry in entries.filter_map(|e| e.ok()) {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_dir() {
                    let path_buf = entry.path();
                    let name = entry.file_name().to_string_lossy().to_string();
                    
                    // Basic hidden filter
                    if name.starts_with('.') { continue; }
                    
                    // Specific system folder filter
                    if ignored_names.iter().any(|&n| name.eq_ignore_ascii_case(n)) { continue; }

                    // Pattern matching for "found.000", "found.001" etc.
                    if name.starts_with("found.") && name[6..].chars().all(char::is_numeric) { continue; }

                    folders.push(DriveInfo {
                        name,
                        mount_point: path_buf.to_string_lossy().to_string(),
                        total_space: 0, // Not applicable for folders
                        available_space: 0,
                        is_removable: false,
                    });
                }
            }
        }
    }
    // Sort alphabetically
    folders.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    folders
}

#[derive(Serialize)]
struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
    size: u64,
    created: u64,
    modified: u64,
}

#[tauri::command]
fn read_directory(path: String) -> Vec<FileEntry> {
    let mut entries_vec = Vec::new();
    // Common system folders to ignore
    let ignored_names = [
        "$RECYCLE.BIN", "System Volume Information", "Recovery", 
        "Config.Msi", "$WinREAgent", ".Trashes", ".fseventsd", 
        ".Spotlight-V100", ".DocumentRevisions-V100", ".TemporaryItems"
    ];

    if let Ok(entries) = std::fs::read_dir(&path) {
        for entry in entries.filter_map(|e| e.ok()) {
            if let Ok(metadata) = entry.metadata() {
                let path_buf = entry.path();
                let name = entry.file_name().to_string_lossy().to_string();
                
                // Basic hidden filter
                if name.starts_with('.') { continue; }
                
                // Specific system folder filter
                if ignored_names.iter().any(|&n| name.eq_ignore_ascii_case(n)) { continue; }
                if name.starts_with("found.") && name[6..].chars().all(char::is_numeric) { continue; }

                let created = metadata.created().ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs())
                    .unwrap_or(0);
                
                let modified = metadata.modified().ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs())
                    .unwrap_or(0);

                entries_vec.push(FileEntry {
                    name,
                    path: path_buf.to_string_lossy().to_string(),
                    is_dir: metadata.is_dir(),
                    size: metadata.len(),
                    created,
                    modified,
                });
            }
        }
    }
    
    // Sort: Directories first, then files. Both alphabetical.
    entries_vec.sort_by(|a, b| {
        if a.is_dir == b.is_dir {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        } else {
            b.is_dir.cmp(&a.is_dir) // true (is_dir) comes before false
        }
    });

    entries_vec
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir().expect("Failed to get app data dir");
            std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data dir");
            let old_db_path = app_data_dir.join("dedupe-pro.db");
            let db_path = app_data_dir.join("dedupe-algo.db");
            
            // Migration: Restore "Muscle Memory" if the old branding DB exists
            if old_db_path.exists() && !db_path.exists() {
                let _ = std::fs::rename(&old_db_path, &db_path);
            }
            
            let cache_manager = CacheManager::new(db_path).expect("Failed to init cache");
            app.manage(AppState {
                cache: Mutex::new(Some(cache_manager)),
            });

            // Pre-authorize standard system nodes in asset protocol scope for "Installer" feel
            for dir in [tauri::path::BaseDirectory::Desktop, tauri::path::BaseDirectory::Document, tauri::path::BaseDirectory::Download] {
                if let Ok(path) = app.path().resolve("", dir) {
                    let _ = app.asset_protocol_scope().allow_directory(&path, true);
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_available_drives_bash, 
            get_system_nodes,
            start_scan, 
            delete_selections,
            reveal_in_finder,
            allow_folder_access,
            get_folder_size,
            reset_cache,
            get_subdirectories,
            read_directory
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
