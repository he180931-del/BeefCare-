import React, { useEffect, useState } from 'react';
import { Button, Table } from 'react-bootstrap';
import { TextFormat, getSortState } from 'react-jhipster';
import { Link, useLocation, useNavigate } from 'react-router';

import { faSort, faSortDown, faSortUp } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_DATE_FORMAT, APP_LOCAL_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';
import { overrideSortStateWithQueryParams } from 'app/shared/util/entity-utils';
import { ASC, DESC } from 'app/shared/util/pagination.constants';

import { getEntities } from './growth.reducer';

export const Growth = () => {
  const dispatch = useAppDispatch();

  const pageLocation = useLocation();
  const navigate = useNavigate();

  const [sortState, setSortState] = useState(overrideSortStateWithQueryParams(getSortState(pageLocation, 'id'), pageLocation.search));

  const growthList = useAppSelector(state => state.growth.entities);
  const loading = useAppSelector(state => state.growth.loading);

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
      <h2 id="growth-heading" data-cy="GrowthHeading">
        Growths
        <div className="d-flex justify-content-end">
          <Button className="me-2" variant="info" onClick={handleSyncList} disabled={loading}>
            <FontAwesomeIcon icon="sync" spin={loading} /> Refresh list
          </Button>
          <Link to="/growth/new" className="btn btn-primary jh-create-entity" id="jh-create-entity" data-cy="entityCreateButton">
            <FontAwesomeIcon icon="plus" />
            &nbsp; Thêm mới một Growth
          </Link>
        </div>
      </h2>
      <div className="table-responsive">
        {growthList?.length > 0 ? (
          <Table responsive>
            <thead>
              <tr>
                <th className="hand" onClick={sort('id')}>
                  ID <FontAwesomeIcon icon={getSortIconByFieldName('id')} />
                </th>
                <th className="hand" onClick={sort('checkDate')}>
                  Check Date <FontAwesomeIcon icon={getSortIconByFieldName('checkDate')} />
                </th>
                <th className="hand" onClick={sort('entryTime')}>
                  Entry Time <FontAwesomeIcon icon={getSortIconByFieldName('entryTime')} />
                </th>
                <th className="hand" onClick={sort('weightKg')}>
                  Weight Kg <FontAwesomeIcon icon={getSortIconByFieldName('weightKg')} />
                </th>
                <th className="hand" onClick={sort('weightType')}>
                  Weight Type <FontAwesomeIcon icon={getSortIconByFieldName('weightType')} />
                </th>
                <th className="hand" onClick={sort('bcs')}>
                  Bcs <FontAwesomeIcon icon={getSortIconByFieldName('bcs')} />
                </th>
                <th className="hand" onClick={sort('status')}>
                  Status <FontAwesomeIcon icon={getSortIconByFieldName('status')} />
                </th>
                <th className="hand" onClick={sort('correctionReason')}>
                  Correction Reason <FontAwesomeIcon icon={getSortIconByFieldName('correctionReason')} />
                </th>
                <th>
                  Cattle <FontAwesomeIcon icon="sort" />
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {growthList.map(growth => (
                <tr key={`entity-${growth.id}`} data-cy="entityTable">
                  <td>
                    <Button as={Link as any} to={`/growth/${growth.id}`} variant="link" size="sm">
                      {growth.id}
                    </Button>
                  </td>
                  <td>{growth.checkDate ? <TextFormat type="date" value={growth.checkDate} format={APP_LOCAL_DATE_FORMAT} /> : null}</td>
                  <td>{growth.entryTime ? <TextFormat type="date" value={growth.entryTime} format={APP_DATE_FORMAT} /> : null}</td>
                  <td>{growth.weightKg}</td>
                  <td>{growth.weightType}</td>
                  <td>{growth.bcs}</td>
                  <td>{growth.status}</td>
                  <td>{growth.correctionReason}</td>
                  <td>{growth.cattle ? <Link to={`/cattle/${growth.cattle.id}`}>{growth.cattle.id}</Link> : ''}</td>
                  <td className="text-end">
                    <div className="btn-group flex-btn-group-container">
                      <Button as={Link as any} to={`/growth/${growth.id}`} variant="info" size="sm" data-cy="entityDetailsButton">
                        <FontAwesomeIcon icon="eye" /> <span className="d-none d-md-inline">Xem</span>
                      </Button>
                      <Button as={Link as any} to={`/growth/${growth.id}/edit`} variant="primary" size="sm" data-cy="entityEditButton">
                        <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
                      </Button>
                      <Button
                        onClick={() => (globalThis.location.href = `/growth/${growth.id}/delete`)}
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
          !loading && <div className="alert alert-warning">No Growths found</div>
        )}
      </div>
    </div>
  );
};

export default Growth;
