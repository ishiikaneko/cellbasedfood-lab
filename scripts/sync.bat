@echo off
REM PC ↔ GitHub 双方向同期スクリプト（Windows用）
setlocal enabledelayedexpansion

set REPO_ROOT=%~dp0..
cd /d "%REPO_ROOT%"

set MODE=%1
if "%MODE%"=="" set MODE=sync

if "%MODE%"=="pull" goto :pull
if "%MODE%"=="push" goto :push
if "%MODE%"=="sync" goto :sync

echo 使い方: sync.bat [pull^|push^|sync]
echo   pull  — GitHubから最新記事をPCに取得
echo   push  — PCの変更をGitHubに送信
echo   sync  — pull -^> push の順に実行（デフォルト）
exit /b 1

:pull
echo ⬇️  GitHubから最新記事を取得中...
git fetch origin main
git pull origin main
if %errorlevel%==0 (
  echo ✅ Pull完了
) else (
  echo ❌ Pull失敗 — git認証を確認してください
  exit /b 1
)
goto :eof

:push
echo ⬆️  PCの変更をGitHubに送信中...
git add src\content\blog\ public\images\
git diff --staged --name-only > "%TEMP%\staged.tmp" 2>&1
set /p STAGED=<"%TEMP%\staged.tmp"
if "%STAGED%"=="" (
  echo ℹ️  送信する変更がありません
  goto :eof
)
for /f "tokens=1-4 delims=/ " %%a in ('date /t') do set MYDATE=%%a-%%b-%%c
for /f "tokens=1 delims=:" %%a in ('time /t') do set MYTIME=%%a
git commit -m "sync: PC同期 %MYDATE% %MYTIME%"
git push origin main
if %errorlevel%==0 (
  echo ✅ Push完了 -^> Vercelが自動デプロイします
) else (
  echo ❌ Push失敗 — git認証を確認してください
  exit /b 1
)
goto :eof

:sync
call :pull
echo.
call :push
goto :eof
