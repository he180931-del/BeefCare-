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

import { getEntities } from './pen-assignment.reducer';

export const PenAssignment = () => {
  const dispatch = useAppDispatch();

  const pageLocation = useLocation();
  const navigate = useNavigate();

  const [sortState, setSortState] = useState(overrideSortStateWithQueryParams(getSortState(pageLocation, 'id'), pageLocation.search));

  const penAssignmentList = useAppSelector(state => state.penAssignment.entities);
  const loading = useAppSelector(state => state.penAssignment.loading);

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
      <h2 id="pen-assignment-heading" data-cy="PenAssignmentHeading">
        Pen Assignments
        <div className="d-flex justify-content-end">
          <Button className="me-2" variant="info" onClick={handleSyncList} disabled={loading}>
            <FontAwesomeIcon icon="sync" spin={loading} /> Refresh list
          </Button>
          <Link to="/pen-assignment/new" className="btn btn-primary jh-create-entity" id="jh-create-entity" data-cy="entityCreateButton">
            <FontAwesomeIcon icon="plus" />
            &nbsp; Thêm mới một Pen Assignment
          </Link>
        </div>
      </h2>
      <div className="table-responsive">
        {penAssignmentList?.length > 0 ? (
          <Table responsive>
            <thead>
              <tr>
                <th className="hand" onClick={sort('id')}>
                  ID <FontAwesomeIcon icon={getSortIconByFieldName('id')} />
                </th>
                <th className="hand" onClick={sort('effectiveFrom')}>
                  Effective From <FontAwesomeIcon icon={getSortIconByFieldName('effectiveFrom')} />
                </th>
                <th className="hand" onClick={sort('effectiveTo')}>
                  Effective To <FontAwesomeIcon icon={getSortIconByFieldName('effectiveTo')} />
                </th>
                <th className="hand" onClick={sort('source')}>
                  Source <FontAwesomeIcon icon={getSortIconByFieldName('source')} />
                </th>
                <th className="hand" onClick={sort('reason')}>
                  Reason <FontAwesomeIcon icon={getSortIconByFieldName('reason')} />
                </th>
                <th>
                  Cattle <FontAwesomeIcon icon="sort" />
                </th>
                <th>
                  Pen <FontAwesomeIcon icon="sort" />
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {penAssignmentList.map(penAssignment => (
                <tr key={`entity-${penAssignment.id}`} data-cy="entityTable">
                  <td>
                    <Button as={Link as any} to={`/pen-assignment/${penAssignment.id}`} variant="link" size="sm">
                      {penAssignment.id}
                    </Button>
                  </td>
                  <td>
                    {penAssignment.effectiveFrom ? (
                      <TextFormat type="date" value={penAssignment.effectiveFrom} format={APP_LOCAL_DATE_FORMAT} />
                    ) : null}
                  </td>
                  <td>
                    {penAssignment.effectiveTo ? (
                      <TextFormat type="date" value={penAssignment.effectiveTo} format={APP_LOCAL_DATE_FORMAT} />
                    ) : null}
                  </td>
                  <td>{penAssignment.source}</td>
                  <td>{penAssignment.reason}</td>
                  <td>{penAssignment.cattle ? <Link to={`/cattle/${penAssignment.cattle.id}`}>{penAssignment.cattle.id}</Link> : ''}</td>
                  <td>{penAssignment.pen ? <Link to={`/pen/${penAssignment.pen.id}`}>{penAssignment.pen.id}</Link> : ''}</td>
                  <td className="text-end">
                    <div className="btn-group flex-btn-group-container">
                      <Button
                        as={Link as any}
                        to={`/pen-assignment/${penAssignment.id}`}
                        variant="info"
                        size="sm"
                        data-cy="entityDetailsButton"
                      >
                        <FontAwesomeIcon icon="eye" /> <span className="d-none d-md-inline">Xem</span>
                      </Button>
                      <Button
                        as={Link as any}
                        to={`/pen-assignment/${penAssignment.id}/edit`}
                        variant="primary"
                        size="sm"
                        data-cy="entityEditButton"
                      >
                        <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
                      </Button>
                      <Button
                        onClick={() => (globalThis.location.href = `/pen-assignment/${penAssignment.id}/delete`)}
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
          !loading && <div className="alert alert-warning">No Pen Assignments found</div>
        )}
      </div>
    </div>
  );
};

export default PenAssignment;
