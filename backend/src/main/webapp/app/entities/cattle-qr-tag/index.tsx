import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import CattleQrTag from './cattle-qr-tag';
import CattleQrTagDeleteDialog from './cattle-qr-tag-delete-dialog';
import CattleQrTagDetail from './cattle-qr-tag-detail';
import CattleQrTagUpdate from './cattle-qr-tag-update';

const CattleQrTagRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<CattleQrTag />} />
    <Route path="new" element={<CattleQrTagUpdate />} />
    <Route path=":id">
      <Route index element={<CattleQrTagDetail />} />
      <Route path="edit" element={<CattleQrTagUpdate />} />
      <Route path="delete" element={<CattleQrTagDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default CattleQrTagRoutes;
