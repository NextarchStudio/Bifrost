module.exports = {
  apps: [
    {
      name: "Bifrost-API",
      cwd: "./Bifrost-API",
      script: "dist/server.js",
      node_args: "--env-file-if-exists=.env",
      env: {
        BIFROST_API_HOST: "127.0.0.1",
        BIFROST_API_PORT: "3001"
      },
      env_production: {
        BIFROST_API_HOST: "127.0.0.1",
        BIFROST_API_PORT: "3103"
      },
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      restart_delay: 2_000,
      max_restarts: 10,
      min_uptime: "10s",
      kill_timeout: 10_000,
      time: true
    },
    {
      name: "Bifrost-Web",
      cwd: "./Bifrost-Web",
      script: "server.mjs",
      env: {
        BIFROST_WEB_HOST: "127.0.0.1",
        BIFROST_WEB_PORT: "3000"
      },
      env_production: {
        BIFROST_WEB_HOST: "127.0.0.1",
        BIFROST_WEB_PORT: "3102"
      },
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      restart_delay: 2_000,
      max_restarts: 10,
      min_uptime: "10s",
      kill_timeout: 10_000,
      time: true
    },
    {
      name: "Bifrost-Worker",
      cwd: "./Bifrost-Worker",
      script: "dist/worker.js",
      node_args: "--env-file-if-exists=.env",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      restart_delay: 2_000,
      max_restarts: 10,
      min_uptime: "10s",
      kill_timeout: 10_000,
      time: true
    }
  ]
};
