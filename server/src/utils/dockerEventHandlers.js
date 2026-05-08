// Track containers going through lifecycle transitions (start/stop/kill/die).
// Docker automatically fires network connect/disconnect events during these
// transitions — those should NOT be forwarded to the client because the
// container_state_change handler already takes care of edge animations and
// active-container counts.
const lifecycleContainers = new Set();

export const handleContainerEvent = (event,io) => {
    const container = event.Actor;
    if(event.Action === 'start'){
        lifecycleContainers.add(container.ID);
        setTimeout(() => lifecycleContainers.delete(container.ID), 10000);
        io.emit('container_state_change',{id: container.ID, state: "running"});
    }
    else if(event.Action === 'kill'){
        // kill fires before die — add early so subsequent disconnect events are caught
        lifecycleContainers.add(container.ID);
        setTimeout(() => lifecycleContainers.delete(container.ID), 10000);
    }
    else if(event.Action === 'die' || event.Action === 'stop'){
        lifecycleContainers.add(container.ID);
        setTimeout(() => lifecycleContainers.delete(container.ID), 10000);
        io.emit('container_state_change',{id: container.ID, state: "exited"});
    }
    else if(event.Action === 'pause'){
        io.emit('container_state_change',{id: container.ID, state: "paused"});
    }
    else if(event.Action === 'unpause'){
        io.emit('container_state_change',{id: container.ID, state: "running"});
    }
    else if(event.Action === 'destroy'){
        lifecycleContainers.delete(container.ID);
        io.emit('container_removed',{id: container.ID});
    }
}

export const handleImageEvent = (event,io) => {
    if(event.Action === 'delete' || event.Action === 'untag'){
        io.emit('image_removed',{id: event.Actor.ID});
    }
    else if(event.Action === 'pull' || event.Action === 'tag'){
        io.emit('image_changed',{id: event.Actor.ID, action: event.Action});
    }
}

export const handleVolumeEvent = (event,io) => {

}

export const handleNetworkEvent = (event,io) => {
    if(event.Action === 'create'){
        io.emit('network_created',{
            networkId: event.Actor.ID,
            name: event.Actor.Attributes?.name,
            driver: event.Actor.Attributes?.type,
        });
    }
    else if(event.Action === 'destroy'){
        io.emit('network_destroyed',{
            networkId: event.Actor.ID,
            name: event.Actor.Attributes?.name,
        });
    }
    else if(event.Action === 'connect' || event.Action === 'disconnect'){
        const containerId = event.Actor.Attributes?.container;

        // Skip automatic network events fired during container lifecycle
        // transitions (start → connect, stop/die → disconnect).
        if(containerId && lifecycleContainers.has(containerId)){
            return;
        }

        io.emit('network_change',{
            networkId: event.Actor.ID,
            containerId,
            action: event.Action,
        });
    }
}