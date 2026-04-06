import docker from "../config/docker.js";

const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

const formatImages = (images) => {
  const formattedImages = images.map((image) => {
    const hasTags = image.RepoTags && image.RepoTags.length > 0;
    const references = hasTags
      ? image.RepoTags.filter((tag) => tag && tag !== "<none>:<none>")
      : [];
    const primaryReference = references[0] || null;
    let name = '<none>';
    if (primaryReference) {
       const firstTag = primaryReference;
       const lastColon = firstTag.lastIndexOf(':');
       name = lastColon === -1 ? firstTag : firstTag.substring(0, lastColon);
    }
    const tags = references.map((tag) =>{
      const lastColonIndex = tag.lastIndexOf(':');
      return tag.substring(lastColonIndex + 1);
    });

    return {
      name,
      tags,
      references,
      primaryReference,
      primaryTag: tags[0] || null,
      id: image.Id.split(":")[1]?.substring(0, 12) || "N/A",
      fullId: image.Id,
      containersCount: image.Containers,
      size: formatBytes(image.Size),
      created: new Date(image.Created * 1000).toISOString(),
    };
  });
  return formattedImages;
};

export const getImages = async (req, res) => {
  try {
    const images = await docker.listImages();
    const formattedImages = formatImages(images);

    return res.status(200).json(formattedImages);
  } catch (error) {
    console.error(`[Image Error]: ${error}`);
    return res.status(500).json("Failed to fetch containers from Docker daemon");
  }
};

export const pruneImages = async (req, res) => {
  try {
    const result = await docker.pruneImages();
    return res.status(200).json({
      message: "Images pruned successfully",
      spaceReclaimed: result.SpaceReclaimed,
      imagesDeleted: result.ImagesDeleted || [],
    });
  } catch (error) {
    console.error(`[Image Prune Error]: ${error}`);
    return res.status(500).json("Error pruning images");
  }
};

export const inspectImage = async (req, res) => {
  try {
    const { id } = req.params;
    const image = docker.getImage(id);
    const info = await image.inspect();

    const config = info.Config || {};
    const containerConfig = info.ContainerConfig || {};

    return res.status(200).json({
      id: info.Id,
      created: info.Created,
      architecture: info.Architecture,
      os: info.Os,
      author: info.Author || null,
      dockerVersion: info.DockerVersion || null,
      // Dockerfile instructions
      entrypoint: config.Entrypoint || null,
      cmd: config.Cmd || null,
      workingDir: config.WorkingDir || "",
      user: config.User || "",
      // Environment defaults baked into the image
      env: config.Env || [],
      // Exposed ports from Dockerfile EXPOSE
      exposedPorts: Object.keys(config.ExposedPorts || {}),
      // Volumes defined in Dockerfile
      volumes: Object.keys(config.Volumes || {}),
      // Labels
      labels: config.Labels || {},
      // Shell
      shell: config.Shell || null,
      // Layers count
      layersCount: (info.RootFS?.Layers || []).length,
    });
  } catch (error) {
    console.error(`[Image Inspect Error]: ${error}`);
    return res.status(500).json("Error inspecting image");
  }
};

