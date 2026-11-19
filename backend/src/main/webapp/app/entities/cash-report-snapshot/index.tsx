import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import CashReportSnapshot from './cash-report-snapshot';
import CashReportSnapshotDeleteDialog from './cash-report-snapshot-delete-dialog';
import CashReportSnapshotDetail from './cash-report-snapshot-detail';
import CashReportSnapshotUpdate from './cash-report-snapshot-update';

const CashReportSnapshotRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<CashReportSnapshot />} />
    <Route path="new" element={<CashReportSnapshotUpdate />} />
    <Route path=":id">
      <Route index element={<CashReportSnapshotDetail />} />
      <Route path="edit" element={<CashReportSnapshotUpdate />} />
      <Route path="delete" element={<CashReportSnapshotDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default CashReportSnapshotRoutes;
