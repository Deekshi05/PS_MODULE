import { Navigate, Route, Routes } from 'react-router-dom';
import PsmoduleRoutes from '../psmoduleRoutes';

export default function GlobalRoutes(props) {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/indent" replace />} />
      <Route path="/indent/*" element={<PsmoduleRoutes section="indent" {...props} />} />
      <Route path="/depadmin/*" element={<PsmoduleRoutes section="depadmin" {...props} />} />
      <Route path="*" element={<Navigate to="/indent" replace />} />
    </Routes>
  );
}

