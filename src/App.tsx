import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import GameHub from './routes/GameHub';
import Toast from './components/Toast';
import BetaBanner from './components/BetaBanner';
import { ThemeProvider } from './contexts/ThemeContext';

const Play = lazy(() => import('./routes/Play'));
const ManagerHub = lazy(() => import('./routes/ManagerHub'));

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Toast />
        <BetaBanner />
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

            <Route path="/drones" element={<GameHub initialView="home" />} />
            <Route path="/shooter" element={<GameHub initialView="home" />} />
            <Route path="/marshrutka" element={<GameHub initialView="home" />} />
            <Route path="/trivia" element={<GameHub initialView="home" />} />
            <Route path="/lighthouse" element={<GameHub initialView="home" />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}

