import docker from "../config/docker.js";

const activeLogStreams = new Map();
const activeExecStreams = new Map();
let statsInterval = null;
let connectedClients = 0;

const calculateCpuPercent = (stats) => {
  const cpuDelta =
    stats.cpu_stats.cpu_usage.total_usage -
    stats.precpu_stats.cpu_usage.total_usage;
  const systemDelta =
    stats.cpu_stats.system_cpu_usage -
    stats.precpu_stats.system_cpu_usage;
  const numCpus = stats.cpu_stats.online_cpus || 1;
  if (systemDelta > 0 && cpuDelta >= 0) {
    return ((cpuDelta / systemDelta) * numCpus * 100).toFixed(2);
  }
  return "0.00";
};

const calculateMemPercent = (stats) => {
  const usage = stats.memory_stats.usage || 0;
  const limit = stats.memory_stats.limit || 1;
  return ((usage / limit) * 100).toFixed(2);
};

const startStatsCollection = (io) => {
  if (statsInterval) return;
  statsInterval = setInterval(async () => {
    try {
      const containers = await docker.listContainers();
      const statsPromises = containers.map(async (c) => {
        try {
          const container = docker.getContainer(c.Id);
          const stats = await container.stats({ stream: false });
          return {
            id: c.Id,
            cpu: parseFloat(calculateCpuPercent(stats)),
            memory: parseFloat(calculateMemPercent(stats)),
            memoryUsage: stats.memory_stats.usage || 0,
            memoryLimit: stats.memory_stats.limit || 0,
          };
        } catch {
          return null;
        }
      });
      const results = (await Promise.all(statsPromises)).filter(Boolean);
      if (results.length > 0) {
        io.emit("container-stats", results);
      }
    } catch (error) {
      console.error("[Stats Error]:", error.message);
    }
  }, 2000);
};

const stopStatsCollection = () => {
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
};

