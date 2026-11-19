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

import { getEntities } from './support-history.reducer';

export const SupportHistory = () => {
  const dispatch = useAppDispatch();

  const pageLocation = useLocation();
  const navigate = useNavigate();

  const [sortState, setSortState] = useState(overrideSortStateWithQueryParams(getSortState(pageLocation, 'id'), pageLocation.search));

  const supportHistoryList = useAppSelector(state => state.supportHistory.entities);
  const loading = useAppSelector(state => state.supportHistory.loading);

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
      <h2 id="support-history-heading" data-cy="SupportHistoryHeading">
        Support Histories
        <div className="d-flex justify-content-end">
          <Button className="me-2" variant="info" onClick={handleSyncList} disabled={loading}>
            <FontAwesomeIcon icon="sync" spin={loading} /> Refresh list
          </Button>
          <Link to="/support-history/new" className="btn btn-primary jh-create-entity" id="jh-create-entity" data-cy="entityCreateButton">
            <FontAwesomeIcon icon="plus" />
            &nbsp; Thêm mới một Support History
          </Link>
        </div>
      </h2>
      <div className="table-responsive">
        {supportHistoryList?.length > 0 ? (
          <Table responsive>
            <thead>
              <tr>
                <th className="hand" onClick={sort('id')}>
                  ID <FontAwesomeIcon icon={getSortIconByFieldName('id')} />
                </th>
                <th className="hand" onClick={sort('eventType')}>
                  Event Type <FontAwesomeIcon icon={getSortIconByFieldName('eventType')} />
                </th>
                <th className="hand" onClick={sort('priorState')}>
                  Prior State <FontAwesomeIcon icon={getSortIconByFieldName('priorState')} />
                </th>
                <th className="hand" onClick={sort('newState')}>
                  New State <FontAwesomeIcon icon={getSortIconByFieldName('newState')} />
                </th>
                <th className="hand" onClick={sort('occurredAt')}>
                  Occurred At <FontAwesomeIcon icon={getSortIconByFieldName('occurredAt')} />
                </th>
                <th>
                  Ticket <FontAwesomeIcon icon="sort" />
                </th>
                <th>
                  Actor <FontAwesomeIcon icon="sort" />
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {supportHistoryList.map(supportHistory => (
                <tr key={`entity-${supportHistory.id}`} data-cy="entityTable">
                  <td>
                    <Button as={Link as any} to={`/support-history/${supportHistory.id}`} variant="link" size="sm">
                      {supportHistory.id}
                    </Button>
                  </td>
                  <td>{supportHistory.eventType}</td>
                  <td>{supportHistory.priorState}</td>
                  <td>{supportHistory.newState}</td>
                  <td>
                    {supportHistory.occurredAt ? (
                      <TextFormat type="date" value={supportHistory.occurredAt} format={APP_DATE_FORMAT} />
                    ) : null}
                  </td>
                  <td>
                    {supportHistory.ticket ? (
                      <Link to={`/support-ticket/${supportHistory.ticket.id}`}>{supportHistory.ticket.id}</Link>
                    ) : (
                      ''
                    )}
                  </td>
                  <td>{supportHistory.actor ? <Link to={`/app-user/${supportHistory.actor.id}`}>{supportHistory.actor.id}</Link> : ''}</td>
                  <td className="text-end">
                    <div className="btn-group flex-btn-group-container">
                      <Button
                        as={Link as any}
                        to={`/support-history/${supportHistory.id}`}
                        variant="info"
                        size="sm"
                        data-cy="entityDetailsButton"
                      >
                        <FontAwesomeIcon icon="eye" /> <span className="d-none d-md-inline">Xem</span>
                      </Button>
                      <Button
                        as={Link as any}
                        to={`/support-history/${supportHistory.id}/edit`}
                        variant="primary"
                        size="sm"
                        data-cy="entityEditButton"
                      >
                        <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
                      </Button>
                      <Button
                        onClick={() => (globalThis.location.href = `/support-history/${supportHistory.id}/delete`)}
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
          !loading && <div className="alert alert-warning">No Support Histories found</div>
        )}
      </div>
    </div>
  );
};

export default SupportHistory;
