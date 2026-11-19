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

import { getEntities } from './pen-reception-criteria.reducer';

export const PenReceptionCriteria = () => {
  const dispatch = useAppDispatch();

  const pageLocation = useLocation();
  const navigate = useNavigate();

  const [sortState, setSortState] = useState(overrideSortStateWithQueryParams(getSortState(pageLocation, 'id'), pageLocation.search));

  const penReceptionCriteriaList = useAppSelector(state => state.penReceptionCriteria.entities);
  const loading = useAppSelector(state => state.penReceptionCriteria.loading);

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
      <h2 id="pen-reception-criteria-heading" data-cy="PenReceptionCriteriaHeading">
        Pen Reception Criteria
        <div className="d-flex justify-content-end">
          <Button className="me-2" variant="info" onClick={handleSyncList} disabled={loading}>
            <FontAwesomeIcon icon="sync" spin={loading} /> Refresh list
          </Button>
          <Link
            to="/pen-reception-criteria/new"
            className="btn btn-primary jh-create-entity"
            id="jh-create-entity"
            data-cy="entityCreateButton"
          >
            <FontAwesomeIcon icon="plus" />
            &nbsp; Thêm mới một Pen Reception Criteria
          </Link>
        </div>
      </h2>
      <div className="table-responsive">
        {penReceptionCriteriaList?.length > 0 ? (
          <Table responsive>
            <thead>
              <tr>
                <th className="hand" onClick={sort('id')}>
                  ID <FontAwesomeIcon icon={getSortIconByFieldName('id')} />
                </th>
                <th className="hand" onClick={sort('versionNo')}>
                  Version No <FontAwesomeIcon icon={getSortIconByFieldName('versionNo')} />
                </th>
                <th className="hand" onClick={sort('acceptedPurposes')}>
                  Accepted Purposes <FontAwesomeIcon icon={getSortIconByFieldName('acceptedPurposes')} />
                </th>
                <th className="hand" onClick={sort('acceptedStages')}>
                  Accepted Stages <FontAwesomeIcon icon={getSortIconByFieldName('acceptedStages')} />
                </th>
                <th className="hand" onClick={sort('thresholds')}>
                  Thresholds <FontAwesomeIcon icon={getSortIconByFieldName('thresholds')} />
                </th>
                <th className="hand" onClick={sort('effectiveFrom')}>
                  Effective From <FontAwesomeIcon icon={getSortIconByFieldName('effectiveFrom')} />
                </th>
                <th>
                  Pen <FontAwesomeIcon icon="sort" />
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {penReceptionCriteriaList.map(penReceptionCriteria => (
                <tr key={`entity-${penReceptionCriteria.id}`} data-cy="entityTable">
                  <td>
                    <Button as={Link as any} to={`/pen-reception-criteria/${penReceptionCriteria.id}`} variant="link" size="sm">
                      {penReceptionCriteria.id}
                    </Button>
                  </td>
                  <td>{penReceptionCriteria.versionNo}</td>
                  <td>{penReceptionCriteria.acceptedPurposes}</td>
                  <td>{penReceptionCriteria.acceptedStages}</td>
                  <td>{penReceptionCriteria.thresholds}</td>
                  <td>
                    {penReceptionCriteria.effectiveFrom ? (
                      <TextFormat type="date" value={penReceptionCriteria.effectiveFrom} format={APP_LOCAL_DATE_FORMAT} />
                    ) : null}
                  </td>
                  <td>
                    {penReceptionCriteria.pen ? <Link to={`/pen/${penReceptionCriteria.pen.id}`}>{penReceptionCriteria.pen.id}</Link> : ''}
                  </td>
                  <td className="text-end">
                    <div className="btn-group flex-btn-group-container">
                      <Button
                        as={Link as any}
                        to={`/pen-reception-criteria/${penReceptionCriteria.id}`}
                        variant="info"
                        size="sm"
                        data-cy="entityDetailsButton"
                      >
                        <FontAwesomeIcon icon="eye" /> <span className="d-none d-md-inline">Xem</span>
                      </Button>
                      <Button
                        as={Link as any}
                        to={`/pen-reception-criteria/${penReceptionCriteria.id}/edit`}
                        variant="primary"
                        size="sm"
                        data-cy="entityEditButton"
                      >
                        <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
                      </Button>
                      <Button
                        onClick={() => (globalThis.location.href = `/pen-reception-criteria/${penReceptionCriteria.id}/delete`)}
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
          !loading && <div className="alert alert-warning">No Pen Reception Criteria found</div>
        )}
      </div>
    </div>
  );
};

export default PenReceptionCriteria;