const socketServices = (io) => {
  io.on("connection", (socket) => {
    console.log(`[Socket.IO]: User Connected: ${socket.id}`);
    connectedClients++;
    startStatsCollection(io);

    // ── Image Pull with progress streaming ────────────────────────────────
    socket.on("image-pull", async ({ imageName }) => {
      if (!imageName) {
        socket.emit("image-pull-error", { imageName, error: "Image name is required" });
        return;
      }

      try {
        const stream = await docker.pull(imageName);

        docker.modem.followProgress(
          stream,
          // onFinished
          (err, output) => {
            if (err) {
              socket.emit("image-pull-error", {
                imageName,
                error: err.message || "Pull failed",
              });
            } else {
              socket.emit("image-pull-complete", { imageName });
            }
          },
          // onProgress
          (event) => {
            socket.emit("image-pull-progress", {
              imageName,
              id: event.id || null,
              status: event.status || "",
              progress: event.progress || "",
              progressDetail: event.progressDetail || {},
            });
          },
        );
      } catch (error) {
        socket.emit("image-pull-error", {
          imageName,
          error: error.message || "Failed to pull image",
        });
      }
    });

    // Log streaming
    socket.on("join-logs", async (containerId) => {
      const streamKey = `${socket.id}-${containerId}`;

      // Clean up existing stream if any
      if (activeLogStreams.has(streamKey)) {
        const existing = activeLogStreams.get(streamKey);
        existing.destroy();
        activeLogStreams.delete(streamKey);
      }

      try {
        const container = docker.getContainer(containerId);
        const stream = await container.logs({
          follow: true,
          stdout: true,
          stderr: true,
          tail: 100,
          timestamps: true,
        });

        activeLogStreams.set(streamKey, stream);

        stream.on("data", (chunk) => {
          // Docker multiplexed stream: first 8 bytes are header
          const raw = chunk.toString("utf8");
          // Strip docker stream headers (non-printable chars in first 8 bytes)
          const content = raw.replace(/[\x00-\x08]/g, "").trim();
          if (content) {
            socket.emit("container-logs", { id: containerId, log: content });
          }
        });

        stream.on("end", () => {
          activeLogStreams.delete(streamKey);
        });

        stream.on("error", (err) => {
          console.error(`[Log Stream Error]: ${err.message}`);
          activeLogStreams.delete(streamKey);
        });
      } catch (error) {
        console.error(`[Log Join Error]: ${error.message}`);
        socket.emit("container-logs-error", {
          id: containerId,
          error: error.message,
        });
      }
    });

    socket.on("leave-logs", (containerId) => {
      const streamKey = `${socket.id}-${containerId}`;
      if (activeLogStreams.has(streamKey)) {
        const stream = activeLogStreams.get(streamKey);
        stream.destroy();
        activeLogStreams.delete(streamKey);
      }
    });

    // ── Interactive Exec / Shell ──────────────────────────────────────────
    socket.on("exec-start", async ({ containerId, command }) => {
      const execKey = `${socket.id}-exec-${containerId}`;

      // Clean up existing exec session
      if (activeExecStreams.has(execKey)) {
        const existing = activeExecStreams.get(execKey);
        existing.destroy();
        activeExecStreams.delete(execKey);
      }

      try {
        const container = docker.getContainer(containerId);

        // Try bash first (has tab-completion / readline), fall back to sh
        const shells = command ? [command] : [["/bin/bash"], ["/bin/sh"]];
        let lastError = null;

        for (const cmd of shells) {
          try {
            const exec = await container.exec({
              AttachStdin: true,
              AttachStdout: true,
              AttachStderr: true,
              Tty: true,
              Cmd: cmd,
            });

            const stream = await exec.start({
              hijack: true,
              stdin: true,
              Tty: true,
            });

            activeExecStreams.set(execKey, stream);

            stream.on("data", (chunk) => {
              socket.emit("exec-output", {
                id: containerId,
                data: chunk.toString("utf8"),
              });
            });

            stream.on("end", () => {
              activeExecStreams.delete(execKey);
              socket.emit("exec-exit", { id: containerId });
            });

            stream.on("error", (err) => {
              console.error(`[Exec Stream Error]: ${err.message}`);
              activeExecStreams.delete(execKey);
              socket.emit("exec-exit", { id: containerId });
            });

            socket.emit("exec-ready", { id: containerId });
            return; // Success — stop trying shells
          } catch (err) {
            lastError = err;
            // This shell doesn't exist in the container, try next
          }
        }

        // All shells failed
        throw lastError || new Error("No shell available in container");
      } catch (error) {
        console.error(`[Exec Start Error]: ${error.message}`);
        socket.emit("exec-error", {
          id: containerId,
          error: error.message,
        });
      }
    });

    // Receive terminal input from client
    socket.on("exec-input", ({ containerId, data }) => {
      const execKey = `${socket.id}-exec-${containerId}`;
      const stream = activeExecStreams.get(execKey);
      if (stream) {
        stream.write(data);
      }
    });

    // Resize the TTY
    socket.on("exec-resize", async ({ containerId, cols, rows }) => {
      const execKey = `${socket.id}-exec-${containerId}`;
      if (!activeExecStreams.has(execKey)) return;
      try {
        const container = docker.getContainer(containerId);
        // Dockerode resize on exec instance — use the container resize as fallback
        await container.resize({ h: rows, w: cols });
      } catch {
        // Resize may not be supported on all setups, ignore
      }
    });

    // Stop exec session
    socket.on("exec-stop", (containerId) => {
      const execKey = `${socket.id}-exec-${containerId}`;
      if (activeExecStreams.has(execKey)) {
        const stream = activeExecStreams.get(execKey);
        stream.write("exit\n");
        setTimeout(() => {
          stream.destroy();
          activeExecStreams.delete(execKey);
        }, 200);
      }
    });

    // Quick command: exec a one-shot command and return output
    socket.on("exec-command", async ({ containerId, command }) => {
      try {
        const container = docker.getContainer(containerId);
        const exec = await container.exec({
          AttachStdout: true,
          AttachStderr: true,
          Tty: false,
          Cmd: ["sh", "-c", command],
        });

        const stream = await exec.start({ hijack: true, stdin: false });
        let output = "";

        stream.on("data", (chunk) => {
          // Strip Docker multiplexed stream headers
          output += chunk.toString("utf8").replace(/[\x00-\x08]/g, "");
        });

        stream.on("end", () => {
          socket.emit("exec-command-result", {
            id: containerId,
            command,
            output: output.trim(),
          });
        });

        stream.on("error", (err) => {
          socket.emit("exec-command-result", {
            id: containerId,
            command,
            output: `Error: ${err.message}`,
          });
        });
      } catch (error) {
        socket.emit("exec-command-result", {
          id: containerId,
          command,
          output: `Error: ${error.message}`,
        });
      }
    });

    socket.on("disconnect", () => {
      console.log(`[Socket.IO]: User Disconnected: ${socket.id}`);
      connectedClients--;

      // Clean up all log streams for this socket
      for (const [key, stream] of activeLogStreams.entries()) {
        if (key.startsWith(socket.id)) {
          stream.destroy();
          activeLogStreams.delete(key);
        }
      }

      // Clean up all exec streams for this socket
      for (const [key, stream] of activeExecStreams.entries()) {
        if (key.startsWith(socket.id)) {
          stream.destroy();
          activeExecStreams.delete(key);
        }
      }

      if (connectedClients <= 0) {
        connectedClients = 0;
        stopStatsCollection();
      }
    });
  });
};

export default socketServices;
