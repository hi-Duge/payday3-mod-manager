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
if not exist "node_modules\electron" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)
echo Building Windows installer and portable artifacts...
call npm run dist
if errorlevel 1 (
  echo Build failed.
  pause
  exit /b 1
)
echo Build complete. Check the dist folder.
pause
