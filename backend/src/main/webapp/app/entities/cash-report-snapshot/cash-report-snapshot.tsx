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

import { getEntities } from './cash-report-snapshot.reducer';

export const CashReportSnapshot = () => {
  const dispatch = useAppDispatch();

  const pageLocation = useLocation();
  const navigate = useNavigate();

  const [sortState, setSortState] = useState(overrideSortStateWithQueryParams(getSortState(pageLocation, 'id'), pageLocation.search));

  const cashReportSnapshotList = useAppSelector(state => state.cashReportSnapshot.entities);
  const loading = useAppSelector(state => state.cashReportSnapshot.loading);

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
      <h2 id="cash-report-snapshot-heading" data-cy="CashReportSnapshotHeading">
        Cash Report Snapshots
        <div className="d-flex justify-content-end">
          <Button className="me-2" variant="info" onClick={handleSyncList} disabled={loading}>
            <FontAwesomeIcon icon="sync" spin={loading} /> Refresh list
          </Button>
          <Link
            to="/cash-report-snapshot/new"
            className="btn btn-primary jh-create-entity"
            id="jh-create-entity"
            data-cy="entityCreateButton"
          >
            <FontAwesomeIcon icon="plus" />
            &nbsp; Thêm mới một Cash Report Snapshot
          </Link>
        </div>
      </h2>
      <div className="table-responsive">
        {cashReportSnapshotList?.length > 0 ? (
          <Table responsive>
            <thead>
              <tr>
                <th className="hand" onClick={sort('id')}>
                  ID <FontAwesomeIcon icon={getSortIconByFieldName('id')} />
                </th>
                <th className="hand" onClick={sort('asOf')}>
                  As Of <FontAwesomeIcon icon={getSortIconByFieldName('asOf')} />
                </th>
                <th className="hand" onClick={sort('dateFrom')}>
                  Date From <FontAwesomeIcon icon={getSortIconByFieldName('dateFrom')} />
                </th>
                <th className="hand" onClick={sort('dateTo')}>
                  Date To <FontAwesomeIcon icon={getSortIconByFieldName('dateTo')} />
                </th>
                <th className="hand" onClick={sort('totals')}>
                  Totals <FontAwesomeIcon icon={getSortIconByFieldName('totals')} />
                </th>
                <th>
                  Pm User <FontAwesomeIcon icon="sort" />
                </th>
                <th>
                  Farm <FontAwesomeIcon icon="sort" />
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cashReportSnapshotList.map(cashReportSnapshot => (
                <tr key={`entity-${cashReportSnapshot.id}`} data-cy="entityTable">
                  <td>
                    <Button as={Link as any} to={`/cash-report-snapshot/${cashReportSnapshot.id}`} variant="link" size="sm">
                      {cashReportSnapshot.id}
                    </Button>
                  </td>
                  <td>
                    {cashReportSnapshot.asOf ? <TextFormat type="date" value={cashReportSnapshot.asOf} format={APP_DATE_FORMAT} /> : null}
                  </td>
                  <td>
                    {cashReportSnapshot.dateFrom ? (
                      <TextFormat type="date" value={cashReportSnapshot.dateFrom} format={APP_LOCAL_DATE_FORMAT} />
                    ) : null}
                  </td>
                  <td>
                    {cashReportSnapshot.dateTo ? (
                      <TextFormat type="date" value={cashReportSnapshot.dateTo} format={APP_LOCAL_DATE_FORMAT} />
                    ) : null}
                  </td>
                  <td>{cashReportSnapshot.totals}</td>
                  <td>
                    {cashReportSnapshot.pmUser ? (
                      <Link to={`/app-user/${cashReportSnapshot.pmUser.id}`}>{cashReportSnapshot.pmUser.id}</Link>
                    ) : (
                      ''
                    )}
                  </td>
                  <td>
                    {cashReportSnapshot.farm ? <Link to={`/farm/${cashReportSnapshot.farm.id}`}>{cashReportSnapshot.farm.id}</Link> : ''}
                  </td>
                  <td className="text-end">
                    <div className="btn-group flex-btn-group-container">
                      <Button
                        as={Link as any}
                        to={`/cash-report-snapshot/${cashReportSnapshot.id}`}
                        variant="info"
                        size="sm"
                        data-cy="entityDetailsButton"
                      >
                        <FontAwesomeIcon icon="eye" /> <span className="d-none d-md-inline">Xem</span>
                      </Button>
                      <Button
                        as={Link as any}
                        to={`/cash-report-snapshot/${cashReportSnapshot.id}/edit`}
                        variant="primary"
                        size="sm"
                        data-cy="entityEditButton"
                      >
                        <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
                      </Button>
                      <Button
                        onClick={() => (globalThis.location.href = `/cash-report-snapshot/${cashReportSnapshot.id}/delete`)}
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
          !loading && <div className="alert alert-warning">No Cash Report Snapshots found</div>
        )}
      </div>
    </div>
  );
};

export default CashReportSnapshot;
