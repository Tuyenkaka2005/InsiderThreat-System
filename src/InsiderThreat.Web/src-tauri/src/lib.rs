#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_autostart::init(
      tauri_plugin_autostart::MacosLauncher::LaunchAgent,
      Some(vec!["--minimized"]),
    ))
    .plugin(tauri_plugin_shell::init())
    .setup(|app| {
      use tauri_plugin_shell::ShellExt;
      use tauri_plugin_autostart::ManagerExt;

      // Enable autostart automatically
      let _ = app.autolaunch().enable();

      // Kích hoạt Backend .NET ngầm
      if let Ok(sidecar) = app.shell().sidecar("InsiderThreat.Server") {
          let _ = sidecar.spawn();
      }

      // Kích hoạt USB Blocker ngầm
      if let Ok(sidecar) = app.shell().sidecar("InsiderThreat.ClientAgent") {
          let _ = sidecar.spawn();
      }

      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
