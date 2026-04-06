import ReactFlowPage from "./pages/ReactFlowPage";
import { Toaster } from "react-hot-toast";
import { ReactFlowProvider } from "@xyflow/react";

const App = () => {
  return (
    <>
      <ReactFlowProvider>
        <ReactFlowPage />
      </ReactFlowProvider>
      <Toaster position="top-left" />
    </>
  );
};

export default App;