export const deleteImage = async (req, res) => {
  try {
    const { id } = req.params;
    const force = req.query.force === "true";
    const containers = await docker.listContainers({ all: true });
    const dependents = containers.filter(
      (c) => c.ImageID === id || c.Image === id,
    );
    const runningDependents = dependents.filter((c) => c.State === "running");

    const serializeContainers = (list) =>
      list.map((c) => ({
        id: c.Id.substring(0, 12),
        fullId: c.Id,
        name: c.Names[0]?.replace(/^\//, ""),
        state: c.State,
      }));

    // Check for containers using this image (safe path)
    if (!force) {
      if (dependents.length > 0) {
        return res.status(409).json({
          error: "Image is in use by containers",
          message: "Image is in use by containers",
          forceAllowed: runningDependents.length === 0,
          hasRunningContainers: runningDependents.length > 0,
          containers: serializeContainers(dependents),
        });
      }
    }

    // Docker typically refuses image removal when a running container still uses it.
    if (force && runningDependents.length > 0) {
      return res.status(409).json({
        error:
          "Cannot force delete an image while it is used by running containers. Stop or remove those containers first.",
        message:
          "Cannot force delete an image while it is used by running containers. Stop or remove those containers first.",
        forceAllowed: false,
        hasRunningContainers: true,
        containers: serializeContainers(dependents),
      });
    }

    const image = docker.getImage(id);
    await image.remove({ force });

    return res.status(200).json({ message: "Image deleted successfully" });
  } catch (error) {
    console.error(`[Image Delete Error]: ${error}`);
    return res.status(500).json({
      error:
        error?.reason ||
        error?.json?.message ||
        error?.message ||
        "Error deleting image",
    });
  }
};

export const tagImage = async (req, res) => {
  try {
    const { id } = req.params;
    const { repo, tag } = req.body;
    const normalizedTag = tag || "latest";

    if (!repo) {
      return res.status(400).json("Repository name is required");
    }

    const image = docker.getImage(id);
    const info = await image.inspect();
    const existingReferences = info.RepoTags || [];
    const targetReference = `${repo}:${normalizedTag}`;

    if (existingReferences.includes(targetReference)) {
      return res.status(409).json({
        error: `Image already has the reference ${targetReference}`,
      });
    }

    await image.tag({ repo, tag: normalizedTag });

    return res
      .status(200)
      .json({ message: `Image tagged as ${targetReference}` });
  } catch (error) {
    console.error(`[Image Tag Error]: ${error}`);
    return res.status(500).json({ error: error.message || "Error tagging image" });
  }
};

export const renameImage = async (req, res) => {
  try {
    const { id } = req.params;
    const { oldReference, repo, tag } = req.body;
    const normalizedTag = tag || "latest";

    if (!repo?.trim()) {
      return res.status(400).json({ error: "Repository name is required" });
    }

    const image = docker.getImage(id);
    const info = await image.inspect();
    const existingReferences = (info.RepoTags || []).filter(
      (ref) => ref && ref !== "<none>:<none>",
    );

    if (existingReferences.length === 0) {
      return res.status(400).json({
        error: "Dangling images cannot be renamed until they have a valid tag",
      });
    }

    const sourceReference = oldReference || existingReferences[0];
    const targetReference = `${repo.trim()}:${normalizedTag}`;

    if (!existingReferences.includes(sourceReference)) {
      return res.status(404).json({
        error: `Source reference ${sourceReference} was not found on this image`,
      });
    }

    if (sourceReference === targetReference) {
      return res.status(400).json({
        error: "New image reference must be different from the current one",
      });
    }

    if (existingReferences.includes(targetReference)) {
      return res.status(409).json({
        error: `Image already has the reference ${targetReference}`,
      });
    }

    await image.tag({ repo: repo.trim(), tag: normalizedTag });
    await docker.getImage(sourceReference).remove();

    return res.status(200).json({
      message: `Renamed ${sourceReference} to ${targetReference}`,
      oldReference: sourceReference,
      newReference: targetReference,
    });
  } catch (error) {
    console.error(`[Image Rename Error]: ${error}`);
    return res.status(500).json({
      error: error?.reason || error?.json?.message || error.message || "Error renaming image",
    });
  }
};

export const untagImage = async (req, res) => {
  try {
    const { id } = req.params;
    const { reference } = req.body;

    if (!reference?.trim()) {
      return res.status(400).json({ error: "Reference is required" });
    }

    const image = docker.getImage(id);
    const info = await image.inspect();
    const existingReferences = (info.RepoTags || []).filter(
      (ref) => ref && ref !== "<none>:<none>",
    );

    if (!existingReferences.includes(reference)) {
      return res.status(404).json({
        error: `Reference ${reference} was not found on this image`,
      });
    }

    const isLastTag = existingReferences.length === 1;

    // Removing the tag by calling remove on the reference string;
    // noprune: true prevents deleting untagged parent layers
    await docker.getImage(reference).remove({ noprune: true });

    return res.status(200).json({
      message: `Removed tag ${reference}`,
      reference,
      wasLastTag: isLastTag,
    });
  } catch (error) {
    console.error(`[Image Untag Error]: ${error}`);
    return res.status(500).json({
      error: error?.reason || error?.json?.message || error.message || "Error removing tag",
    });
  }
};

export const searchImages = async (req, res) => {
  try {
    const { term } = req.query;
    if (!term) {
      return res.status(400).json("Search term is required");
    }

    const results = await docker.searchImages({ term, limit: 25 });
    return res.status(200).json(
      results.map((r) => ({
        name: r.name,
        description: r.description,
        stars: r.star_count,
        official: r.is_official,
        automated: r.is_automated,
      })),
    );
  } catch (error) {
    console.error(`[Image Search Error]: ${error}`);
    return res.status(500).json(error.message || "Error searching images");
  }
};
