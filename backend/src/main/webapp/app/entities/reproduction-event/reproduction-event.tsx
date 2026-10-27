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

import { getEntities } from './reproduction-event.reducer';

export const ReproductionEvent = () => {
  const dispatch = useAppDispatch();

  const pageLocation = useLocation();
  const navigate = useNavigate();

  const [sortState, setSortState] = useState(overrideSortStateWithQueryParams(getSortState(pageLocation, 'id'), pageLocation.search));

  const reproductionEventList = useAppSelector(state => state.reproductionEvent.entities);
  const loading = useAppSelector(state => state.reproductionEvent.loading);

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
      <h2 id="reproduction-event-heading" data-cy="ReproductionEventHeading">
        Reproduction Events
        <div className="d-flex justify-content-end">
          <Button className="me-2" variant="info" onClick={handleSyncList} disabled={loading}>
            <FontAwesomeIcon icon="sync" spin={loading} /> Refresh list
          </Button>
          <Link
            to="/reproduction-event/new"
            className="btn btn-primary jh-create-entity"
            id="jh-create-entity"
            data-cy="entityCreateButton"
          >
            <FontAwesomeIcon icon="plus" />
            &nbsp; Thêm mới một Reproduction Event
          </Link>
        </div>
      </h2>
      <div className="table-responsive">
        {reproductionEventList?.length > 0 ? (
          <Table responsive>
            <thead>
              <tr>
                <th className="hand" onClick={sort('id')}>
                  ID <FontAwesomeIcon icon={getSortIconByFieldName('id')} />
                </th>
                <th className="hand" onClick={sort('type')}>
                  Type <FontAwesomeIcon icon={getSortIconByFieldName('type')} />
                </th>
                <th className="hand" onClick={sort('eventTime')}>
                  Event Time <FontAwesomeIcon icon={getSortIconByFieldName('eventTime')} />
                </th>
                <th className="hand" onClick={sort('method')}>
                  Method <FontAwesomeIcon icon={getSortIconByFieldName('method')} />
                </th>
                <th className="hand" onClick={sort('result')}>
                  Result <FontAwesomeIcon icon={getSortIconByFieldName('result')} />
                </th>
                <th className="hand" onClick={sort('source')}>
                  Source <FontAwesomeIcon icon={getSortIconByFieldName('source')} />
                </th>
                <th>
                  Cattle <FontAwesomeIcon icon="sort" />
                </th>
                <th>
                  Linked Event <FontAwesomeIcon icon="sort" />
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {reproductionEventList.map(reproductionEvent => (
                <tr key={`entity-${reproductionEvent.id}`} data-cy="entityTable">
                  <td>
                    <Button as={Link as any} to={`/reproduction-event/${reproductionEvent.id}`} variant="link" size="sm">
                      {reproductionEvent.id}
                    </Button>
                  </td>
                  <td>{reproductionEvent.type}</td>
                  <td>
                    {reproductionEvent.eventTime ? (
                      <TextFormat type="date" value={reproductionEvent.eventTime} format={APP_DATE_FORMAT} />
                    ) : null}
                  </td>
                  <td>{reproductionEvent.method}</td>
                  <td>{reproductionEvent.result}</td>
                  <td>{reproductionEvent.source}</td>
                  <td>
                    {reproductionEvent.cattle ? (
                      <Link to={`/cattle/${reproductionEvent.cattle.id}`}>{reproductionEvent.cattle.id}</Link>
                    ) : (
                      ''
                    )}
                  </td>
                  <td>
                    {reproductionEvent.linkedEvent ? (
                      <Link to={`/reproduction-event/${reproductionEvent.linkedEvent.id}`}>{reproductionEvent.linkedEvent.id}</Link>
                    ) : (
                      ''
                    )}
                  </td>
                  <td className="text-end">
                    <div className="btn-group flex-btn-group-container">
                      <Button
                        as={Link as any}
                        to={`/reproduction-event/${reproductionEvent.id}`}
                        variant="info"
                        size="sm"
                        data-cy="entityDetailsButton"
                      >
                        <FontAwesomeIcon icon="eye" /> <span className="d-none d-md-inline">Xem</span>
                      </Button>
                      <Button
                        as={Link as any}
                        to={`/reproduction-event/${reproductionEvent.id}/edit`}
                        variant="primary"
                        size="sm"
                        data-cy="entityEditButton"
                      >
                        <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
                      </Button>
                      <Button
                        onClick={() => (globalThis.location.href = `/reproduction-event/${reproductionEvent.id}/delete`)}
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
          !loading && <div className="alert alert-warning">No Reproduction Events found</div>
        )}
      </div>
    </div>
  );
};

export default ReproductionEvent;
