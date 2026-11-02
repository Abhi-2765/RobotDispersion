# Repository Guidelines

## Project Structure

- `src/App.jsx` composes the application and selects the active page.
- Put screen-level views in `src/pages/` (for example, `ConfigurationPage.jsx` and `PreviewPage.jsx`). Do not put pages in `src/components/`.
- Put reusable, focused UI pieces in `src/components/`; simulator visualization components belong in `src/components/simulator/`.
- `src/hooks/` is for reusable React hooks; `src/context/` is for shared React state only when props are insufficient.
- `src/simulation/models/` defines `Grid`, `Node`, and `Robot`; setup and placement live in `src/simulation/` and `initialization/`.
- `src/simulation/engine/` owns CCM execution and managers. Shared contracts live in `src/simulation/algorithms/`; non-faulty and future faulty protocols belong in their respective subdirectories.
- `src/assets/` and `public/` hold imported and static assets. There is currently no test directory or test framework.

Keep UI, engine, and algorithm responsibilities separate. UI code may use simulator IDs and coordinates to render the grid; robot algorithms must receive only local observations.

## Design Principles (SOLID)

- **Single responsibility:** Each page, component, model, manager, and algorithm stage should have one clear job.
- **Open/closed:** Add new algorithms through existing contracts and composition; avoid editing unrelated working modules to add a mode.
- **Liskov substitution:** Algorithm implementations must honor `createMessage()` and `compute()` contracts and preserve CCM behavior.
- **Interface segregation:** Keep props and module APIs focused; avoid all-purpose components or managers.
- **Dependency inversion:** Pages depend on props and simulation interfaces, not internal node mutation or algorithm details. Keep algorithms independent of React and rendering code.

Apply these principles pragmatically; avoid abstractions without a concrete need.

## Commands and Testing

- `npm run dev` starts Vite locally.
- `npm run build` creates the production bundle in `dist/`.
- `npm run preview` serves that bundle locally.
- `npm run lint` runs ESLint.

No automated test runner is configured. Do not claim algorithm correctness without checking behavior against the paper and relevant scenarios. Preserve Communicate–Compute–Move order, simultaneous movement, and the local-knowledge boundary. Document assumptions where the paper is underspecified. Stage 3 remains deferred unless requested.

## Style and Contributions

Use JavaScript ES modules, JSX, and two-space indentation. Use `PascalCase` for components/classes and `camelCase` for functions/variables. Style UI with Tailwind; keep global tokens in `src/index.css`. Avoid new dependencies and duplicate layers.

Recent commits use short descriptive subjects. Prefer imperative messages such as `Add preview node inspector`. Pull requests should summarize changes and validation, document algorithm assumptions, and include UI screenshots. Do not commit `dist/`.
