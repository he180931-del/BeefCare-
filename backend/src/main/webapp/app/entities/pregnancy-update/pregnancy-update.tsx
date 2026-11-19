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

import { getEntities } from './pregnancy-update.reducer';

export const PregnancyUpdate = () => {
  const dispatch = useAppDispatch();

  const pageLocation = useLocation();
  const navigate = useNavigate();

  const [sortState, setSortState] = useState(overrideSortStateWithQueryParams(getSortState(pageLocation, 'id'), pageLocation.search));

  const pregnancyUpdateList = useAppSelector(state => state.pregnancyUpdate.entities);
  const loading = useAppSelector(state => state.pregnancyUpdate.loading);

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
      <h2 id="pregnancy-update-heading" data-cy="PregnancyUpdateHeading">
        Pregnancy Updates
        <div className="d-flex justify-content-end">
          <Button className="me-2" variant="info" onClick={handleSyncList} disabled={loading}>
            <FontAwesomeIcon icon="sync" spin={loading} /> Refresh list
          </Button>
          <Link to="/pregnancy-update/new" className="btn btn-primary jh-create-entity" id="jh-create-entity" data-cy="entityCreateButton">
            <FontAwesomeIcon icon="plus" />
            &nbsp; Thêm mới một Pregnancy Update
          </Link>
        </div>
      </h2>
      <div className="table-responsive">
        {pregnancyUpdateList?.length > 0 ? (
          <Table responsive>
            <thead>
              <tr>
                <th className="hand" onClick={sort('id')}>
                  ID <FontAwesomeIcon icon={getSortIconByFieldName('id')} />
                </th>
                <th className="hand" onClick={sort('type')}>
                  Type <FontAwesomeIcon icon={getSortIconByFieldName('type')} />
                </th>
                <th className="hand" onClick={sort('occurredTime')}>
                  Occurred Time <FontAwesomeIcon icon={getSortIconByFieldName('occurredTime')} />
                </th>
                <th className="hand" onClick={sort('details')}>
                  Details <FontAwesomeIcon icon={getSortIconByFieldName('details')} />
                </th>
                <th>
                  Episode <FontAwesomeIcon icon="sort" />
                </th>
                <th>
                  Health Case <FontAwesomeIcon icon="sort" />
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pregnancyUpdateList.map(pregnancyUpdate => (
                <tr key={`entity-${pregnancyUpdate.id}`} data-cy="entityTable">
                  <td>
                    <Button as={Link as any} to={`/pregnancy-update/${pregnancyUpdate.id}`} variant="link" size="sm">
                      {pregnancyUpdate.id}
                    </Button>
                  </td>
                  <td>{pregnancyUpdate.type}</td>
                  <td>
                    {pregnancyUpdate.occurredTime ? (
                      <TextFormat type="date" value={pregnancyUpdate.occurredTime} format={APP_DATE_FORMAT} />
                    ) : null}
                  </td>
                  <td>{pregnancyUpdate.details}</td>
                  <td>
                    {pregnancyUpdate.episode ? (
                      <Link to={`/pregnancy-episode/${pregnancyUpdate.episode.id}`}>{pregnancyUpdate.episode.id}</Link>
                    ) : (
                      ''
                    )}
                  </td>
                  <td>
                    {pregnancyUpdate.healthCase ? (
                      <Link to={`/health-case/${pregnancyUpdate.healthCase.id}`}>{pregnancyUpdate.healthCase.id}</Link>
                    ) : (
                      ''
                    )}
                  </td>
                  <td className="text-end">
                    <div className="btn-group flex-btn-group-container">
                      <Button
                        as={Link as any}
                        to={`/pregnancy-update/${pregnancyUpdate.id}`}
                        variant="info"
                        size="sm"
                        data-cy="entityDetailsButton"
                      >
                        <FontAwesomeIcon icon="eye" /> <span className="d-none d-md-inline">Xem</span>
                      </Button>
                      <Button
                        as={Link as any}
                        to={`/pregnancy-update/${pregnancyUpdate.id}/edit`}
                        variant="primary"
                        size="sm"
                        data-cy="entityEditButton"
                      >
                        <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
                      </Button>
                      <Button
                        onClick={() => (globalThis.location.href = `/pregnancy-update/${pregnancyUpdate.id}/delete`)}
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
          !loading && <div className="alert alert-warning">No Pregnancy Updates found</div>
        )}
      </div>
    </div>
  );
};

export default PregnancyUpdate;
