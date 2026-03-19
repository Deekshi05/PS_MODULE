import { Navigate, Route, Routes } from 'react-router-dom';
import IndentMain from '../../Modules/Indent/IndentMain';

export default function IndentRoutes(props) {
  return (
    <Routes>
      <Route path="/" element={<IndentMain {...props} />} />
      <Route path="*" element={<Navigate to="/indent" replace />} />
    </Routes>
  );
}

