@echo off
setlocal
cd /d "%~dp0"
if not exist "Sukoaa Browser.exe" (
  echo Extract the entire Sukoaa Browser ZIP before running this script.
  pause
  exit /b 1
)
set "AEGIS_LOG_DIR=%LOCALAPPDATA%\AegisBrowser-Diagnostics"
if not defined LOCALAPPDATA set "AEGIS_LOG_DIR=%TEMP%\AegisBrowser-Diagnostics"
if not exist "%AEGIS_LOG_DIR%" mkdir "%AEGIS_LOG_DIR%"
set "ELECTRON_ENABLE_LOGGING=1"
echo Starting Sukoaa Browser 0.7 beta with local diagnostic logging...
"Sukoaa Browser.exe" --enable-logging --log-file="%AEGIS_LOG_DIR%\startup.log" > "%AEGIS_LOG_DIR%\console.log" 2>&1
set "AEGIS_EXIT_CODE=%ERRORLEVEL%"
echo Browser exited with code %AEGIS_EXIT_CODE%.
echo Logs: %AEGIS_LOG_DIR%
echo Review logs before sharing; they may contain website addresses.
pause
exit /b %AEGIS_EXIT_CODE%
