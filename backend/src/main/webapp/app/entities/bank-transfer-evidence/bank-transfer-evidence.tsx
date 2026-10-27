import React, { useEffect, useState } from 'react';
import { Button, Table } from 'react-bootstrap';
import { TextFormat, getSortState } from 'react-jhipster';
import { Link, useLocation, useNavigate } from 'react-router';

import { faSort, faSortDown, faSortUp } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';
import { overrideSortStateWithQueryParams } from 'app/shared/util/entity-utils';
import { ASC, DESC } from 'app/shared/util/pagination.constants';

import { getEntities } from './bank-transfer-evidence.reducer';

export const BankTransferEvidence = () => {
  const dispatch = useAppDispatch();

  const pageLocation = useLocation();
  const navigate = useNavigate();

  const [sortState, setSortState] = useState(overrideSortStateWithQueryParams(getSortState(pageLocation, 'id'), pageLocation.search));

  const bankTransferEvidenceList = useAppSelector(state => state.bankTransferEvidence.entities);
  const loading = useAppSelector(state => state.bankTransferEvidence.loading);

  const getAllEntities = () => {
    dispatch(
      getEntities({
        sort: `${sortState.sort},${sortState.order}`,
      }),
    );
  };

  const sortEntities = () => {
    getAllEntities();
    const endURL = `?sort=${sortState.sort},${sortState.order}`;
    if (pageLocation.search !== endURL) {
      navigate(`${pageLocation.pathname}${endURL}`);
    }
  };

  useEffect(() => {
    sortEntities();
  }, [sortState.order, sortState.sort]);

  const sort = p => () => {
    setSortState({
      ...sortState,
      order: sortState.order === ASC ? DESC : ASC,
      sort: p,
    });
  };

  const handleSyncList = () => {
    sortEntities();
  };

  const getSortIconByFieldName = (fieldName: string) => {
    const sortFieldName = sortState.sort;
    const { order } = sortState;
    if (sortFieldName !== fieldName) {
      return faSort;
    }
    return order === ASC ? faSortUp : faSortDown;
  };

  return (
    <div>
      <h2 id="bank-transfer-evidence-heading" data-cy="BankTransferEvidenceHeading">
        Bank Transfer Evidences
        <div className="d-flex justify-content-end">
          <Button className="me-2" variant="info" onClick={handleSyncList} disabled={loading}>
            <FontAwesomeIcon icon="sync" spin={loading} /> Refresh list
          </Button>
          <Link
            to="/bank-transfer-evidence/new"
            className="btn btn-primary jh-create-entity"
            id="jh-create-entity"
            data-cy="entityCreateButton"
          >
            <FontAwesomeIcon icon="plus" />
            &nbsp; Thêm mới một Bank Transfer Evidence
          </Link>
        </div>
      </h2>
      <div className="table-responsive">
        {bankTransferEvidenceList?.length > 0 ? (
          <Table responsive>
            <thead>
              <tr>
                <th className="hand" onClick={sort('id')}>
                  ID <FontAwesomeIcon icon={getSortIconByFieldName('id')} />
                </th>
                <th className="hand" onClick={sort('providerTxnId')}>
                  Provider Txn Id <FontAwesomeIcon icon={getSortIconByFieldName('providerTxnId')} />
                </th>
                <th className="hand" onClick={sort('amount')}>
                  Amount <FontAwesomeIcon icon={getSortIconByFieldName('amount')} />
                </th>
                <th className="hand" onClick={sort('bankPaidAt')}>
                  Bank Paid At <FontAwesomeIcon icon={getSortIconByFieldName('bankPaidAt')} />
                </th>
                <th className="hand" onClick={sort('quoteRef')}>
                  Quote Ref <FontAwesomeIcon icon={getSortIconByFieldName('quoteRef')} />
                </th>
                <th className="hand" onClick={sort('deliveryOutcome')}>
                  Delivery Outcome <FontAwesomeIcon icon={getSortIconByFieldName('deliveryOutcome')} />
                </th>
                <th className="hand" onClick={sort('authOutcome')}>
                  Auth Outcome <FontAwesomeIcon icon={getSortIconByFieldName('authOutcome')} />
                </th>
                <th>
                  Payment <FontAwesomeIcon icon="sort" />
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {bankTransferEvidenceList.map(bankTransferEvidence => (
                <tr key={`entity-${bankTransferEvidence.id}`} data-cy="entityTable">
                  <td>
                    <Button as={Link as any} to={`/bank-transfer-evidence/${bankTransferEvidence.id}`} variant="link" size="sm">
                      {bankTransferEvidence.id}
                    </Button>
                  </td>
                  <td>{bankTransferEvidence.providerTxnId}</td>
                  <td>{bankTransferEvidence.amount}</td>
                  <td>
                    {bankTransferEvidence.bankPaidAt ? (
                      <TextFormat type="date" value={bankTransferEvidence.bankPaidAt} format={APP_DATE_FORMAT} />
                    ) : null}
                  </td>
                  <td>{bankTransferEvidence.quoteRef}</td>
                  <td>{bankTransferEvidence.deliveryOutcome}</td>
                  <td>{bankTransferEvidence.authOutcome}</td>
                  <td>
                    {bankTransferEvidence.payment ? (
                      <Link to={`/payment/${bankTransferEvidence.payment.id}`}>{bankTransferEvidence.payment.id}</Link>
                    ) : (
                      ''
                    )}
                  </td>
                  <td className="text-end">
                    <div className="btn-group flex-btn-group-container">
                      <Button
                        as={Link as any}
                        to={`/bank-transfer-evidence/${bankTransferEvidence.id}`}
                        variant="info"
                        size="sm"
                        data-cy="entityDetailsButton"
                      >
                        <FontAwesomeIcon icon="eye" /> <span className="d-none d-md-inline">Xem</span>
                      </Button>
                      <Button
                        as={Link as any}
                        to={`/bank-transfer-evidence/${bankTransferEvidence.id}/edit`}
                        variant="primary"
                        size="sm"
                        data-cy="entityEditButton"
                      >
                        <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
                      </Button>
                      <Button
                        onClick={() => (globalThis.location.href = `/bank-transfer-evidence/${bankTransferEvidence.id}/delete`)}
                        variant="danger"
                        size="sm"
                        data-cy="entityDeleteButton"
                      >
                        <FontAwesomeIcon icon="trash" /> <span className="d-none d-md-inline">Xóa</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          !loading && <div className="alert alert-warning">No Bank Transfer Evidences found</div>
        )}
      </div>
    </div>
  );
};

export default BankTransferEvidence;
