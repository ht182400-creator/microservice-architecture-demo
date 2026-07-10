// PM2 部署配置 —— 用于「自托管」方式 B
// 用法：
//   npm install -g pm2
//   pm2 start deploy/ecosystem.config.js
//   pm2 save && pm2 startup        # 开机自启（按提示执行生成的命令）
//
// 该配置假定代码已位于 /opt/micro-arch（见 setup-vps.sh）。
// 若部署到其他目录，请同步修改 cwd 与 error_file/out_file 路径。

module.exports = {
  apps: [
    {
      name: 'micro-arch',
      script: 'server.js',
      cwd: '/opt/micro-arch',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '/var/log/micro-arch/err.log',
      out_file: '/var/log/micro-arch/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
