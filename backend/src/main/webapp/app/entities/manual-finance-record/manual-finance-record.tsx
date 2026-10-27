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

import { getEntities } from './manual-finance-record.reducer';

export const ManualFinanceRecord = () => {
  const dispatch = useAppDispatch();

  const pageLocation = useLocation();
  const navigate = useNavigate();

  const [sortState, setSortState] = useState(overrideSortStateWithQueryParams(getSortState(pageLocation, 'id'), pageLocation.search));

  const manualFinanceRecordList = useAppSelector(state => state.manualFinanceRecord.entities);
  const loading = useAppSelector(state => state.manualFinanceRecord.loading);

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
      <h2 id="manual-finance-record-heading" data-cy="ManualFinanceRecordHeading">
        Manual Finance Records
        <div className="d-flex justify-content-end">
          <Button className="me-2" variant="info" onClick={handleSyncList} disabled={loading}>
            <FontAwesomeIcon icon="sync" spin={loading} /> Refresh list
          </Button>
          <Link
            to="/manual-finance-record/new"
            className="btn btn-primary jh-create-entity"
            id="jh-create-entity"
            data-cy="entityCreateButton"
          >
            <FontAwesomeIcon icon="plus" />
            &nbsp; Thêm mới một Manual Finance Record
          </Link>
        </div>
      </h2>
      <div className="table-responsive">
        {manualFinanceRecordList?.length > 0 ? (
          <Table responsive>
            <thead>
              <tr>
                <th className="hand" onClick={sort('id')}>
                  ID <FontAwesomeIcon icon={getSortIconByFieldName('id')} />
                </th>
                <th className="hand" onClick={sort('type')}>
                  Type <FontAwesomeIcon icon={getSortIconByFieldName('type')} />
                </th>
                <th className="hand" onClick={sort('category')}>
                  Category <FontAwesomeIcon icon={getSortIconByFieldName('category')} />
                </th>
                <th className="hand" onClick={sort('amountVnd')}>
                  Amount Vnd <FontAwesomeIcon icon={getSortIconByFieldName('amountVnd')} />
                </th>
                <th className="hand" onClick={sort('occurredOn')}>
                  Occurred On <FontAwesomeIcon icon={getSortIconByFieldName('occurredOn')} />
                </th>
                <th className="hand" onClick={sort('state')}>
                  State <FontAwesomeIcon icon={getSortIconByFieldName('state')} />
                </th>
                <th>
                  Farm <FontAwesomeIcon icon="sort" />
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {manualFinanceRecordList.map(manualFinanceRecord => (
                <tr key={`entity-${manualFinanceRecord.id}`} data-cy="entityTable">
                  <td>
                    <Button as={Link as any} to={`/manual-finance-record/${manualFinanceRecord.id}`} variant="link" size="sm">
                      {manualFinanceRecord.id}
                    </Button>
                  </td>
                  <td>{manualFinanceRecord.type}</td>
                  <td>{manualFinanceRecord.category}</td>
                  <td>{manualFinanceRecord.amountVnd}</td>
                  <td>
                    {manualFinanceRecord.occurredOn ? (
                      <TextFormat type="date" value={manualFinanceRecord.occurredOn} format={APP_LOCAL_DATE_FORMAT} />
                    ) : null}
                  </td>
                  <td>{manualFinanceRecord.state}</td>
                  <td>
                    {manualFinanceRecord.farm ? <Link to={`/farm/${manualFinanceRecord.farm.id}`}>{manualFinanceRecord.farm.id}</Link> : ''}
                  </td>
                  <td className="text-end">
                    <div className="btn-group flex-btn-group-container">
                      <Button
                        as={Link as any}
                        to={`/manual-finance-record/${manualFinanceRecord.id}`}
                        variant="info"
                        size="sm"
                        data-cy="entityDetailsButton"
                      >
                        <FontAwesomeIcon icon="eye" /> <span className="d-none d-md-inline">Xem</span>
                      </Button>
                      <Button
                        as={Link as any}
                        to={`/manual-finance-record/${manualFinanceRecord.id}/edit`}
                        variant="primary"
                        size="sm"
                        data-cy="entityEditButton"
                      >
                        <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
                      </Button>
                      <Button
                        onClick={() => (globalThis.location.href = `/manual-finance-record/${manualFinanceRecord.id}/delete`)}
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
          !loading && <div className="alert alert-warning">No Manual Finance Records found</div>
        )}
      </div>
    </div>
  );
};

export default ManualFinanceRecord;
