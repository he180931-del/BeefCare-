import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import BankTransferEvidence from './bank-transfer-evidence';
import BankTransferEvidenceDeleteDialog from './bank-transfer-evidence-delete-dialog';
import BankTransferEvidenceDetail from './bank-transfer-evidence-detail';
import BankTransferEvidenceUpdate from './bank-transfer-evidence-update';

const BankTransferEvidenceRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<BankTransferEvidence />} />
    <Route path="new" element={<BankTransferEvidenceUpdate />} />
    <Route path=":id">
      <Route index element={<BankTransferEvidenceDetail />} />
      <Route path="edit" element={<BankTransferEvidenceUpdate />} />
      <Route path="delete" element={<BankTransferEvidenceDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default BankTransferEvidenceRoutes;
