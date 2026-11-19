import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import ManualFinanceRecord from './manual-finance-record';
import ManualFinanceRecordDeleteDialog from './manual-finance-record-delete-dialog';
import ManualFinanceRecordDetail from './manual-finance-record-detail';
import ManualFinanceRecordUpdate from './manual-finance-record-update';

const ManualFinanceRecordRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<ManualFinanceRecord />} />
    <Route path="new" element={<ManualFinanceRecordUpdate />} />
    <Route path=":id">
      <Route index element={<ManualFinanceRecordDetail />} />
      <Route path="edit" element={<ManualFinanceRecordUpdate />} />
      <Route path="delete" element={<ManualFinanceRecordDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default ManualFinanceRecordRoutes;
