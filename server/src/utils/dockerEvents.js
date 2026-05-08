import docker from '../config/docker.js'
import { handleContainerEvent, handleImageEvent, handleNetworkEvent, handleVolumeEvent } from './dockerEventHandlers.js';

const dockerEvents = async (io) => {
    try {
        const stream = await docker.getEvents();
        stream.on('data',(chunk) => {
            if(!chunk) return;

            const event = JSON.parse(chunk.toString('utf8'));
            // console.log(event);
            if(event.Type === 'container'){
                handleContainerEvent(event,io);
            }
            else if(event.Type === 'image'){
                handleImageEvent(event,io);
            }
            else if(event.Type === 'network'){
                handleNetworkEvent(event,io);
            }
            else if(event.Type === 'volume'){
                handleVolumeEvent(event,io);
            }
        })    
    } catch (error) {
        console.error("Error listening to Docker events:", error);
    }
}

export default dockerEvents;