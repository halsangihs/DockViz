import express from 'express'
import { getContainers, startContainer, stopContainer, renameContainer, containerAction, createContainer, isolateContainer, deisolateContainer } from '../controllers/container.js';

const containerRouter = express.Router();

containerRouter.post("/stop/:id",stopContainer);
containerRouter.post("/start/:id",startContainer);
containerRouter.post("/rename/:id", renameContainer);
containerRouter.post("/action/:id", containerAction);
containerRouter.post("/create", createContainer);
containerRouter.post("/isolate/:id", isolateContainer);
containerRouter.post("/deisolate/:id", deisolateContainer);
containerRouter.get("/",getContainers);

export default containerRouter;
