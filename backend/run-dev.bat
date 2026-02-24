@echo off
REM Quick run script for backend on Node v25
REM Compiles TypeScript with SWC and runs with Node

echo 🔨 Compiling TypeScript with SWC...
call npx swc src -d dist --strip-leading-paths --quiet

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Compilation failed!
    exit /b 1
)

echo ✅ Compilation successful!
echo 🚀 Starting backend...
echo.

REM Run with Node, setting NODE_PATH to help with module resolution
SET NODE_OPTIONS=--experimental-network-imports
node dist/index.js

exit /b %ERRORLEVEL%
