import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import CattleProfileChange from './cattle-profile-change';
import CattleProfileChangeDeleteDialog from './cattle-profile-change-delete-dialog';
import CattleProfileChangeDetail from './cattle-profile-change-detail';
import CattleProfileChangeUpdate from './cattle-profile-change-update';

const CattleProfileChangeRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<CattleProfileChange />} />
    <Route path="new" element={<CattleProfileChangeUpdate />} />
    <Route path=":id">
      <Route index element={<CattleProfileChangeDetail />} />
      <Route path="edit" element={<CattleProfileChangeUpdate />} />
      <Route path="delete" element={<CattleProfileChangeDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default CattleProfileChangeRoutes;
