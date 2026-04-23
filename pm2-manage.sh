#!/bin/bash

# Crime Scene Investigation - PM2 服务管理脚本

case "$1" in
  start)
    echo "启动服务..."
    pm2 start ecosystem.config.js
    ;;
  stop)
    echo "停止服务..."
    pm2 stop all
    ;;
  restart)
    echo "重启服务..."
    pm2 restart all
    ;;
  status)
    echo "服务状态："
    pm2 status
    ;;
  logs)
    echo "查看日志（Ctrl+C退出）："
    pm2 logs
    ;;
  server-logs)
    echo "查看服务器日志（Ctrl+C退出）："
    pm2 logs crime-scene-server
    ;;
  client-logs)
    echo "查看客户端日志（Ctrl+C退出）："
    pm2 logs crime-scene-client
    ;;
  monit)
    echo "监控面板："
    pm2 monit
    ;;
  reload)
    echo "重新加载配置..."
    pm2 delete all
    pm2 start ecosystem.config.js
    pm2 save
    ;;
  save)
    echo "保存当前进程列表..."
    pm2 save
    ;;
  *)
    echo "Crime Scene Investigation - PM2 服务管理"
    echo ""
    echo "用法: $0 {start|stop|restart|status|logs|server-logs|client-logs|monit|reload|save}"
    echo ""
    echo "命令说明："
    echo "  start        - 启动所有服务"
    echo "  stop         - 停止所有服务"
    echo "  restart      - 重启所有服务"
    echo "  status       - 查看服务状态"
    echo "  logs         - 查看所有服务日志"
    echo "  server-logs  - 只查看服务器日志"
    echo "  client-logs  - 只查看客户端日志"
    echo "  monit        - 打开监控面板"
    echo "  reload       - 重新加载配置文件"
    echo "  save         - 保存当前进程列表"
    exit 1
    ;;
esac
