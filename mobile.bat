@echo off
chcp 65001 > nul
title Roc Waves - Teste no Telemovel (servidor Wi-Fi)
rem ============================================================
rem  Serve a app para testar no TELEMOVEL:
rem  1. Telemovel na MESMA rede Wi-Fi que este PC
rem  2. Abre no telemovel o endereco mostrado na janela
rem  3. Windows pode pedir para permitir o Node na firewall:
rem     clica "Permitir acesso"
rem  Para DSP total no telemovel: corre tambem proxy.bat
rem ============================================================
where node > nul 2>&1
if errorlevel 1 (
  echo Node.js nao encontrado. Instala em https://nodejs.org
  pause
  exit /b 1
)
node "%~dp0tools\serve.cjs"
pause
