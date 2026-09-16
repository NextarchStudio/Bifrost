module.exports = {
  apps: [
    {
      name: "bifrost-api",
      cwd: "./Bifrost-API",
      script: "dist/server.js",
      node_args: "--env-file-if-exists=.env",
      instances: 1,
      exec_mode: "fork",
      autorestart: true
    },
    {
      name: "bifrost-web",
      cwd: "./Bifrost-Web",
      script: "server.mjs",
      instances: 1,
      exec_mode: "fork",
      autorestart: true
    },
    {
      name: "bifrost-worker",
      cwd: "./Bifrost-Worker",
      script: "dist/worker.js",
      node_args: "--env-file-if-exists=.env",
      instances: 1,
      exec_mode: "fork",
      autorestart: true
    }
  ]
};
