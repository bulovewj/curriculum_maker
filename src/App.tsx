import { Shell } from './components/Shell';
import { Start } from './screens/Start/Start';
import { ProjectProvider, useProject } from './state/ProjectContext';

function Screen() {
  return useProject().project ? <Shell /> : <Start />;
}

export function App() {
  return (
    <ProjectProvider>
      <Screen />
    </ProjectProvider>
  );
}
