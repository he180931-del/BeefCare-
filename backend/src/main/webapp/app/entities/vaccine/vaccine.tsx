import React, { useEffect, useState } from 'react';
import { Button, Table } from 'react-bootstrap';
import { getSortState } from 'react-jhipster';
import { Link, useLocation, useNavigate } from 'react-router';

import { faSort, faSortDown, faSortUp } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { overrideSortStateWithQueryParams } from 'app/shared/util/entity-utils';
import { ASC, DESC } from 'app/shared/util/pagination.constants';

import { getEntities } from './vaccine.reducer';

export const Vaccine = () => {
  const dispatch = useAppDispatch();

  const pageLocation = useLocation();
  const navigate = useNavigate();

  const [sortState, setSortState] = useState(overrideSortStateWithQueryParams(getSortState(pageLocation, 'id'), pageLocation.search));

  const vaccineList = useAppSelector(state => state.vaccine.entities);
  const loading = useAppSelector(state => state.vaccine.loading);

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
      <h2 id="vaccine-heading" data-cy="VaccineHeading">
        Vaccines
        <div className="d-flex justify-content-end">
          <Button className="me-2" variant="info" onClick={handleSyncList} disabled={loading}>
            <FontAwesomeIcon icon="sync" spin={loading} /> Refresh list
          </Button>
          <Link to="/vaccine/new" className="btn btn-primary jh-create-entity" id="jh-create-entity" data-cy="entityCreateButton">
            <FontAwesomeIcon icon="plus" />
            &nbsp; Thêm mới một Vaccine
          </Link>
        </div>
      </h2>
      <div className="table-responsive">
        {vaccineList?.length > 0 ? (
          <Table responsive>
            <thead>
              <tr>
                <th className="hand" onClick={sort('id')}>
                  ID <FontAwesomeIcon icon={getSortIconByFieldName('id')} />
                </th>
                <th className="hand" onClick={sort('code')}>
                  Code <FontAwesomeIcon icon={getSortIconByFieldName('code')} />
                </th>
                <th className="hand" onClick={sort('name')}>
                  Name <FontAwesomeIcon icon={getSortIconByFieldName('name')} />
                </th>
                <th className="hand" onClick={sort('diseasePrevented')}>
                  Disease Prevented <FontAwesomeIcon icon={getSortIconByFieldName('diseasePrevented')} />
                </th>
                <th className="hand" onClick={sort('manufacturer')}>
                  Manufacturer <FontAwesomeIcon icon={getSortIconByFieldName('manufacturer')} />
                </th>
                <th className="hand" onClick={sort('dose')}>
                  Dose <FontAwesomeIcon icon={getSortIconByFieldName('dose')} />
                </th>
                <th className="hand" onClick={sort('route')}>
                  Route <FontAwesomeIcon icon={getSortIconByFieldName('route')} />
                </th>
                <th className="hand" onClick={sort('boosterInterval')}>
                  Booster Interval <FontAwesomeIcon icon={getSortIconByFieldName('boosterInterval')} />
                </th>
                <th className="hand" onClick={sort('withdrawalInfo')}>
                  Withdrawal Info <FontAwesomeIcon icon={getSortIconByFieldName('withdrawalInfo')} />
                </th>
                <th className="hand" onClick={sort('available')}>
                  Available <FontAwesomeIcon icon={getSortIconByFieldName('available')} />
                </th>
                <th>
                  Farm <FontAwesomeIcon icon="sort" />
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {vaccineList.map(vaccine => (
                <tr key={`entity-${vaccine.id}`} data-cy="entityTable">
                  <td>
                    <Button as={Link as any} to={`/vaccine/${vaccine.id}`} variant="link" size="sm">
                      {vaccine.id}
                    </Button>
                  </td>
                  <td>{vaccine.code}</td>
                  <td>{vaccine.name}</td>
                  <td>{vaccine.diseasePrevented}</td>
                  <td>{vaccine.manufacturer}</td>
                  <td>{vaccine.dose}</td>
                  <td>{vaccine.route}</td>
                  <td>{vaccine.boosterInterval}</td>
                  <td>{vaccine.withdrawalInfo}</td>
                  <td>{vaccine.available ? 'true' : 'false'}</td>
                  <td>{vaccine.farm ? <Link to={`/farm/${vaccine.farm.id}`}>{vaccine.farm.id}</Link> : ''}</td>
                  <td className="text-end">
                    <div className="btn-group flex-btn-group-container">
                      <Button as={Link as any} to={`/vaccine/${vaccine.id}`} variant="info" size="sm" data-cy="entityDetailsButton">
                        <FontAwesomeIcon icon="eye" /> <span className="d-none d-md-inline">Xem</span>
                      </Button>
                      <Button as={Link as any} to={`/vaccine/${vaccine.id}/edit`} variant="primary" size="sm" data-cy="entityEditButton">
                        <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
                      </Button>
                      <Button
                        onClick={() => (globalThis.location.href = `/vaccine/${vaccine.id}/delete`)}
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
          !loading && <div className="alert alert-warning">No Vaccines found</div>
        )}
      </div>
    </div>
  );
};

export default Vaccine;
