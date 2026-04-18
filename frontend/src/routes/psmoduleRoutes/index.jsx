import { Navigate, Route, Routes } from 'react-router-dom';
import IndentMain from '../../Modules/psmodule/IndentMain';
import DepartmentStockMain from '../../Modules/psmodule/DepartmentStockMain';

export default function PsmoduleRoutes({ section = 'indent', ...props }) {
  if (section === 'depadmin') {
    return <DepartmentStockMain {...props} />;
  }

  return (
    <Routes>
      <Route path="/" element={<IndentMain {...props} />} />
      <Route path="*" element={<Navigate to="/indent" replace />} />
    </Routes>
  );
}
