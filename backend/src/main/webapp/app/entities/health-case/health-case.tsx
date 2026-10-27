import React, { useEffect, useState } from 'react';
import { Button, Table } from 'react-bootstrap';
import { TextFormat, getSortState } from 'react-jhipster';
import { Link, useLocation, useNavigate } from 'react-router';

import { faSort, faSortDown, faSortUp } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_LOCAL_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';
import { overrideSortStateWithQueryParams } from 'app/shared/util/entity-utils';
import { ASC, DESC } from 'app/shared/util/pagination.constants';

import { getEntities } from './health-case.reducer';

export const HealthCase = () => {
  const dispatch = useAppDispatch();

  const pageLocation = useLocation();
  const navigate = useNavigate();

  const [sortState, setSortState] = useState(overrideSortStateWithQueryParams(getSortState(pageLocation, 'id'), pageLocation.search));

  const healthCaseList = useAppSelector(state => state.healthCase.entities);
  const loading = useAppSelector(state => state.healthCase.loading);

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
      <h2 id="health-case-heading" data-cy="HealthCaseHeading">
        Health Cases
        <div className="d-flex justify-content-end">
          <Button className="me-2" variant="info" onClick={handleSyncList} disabled={loading}>
            <FontAwesomeIcon icon="sync" spin={loading} /> Refresh list
          </Button>
          <Link to="/health-case/new" className="btn btn-primary jh-create-entity" id="jh-create-entity" data-cy="entityCreateButton">
            <FontAwesomeIcon icon="plus" />
            &nbsp; Thêm mới một Health Case
          </Link>
        </div>
      </h2>
      <div className="table-responsive">
        {healthCaseList?.length > 0 ? (
          <Table responsive>
            <thead>
              <tr>
                <th className="hand" onClick={sort('id')}>
                  ID <FontAwesomeIcon icon={getSortIconByFieldName('id')} />
                </th>
                <th className="hand" onClick={sort('openedDate')}>
                  Opened Date <FontAwesomeIcon icon={getSortIconByFieldName('openedDate')} />
                </th>
                <th className="hand" onClick={sort('status')}>
                  Status <FontAwesomeIcon icon={getSortIconByFieldName('status')} />
                </th>
                <th className="hand" onClick={sort('outcome')}>
                  Outcome <FontAwesomeIcon icon={getSortIconByFieldName('outcome')} />
                </th>
                <th className="hand" onClick={sort('closedDate')}>
                  Closed Date <FontAwesomeIcon icon={getSortIconByFieldName('closedDate')} />
                </th>
                <th>
                  Cattle <FontAwesomeIcon icon="sort" />
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {healthCaseList.map(healthCase => (
                <tr key={`entity-${healthCase.id}`} data-cy="entityTable">
                  <td>
                    <Button as={Link as any} to={`/health-case/${healthCase.id}`} variant="link" size="sm">
                      {healthCase.id}
                    </Button>
                  </td>
                  <td>
                    {healthCase.openedDate ? <TextFormat type="date" value={healthCase.openedDate} format={APP_LOCAL_DATE_FORMAT} /> : null}
                  </td>
                  <td>{healthCase.status}</td>
                  <td>{healthCase.outcome}</td>
                  <td>
                    {healthCase.closedDate ? <TextFormat type="date" value={healthCase.closedDate} format={APP_LOCAL_DATE_FORMAT} /> : null}
                  </td>
                  <td>{healthCase.cattle ? <Link to={`/cattle/${healthCase.cattle.id}`}>{healthCase.cattle.id}</Link> : ''}</td>
                  <td className="text-end">
                    <div className="btn-group flex-btn-group-container">
                      <Button as={Link as any} to={`/health-case/${healthCase.id}`} variant="info" size="sm" data-cy="entityDetailsButton">
                        <FontAwesomeIcon icon="eye" /> <span className="d-none d-md-inline">Xem</span>
                      </Button>
                      <Button
                        as={Link as any}
                        to={`/health-case/${healthCase.id}/edit`}
                        variant="primary"
                        size="sm"
                        data-cy="entityEditButton"
                      >
                        <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
                      </Button>
                      <Button
                        onClick={() => (globalThis.location.href = `/health-case/${healthCase.id}/delete`)}
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
          !loading && <div className="alert alert-warning">No Health Cases found</div>
        )}
      </div>
    </div>
  );
};

export default HealthCase;
