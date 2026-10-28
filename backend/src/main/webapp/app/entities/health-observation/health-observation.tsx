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

import { getEntities } from './health-observation.reducer';

export const HealthObservation = () => {
  const dispatch = useAppDispatch();

  const pageLocation = useLocation();
  const navigate = useNavigate();

  const [sortState, setSortState] = useState(overrideSortStateWithQueryParams(getSortState(pageLocation, 'id'), pageLocation.search));

  const healthObservationList = useAppSelector(state => state.healthObservation.entities);
  const loading = useAppSelector(state => state.healthObservation.loading);

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
      <h2 id="health-observation-heading" data-cy="HealthObservationHeading">
        Health Observations
        <div className="d-flex justify-content-end">
          <Button className="me-2" variant="info" onClick={handleSyncList} disabled={loading}>
            <FontAwesomeIcon icon="sync" spin={loading} /> Refresh list
          </Button>
          <Link
            to="/health-observation/new"
            className="btn btn-primary jh-create-entity"
            id="jh-create-entity"
            data-cy="entityCreateButton"
          >
            <FontAwesomeIcon icon="plus" />
            &nbsp; Thêm mới một Health Observation
          </Link>
        </div>
      </h2>
      <div className="table-responsive">
        {healthObservationList?.length > 0 ? (
          <Table responsive>
            <thead>
              <tr>
                <th className="hand" onClick={sort('id')}>
                  ID <FontAwesomeIcon icon={getSortIconByFieldName('id')} />
                </th>
                <th className="hand" onClick={sort('observedTime')}>
                  Observed Time <FontAwesomeIcon icon={getSortIconByFieldName('observedTime')} />
                </th>
                <th className="hand" onClick={sort('entryTime')}>
                  Entry Time <FontAwesomeIcon icon={getSortIconByFieldName('entryTime')} />
                </th>
                <th className="hand" onClick={sort('signsProgress')}>
                  Signs Progress <FontAwesomeIcon icon={getSortIconByFieldName('signsProgress')} />
                </th>
                <th className="hand" onClick={sort('source')}>
                  Source <FontAwesomeIcon icon={getSortIconByFieldName('source')} />
                </th>
                <th>
                  Health Case <FontAwesomeIcon icon="sort" />
                </th>
                <th>
                  Vaccination <FontAwesomeIcon icon="sort" />
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {healthObservationList.map(healthObservation => (
                <tr key={`entity-${healthObservation.id}`} data-cy="entityTable">
                  <td>
                    <Button as={Link as any} to={`/health-observation/${healthObservation.id}`} variant="link" size="sm">
                      {healthObservation.id}
                    </Button>
                  </td>
                  <td>
                    {healthObservation.observedTime ? (
                      <TextFormat type="date" value={healthObservation.observedTime} format={APP_DATE_FORMAT} />
                    ) : null}
                  </td>
                  <td>
                    {healthObservation.entryTime ? (
                      <TextFormat type="date" value={healthObservation.entryTime} format={APP_DATE_FORMAT} />
                    ) : null}
                  </td>
                  <td>{healthObservation.signsProgress}</td>
                  <td>{healthObservation.source}</td>
                  <td>
                    {healthObservation.healthCase ? (
                      <Link to={`/health-case/${healthObservation.healthCase.id}`}>{healthObservation.healthCase.id}</Link>
                    ) : (
                      ''
                    )}
                  </td>
                  <td>
                    {healthObservation.vaccination ? (
                      <Link to={`/vaccination/${healthObservation.vaccination.id}`}>{healthObservation.vaccination.id}</Link>
                    ) : (
                      ''
                    )}
                  </td>
                  <td className="text-end">
                    <div className="btn-group flex-btn-group-container">
                      <Button
                        as={Link as any}
                        to={`/health-observation/${healthObservation.id}`}
                        variant="info"
                        size="sm"
                        data-cy="entityDetailsButton"
                      >
                        <FontAwesomeIcon icon="eye" /> <span className="d-none d-md-inline">Xem</span>
                      </Button>
                      <Button
                        as={Link as any}
                        to={`/health-observation/${healthObservation.id}/edit`}
                        variant="primary"
                        size="sm"
                        data-cy="entityEditButton"
                      >
                        <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
                      </Button>
                      <Button
                        onClick={() => (globalThis.location.href = `/health-observation/${healthObservation.id}/delete`)}
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
          !loading && <div className="alert alert-warning">No Health Observations found</div>
        )}
      </div>
    </div>
  );
};

export default HealthObservation;
