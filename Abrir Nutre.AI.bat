@echo off
setlocal
title Nutre.AI
cd /d "%~dp0"

REM ============================================================
REM  Abrir Nutre.AI - sobe o servidor (IA real, via AI_PROVIDER
REM  do .env) e abre o app no navegador padrao.
REM
REM  Modo demo (sem custo de API, respostas simuladas): troque o
REM  bloco "start" abaixo pela linha com ANTHROPIC_MOCK=1.
REM ============================================================

REM ja tem servidor na porta 3000? entao so abre o navegador
powershell -NoProfile -Command "exit (200 -ne $(try{(Invoke-WebRequest -UseBasicParsing http://localhost:3000 -TimeoutSec 2).StatusCode}catch{0}))" >nul 2>&1
if not errorlevel 1 goto abrir

echo Iniciando o servidor do Nutre.AI...
start "Nutre.AI - servidor (feche esta janela para desligar)" /min cmd /k "npx next start -p 3000"
REM modo demo (sem custo de API, respostas simuladas):
REM start "Nutre.AI - servidor (feche esta janela para desligar)" /min cmd /k "set ANTHROPIC_MOCK=1&& npx next start -p 3000"

REM espera ficar pronto (ate ~60s)
for /l %%i in (1,1,60) do (
  powershell -NoProfile -Command "exit (200 -ne $(try{(Invoke-WebRequest -UseBasicParsing http://localhost:3000 -TimeoutSec 1).StatusCode}catch{0}))" >nul 2>&1
  if not errorlevel 1 goto abrir
  ping -n 2 127.0.0.1 >nul
)
echo Servidor nao respondeu em 60s. Veja a janela "Nutre.AI - servidor".
pause
exit /b 1

:abrir
echo Abrindo o Nutre.AI no navegador...
REM Painel do nutricionista (fila tem Ana gestante + Celia idosa pendentes)
start "" "http://localhost:3000/admin"
REM Painel do cliente (dashboard com evolucao)
start "" "http://localhost:3000/paciente/demo-marcos"
REM Chat / conversa (plano liberado)
start "" "http://localhost:3000/c/demo-marcos"
REM Chat da idosa (energia por EER da DRI, dieta em revisao)
start "" "http://localhost:3000/c/demo-celia"
exit /b 0
