import { createContext, useContext } from "react";

const FlowActionsContext = createContext(null);

export const useFlowActions = () => useContext(FlowActionsContext);

export default FlowActionsContext;
