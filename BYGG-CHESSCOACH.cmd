@echo off
setlocal EnableExtensions DisableDelayedExpansion
title Bygg Chess Coach
pushd "%~dp0"
if errorlevel 1 goto location_error

echo BYGG CHESS COACH - WINDOWS X64
echo Kor fran den kompletta projektkopian. Internet kravs for beroenden.
echo Stang Chess Coach innan du fortsatter.
echo.
if not exist "package.json" goto missing_project
if not exist "src-tauri\Cargo.toml" goto missing_backend
if not exist "pnpm-lock.yaml" goto missing_lock
if not exist "scripts\copy-stockfish.mjs" goto missing_sidecar

where node >nul 2>&1
if errorlevel 1 goto missing_tools
where pnpm >nul 2>&1
if errorlevel 1 goto missing_tools
where cargo >nul 2>&1
if errorlevel 1 goto missing_tools
where rustc >nul 2>&1
if errorlevel 1 goto missing_tools
call rustc -vV | findstr /C:"host: x86_64-pc-windows-msvc" >nul
if errorlevel 1 goto wrong_arch

if defined STOCKFISH_SRC goto engine_ready
if exist "stockfish.exe" set "STOCKFISH_SRC=%CD%\stockfish.exe"
if defined STOCKFISH_SRC goto engine_ready
if exist "..\stockfish-windows-x86-64-universal\stockfish\stockfish-windows-x86-64-universal.exe" set "STOCKFISH_SRC=%CD%\..\stockfish-windows-x86-64-universal\stockfish\stockfish-windows-x86-64-universal.exe"
if defined STOCKFISH_SRC goto engine_ready
if exist "src-tauri\binaries\stockfish-x86_64-pc-windows-msvc.exe" set "STOCKFISH_SRC=%CD%\src-tauri\binaries\stockfish-x86_64-pc-windows-msvc.exe"
if not defined STOCKFISH_SRC goto missing_engine

:engine_ready
if not exist "%STOCKFISH_SRC%" goto missing_engine
echo [1/4] Installerar projektets lasta beroenden...
call pnpm install --frozen-lockfile
if not "%errorlevel%"=="0" goto build_failed

echo [2/4] Forbereder Stockfish...
call pnpm sidecar
if not "%errorlevel%"=="0" goto build_failed

echo [3/4] Kor frontendtester...
call pnpm test
if not "%errorlevel%"=="0" goto build_failed

echo [4/4] Bygger desktopapp och installationsprogram...
call pnpm tauri build
if not "%errorlevel%"=="0" goto build_failed

echo.
echo BYGGET LYCKADES.
echo Se sokvagen till installationsprogrammet i byggutskriften ovan.
echo Normal mapp: src-tauri\target\release\bundle\nsis\
echo Saknas installationspaket: kontrollera bundle.active och bundle.targets i Tauri.
echo Installera och provkor den NYBYGGDA filen. Ingen installation har startats automatiskt.
echo Ett lyckat bygge ersatter inte provkorning av motor, sparande och traning.
popd
pause
exit /b 0

:missing_project
echo FEL: Kopiera denna fil till mappen med package.json i ditt kompletta projekt.
goto failed
:missing_backend
echo FEL: src-tauri\Cargo.toml saknas. USB-kopian ensam kan inte bygga desktopappen.
echo Kopiera byggfilen och koduppdateringen till din KOMPLETTA originalkopia.
goto failed
:missing_lock
echo FEL: pnpm-lock.yaml saknas. Aterstall projektets matchande lasfil.
goto failed
:missing_sidecar
echo FEL: scripts\copy-stockfish.mjs saknas. Kontrollera projektkopian.
goto failed
:missing_tools
echo FEL: Node.js, pnpm, Rust eller Cargo saknas i PATH.
echo Installera aven Microsoft C++ Build Tools med Desktop development with C++
echo och Windows SDK samt WebView2. Oppna byggfilen igen efter installationen.
echo Hjalp: https://v2.tauri.app/start/prerequisites/
goto failed
:wrong_arch
echo FEL: Denna byggfil kraver Rust-varden x86_64-pc-windows-msvc.
echo ARM64 eller andra mal behover en anpassad motor och byggkonfiguration.
goto failed
:missing_engine
echo FEL: Stockfish hittades inte.
echo Kopiera x64-motorn fran USB-minnet till samma mapp som denna byggfil
echo och ge kopian namnet stockfish.exe. Alternativt ange STOCKFISH_SRC.
echo Om STOCKFISH_SRC redan ar satt maste den peka pa en befintlig exe-fil.
goto failed
:build_failed
echo.
echo BYGGET AVBROTS. Las felet ovan. Inga senare byggsteg har korts.
echo Anvand inte en gammal installationsfil som om den kom fran detta forsok.
:failed
popd
pause
exit /b 1
:location_error
echo FEL: Kunde inte oppna mappen dar byggfilen ligger.
pause
exit /b 1
