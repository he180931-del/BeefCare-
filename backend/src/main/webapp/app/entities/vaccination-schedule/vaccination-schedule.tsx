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

import { getEntities } from './vaccination-schedule.reducer';

export const VaccinationSchedule = () => {
  const dispatch = useAppDispatch();

  const pageLocation = useLocation();
  const navigate = useNavigate();

  const [sortState, setSortState] = useState(overrideSortStateWithQueryParams(getSortState(pageLocation, 'id'), pageLocation.search));

  const vaccinationScheduleList = useAppSelector(state => state.vaccinationSchedule.entities);
  const loading = useAppSelector(state => state.vaccinationSchedule.loading);

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
      <h2 id="vaccination-schedule-heading" data-cy="VaccinationScheduleHeading">
        Vaccination Schedules
        <div className="d-flex justify-content-end">
          <Button className="me-2" variant="info" onClick={handleSyncList} disabled={loading}>
            <FontAwesomeIcon icon="sync" spin={loading} /> Refresh list
          </Button>
          <Link
            to="/vaccination-schedule/new"
            className="btn btn-primary jh-create-entity"
            id="jh-create-entity"
            data-cy="entityCreateButton"
          >
            <FontAwesomeIcon icon="plus" />
            &nbsp; Thêm mới một Vaccination Schedule
          </Link>
        </div>
      </h2>
      <div className="table-responsive">
        {vaccinationScheduleList?.length > 0 ? (
          <Table responsive>
            <thead>
              <tr>
                <th className="hand" onClick={sort('id')}>
                  ID <FontAwesomeIcon icon={getSortIconByFieldName('id')} />
                </th>
                <th className="hand" onClick={sort('targetGroup')}>
                  Target Group <FontAwesomeIcon icon={getSortIconByFieldName('targetGroup')} />
                </th>
                <th className="hand" onClick={sort('firstDueDate')}>
                  First Due Date <FontAwesomeIcon icon={getSortIconByFieldName('firstDueDate')} />
                </th>
                <th className="hand" onClick={sort('doseCount')}>
                  Dose Count <FontAwesomeIcon icon={getSortIconByFieldName('doseCount')} />
                </th>
                <th className="hand" onClick={sort('intervalDays')}>
                  Interval Days <FontAwesomeIcon icon={getSortIconByFieldName('intervalDays')} />
                </th>
                <th className="hand" onClick={sort('status')}>
                  Status <FontAwesomeIcon icon={getSortIconByFieldName('status')} />
                </th>
                <th>
                  Farm <FontAwesomeIcon icon="sort" />
                </th>
                <th>
                  Vaccine <FontAwesomeIcon icon="sort" />
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {vaccinationScheduleList.map(vaccinationSchedule => (
                <tr key={`entity-${vaccinationSchedule.id}`} data-cy="entityTable">
                  <td>
                    <Button as={Link as any} to={`/vaccination-schedule/${vaccinationSchedule.id}`} variant="link" size="sm">
                      {vaccinationSchedule.id}
                    </Button>
                  </td>
                  <td>{vaccinationSchedule.targetGroup}</td>
                  <td>
                    {vaccinationSchedule.firstDueDate ? (
                      <TextFormat type="date" value={vaccinationSchedule.firstDueDate} format={APP_LOCAL_DATE_FORMAT} />
                    ) : null}
                  </td>
                  <td>{vaccinationSchedule.doseCount}</td>
                  <td>{vaccinationSchedule.intervalDays}</td>
                  <td>{vaccinationSchedule.status}</td>
                  <td>
                    {vaccinationSchedule.farm ? <Link to={`/farm/${vaccinationSchedule.farm.id}`}>{vaccinationSchedule.farm.id}</Link> : ''}
                  </td>
                  <td>
                    {vaccinationSchedule.vaccine ? (
                      <Link to={`/vaccine/${vaccinationSchedule.vaccine.id}`}>{vaccinationSchedule.vaccine.id}</Link>
                    ) : (
                      ''
                    )}
                  </td>
                  <td className="text-end">
                    <div className="btn-group flex-btn-group-container">
                      <Button
                        as={Link as any}
                        to={`/vaccination-schedule/${vaccinationSchedule.id}`}
                        variant="info"
                        size="sm"
                        data-cy="entityDetailsButton"
                      >
                        <FontAwesomeIcon icon="eye" /> <span className="d-none d-md-inline">Xem</span>
                      </Button>
                      <Button
                        as={Link as any}
                        to={`/vaccination-schedule/${vaccinationSchedule.id}/edit`}
                        variant="primary"
                        size="sm"
                        data-cy="entityEditButton"
                      >
                        <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
                      </Button>
                      <Button
                        onClick={() => (globalThis.location.href = `/vaccination-schedule/${vaccinationSchedule.id}/delete`)}
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
          !loading && <div className="alert alert-warning">No Vaccination Schedules found</div>
        )}
      </div>
    </div>
  );
};

export default VaccinationSchedule;
