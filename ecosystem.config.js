module.exports = {
  apps: [
    {
      name: 'crime-scene-server',
      cwd: '/root/apps/crime-scene-investigation/server',
      script: '/root/.nvm/versions/node/v24.12.0/bin/pnpm',
      args: 'dev',
      env: {
        NODE_ENV: 'development',
        PORT: 8040,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 8040,
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: '/root/apps/crime-scene-investigation/server/logs/server-error.log',
      out_file: '/root/apps/crime-scene-investigation/server/logs/server-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
    {
      name: 'crime-scene-client',
      cwd: '/root/apps/crime-scene-investigation/client',
      script: '/root/.nvm/versions/node/v24.12.0/bin/pnpm',
      args: 'dev',
      env: {
        NODE_ENV: 'development',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: '/root/apps/crime-scene-investigation/client/logs/client-error.log',
      out_file: '/root/apps/crime-scene-investigation/client/logs/client-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
  ],
};
