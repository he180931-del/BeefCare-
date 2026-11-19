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

import { getEntities } from './treatment.reducer';

export const Treatment = () => {
  const dispatch = useAppDispatch();

  const pageLocation = useLocation();
  const navigate = useNavigate();

  const [sortState, setSortState] = useState(overrideSortStateWithQueryParams(getSortState(pageLocation, 'id'), pageLocation.search));

  const treatmentList = useAppSelector(state => state.treatment.entities);
  const loading = useAppSelector(state => state.treatment.loading);

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
      <h2 id="treatment-heading" data-cy="TreatmentHeading">
        Treatments
        <div className="d-flex justify-content-end">
          <Button className="me-2" variant="info" onClick={handleSyncList} disabled={loading}>
            <FontAwesomeIcon icon="sync" spin={loading} /> Refresh list
          </Button>
          <Link to="/treatment/new" className="btn btn-primary jh-create-entity" id="jh-create-entity" data-cy="entityCreateButton">
            <FontAwesomeIcon icon="plus" />
            &nbsp; Thêm mới một Treatment
          </Link>
        </div>
      </h2>
      <div className="table-responsive">
        {treatmentList?.length > 0 ? (
          <Table responsive>
            <thead>
              <tr>
                <th className="hand" onClick={sort('id')}>
                  ID <FontAwesomeIcon icon={getSortIconByFieldName('id')} />
                </th>
                <th className="hand" onClick={sort('treatmentTime')}>
                  Treatment Time <FontAwesomeIcon icon={getSortIconByFieldName('treatmentTime')} />
                </th>
                <th className="hand" onClick={sort('entryTime')}>
                  Entry Time <FontAwesomeIcon icon={getSortIconByFieldName('entryTime')} />
                </th>
                <th className="hand" onClick={sort('treatmentDetail')}>
                  Treatment Detail <FontAwesomeIcon icon={getSortIconByFieldName('treatmentDetail')} />
                </th>
                <th className="hand" onClick={sort('dose')}>
                  Dose <FontAwesomeIcon icon={getSortIconByFieldName('dose')} />
                </th>
                <th className="hand" onClick={sort('route')}>
                  Route <FontAwesomeIcon icon={getSortIconByFieldName('route')} />
                </th>
                <th className="hand" onClick={sort('withdrawalPeriod')}>
                  Withdrawal Period <FontAwesomeIcon icon={getSortIconByFieldName('withdrawalPeriod')} />
                </th>
                <th className="hand" onClick={sort('result')}>
                  Result <FontAwesomeIcon icon={getSortIconByFieldName('result')} />
                </th>
                <th>
                  Health Case <FontAwesomeIcon icon="sort" />
                </th>
                <th>
                  Medicine <FontAwesomeIcon icon="sort" />
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {treatmentList.map(treatment => (
                <tr key={`entity-${treatment.id}`} data-cy="entityTable">
                  <td>
                    <Button as={Link as any} to={`/treatment/${treatment.id}`} variant="link" size="sm">
                      {treatment.id}
                    </Button>
                  </td>
                  <td>
                    {treatment.treatmentTime ? <TextFormat type="date" value={treatment.treatmentTime} format={APP_DATE_FORMAT} /> : null}
                  </td>
                  <td>{treatment.entryTime ? <TextFormat type="date" value={treatment.entryTime} format={APP_DATE_FORMAT} /> : null}</td>
                  <td>{treatment.treatmentDetail}</td>
                  <td>{treatment.dose}</td>
                  <td>{treatment.route}</td>
                  <td>{treatment.withdrawalPeriod}</td>
                  <td>{treatment.result}</td>
                  <td>
                    {treatment.healthCase ? <Link to={`/health-case/${treatment.healthCase.id}`}>{treatment.healthCase.id}</Link> : ''}
                  </td>
                  <td>{treatment.medicine ? <Link to={`/medicine/${treatment.medicine.id}`}>{treatment.medicine.id}</Link> : ''}</td>
                  <td className="text-end">
                    <div className="btn-group flex-btn-group-container">
                      <Button as={Link as any} to={`/treatment/${treatment.id}`} variant="info" size="sm" data-cy="entityDetailsButton">
                        <FontAwesomeIcon icon="eye" /> <span className="d-none d-md-inline">Xem</span>
                      </Button>
                      <Button
                        as={Link as any}
                        to={`/treatment/${treatment.id}/edit`}
                        variant="primary"
                        size="sm"
                        data-cy="entityEditButton"
                      >
                        <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
                      </Button>
                      <Button
                        onClick={() => (globalThis.location.href = `/treatment/${treatment.id}/delete`)}
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
          !loading && <div className="alert alert-warning">No Treatments found</div>
        )}
      </div>
    </div>
  );
};

export default Treatment;
