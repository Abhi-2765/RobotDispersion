import { useState } from "react";
import { createSimulation } from "./simulation/SimulationSetup.js";
import { ConfigurationPage } from "./pages/ConfigurationPage.jsx";
import { PreviewPage } from "./pages/PreviewPage.jsx";
import { SimulatorPage } from "./pages/SimulatorPage.jsx";
import { Navbar } from "./components/Navbar.jsx";

const APP_TITLE = "Optimizing Robot Dispersion on Grids: with and without Fault Tolerance";

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export default function App() {
  const [gridSize, setGridSize] = useState(6);
  const [robotCount, setRobotCount] = useState(12);
  const [algorithmMode, setAlgorithmMode] = useState("nonFaulty");
  const [simulation, setSimulation] = useState(null);
  const [simulationVersion, setSimulationVersion] = useState(0);
  const [simulationSeed, setSimulationSeed] = useState(1);
  const [page, setPage] = useState("configuration");

  function updateGridSize(nextSize) {
    setGridSize(nextSize);
    setRobotCount((current) => Math.min(current, nextSize * nextSize));
  }

  function createSimulationForSeed(seed) {
    return createSimulation({
      gridSize,
      robotCount,
      placementMode: "random",
      random: createSeededRandom(seed),
    });
  }

  function createPreview() {
    const nextSeed = simulationSeed + 1;
    setSimulationSeed(nextSeed);
    setSimulation(createSimulationForSeed(nextSeed));
    setSimulationVersion((version) => version + 1);
    setPage("preview");
  }

  function resetSimulation() {
    setSimulation(createSimulationForSeed(simulationSeed));
    setSimulationVersion((version) => version + 1);
  }

  const pageNavigation = page === "configuration"
    ? { currentPage: "Configuration" }
    : page === "preview"
      ? { currentPage: "Configuration preview", onBack: () => setPage("configuration"), backLabel: "Back to configuration" }
      : { currentPage: "Simulation", onBack: () => setPage("preview"), backLabel: "Back to configuration preview" };

  return (
    <main className="min-h-screen bg-background px-3 py-5 font-sans text-foreground sm:px-5 sm:py-7 lg:px-8">
      <div className="w-full">
        <Navbar title={APP_TITLE} {...pageNavigation} />

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
        ) : page === "preview" ? (
          <PreviewPage
            simulation={simulation}
            gridSize={gridSize}
            algorithmMode={algorithmMode}
            onRegenerate={createPreview}
            onStart={() => setPage("simulator")}
          />
        ) : (
          <SimulatorPage
            key={simulationVersion}
            simulation={simulation}
            gridSize={gridSize}
            algorithmMode={algorithmMode}
            onReset={resetSimulation}
          />
        )}
      </div>
    </main>
  );
}
