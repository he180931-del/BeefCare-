import React, { useEffect, useState } from 'react';
import { Button, Table } from 'react-bootstrap';
import { getSortState } from 'react-jhipster';
import { Link, useLocation, useNavigate } from 'react-router';

import { faSort, faSortDown, faSortUp } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { overrideSortStateWithQueryParams } from 'app/shared/util/entity-utils';
import { ASC, DESC } from 'app/shared/util/pagination.constants';

import { getEntities } from './internal-request.reducer';

export const InternalRequest = () => {
  const dispatch = useAppDispatch();

  const pageLocation = useLocation();
  const navigate = useNavigate();

  const [sortState, setSortState] = useState(overrideSortStateWithQueryParams(getSortState(pageLocation, 'id'), pageLocation.search));

  const internalRequestList = useAppSelector(state => state.internalRequest.entities);
  const loading = useAppSelector(state => state.internalRequest.loading);

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
      <h2 id="internal-request-heading" data-cy="InternalRequestHeading">
        Internal Requests
        <div className="d-flex justify-content-end">
          <Button className="me-2" variant="info" onClick={handleSyncList} disabled={loading}>
            <FontAwesomeIcon icon="sync" spin={loading} /> Refresh list
          </Button>
          <Link to="/internal-request/new" className="btn btn-primary jh-create-entity" id="jh-create-entity" data-cy="entityCreateButton">
            <FontAwesomeIcon icon="plus" />
            &nbsp; Thêm mới một Internal Request
          </Link>
        </div>
      </h2>
      <div className="table-responsive">
        {internalRequestList?.length > 0 ? (
          <Table responsive>
            <thead>
              <tr>
                <th className="hand" onClick={sort('id')}>
                  ID <FontAwesomeIcon icon={getSortIconByFieldName('id')} />
                </th>
                <th className="hand" onClick={sort('targetRole')}>
                  Target Role <FontAwesomeIcon icon={getSortIconByFieldName('targetRole')} />
                </th>
                <th className="hand" onClick={sort('state')}>
                  State <FontAwesomeIcon icon={getSortIconByFieldName('state')} />
                </th>
                <th className="hand" onClick={sort('outcome')}>
                  Outcome <FontAwesomeIcon icon={getSortIconByFieldName('outcome')} />
                </th>
                <th>
                  Ticket <FontAwesomeIcon icon="sort" />
                </th>
                <th>
                  Recipient <FontAwesomeIcon icon="sort" />
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {internalRequestList.map(internalRequest => (
                <tr key={`entity-${internalRequest.id}`} data-cy="entityTable">
                  <td>
                    <Button as={Link as any} to={`/internal-request/${internalRequest.id}`} variant="link" size="sm">
                      {internalRequest.id}
                    </Button>
                  </td>
                  <td>{internalRequest.targetRole}</td>
                  <td>{internalRequest.state}</td>
                  <td>{internalRequest.outcome}</td>
                  <td>
                    {internalRequest.ticket ? (
                      <Link to={`/support-ticket/${internalRequest.ticket.id}`}>{internalRequest.ticket.id}</Link>
                    ) : (
                      ''
                    )}
                  </td>
                  <td>
                    {internalRequest.recipient ? (
                      <Link to={`/app-user/${internalRequest.recipient.id}`}>{internalRequest.recipient.id}</Link>
                    ) : (
                      ''
                    )}
                  </td>
                  <td className="text-end">
                    <div className="btn-group flex-btn-group-container">
                      <Button
                        as={Link as any}
                        to={`/internal-request/${internalRequest.id}`}
                        variant="info"
                        size="sm"
                        data-cy="entityDetailsButton"
                      >
                        <FontAwesomeIcon icon="eye" /> <span className="d-none d-md-inline">Xem</span>
                      </Button>
                      <Button
                        as={Link as any}
                        to={`/internal-request/${internalRequest.id}/edit`}
                        variant="primary"
                        size="sm"
                        data-cy="entityEditButton"
                      >
                        <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
                      </Button>
                      <Button
                        onClick={() => (globalThis.location.href = `/internal-request/${internalRequest.id}/delete`)}
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
          !loading && <div className="alert alert-warning">No Internal Requests found</div>
        )}
      </div>
    </div>
  );
};

export default InternalRequest;
