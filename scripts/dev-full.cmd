@echo off
setlocal

set "ROOT=%~dp0.."

echo Starting Matchday Ledger local blockchain...
start "Matchday Ledger - Chain" cmd /k "cd /d ""%ROOT%"" && npm.cmd run chain"

timeout /t 6 /nobreak >nul

echo Starting Matchday Ledger API...
start "Matchday Ledger - Server" cmd /k "cd /d ""%ROOT%"" && npm.cmd run server:local"

timeout /t 6 /nobreak >nul

echo Starting Matchday Ledger web app...
start "Matchday Ledger - Client" cmd /k "cd /d ""%ROOT%"" && npm.cmd run client"

echo.
echo Local stack is starting.
echo Open http://localhost:3000 after the client terminal says ready.
