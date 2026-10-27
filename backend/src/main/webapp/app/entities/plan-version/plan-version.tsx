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

import { getEntities } from './plan-version.reducer';

export const PlanVersion = () => {
  const dispatch = useAppDispatch();

  const pageLocation = useLocation();
  const navigate = useNavigate();

  const [sortState, setSortState] = useState(overrideSortStateWithQueryParams(getSortState(pageLocation, 'id'), pageLocation.search));

  const planVersionList = useAppSelector(state => state.planVersion.entities);
  const loading = useAppSelector(state => state.planVersion.loading);

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
      <h2 id="plan-version-heading" data-cy="PlanVersionHeading">
        Plan Versions
        <div className="d-flex justify-content-end">
          <Button className="me-2" variant="info" onClick={handleSyncList} disabled={loading}>
            <FontAwesomeIcon icon="sync" spin={loading} /> Refresh list
          </Button>
          <Link to="/plan-version/new" className="btn btn-primary jh-create-entity" id="jh-create-entity" data-cy="entityCreateButton">
            <FontAwesomeIcon icon="plus" />
            &nbsp; Thêm mới một Plan Version
          </Link>
        </div>
      </h2>
      <div className="table-responsive">
        {planVersionList?.length > 0 ? (
          <Table responsive>
            <thead>
              <tr>
                <th className="hand" onClick={sort('id')}>
                  ID <FontAwesomeIcon icon={getSortIconByFieldName('id')} />
                </th>
                <th className="hand" onClick={sort('price1y')}>
                  Price 1 Y <FontAwesomeIcon icon={getSortIconByFieldName('price1y')} />
                </th>
                <th className="hand" onClick={sort('price2y')}>
                  Price 2 Y <FontAwesomeIcon icon={getSortIconByFieldName('price2y')} />
                </th>
                <th className="hand" onClick={sort('price3y')}>
                  Price 3 Y <FontAwesomeIcon icon={getSortIconByFieldName('price3y')} />
                </th>
                <th className="hand" onClick={sort('terms')}>
                  Terms <FontAwesomeIcon icon={getSortIconByFieldName('terms')} />
                </th>
                <th className="hand" onClick={sort('effectiveAt')}>
                  Effective At <FontAwesomeIcon icon={getSortIconByFieldName('effectiveAt')} />
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {planVersionList.map(planVersion => (
                <tr key={`entity-${planVersion.id}`} data-cy="entityTable">
                  <td>
                    <Button as={Link as any} to={`/plan-version/${planVersion.id}`} variant="link" size="sm">
                      {planVersion.id}
                    </Button>
                  </td>
                  <td>{planVersion.price1y}</td>
                  <td>{planVersion.price2y}</td>
                  <td>{planVersion.price3y}</td>
                  <td>{planVersion.terms}</td>
                  <td>
                    {planVersion.effectiveAt ? <TextFormat type="date" value={planVersion.effectiveAt} format={APP_DATE_FORMAT} /> : null}
                  </td>
                  <td className="text-end">
                    <div className="btn-group flex-btn-group-container">
                      <Button
                        as={Link as any}
                        to={`/plan-version/${planVersion.id}`}
                        variant="info"
                        size="sm"
                        data-cy="entityDetailsButton"
                      >
                        <FontAwesomeIcon icon="eye" /> <span className="d-none d-md-inline">Xem</span>
                      </Button>
                      <Button
                        as={Link as any}
                        to={`/plan-version/${planVersion.id}/edit`}
                        variant="primary"
                        size="sm"
                        data-cy="entityEditButton"
                      >
                        <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
                      </Button>
                      <Button
                        onClick={() => (globalThis.location.href = `/plan-version/${planVersion.id}/delete`)}
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
          !loading && <div className="alert alert-warning">No Plan Versions found</div>
        )}
      </div>
    </div>
  );
};

export default PlanVersion;
