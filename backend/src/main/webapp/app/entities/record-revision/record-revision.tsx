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

import { getEntities } from './record-revision.reducer';

export const RecordRevision = () => {
  const dispatch = useAppDispatch();

  const pageLocation = useLocation();
  const navigate = useNavigate();

  const [sortState, setSortState] = useState(overrideSortStateWithQueryParams(getSortState(pageLocation, 'id'), pageLocation.search));

  const recordRevisionList = useAppSelector(state => state.recordRevision.entities);
  const loading = useAppSelector(state => state.recordRevision.loading);

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
      <h2 id="record-revision-heading" data-cy="RecordRevisionHeading">
        Record Revisions
        <div className="d-flex justify-content-end">
          <Button className="me-2" variant="info" onClick={handleSyncList} disabled={loading}>
            <FontAwesomeIcon icon="sync" spin={loading} /> Refresh list
          </Button>
          <Link to="/record-revision/new" className="btn btn-primary jh-create-entity" id="jh-create-entity" data-cy="entityCreateButton">
            <FontAwesomeIcon icon="plus" />
            &nbsp; Thêm mới một Record Revision
          </Link>
        </div>
      </h2>
      <div className="table-responsive">
        {recordRevisionList?.length > 0 ? (
          <Table responsive>
            <thead>
              <tr>
                <th className="hand" onClick={sort('id')}>
                  ID <FontAwesomeIcon icon={getSortIconByFieldName('id')} />
                </th>
                <th className="hand" onClick={sort('sourceType')}>
                  Source Type <FontAwesomeIcon icon={getSortIconByFieldName('sourceType')} />
                </th>
                <th className="hand" onClick={sort('sourceId')}>
                  Source Id <FontAwesomeIcon icon={getSortIconByFieldName('sourceId')} />
                </th>
                <th className="hand" onClick={sort('action')}>
                  Action <FontAwesomeIcon icon={getSortIconByFieldName('action')} />
                </th>
                <th className="hand" onClick={sort('reason')}>
                  Reason <FontAwesomeIcon icon={getSortIconByFieldName('reason')} />
                </th>
                <th className="hand" onClick={sort('beforeSnapshot')}>
                  Before Snapshot <FontAwesomeIcon icon={getSortIconByFieldName('beforeSnapshot')} />
                </th>
                <th className="hand" onClick={sort('afterSnapshot')}>
                  After Snapshot <FontAwesomeIcon icon={getSortIconByFieldName('afterSnapshot')} />
                </th>
                <th className="hand" onClick={sort('changedAt')}>
                  Changed At <FontAwesomeIcon icon={getSortIconByFieldName('changedAt')} />
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {recordRevisionList.map(recordRevision => (
                <tr key={`entity-${recordRevision.id}`} data-cy="entityTable">
                  <td>
                    <Button as={Link as any} to={`/record-revision/${recordRevision.id}`} variant="link" size="sm">
                      {recordRevision.id}
                    </Button>
                  </td>
                  <td>{recordRevision.sourceType}</td>
                  <td>{recordRevision.sourceId}</td>
                  <td>{recordRevision.action}</td>
                  <td>{recordRevision.reason}</td>
                  <td>{recordRevision.beforeSnapshot}</td>
                  <td>{recordRevision.afterSnapshot}</td>
                  <td>
                    {recordRevision.changedAt ? <TextFormat type="date" value={recordRevision.changedAt} format={APP_DATE_FORMAT} /> : null}
                  </td>
                  <td className="text-end">
                    <div className="btn-group flex-btn-group-container">
                      <Button
                        as={Link as any}
                        to={`/record-revision/${recordRevision.id}`}
                        variant="info"
                        size="sm"
                        data-cy="entityDetailsButton"
                      >
                        <FontAwesomeIcon icon="eye" /> <span className="d-none d-md-inline">Xem</span>
                      </Button>
                      <Button
                        as={Link as any}
                        to={`/record-revision/${recordRevision.id}/edit`}
                        variant="primary"
                        size="sm"
                        data-cy="entityEditButton"
                      >
                        <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
                      </Button>
                      <Button
                        onClick={() => (globalThis.location.href = `/record-revision/${recordRevision.id}/delete`)}
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
          !loading && <div className="alert alert-warning">No Record Revisions found</div>
        )}
      </div>
    </div>
  );
};

export default RecordRevision;
