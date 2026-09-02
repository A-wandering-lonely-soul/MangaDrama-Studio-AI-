#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[tauri::command]
fn open_in_file_manager(path: String) -> Result<(), String> {
    std::process::Command::new("explorer")
        .arg(path)
        .spawn()
        .map(|_| ())
        .map_err(|error| error.to_string())
}

fn main() {
    tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![open_in_file_manager])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
