import { Navigate, Route, Routes } from 'react-router-dom';
import IndentRoutes from '../IndentRoutes';

export default function GlobalRoutes(props) {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/indent" replace />} />
      <Route path="/indent/*" element={<IndentRoutes {...props} />} />
      <Route path="*" element={<Navigate to="/indent" replace />} />
    </Routes>
  );
}

