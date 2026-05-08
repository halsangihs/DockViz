const nodesTransformer = (containers, images, networks) => {
  const containerNodes = containers.map((container, index) => {
    // Check if the container's claimed image name still exists as a tag on the parent image
    const parentImage = images.find((img) => img.fullId === container.fullImageId);
    let displayImageName = container.imageName;
    let isStaleRef = false;
    let currentValidTag = null;
    let isImageDeleted = false;

    if (parentImage) {
      const parentTags = parentImage.references || parentImage.tags || [];
      const cleanContainerImg = container.imageName;
      
      const isStale = (
        cleanContainerImg &&
        !cleanContainerImg.startsWith("sha256:") &&
        !cleanContainerImg.includes("<none>") &&
        !parentTags.includes(cleanContainerImg) &&
        !parentTags.includes(`${cleanContainerImg}:latest`) 
      );

      if (isStale) {
         isStaleRef = true;
         if (parentImage.primaryReference) {
            currentValidTag = parentImage.primaryReference;
            // We'll pass this new info to the node
         }
      }
    } else {
       // If no parent image found but container isn't running on scratch/empty
       if (container.imageId) {
          isImageDeleted = true;
       }
    }

    return {
      id: container.fullId,
      type: "container",
      position: { x: index * 250, y: 100 },
      deletable: false,
      data: {
        ...container,
        currentValidTag, // If set, means the original image name is stale
        isStaleRef,
        isImageDeleted,
      },
    };
  });

  const imageNodes = images.map((image, index) => ({
    id: image.fullId,
    type: "image",
    position: { x: index * 250, y: 100 },
    data: image,
    deletable: false,
    connectable: false,
  }));

  // Exclude the "none" network (null driver) — isolation is shown on containers instead
  const visibleNetworks = networks.filter(
    (n) => n.driver !== "null" && n.name !== "none",
  );

  const networkNodes = visibleNetworks.map((network, index) => ({
    id: network.name,
    type: "network",
    position: { x: index * 250, y: 100 },
    data: network,
    deletable: false,
  }));

  return [...containerNodes, ...imageNodes, ...networkNodes];
};

export default nodesTransformer;
