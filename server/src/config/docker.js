import Docker from "dockerode";
import os from "os";

const isWindows = os.platform() === "win32";

const socketPath = isWindows
  ? "//./pipe/docker_engine"
  : "/var/run/docker.sock";

const docker = new Docker({ socketPath: socketPath });

console.log(`Connecting to Docker via: ${socketPath}`);

export default docker;
