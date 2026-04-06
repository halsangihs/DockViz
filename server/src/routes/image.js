import express from 'express'
import { getImages, pruneImages, inspectImage, deleteImage, tagImage, renameImage, untagImage, searchImages } from '../controllers/image.js';

const imageRouter = express.Router();

imageRouter.get("/",getImages);
imageRouter.get("/search", searchImages);
imageRouter.get("/inspect/:id", inspectImage);
imageRouter.delete("/prune", pruneImages);
imageRouter.delete("/:id", deleteImage);
imageRouter.post("/:id/tag", tagImage);
imageRouter.post("/:id/rename", renameImage);
imageRouter.post("/:id/untag", untagImage);

export default imageRouter;