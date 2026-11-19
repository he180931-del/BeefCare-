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

import { getEntities } from './scheduled-dose.reducer';

export const ScheduledDose = () => {
  const dispatch = useAppDispatch();

  const pageLocation = useLocation();
  const navigate = useNavigate();

  const [sortState, setSortState] = useState(overrideSortStateWithQueryParams(getSortState(pageLocation, 'id'), pageLocation.search));

  const scheduledDoseList = useAppSelector(state => state.scheduledDose.entities);
  const loading = useAppSelector(state => state.scheduledDose.loading);

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
      <h2 id="scheduled-dose-heading" data-cy="ScheduledDoseHeading">
        Scheduled Doses
        <div className="d-flex justify-content-end">
          <Button className="me-2" variant="info" onClick={handleSyncList} disabled={loading}>
            <FontAwesomeIcon icon="sync" spin={loading} /> Refresh list
          </Button>
          <Link to="/scheduled-dose/new" className="btn btn-primary jh-create-entity" id="jh-create-entity" data-cy="entityCreateButton">
            <FontAwesomeIcon icon="plus" />
            &nbsp; Thêm mới một Scheduled Dose
          </Link>
        </div>
      </h2>
      <div className="table-responsive">
        {scheduledDoseList?.length > 0 ? (
          <Table responsive>
            <thead>
              <tr>
                <th className="hand" onClick={sort('id')}>
                  ID <FontAwesomeIcon icon={getSortIconByFieldName('id')} />
                </th>
                <th className="hand" onClick={sort('doseNo')}>
                  Dose No <FontAwesomeIcon icon={getSortIconByFieldName('doseNo')} />
                </th>
                <th className="hand" onClick={sort('dueDate')}>
                  Due Date <FontAwesomeIcon icon={getSortIconByFieldName('dueDate')} />
                </th>
                <th className="hand" onClick={sort('status')}>
                  Status <FontAwesomeIcon icon={getSortIconByFieldName('status')} />
                </th>
                <th className="hand" onClick={sort('deferralReason')}>
                  Deferral Reason <FontAwesomeIcon icon={getSortIconByFieldName('deferralReason')} />
                </th>
                <th className="hand" onClick={sort('newExpectedDate')}>
                  New Expected Date <FontAwesomeIcon icon={getSortIconByFieldName('newExpectedDate')} />
                </th>
                <th>
                  Vaccination <FontAwesomeIcon icon="sort" />
                </th>
                <th>
                  Schedule <FontAwesomeIcon icon="sort" />
                </th>
                <th>
                  Cattle <FontAwesomeIcon icon="sort" />
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {scheduledDoseList.map(scheduledDose => (
                <tr key={`entity-${scheduledDose.id}`} data-cy="entityTable">
                  <td>
                    <Button as={Link as any} to={`/scheduled-dose/${scheduledDose.id}`} variant="link" size="sm">
                      {scheduledDose.id}
                    </Button>
                  </td>
                  <td>{scheduledDose.doseNo}</td>
                  <td>
                    {scheduledDose.dueDate ? <TextFormat type="date" value={scheduledDose.dueDate} format={APP_LOCAL_DATE_FORMAT} /> : null}
                  </td>
                  <td>{scheduledDose.status}</td>
                  <td>{scheduledDose.deferralReason}</td>
                  <td>
                    {scheduledDose.newExpectedDate ? (
                      <TextFormat type="date" value={scheduledDose.newExpectedDate} format={APP_LOCAL_DATE_FORMAT} />
                    ) : null}
                  </td>
                  <td>
                    {scheduledDose.vaccination ? (
                      <Link to={`/vaccination/${scheduledDose.vaccination.id}`}>{scheduledDose.vaccination.id}</Link>
                    ) : (
                      ''
                    )}
                  </td>
                  <td>
                    {scheduledDose.schedule ? (
                      <Link to={`/vaccination-schedule/${scheduledDose.schedule.id}`}>{scheduledDose.schedule.id}</Link>
                    ) : (
                      ''
                    )}
                  </td>
                  <td>{scheduledDose.cattle ? <Link to={`/cattle/${scheduledDose.cattle.id}`}>{scheduledDose.cattle.id}</Link> : ''}</td>
                  <td className="text-end">
                    <div className="btn-group flex-btn-group-container">
                      <Button
                        as={Link as any}
                        to={`/scheduled-dose/${scheduledDose.id}`}
                        variant="info"
                        size="sm"
                        data-cy="entityDetailsButton"
                      >
                        <FontAwesomeIcon icon="eye" /> <span className="d-none d-md-inline">Xem</span>
                      </Button>
                      <Button
                        as={Link as any}
                        to={`/scheduled-dose/${scheduledDose.id}/edit`}
                        variant="primary"
                        size="sm"
                        data-cy="entityEditButton"
                      >
                        <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
                      </Button>
                      <Button
                        onClick={() => (globalThis.location.href = `/scheduled-dose/${scheduledDose.id}/delete`)}
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
          !loading && <div className="alert alert-warning">No Scheduled Doses found</div>
        )}
      </div>
    </div>
  );
};

export default ScheduledDose;
