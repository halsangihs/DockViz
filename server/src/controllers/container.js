import docker from "../config/docker.js";

const formatNetworks = (networks) => {
  const formattedNetworks = networks.map(([name, details]) => name);
  return formattedNetworks;
};

const formatVolumes = (volumes) => {
  const formattedVolumes = (volumes || []).map((mount) => ({
    type: mount.Type,
    source: mount.Source,
    destination: mount.Destination,
  }));
  return formattedVolumes;
};

const formatPorts = (ports) => {
  const formattedPorts = (ports || []).map((p) => ({
    private: p.PrivatePort,
    public: p.PublicPort,
    type: p.Type,
  }));
  return formattedPorts;
};

const formatImageName = (container, inspectInfo) => {
  const configuredImage = inspectInfo?.Config?.Image;
  const listedImage = container.Image;
  const fullImageId = container.ImageID;

  const humanReadable = [configuredImage, listedImage].find(
    (value) => value && !value.startsWith("sha256:"),
  );

  if (humanReadable) return humanReadable;

  if (fullImageId?.startsWith("sha256:")) {
    return `<deleted-image:${fullImageId.substring(7, 19)}>`;
  }

  return listedImage || "<deleted-image>";
};

const formatContainers = async (containers) => {
  const formattedContainers = await Promise.all(containers.map(async (container) => {
    let inspectInfo = null;

    try {
      inspectInfo = await docker.getContainer(container.Id).inspect();
    } catch (error) {
      console.warn(
        `[Container Inspect Warning]: Failed to inspect ${container.Id.substring(0, 12)} - ${error.message}`,
      );
    }

    return {
      id: container.Id.substring(0, 12),
      fullId: container.Id,
      name: container.Names[0].replace(/^\//, ""),

      imageName: formatImageName(container, inspectInfo),
      imageId: container.ImageID.split(":")[1]?.substring(0, 12),
      fullImageId: container.ImageID,

      state: container.State,
      status: container.Status,
      created: new Date(container.Created * 1000).toISOString(),

      ports: formatPorts(container.Ports),

      networks: formatNetworks(
        Object.entries(container.NetworkSettings?.Networks || []),
      ),

      volumes: formatVolumes(container.Mounts),

      command: container.Command,
    };
  }));
  return formattedContainers;
};

export const getContainers = async (req, res) => {
  try {
    const containers = await docker.listContainers({ all: true });
    const formattedContainers = await formatContainers(containers);

    return res.status(200).json(formattedContainers);
  } catch (error) {
    console.error(`[Container Error]: ${error}`);
    return res
      .status(500)
      .json("Failed to fetch containers from Docker daemon");
  }
};

export const stopContainer = async (req, res) => {
  try {
    const { id } = req.params;
    const container = docker.getContainer(id);
    await container.kill();
    return res.status(200).json("Container Stopped Successfully");
  } catch (error) {
    console.error(`[Container Error]: ${error}`);
    return res.status(500).json("Error Stopping Container");
  }
};

export const startContainer = async (req, res) => {
  try {
    const { id } = req.params;
    const container = docker.getContainer(id);
    await container.start();
    return res.status(200).json("Container Started Successfully");
  } catch (error) {
    console.error(`[Container Error]: ${error}`);
    return res.status(500).json("Error Starting Container");
  }
};

export const renameContainer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Container name is required" });
    }

    const container = docker.getContainer(id);
    await container.rename({ name: name.trim() });

    return res.status(200).json({
      message: `Container renamed to ${name.trim()}`,
    });
  } catch (error) {
    console.error(`[Container Rename Error]: ${error}`);
    return res.status(500).json({
      error: error?.reason || error?.json?.message || error.message || "Error renaming container",
    });
  }
};

