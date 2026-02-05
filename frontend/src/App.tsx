import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import SubmissionsList from "./pages/SubmissionsList";
import SubmissionDetail from "./pages/SubmissionDetail";
import SettingsPage from "./pages/SettingsPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Navigate to="/inbox" replace />} />
        <Route path="inbox" element={<SubmissionsList />} />
        <Route path="site/:siteId" element={<SubmissionsList />} />
        <Route path="submission/:submissionId" element={<SubmissionDetail />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="trash" element={<SubmissionsList />} />
      </Route>
      <Route path="*" element={<Navigate to="/inbox" replace />} />
    </Routes>
  );
}

export default App;