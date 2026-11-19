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

import { getEntities } from './vaccination.reducer';

export const Vaccination = () => {
  const dispatch = useAppDispatch();

  const pageLocation = useLocation();
  const navigate = useNavigate();

  const [sortState, setSortState] = useState(overrideSortStateWithQueryParams(getSortState(pageLocation, 'id'), pageLocation.search));

  const vaccinationList = useAppSelector(state => state.vaccination.entities);
  const loading = useAppSelector(state => state.vaccination.loading);

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
      <h2 id="vaccination-heading" data-cy="VaccinationHeading">
        Vaccinations
        <div className="d-flex justify-content-end">
          <Button className="me-2" variant="info" onClick={handleSyncList} disabled={loading}>
            <FontAwesomeIcon icon="sync" spin={loading} /> Refresh list
          </Button>
          <Link to="/vaccination/new" className="btn btn-primary jh-create-entity" id="jh-create-entity" data-cy="entityCreateButton">
            <FontAwesomeIcon icon="plus" />
            &nbsp; Thêm mới một Vaccination
          </Link>
        </div>
      </h2>
      <div className="table-responsive">
        {vaccinationList?.length > 0 ? (
          <Table responsive>
            <thead>
              <tr>
                <th className="hand" onClick={sort('id')}>
                  ID <FontAwesomeIcon icon={getSortIconByFieldName('id')} />
                </th>
                <th className="hand" onClick={sort('vaccinationDate')}>
                  Vaccination Date <FontAwesomeIcon icon={getSortIconByFieldName('vaccinationDate')} />
                </th>
                <th className="hand" onClick={sort('entryTime')}>
                  Entry Time <FontAwesomeIcon icon={getSortIconByFieldName('entryTime')} />
                </th>
                <th className="hand" onClick={sort('dose')}>
                  Dose <FontAwesomeIcon icon={getSortIconByFieldName('dose')} />
                </th>
                <th className="hand" onClick={sort('batchNo')}>
                  Batch No <FontAwesomeIcon icon={getSortIconByFieldName('batchNo')} />
                </th>
                <th className="hand" onClick={sort('source')}>
                  Source <FontAwesomeIcon icon={getSortIconByFieldName('source')} />
                </th>
                <th className="hand" onClick={sort('vaccinator')}>
                  Vaccinator <FontAwesomeIcon icon={getSortIconByFieldName('vaccinator')} />
                </th>
                <th>
                  Cattle <FontAwesomeIcon icon="sort" />
                </th>
                <th>
                  Vaccine <FontAwesomeIcon icon="sort" />
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {vaccinationList.map(vaccination => (
                <tr key={`entity-${vaccination.id}`} data-cy="entityTable">
                  <td>
                    <Button as={Link as any} to={`/vaccination/${vaccination.id}`} variant="link" size="sm">
                      {vaccination.id}
                    </Button>
                  </td>
                  <td>
                    {vaccination.vaccinationDate ? (
                      <TextFormat type="date" value={vaccination.vaccinationDate} format={APP_LOCAL_DATE_FORMAT} />
                    ) : null}
                  </td>
                  <td>
                    {vaccination.entryTime ? <TextFormat type="date" value={vaccination.entryTime} format={APP_DATE_FORMAT} /> : null}
                  </td>
                  <td>{vaccination.dose}</td>
                  <td>{vaccination.batchNo}</td>
                  <td>{vaccination.source}</td>
                  <td>{vaccination.vaccinator}</td>
                  <td>{vaccination.cattle ? <Link to={`/cattle/${vaccination.cattle.id}`}>{vaccination.cattle.id}</Link> : ''}</td>
                  <td>{vaccination.vaccine ? <Link to={`/vaccine/${vaccination.vaccine.id}`}>{vaccination.vaccine.id}</Link> : ''}</td>
                  <td className="text-end">
                    <div className="btn-group flex-btn-group-container">
                      <Button as={Link as any} to={`/vaccination/${vaccination.id}`} variant="info" size="sm" data-cy="entityDetailsButton">
                        <FontAwesomeIcon icon="eye" /> <span className="d-none d-md-inline">Xem</span>
                      </Button>
                      <Button
                        as={Link as any}
                        to={`/vaccination/${vaccination.id}/edit`}
                        variant="primary"
                        size="sm"
                        data-cy="entityEditButton"
                      >
                        <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
                      </Button>
                      <Button
                        onClick={() => (globalThis.location.href = `/vaccination/${vaccination.id}/delete`)}
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
          !loading && <div className="alert alert-warning">No Vaccinations found</div>
        )}
      </div>
    </div>
  );
};

export default Vaccination;
