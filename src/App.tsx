import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import GameHub from './routes/GameHub';
import Toast from './components/Toast';

const Play = lazy(() => import('./routes/Play'));
const ManagerHub = lazy(() => import('./routes/ManagerHub'));

export default function App() {
  return (
    <BrowserRouter>
      <Toast />
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<GameHub initialView="home" />} />
          <Route path="/hunt" element={<GameHub initialView="venues" />} />
          <Route path="/me" element={<GameHub initialView="me" />} />
          <Route path="/leaderboard" element={<GameHub initialView="leaderboard" />} />
          <Route path="/admin" element={<GameHub initialView="admin-panel" />} />
          <Route path="/sales" element={<GameHub initialView="sales-tool" />} />

          <Route path="/play" element={<Play />} />
          <Route path="/manager" element={<ManagerHub />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

