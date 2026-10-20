@echo off
chcp 65001 >nul
echo ===== 公众号增长操作系统 · 初始化 =====
echo [1/4] 检查 Python 版本...
python --version

echo [2/4] 安装依赖...
pip install -r scripts/requirements.txt || echo "依赖安装跳过（可手动 pip install）"

echo [3/4] 初始化数据表...
python scripts/daily_collect.py --init

echo [4/4] 运行端到端测试...
python scripts/test_all.py

echo.
echo ✅ 初始化完成！
echo --------------------------------------------------
echo 下一步：
echo   1. copy config.example.yaml config.yaml   # 填你的配置
echo   2. copy .env.example .env                 # 填密钥
echo   3. 按 workflows/daily-flow.md 开始日常
echo   4. python scripts/daily_collect.py        # 每日采集
echo   5. python scripts/weekly_review.py        # 每周复盘
echo   6. python scripts/monthly_calibrate.py    # 每月校准
echo --------------------------------------------------
pause
