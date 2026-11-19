import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import AuditLog from './audit-log';
import AuditLogDeleteDialog from './audit-log-delete-dialog';
import AuditLogDetail from './audit-log-detail';
import AuditLogUpdate from './audit-log-update';

const AuditLogRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<AuditLog />} />
    <Route path="new" element={<AuditLogUpdate />} />
    <Route path=":id">
      <Route index element={<AuditLogDetail />} />
      <Route path="edit" element={<AuditLogUpdate />} />
      <Route path="delete" element={<AuditLogDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default AuditLogRoutes;
