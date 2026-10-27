import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import EvidenceReview from './evidence-review';
import EvidenceReviewDeleteDialog from './evidence-review-delete-dialog';
import EvidenceReviewDetail from './evidence-review-detail';
import EvidenceReviewUpdate from './evidence-review-update';

const EvidenceReviewRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<EvidenceReview />} />
    <Route path="new" element={<EvidenceReviewUpdate />} />
    <Route path=":id">
      <Route index element={<EvidenceReviewDetail />} />
      <Route path="edit" element={<EvidenceReviewUpdate />} />
      <Route path="delete" element={<EvidenceReviewDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default EvidenceReviewRoutes;
