module.exports = {
  apps: [
    {
      name: 'ollama-server',
      script: 'dist/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'cloudflare-tunnel',
      script: 'cloudflared',
      args: 'tunnel run <ollama-api>',
      autorestart: true,
      watch: false
    }
  ]
};
