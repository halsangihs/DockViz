import api from '../api/apiClient.js'

export const apiService = {
    getContainers: async () => {
        const response = await api.get("/containers");
        return response.data;
    },
    getImages: async () => {
        const response = await api.get("/images");
        return response.data;
    },
    getNetworks: async () => {
        const response = await api.get("/networks");
        return response.data;
    },
    getVolumes: async () => {
        const response = await api.get("/volumes");
        return response.data;
    },

    // container management (legacy)
    stopContainer: async (id) => {
        const response = await api.post(`/containers/stop/${id}`);
        return response.data;
    },
    startContainer: async (id) => {
        const response = await api.post(`/containers/start/${id}`);
        return response.data;
    },

    // generic container action (start/stop/kill/restart/remove)
    containerAction: async (id, action) => {
        const response = await api.post(`/containers/action/${id}`, { action });
        return response.data;
    },
    renameContainer: async (id, name) => {
        const response = await api.post(`/containers/rename/${id}`, { name });
        return response.data;
    },

    // create container from image
    createContainer: async (config) => {
        const response = await api.post("/containers/create", config);
        return response.data;
    },

    // isolate container (disconnect from all networks)
    isolateContainer: async (id) => {
        const response = await api.post(`/containers/isolate/${id}`);
        return response.data;
    },

    // de-isolate container (reconnect to bridge)
    deisolateContainer: async (id) => {
        const response = await api.post(`/containers/deisolate/${id}`);
        return response.data;
    },

    // network management
    createNetwork: async (config) => {
        const response = await api.post("/networks", config);
        return response.data;
    },
    deleteNetwork: async (netId) => {
        const response = await api.delete(`/networks/${netId}`);
        return response.data;
    },
    renameNetwork: async (netId, name) => {
        const response = await api.post(`/networks/${netId}/rename`, { name });
        return response.data;
    },
    connectToNetwork: async (netId, containerId) => {
        const response = await api.post(`/networks/${netId}/connect`, { Container: containerId });
        return response.data;
    },
    disconnectFromNetwork: async (netId, containerId) => {
        const response = await api.post(`/networks/${netId}/disconnect`, { Container: containerId });
        return response.data;
    },

    // image management
    pruneImages: async () => {
        const response = await api.delete("/images/prune");
        return response.data;
    },
    inspectImage: async (id) => {
        const response = await api.get(`/images/inspect/${encodeURIComponent(id)}`);
        return response.data;
    },
    deleteImage: async (id, force = false) => {
        const response = await api.delete(`/images/${encodeURIComponent(id)}${force ? '?force=true' : ''}`);
        return response.data;
    },
    tagImage: async (id, repo, tag) => {
        const response = await api.post(`/images/${encodeURIComponent(id)}/tag`, { repo, tag });
        return response.data;
    },
    renameImage: async (id, oldReference, repo, tag) => {
        const response = await api.post(`/images/${encodeURIComponent(id)}/rename`, { oldReference, repo, tag });
        return response.data;
    },
    untagImage: async (id, reference) => {
        const response = await api.post(`/images/${encodeURIComponent(id)}/untag`, { reference });
        return response.data;
    },
    searchImages: async (term) => {
        const response = await api.get(`/images/search?term=${encodeURIComponent(term)}`);
        return response.data;
    },
}