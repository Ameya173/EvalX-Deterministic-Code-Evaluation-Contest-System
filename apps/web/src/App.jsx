import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Navbar from './components/Navbar.jsx';
import AuthPromptModal from './components/AuthPromptModal.jsx';
import Landing from './pages/Landing.jsx';
import Problems from './pages/Problems.jsx';
import Problem from './pages/Problem.jsx';
import Login from './pages/Login.jsx';
import Submissions from './pages/Submissions.jsx';
import SubmissionDetail from './pages/SubmissionDetail.jsx';
import Contests from './pages/Contests.jsx';
import Contest from './pages/Contest.jsx';
import Manage from './pages/Manage.jsx';
import ProblemEditor from './pages/ProblemEditor.jsx';
import Admin from './pages/Admin.jsx';
import Profile from './pages/Profile.jsx';
import StudyPlan from './pages/StudyPlan.jsx';

function Guard({ children, role }) {
  const { user, loading, isSetter, isAdmin } = useAuth();
  const location = useLocation();
  if (loading) return <div className="container muted">Loading...</div>;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (role === 'setter' && !isSetter) return <div className="container"><div className="alert error">Setter or admin access required.</div></div>;
  if (role === 'admin' && !isAdmin) return <div className="container"><div className="alert error">Admin access required.</div></div>;
  return children;
}

export default function App() {
  return (
    <>
      <Navbar />
      <AuthPromptModal />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/problems" element={<Problems />} />
        <Route path="/login" element={<Login mode="login" />} />
        <Route path="/register" element={<Login mode="register" />} />
        <Route path="/problems/:slug" element={<Guard><Problem /></Guard>} />
        <Route path="/submissions" element={<Guard><Submissions /></Guard>} />
        <Route path="/submissions/:id" element={<Guard><SubmissionDetail /></Guard>} />
        <Route path="/contests" element={<Contests />} />
        <Route path="/contests/:id" element={<Guard><Contest /></Guard>} />
        <Route path="/study-plan" element={<StudyPlan />} />
        <Route path="/users/:handle" element={<Profile />} />
        <Route path="/manage" element={<Guard role="setter"><Manage /></Guard>} />
        <Route path="/manage/:slug" element={<Guard role="setter"><ProblemEditor /></Guard>} />
        <Route path="/admin" element={<Guard role="admin"><Admin /></Guard>} />
        <Route path="/architecture" element={<Navigate to="/" replace />} />
        <Route path="*" element={<div className="container">Page not found.</div>} />
      </Routes>
    </>
  );
}
