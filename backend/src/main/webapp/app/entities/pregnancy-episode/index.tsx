import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import PregnancyEpisode from './pregnancy-episode';
import PregnancyEpisodeDeleteDialog from './pregnancy-episode-delete-dialog';
import PregnancyEpisodeDetail from './pregnancy-episode-detail';
import PregnancyEpisodeUpdate from './pregnancy-episode-update';

const PregnancyEpisodeRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<PregnancyEpisode />} />
    <Route path="new" element={<PregnancyEpisodeUpdate />} />
    <Route path=":id">
      <Route index element={<PregnancyEpisodeDetail />} />
      <Route path="edit" element={<PregnancyEpisodeUpdate />} />
      <Route path="delete" element={<PregnancyEpisodeDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default PregnancyEpisodeRoutes;
