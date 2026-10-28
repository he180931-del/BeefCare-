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

import { getEntities } from './calving-event.reducer';

export const CalvingEvent = () => {
  const dispatch = useAppDispatch();

  const pageLocation = useLocation();
  const navigate = useNavigate();

  const [sortState, setSortState] = useState(overrideSortStateWithQueryParams(getSortState(pageLocation, 'id'), pageLocation.search));

  const calvingEventList = useAppSelector(state => state.calvingEvent.entities);
  const loading = useAppSelector(state => state.calvingEvent.loading);

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
      <h2 id="calving-event-heading" data-cy="CalvingEventHeading">
        Calving Events
        <div className="d-flex justify-content-end">
          <Button className="me-2" variant="info" onClick={handleSyncList} disabled={loading}>
            <FontAwesomeIcon icon="sync" spin={loading} /> Refresh list
          </Button>
          <Link to="/calving-event/new" className="btn btn-primary jh-create-entity" id="jh-create-entity" data-cy="entityCreateButton">
            <FontAwesomeIcon icon="plus" />
            &nbsp; Thêm mới một Calving Event
          </Link>
        </div>
      </h2>
      <div className="table-responsive">
        {calvingEventList?.length > 0 ? (
          <Table responsive>
            <thead>
              <tr>
                <th className="hand" onClick={sort('id')}>
                  ID <FontAwesomeIcon icon={getSortIconByFieldName('id')} />
                </th>
                <th className="hand" onClick={sort('birthTime')}>
                  Birth Time <FontAwesomeIcon icon={getSortIconByFieldName('birthTime')} />
                </th>
                <th className="hand" onClick={sort('course')}>
                  Course <FontAwesomeIcon icon={getSortIconByFieldName('course')} />
                </th>
                <th className="hand" onClick={sort('damCondition')}>
                  Dam Condition <FontAwesomeIcon icon={getSortIconByFieldName('damCondition')} />
                </th>
                <th>
                  Dam <FontAwesomeIcon icon="sort" />
                </th>
                <th>
                  Episode <FontAwesomeIcon icon="sort" />
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {calvingEventList.map(calvingEvent => (
                <tr key={`entity-${calvingEvent.id}`} data-cy="entityTable">
                  <td>
                    <Button as={Link as any} to={`/calving-event/${calvingEvent.id}`} variant="link" size="sm">
                      {calvingEvent.id}
                    </Button>
                  </td>
                  <td>
                    {calvingEvent.birthTime ? <TextFormat type="date" value={calvingEvent.birthTime} format={APP_DATE_FORMAT} /> : null}
                  </td>
                  <td>{calvingEvent.course}</td>
                  <td>{calvingEvent.damCondition}</td>
                  <td>{calvingEvent.dam ? <Link to={`/cattle/${calvingEvent.dam.id}`}>{calvingEvent.dam.id}</Link> : ''}</td>
                  <td>
                    {calvingEvent.episode ? (
                      <Link to={`/pregnancy-episode/${calvingEvent.episode.id}`}>{calvingEvent.episode.id}</Link>
                    ) : (
                      ''
                    )}
                  </td>
                  <td className="text-end">
                    <div className="btn-group flex-btn-group-container">
                      <Button
                        as={Link as any}
                        to={`/calving-event/${calvingEvent.id}`}
                        variant="info"
                        size="sm"
                        data-cy="entityDetailsButton"
                      >
                        <FontAwesomeIcon icon="eye" /> <span className="d-none d-md-inline">Xem</span>
                      </Button>
                      <Button
                        as={Link as any}
                        to={`/calving-event/${calvingEvent.id}/edit`}
                        variant="primary"
                        size="sm"
                        data-cy="entityEditButton"
                      >
                        <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
                      </Button>
                      <Button
                        onClick={() => (globalThis.location.href = `/calving-event/${calvingEvent.id}/delete`)}
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
          !loading && <div className="alert alert-warning">No Calving Events found</div>
        )}
      </div>
    </div>
  );
};

export default CalvingEvent;
