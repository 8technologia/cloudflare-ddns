module.exports = {
  apps: [{
    name: 'cloudflare-ddns',
    script: './cloudflare-ddns.js',
    restart_delay: 30000,
    max_memory_restart: '500M',
    log_file: './logs/combined.log',
    out_file: './logs/out.log', 
    error_file: './logs/error.log',
    time: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '30s',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
