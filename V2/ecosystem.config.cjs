module.exports = {
  apps: [
    {
      name: "Bifrost-API",
      cwd: "./Bifrost-API",
      script: "dist/server.js",
      node_args: "--env-file-if-exists=.env",
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