// Generic action handler for start/stop/kill/restart/remove
export const containerAction = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body;
    const container = docker.getContainer(id);

    switch (action) {
      case "start":
        await container.start();
        return res.status(200).json("Container started successfully");
      case "stop":
        await container.stop();
        return res.status(200).json("Container stopped successfully");
      case "kill":
        await container.kill();
        return res.status(200).json("Container killed successfully");
      case "restart":
        await container.restart();
        return res.status(200).json("Container restarted successfully");
      case "remove":
        await container.remove({ force: true });
        return res.status(200).json("Container removed successfully");
      default:
        return res.status(400).json(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error(`[Container Action Error]: ${error}`);
    return res.status(500).json("Error performing action on container");
  }
};

// Create container from image
export const createContainer = async (req, res) => {
  try {
    const {
      Image, name, ExposedPorts, HostConfig, Env,
      Cmd, Tty, OpenStdin, AttachStdout, AttachStderr,
      WorkingDir, User, autoStart,
    } = req.body;

    const containerConfig = { Image };
    if (name) containerConfig.name = name;
    if (ExposedPorts) containerConfig.ExposedPorts = ExposedPorts;
    if (Env) containerConfig.Env = Env;
    if (Cmd) containerConfig.Cmd = Cmd;
    if (WorkingDir) containerConfig.WorkingDir = WorkingDir;
    if (User) containerConfig.User = User;

    // TTY / Interactive
    containerConfig.Tty = Tty ?? false;
    containerConfig.OpenStdin = OpenStdin ?? false;
    if (OpenStdin) containerConfig.StdinOnce = false;

    // Attach mode
    containerConfig.AttachStdout = AttachStdout ?? false;
    containerConfig.AttachStderr = AttachStderr ?? false;

    // HostConfig: port bindings + restart policy + resource limits
    const hostConfig = HostConfig ? { ...HostConfig } : {};

    if (req.body.RestartPolicy) {
      hostConfig.RestartPolicy = { Name: req.body.RestartPolicy, MaximumRetryCount: 0 };
      if (req.body.RestartPolicy === "on-failure") {
        hostConfig.RestartPolicy.MaximumRetryCount = req.body.MaxRetry || 3;
      }
    }

    if (req.body.Memory) {
      hostConfig.Memory = parseInt(req.body.Memory) * 1024 * 1024; // MB → bytes
    }
    if (req.body.CpuShares) {
      hostConfig.CpuShares = parseInt(req.body.CpuShares);
    }

    // Network mode (bridge / host / none)
    if (req.body.NetworkMode) {
      hostConfig.NetworkMode = req.body.NetworkMode;
    }

    containerConfig.HostConfig = hostConfig;

    const container = await docker.createContainer(containerConfig);

    // Start unless explicitly told not to
    if (autoStart !== false) {
      await container.start();
    }

    return res.status(201).json({
      message: autoStart !== false
        ? "Container created and started successfully"
        : "Container created successfully (not started)",
      id: container.id,
    });
  } catch (error) {
    console.error(`[Container Create Error]: ${error}`);
    return res.status(500).json(error.message || "Error creating container");
  }
};

// Isolate container — disconnect from ALL networks
export const isolateContainer = async (req, res) => {
  try {
    const { id } = req.params;
    const container = docker.getContainer(id);
    const info = await container.inspect();
    const networks = Object.keys(info.NetworkSettings?.Networks || {});

    for (const netName of networks) {
      const network = docker.getNetwork(netName);
      await network.disconnect({ Container: id });
    }

    return res.status(200).json({
      message: `Container disconnected from ${networks.length} network(s)`,
      disconnected: networks,
    });
  } catch (error) {
    console.error(`[Container Isolate Error]: ${error}`);
    return res.status(500).json(error.message || "Error isolating container");
  }
};

// De-isolate container — reconnect to bridge network
export const deisolateContainer = async (req, res) => {
  try {
    const { id } = req.params;
    const network = docker.getNetwork("bridge");
    await network.connect({ Container: id });

    return res.status(200).json({
      message: "Container reconnected to bridge network",
    });
  } catch (error) {
    console.error(`[Container De-isolate Error]: ${error}`);
    return res.status(500).json(error.message || "Error de-isolating container");
  }
};
