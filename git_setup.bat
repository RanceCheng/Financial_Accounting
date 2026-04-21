@echo off
cd /d D:\WorkspaceCopilot\Financial_Accounting
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/RanceCheng/Financial_Accounting.git
git branch -M main
echo.
echo === Done ===
echo Now run: git push -u origin main
