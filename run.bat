@echo off
chcp 65001 > nul
rem ============================================================
rem  Roc Waves - Arranque direto: abre o player no navegador.
rem  Sem menus, sem consolas. Para DSP total usar proxy.bat.
rem ============================================================
start "" "%~dp0index.html"
exit /b
