import { Link, Route, Routes } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import ScenarioPage from './pages/ScenarioPage';
import RunsPage from './pages/RunsPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <div className="layout">
      <aside>
        <h1>Playwright MCP Portal</h1>
        <nav>
          <Link to="/">Dashboard</Link>
          <Link to="/scenarios">Scenarios</Link>
          <Link to="/runs">Runs</Link>
          <Link to="/settings">Settings</Link>
        </nav>
      </aside>
      <main>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/scenarios" element={<ScenarioPage />} />
          <Route path="/runs" element={<RunsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
