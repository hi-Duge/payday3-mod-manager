@echo off
setlocal
set "NODE="
if defined NVM_HOME (
  if exist "%NVM_HOME%\node.exe" set "NODE=%NVM_HOME%"
)
if not defined NODE if defined ProgramFiles (
  if exist "%ProgramFiles%\nodejs\node.exe" set "NODE=%ProgramFiles%\nodejs"
)
if not defined NODE if defined ProgramFiles(x86) (
  if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "NODE=%ProgramFiles(x86)%\nodejs"
)
if not defined NODE (
  for /f "tokens=*" %%i in ('where node 2^>nul') do set "NODE=%%~dpi" & goto :found
  echo Node.js not found. Install from https://nodejs.org/ and add it to PATH.
  pause
  exit /b 1
)
:found
if defined NODE if "%NODE:~-1%"=="\" set "NODE=%NODE:~0,-1%"
set "PATH=%NODE%;%PATH%"
cd /d "%~dp0"
if not defined GH_TOKEN if not defined GITHUB_TOKEN (
  echo Note: For private-repo auto-updates, set User env GH_TOKEN or GITHUB_TOKEN before building ^(embedded in the exe; not typed in-app^).
  echo.
)
if not exist "node_modules\electron" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

rem Build in LocalAppData first (avoids 7-Zip "file in use" on D:\ from Defender/Explorer).
rem Then copy to D:\dist.
set "STAGE=%LOCALAPPDATA%\Temp\payday3-electron-dist"
set "STAGE_FWD=%STAGE:\=/%"
set "OUT_FINAL=D:\dist"

echo.
echo Staging build in: %STAGE%
echo Final output:     %OUT_FINAL%
echo.

if exist "%STAGE%" (
  attrib -r "%STAGE%\*.*" /s /d >nul 2>&1
  rmdir /s /q "%STAGE%"
)
mkdir "%STAGE%" 2>nul

echo Running electron-builder...
call npm run dist -- --config.directories.output="%STAGE_FWD%"
if errorlevel 1 (
  echo.
  echo Build failed. Tips: close Explorer windows on D:\dist, pause antivirus for this folder, retry.
  pause
  exit /b 1
)

if not exist "%OUT_FINAL%" mkdir "%OUT_FINAL%"
echo.
echo Copying to %OUT_FINAL% ...
robocopy "%STAGE%" "%OUT_FINAL%" /E /COPY:DAT /R:3 /W:3 /IS /IT /NFL /NDL /NJH /NJS
if errorlevel 8 (
  echo robocopy failed ^(code 8+^).
  pause
  exit /b 1
)

attrib -r "%STAGE%\*.*" /s /d >nul 2>&1
rmdir /s /q "%STAGE%" 2>nul

echo.
echo Build complete. Artifacts are in %OUT_FINAL%
pause
exit /b 0
