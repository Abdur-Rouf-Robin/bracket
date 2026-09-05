module.exports = {
  apps: [
    {
      name: "bracket-api",
      cwd: "/var/www/bracket/apps/api",
      script: "dist/main.js",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 15,
      min_uptime: "10s",
      env: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        API_PORT: "4200",
      },
    },
    {
      name: "bracket-web",
      cwd: "/var/www/bracket/apps/web",
      script: "/var/www/bracket/node_modules/next/dist/bin/next",
      args: "start --port 3200 --hostname 127.0.0.1",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 15,
      min_uptime: "10s",
      env: {
        NODE_ENV: "production",
        PORT: "3200",
      },
    },
  ],
};
