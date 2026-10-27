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

import { getEntities } from './audit-log.reducer';

export const AuditLog = () => {
  const dispatch = useAppDispatch();

  const pageLocation = useLocation();
  const navigate = useNavigate();

  const [sortState, setSortState] = useState(overrideSortStateWithQueryParams(getSortState(pageLocation, 'id'), pageLocation.search));

  const auditLogList = useAppSelector(state => state.auditLog.entities);
  const loading = useAppSelector(state => state.auditLog.loading);

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
      <h2 id="audit-log-heading" data-cy="AuditLogHeading">
        Audit Logs
        <div className="d-flex justify-content-end">
          <Button className="me-2" variant="info" onClick={handleSyncList} disabled={loading}>
            <FontAwesomeIcon icon="sync" spin={loading} /> Refresh list
          </Button>
          <Link to="/audit-log/new" className="btn btn-primary jh-create-entity" id="jh-create-entity" data-cy="entityCreateButton">
            <FontAwesomeIcon icon="plus" />
            &nbsp; Thêm mới một Audit Log
          </Link>
        </div>
      </h2>
      <div className="table-responsive">
        {auditLogList?.length > 0 ? (
          <Table responsive>
            <thead>
              <tr>
                <th className="hand" onClick={sort('id')}>
                  ID <FontAwesomeIcon icon={getSortIconByFieldName('id')} />
                </th>
                <th className="hand" onClick={sort('action')}>
                  Action <FontAwesomeIcon icon={getSortIconByFieldName('action')} />
                </th>
                <th className="hand" onClick={sort('targetType')}>
                  Target Type <FontAwesomeIcon icon={getSortIconByFieldName('targetType')} />
                </th>
                <th className="hand" onClick={sort('targetId')}>
                  Target Id <FontAwesomeIcon icon={getSortIconByFieldName('targetId')} />
                </th>
                <th className="hand" onClick={sort('loggedAt')}>
                  Logged At <FontAwesomeIcon icon={getSortIconByFieldName('loggedAt')} />
                </th>
                <th>
                  Actor <FontAwesomeIcon icon="sort" />
                </th>
                <th>
                  Farm <FontAwesomeIcon icon="sort" />
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {auditLogList.map(auditLog => (
                <tr key={`entity-${auditLog.id}`} data-cy="entityTable">
                  <td>
                    <Button as={Link as any} to={`/audit-log/${auditLog.id}`} variant="link" size="sm">
                      {auditLog.id}
                    </Button>
                  </td>
                  <td>{auditLog.action}</td>
                  <td>{auditLog.targetType}</td>
                  <td>{auditLog.targetId}</td>
                  <td>{auditLog.loggedAt ? <TextFormat type="date" value={auditLog.loggedAt} format={APP_DATE_FORMAT} /> : null}</td>
                  <td>{auditLog.actor ? <Link to={`/app-user/${auditLog.actor.id}`}>{auditLog.actor.id}</Link> : ''}</td>
                  <td>{auditLog.farm ? <Link to={`/farm/${auditLog.farm.id}`}>{auditLog.farm.id}</Link> : ''}</td>
                  <td className="text-end">
                    <div className="btn-group flex-btn-group-container">
                      <Button as={Link as any} to={`/audit-log/${auditLog.id}`} variant="info" size="sm" data-cy="entityDetailsButton">
                        <FontAwesomeIcon icon="eye" /> <span className="d-none d-md-inline">Xem</span>
                      </Button>
                      <Button as={Link as any} to={`/audit-log/${auditLog.id}/edit`} variant="primary" size="sm" data-cy="entityEditButton">
                        <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
                      </Button>
                      <Button
                        onClick={() => (globalThis.location.href = `/audit-log/${auditLog.id}/delete`)}
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
          !loading && <div className="alert alert-warning">No Audit Logs found</div>
        )}
      </div>
    </div>
  );
};

export default AuditLog;
