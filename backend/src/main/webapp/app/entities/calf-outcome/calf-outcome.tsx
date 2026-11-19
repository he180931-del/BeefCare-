import React, { useEffect, useState } from 'react';
import { Button, Table } from 'react-bootstrap';
import { getSortState } from 'react-jhipster';
import { Link, useLocation, useNavigate } from 'react-router';

import { faSort, faSortDown, faSortUp } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { overrideSortStateWithQueryParams } from 'app/shared/util/entity-utils';
import { ASC, DESC } from 'app/shared/util/pagination.constants';

import { getEntities } from './calf-outcome.reducer';

export const CalfOutcome = () => {
  const dispatch = useAppDispatch();

  const pageLocation = useLocation();
  const navigate = useNavigate();

  const [sortState, setSortState] = useState(overrideSortStateWithQueryParams(getSortState(pageLocation, 'id'), pageLocation.search));

  const calfOutcomeList = useAppSelector(state => state.calfOutcome.entities);
  const loading = useAppSelector(state => state.calfOutcome.loading);

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
      <h2 id="calf-outcome-heading" data-cy="CalfOutcomeHeading">
        Calf Outcomes
        <div className="d-flex justify-content-end">
          <Button className="me-2" variant="info" onClick={handleSyncList} disabled={loading}>
            <FontAwesomeIcon icon="sync" spin={loading} /> Refresh list
          </Button>
          <Link to="/calf-outcome/new" className="btn btn-primary jh-create-entity" id="jh-create-entity" data-cy="entityCreateButton">
            <FontAwesomeIcon icon="plus" />
            &nbsp; Thêm mới một Calf Outcome
          </Link>
        </div>
      </h2>
      <div className="table-responsive">
        {calfOutcomeList?.length > 0 ? (
          <Table responsive>
            <thead>
              <tr>
                <th className="hand" onClick={sort('id')}>
                  ID <FontAwesomeIcon icon={getSortIconByFieldName('id')} />
                </th>
                <th className="hand" onClick={sort('outcome')}>
                  Outcome <FontAwesomeIcon icon={getSortIconByFieldName('outcome')} />
                </th>
                <th className="hand" onClick={sort('sex')}>
                  Sex <FontAwesomeIcon icon={getSortIconByFieldName('sex')} />
                </th>
                <th className="hand" onClick={sort('birthWeight')}>
                  Birth Weight <FontAwesomeIcon icon={getSortIconByFieldName('birthWeight')} />
                </th>
                <th className="hand" onClick={sort('registrationState')}>
                  Registration State <FontAwesomeIcon icon={getSortIconByFieldName('registrationState')} />
                </th>
                <th>
                  Calving <FontAwesomeIcon icon="sort" />
                </th>
                <th>
                  Registered Cattle <FontAwesomeIcon icon="sort" />
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {calfOutcomeList.map(calfOutcome => (
                <tr key={`entity-${calfOutcome.id}`} data-cy="entityTable">
                  <td>
                    <Button as={Link as any} to={`/calf-outcome/${calfOutcome.id}`} variant="link" size="sm">
                      {calfOutcome.id}
                    </Button>
                  </td>
                  <td>{calfOutcome.outcome}</td>
                  <td>{calfOutcome.sex}</td>
                  <td>{calfOutcome.birthWeight}</td>
                  <td>{calfOutcome.registrationState}</td>
                  <td>
                    {calfOutcome.calving ? <Link to={`/calving-event/${calfOutcome.calving.id}`}>{calfOutcome.calving.id}</Link> : ''}
                  </td>
                  <td>
                    {calfOutcome.registeredCattle ? (
                      <Link to={`/cattle/${calfOutcome.registeredCattle.id}`}>{calfOutcome.registeredCattle.id}</Link>
                    ) : (
                      ''
                    )}
                  </td>
                  <td className="text-end">
                    <div className="btn-group flex-btn-group-container">
                      <Button
                        as={Link as any}
                        to={`/calf-outcome/${calfOutcome.id}`}
                        variant="info"
                        size="sm"
                        data-cy="entityDetailsButton"
                      >
                        <FontAwesomeIcon icon="eye" /> <span className="d-none d-md-inline">Xem</span>
                      </Button>
                      <Button
                        as={Link as any}
                        to={`/calf-outcome/${calfOutcome.id}/edit`}
                        variant="primary"
                        size="sm"
                        data-cy="entityEditButton"
                      >
                        <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
                      </Button>
                      <Button
                        onClick={() => (globalThis.location.href = `/calf-outcome/${calfOutcome.id}/delete`)}
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
          !loading && <div className="alert alert-warning">No Calf Outcomes found</div>
        )}
      </div>
    </div>
  );
};

export default CalfOutcome;
