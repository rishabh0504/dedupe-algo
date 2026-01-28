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

#[tauri::command]
fn start_scan(
    paths: Vec<String>, 
    scan_hidden: bool, 
    scan_images: bool,
    scan_videos: bool,
    scan_zips: bool,
    state: State<AppState>
) -> ScanResult {
    // Phase 1: Traversal
    println!("Starting scan for paths: {:?}", paths);
    let mut all_files = Vec::new();
    for path in &paths {
        let found = scan_directory(path, scan_hidden, scan_images, scan_videos, scan_zips);
        println!("Scanned path: {}. Found {} files.", path, found.len());
        all_files.extend(found);
    }
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

    // Pass 2: Partial Hash (Parallel)
    let hashed_files: Vec<FileMetadata> = potential_dupes.into_par_iter()
        .map(|mut f| {
            let cache_lock = state.cache.lock().unwrap();
            if let Some(cache) = cache_lock.as_ref() {
                if let Ok(Some((Some(ph), _))) = cache.get_hashes(&f.path, f.size, f.modified) {
                    f.partial_hash = Some(ph);
                    return f;
                }
            }
            drop(cache_lock);

            f.partial_hash = scanner::get_partial_hash(&f.path);
            
            if let Some(ph) = &f.partial_hash {
                let cache_lock = state.cache.lock().unwrap();
                if let Some(cache) = cache_lock.as_ref() {
                    let _ = cache.upsert_partial(&f.path, f.size, f.modified, ph);
                }
            }
            f
        })
        .collect();

    // Group by (Size, Partial Hash)
    let mut partial_groups: HashMap<(u64, String), Vec<FileMetadata>> = HashMap::new();
    for f in hashed_files {
        if let Some(ph) = &f.partial_hash {
            partial_groups.entry((f.size, ph.clone())).or_default().push(f);
        }
    }

    // Discard unique partial hashes
    let potential_dupes_p2: Vec<FileMetadata> = partial_groups.into_iter()
        .filter(|(_, group)| group.len() > 1)
        .flat_map(|(_, group)| group)
        .collect();

    if potential_dupes_p2.is_empty() { return ScanResult { groups: Vec::new() }; }

    // Pass 3: Full Hash (Parallel)
    let full_hashed_files: Vec<FileMetadata> = potential_dupes_p2.into_par_iter()
        .map(|mut f| {
            let cache_lock = state.cache.lock().unwrap();
            if let Some(cache) = cache_lock.as_ref() {
                if let Ok(Some((_, Some(fh)))) = cache.get_hashes(&f.path, f.size, f.modified) {
                    f.full_hash = Some(fh);
                    return f;
                }
            }
            drop(cache_lock);

            f.full_hash = scanner::get_full_hash(&f.path);
            
            if let Some(fh) = &f.full_hash {
                let cache_lock = state.cache.lock().unwrap();
                if let Some(cache) = cache_lock.as_ref() {
                    let _ = cache.upsert_full(&f.path, f.size, f.modified, fh);
                }
            }
            f
        })
        .collect();

    // Final Grouping by (Size, Full Hash)
    let mut final_groups: HashMap<(u64, String), Vec<FileMetadata>> = HashMap::new();
    for f in full_hashed_files {
        if let Some(fh) = &f.full_hash {
            final_groups.entry((f.size, fh.clone())).or_default().push(f);
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
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_available_drives_bash, 
            get_system_nodes,
            start_scan, 
            delete_selections,
            reveal_in_finder,
            allow_folder_access,
            get_folder_size
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
