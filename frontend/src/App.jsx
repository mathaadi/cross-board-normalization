import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import ScoreCalculator from './pages/ScoreCalculator';
import BoardStatistics from './pages/BoardStatistics';
import AdminPanel from './pages/AdminPanel';
import StudentExplorer from './pages/StudentExplorer';
import StudentDirectory from './pages/StudentDirectory';
import AcademicRecord from './pages/AcademicRecord';
import AcademicOCR from './pages/AcademicOCR';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#0f172a]">
        <Navbar />
        <main className="max-w-7xl mx-auto px-6 pt-24 pb-12">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/calculator" element={<ScoreCalculator />} />
            <Route path="/statistics" element={<BoardStatistics />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/students" element={<StudentDirectory />} />
            <Route path="/student-explorer" element={<StudentExplorer />} />
            <Route path="/academic-record" element={<AcademicRecord />} />
            <Route path="/academic-ocr" element={<AcademicOCR />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
