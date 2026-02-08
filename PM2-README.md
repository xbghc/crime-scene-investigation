# Crime Scene Investigation - PM2 服务管理

## 服务信息

- **服务器**: http://localhost:8040
- **客户端**: http://localhost:8030
- **游戏访问**: https://service.xbghc.site:34325

## 快速管理

### 使用管理脚本（推荐）

```bash
./pm2-manage.sh status    # 查看服务状态
./pm2-manage.sh restart   # 重启服务
./pm2-manage.sh logs      # 查看日志
./pm2-manage.sh stop      # 停止服务
./pm2-manage.sh start     # 启动服务
```

### 直接使用PM2命令

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs

# 查看特定服务日志
pm2 logs crime-scene-server
pm2 logs crime-scene-client

# 重启服务
pm2 restart all
pm2 restart crime-scene-server
pm2 restart crime-scene-client

# 停止服务
pm2 stop all

# 启动服务
pm2 start ecosystem.config.js

# 监控面板
pm2 monit
```

## 日志文件位置

- **服务器日志**: `server/logs/server-out.log` 和 `server/logs/server-error.log`
- **客户端日志**: `client/logs/client-out.log` 和 `client/logs/client-error.log`
- **游戏日志**: `server/logs/game-*.log`

## 自动启动

服务已配置为系统启动时自动启动（通过systemd）。

### 管理自动启动

```bash
# 保存当前进程列表（开机自动启动）
pm2 save

# 查看启动脚本
systemctl status pm2-root

# 禁用自动启动
pm2 unstartup systemd

# 重新启用自动启动
pm2 startup systemd
pm2 save
```

## 配置文件

- **PM2配置**: `ecosystem.config.js`
- **Logger配置**: `server/src/utils/logger.ts`

## 监控和维护

### 内存使用

如果服务使用超过500MB内存，PM2会自动重启服务。

### 自动重启

服务崩溃时会自动重启。

### 查看详细信息

```bash
pm2 show crime-scene-server
pm2 show crime-scene-client
```

## 更新配置

修改 `ecosystem.config.js` 后，使用以下命令重新加载：

```bash
./pm2-manage.sh reload
```

## 故障排查

### 服务无法启动

1. 检查日志: `pm2 logs`
2. 检查端口占用: `lsof -ti:8041` 和 `lsof -ti:8030`
3. 重新加载配置: `./pm2-manage.sh reload`

### 清理并重启

```bash
pm2 delete all
pm2 start ecosystem.config.js
pm2 save
```

## 生产环境部署

如需部署到生产环境：

1. 修改 `ecosystem.config.js`，将 `env_production` 中的配置设置好
2. 使用以下命令启动：

```bash
pm2 start ecosystem.config.js --env production
pm2 save
```

## 性能优化

### 集群模式（可选）

如需启用多实例负载均衡，修改 `ecosystem.config.js`:

```javascript
instances: 'max',  // 使用所有CPU核心
exec_mode: 'cluster'
```

### 日志轮转

PM2自动管理日志，但可以配置日志轮转：

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
```
