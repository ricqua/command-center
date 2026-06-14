@echo off
title Nightfall Email Backend
echo.
echo  Starting Nightfall Email Backend...
echo.

cd /d "%~dp0"

pip install -r requirements.txt -q

python server.py

pause
