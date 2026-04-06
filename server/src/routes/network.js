import express from 'express'
import { getNetworks, connectContainerToNetwork, disconnectContainerFromNetwork, createNetwork, deleteNetwork, renameNetwork } from '../controllers/network.js';

const networkRouter = express.Router();

networkRouter.get("/",getNetworks);
networkRouter.post("/", createNetwork);
networkRouter.post("/:netId/rename", renameNetwork);
networkRouter.delete("/:netId", deleteNetwork);
networkRouter.post("/:netId/connect", connectContainerToNetwork);
networkRouter.post("/:netId/disconnect", disconnectContainerFromNetwork);

export default networkRouter;