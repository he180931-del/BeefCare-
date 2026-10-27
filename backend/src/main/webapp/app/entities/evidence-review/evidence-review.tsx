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

import { getEntities } from './evidence-review.reducer';

export const EvidenceReview = () => {
  const dispatch = useAppDispatch();

  const pageLocation = useLocation();
  const navigate = useNavigate();

  const [sortState, setSortState] = useState(overrideSortStateWithQueryParams(getSortState(pageLocation, 'id'), pageLocation.search));

  const evidenceReviewList = useAppSelector(state => state.evidenceReview.entities);
  const loading = useAppSelector(state => state.evidenceReview.loading);

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
      <h2 id="evidence-review-heading" data-cy="EvidenceReviewHeading">
        Evidence Reviews
        <div className="d-flex justify-content-end">
          <Button className="me-2" variant="info" onClick={handleSyncList} disabled={loading}>
            <FontAwesomeIcon icon="sync" spin={loading} /> Refresh list
          </Button>
          <Link to="/evidence-review/new" className="btn btn-primary jh-create-entity" id="jh-create-entity" data-cy="entityCreateButton">
            <FontAwesomeIcon icon="plus" />
            &nbsp; Thêm mới một Evidence Review
          </Link>
        </div>
      </h2>
      <div className="table-responsive">
        {evidenceReviewList?.length > 0 ? (
          <Table responsive>
            <thead>
              <tr>
                <th className="hand" onClick={sort('id')}>
                  ID <FontAwesomeIcon icon={getSortIconByFieldName('id')} />
                </th>
                <th className="hand" onClick={sort('decision')}>
                  Decision <FontAwesomeIcon icon={getSortIconByFieldName('decision')} />
                </th>
                <th className="hand" onClick={sort('reason')}>
                  Reason <FontAwesomeIcon icon={getSortIconByFieldName('reason')} />
                </th>
                <th className="hand" onClick={sort('reviewedAt')}>
                  Reviewed At <FontAwesomeIcon icon={getSortIconByFieldName('reviewedAt')} />
                </th>
                <th>
                  Evidence <FontAwesomeIcon icon="sort" />
                </th>
                <th>
                  Pm User <FontAwesomeIcon icon="sort" />
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {evidenceReviewList.map(evidenceReview => (
                <tr key={`entity-${evidenceReview.id}`} data-cy="entityTable">
                  <td>
                    <Button as={Link as any} to={`/evidence-review/${evidenceReview.id}`} variant="link" size="sm">
                      {evidenceReview.id}
                    </Button>
                  </td>
                  <td>{evidenceReview.decision}</td>
                  <td>{evidenceReview.reason}</td>
                  <td>
                    {evidenceReview.reviewedAt ? (
                      <TextFormat type="date" value={evidenceReview.reviewedAt} format={APP_DATE_FORMAT} />
                    ) : null}
                  </td>
                  <td>
                    {evidenceReview.evidence ? (
                      <Link to={`/bank-transfer-evidence/${evidenceReview.evidence.id}`}>{evidenceReview.evidence.id}</Link>
                    ) : (
                      ''
                    )}
                  </td>
                  <td>
                    {evidenceReview.pmUser ? <Link to={`/app-user/${evidenceReview.pmUser.id}`}>{evidenceReview.pmUser.id}</Link> : ''}
                  </td>
                  <td className="text-end">
                    <div className="btn-group flex-btn-group-container">
                      <Button
                        as={Link as any}
                        to={`/evidence-review/${evidenceReview.id}`}
                        variant="info"
                        size="sm"
                        data-cy="entityDetailsButton"
                      >
                        <FontAwesomeIcon icon="eye" /> <span className="d-none d-md-inline">Xem</span>
                      </Button>
                      <Button
                        as={Link as any}
                        to={`/evidence-review/${evidenceReview.id}/edit`}
                        variant="primary"
                        size="sm"
                        data-cy="entityEditButton"
                      >
                        <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
                      </Button>
                      <Button
                        onClick={() => (globalThis.location.href = `/evidence-review/${evidenceReview.id}/delete`)}
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
          !loading && <div className="alert alert-warning">No Evidence Reviews found</div>
        )}
      </div>
    </div>
  );
};

export default EvidenceReview;
