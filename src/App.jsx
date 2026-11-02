import { useState } from "react";
import { createSimulation } from "./simulation/SimulationSetup.js";
import { ConfigurationPage } from "./pages/ConfigurationPage.jsx";
import { PreviewPage } from "./pages/PreviewPage.jsx";

export default function App() {
  const [gridSize, setGridSize] = useState(6);
  const [robotCount, setRobotCount] = useState(12);
  const [algorithmMode, setAlgorithmMode] = useState("nonFaulty");
  const [simulation, setSimulation] = useState(null);
  const [page, setPage] = useState("configuration");

  function updateGridSize(nextSize) {
    setGridSize(nextSize);
    setRobotCount((current) => Math.min(current, nextSize * nextSize));
  }

  function createPreview() {
    setSimulation(createSimulation({
      gridSize,
      robotCount,
      placementMode: "random",
    }));
    setPage("preview");
  }

  return (
    <main className="min-h-screen bg-background px-3 py-5 font-sans text-foreground sm:px-5 sm:py-7 lg:px-8">
      <div className="w-full">
        <header className="mb-8 border-b border-border pb-4">
          <h1 className="text-sm font-medium leading-6 sm:text-base">
            Optimizing Robot Dispersion on Grids: with and without Fault Tolerance
          </h1>
        </header>

        {page === "configuration" ? (
          <ConfigurationPage
            gridSize={gridSize}
            robotCount={robotCount}
            algorithmMode={algorithmMode}
            onGridSizeChange={updateGridSize}
            onRobotCountChange={setRobotCount}
            onAlgorithmModeChange={setAlgorithmMode}
            onPreview={createPreview}
          />
        ) : (
          <PreviewPage
            simulation={simulation}
            gridSize={gridSize}
            algorithmMode={algorithmMode}
            onBack={() => setPage("configuration")}
            onRegenerate={createPreview}
          />
        )}
      </div>
    </main>
  );
}
