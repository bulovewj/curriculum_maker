import { PasswordGate } from './components/PasswordGate';
import { Shell } from './components/Shell';
import { Start } from './screens/Start/Start';
import { ProjectProvider, useProject } from './state/ProjectContext';

function Screen() {
  return useProject().project ? <Shell /> : <Start />;
}

export function App() {
  return (
    <PasswordGate>
      <ProjectProvider>
        <Screen />
      </ProjectProvider>
    </PasswordGate>
  );
}
