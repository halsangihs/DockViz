import docker from "../config/docker.js";

const formatNetworks = (networks, containers) => {
  return networks.map((net) => {
    const connectedContainers = containers.filter((container) => {
      const containerNetworks = container.NetworkSettings?.Networks || {};
      return Object.keys(containerNetworks).includes(net.Name);
    });

    const totalCount = connectedContainers.length;

    const activeCount = connectedContainers.filter(
      (c) => c.State === "running",
    ).length;

    return {
      id: net.Id.substring(0, 12),
      fullId: net.Id,
      name: net.Name,
      driver: net.Driver,
      activeContainersCount: activeCount,
      totalContainersCount: totalCount,
    };
  });
};

export const getNetworks = async (req, res) => {
  try {
    const networks = await docker.listNetworks();
    const containers = await docker.listContainers({ all: true });

    const formattedNetworks = formatNetworks(networks, containers);

    return res.status(200).json(formattedNetworks);
  } catch (error) {
    console.error(`[Network Error]: ${error}`);
    return res
      .status(500)
      .json("Failed to fetch containers from Docker daemon");
  }
};

export const connectContainerToNetwork = async (req, res) => {
  try {
    const { netId } = req.params;
    const { Container } = req.body;
    const network = docker.getNetwork(netId);
    await network.connect({ Container });
    return res.status(200).json("Container connected to network");
  } catch (error) {
    console.error(`[Network Connect Error]: ${error}`);
    return res.status(500).json("Error connecting container to network");
  }
};

export const disconnectContainerFromNetwork = async (req, res) => {
  try {
    const { netId } = req.params;
    const { Container } = req.body;
    const network = docker.getNetwork(netId);
    await network.disconnect({ Container });
    return res.status(200).json("Container disconnected from network");
  } catch (error) {
    console.error(`[Network Disconnect Error]: ${error}`);
    return res.status(500).json("Error disconnecting container from network");
  }
};

export const createNetwork = async (req, res) => {
  try {
    const { Name, Driver = "bridge", Internal = false } = req.body;

    if (!Name || !Name.trim()) {
      return res.status(400).json("Network name is required");
    }

    const network = await docker.createNetwork({
      Name: Name.trim(),
      Driver,
      Internal,
    });

    return res.status(201).json({
      message: "Network created successfully",
      id: network.id,
    });
  } catch (error) {
    console.error(`[Network Create Error]: ${error}`);
    return res.status(500).json(error.message || "Error creating network");
  }
};

export const renameNetwork = async (req, res) => {
  try {
    const { netId } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Network name is required" });
    }

    const targetName = name.trim();
    const sourceNetwork = docker.getNetwork(netId);
    const info = await sourceNetwork.inspect();

    if (["bridge", "host", "none"].includes((info.Name || "").toLowerCase())) {
      return res.status(400).json({ error: "System networks cannot be renamed" });
    }

    if (info.Name === targetName) {
      return res.status(400).json({ error: "New network name must be different" });
    }

    const existingNetworks = await docker.listNetworks();
    if (existingNetworks.some((network) => network.Name === targetName)) {
      return res.status(409).json({ error: `A network named ${targetName} already exists` });
    }

    const recreatedNetwork = await docker.createNetwork({
      Name: targetName,
      Driver: info.Driver,
      Internal: !!info.Internal,
      Attachable: !!info.Attachable,
      EnableIPv6: !!info.EnableIPv6,
      Options: info.Options || {},
      Labels: info.Labels || {},
    });

    const allContainers = await docker.listContainers({ all: true });
    const connectedContainers = allContainers.filter((container) => {
      const nets = container.NetworkSettings?.Networks || {};
      return Object.keys(nets).includes(info.Name);
    });

    for (const container of connectedContainers) {
      const endpointConfig = container.NetworkSettings?.Networks?.[info.Name] || {};
      try {
        await docker.getNetwork(recreatedNetwork.id).connect({
          Container: container.Id,
          EndpointConfig: {
            Aliases: endpointConfig.Aliases,
            IPAMConfig: endpointConfig.IPAMConfig,
          },
        });
      } catch (connectError) {
        console.error(`[Network Rename] Failed to connect ${container.Id} to ${targetName}: ${connectError.message}`);
      }

      try {
        await sourceNetwork.disconnect({ Container: container.Id, Force: true });
      } catch (disconnectError) {
        console.error(`[Network Rename] Failed to disconnect ${container.Id} from ${info.Name}: ${disconnectError.message}`);
      }
    }

    await sourceNetwork.remove();

    return res.status(200).json({
      message: `Network renamed to ${targetName}`,
      id: recreatedNetwork.id,
      oldName: info.Name,
      newName: targetName,
    });
  } catch (error) {
    console.error(`[Network Rename Error]: ${error}`);
    return res.status(500).json({
      error: error?.reason || error?.json?.message || error.message || "Error renaming network",
    });
  }
};

export const deleteNetwork = async (req, res) => {
  try {
    const { netId } = req.params;
    const network = docker.getNetwork(netId);

    // Inspect to get the network name
    const info = await network.inspect();
    const networkName = info.Name;

    // Find ALL containers (including stopped) that reference this network.
    // network.inspect().Containers only lists containers with active
    // endpoints, so stopped containers would be missed.
    const allContainers = await docker.listContainers({ all: true });
    const connectedContainers = allContainers
      .filter((c) => {
        const nets = Object.keys(c.NetworkSettings?.Networks || {});
        return nets.includes(networkName);
      })
      .map((c) => c.Id);

    // Disconnect every container (running or stopped) first
    for (const containerId of connectedContainers) {
      try {
        await network.disconnect({ Container: containerId, Force: true });
      } catch (disconnectErr) {
        console.error(
          `[Network Delete] Failed to disconnect ${containerId}: ${disconnectErr.message}`,
        );
      }
    }

    // Now remove the network
    await network.remove();

    return res.status(200).json({
      message: "Network deleted successfully",
      disconnectedContainers: connectedContainers,
    });
  } catch (error) {
    console.error(`[Network Delete Error]: ${error}`);
    return res.status(500).json(error.message || "Error deleting network");
  }
};
