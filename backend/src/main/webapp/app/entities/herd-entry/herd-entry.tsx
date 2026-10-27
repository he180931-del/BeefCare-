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

import { getEntities } from './herd-entry.reducer';

export const HerdEntry = () => {
  const dispatch = useAppDispatch();

  const pageLocation = useLocation();
  const navigate = useNavigate();

  const [sortState, setSortState] = useState(overrideSortStateWithQueryParams(getSortState(pageLocation, 'id'), pageLocation.search));

  const herdEntryList = useAppSelector(state => state.herdEntry.entities);
  const loading = useAppSelector(state => state.herdEntry.loading);

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
      <h2 id="herd-entry-heading" data-cy="HerdEntryHeading">
        Herd Entries
        <div className="d-flex justify-content-end">
          <Button className="me-2" variant="info" onClick={handleSyncList} disabled={loading}>
            <FontAwesomeIcon icon="sync" spin={loading} /> Refresh list
          </Button>
          <Link to="/herd-entry/new" className="btn btn-primary jh-create-entity" id="jh-create-entity" data-cy="entityCreateButton">
            <FontAwesomeIcon icon="plus" />
            &nbsp; Thêm mới một Herd Entry
          </Link>
        </div>
      </h2>
      <div className="table-responsive">
        {herdEntryList?.length > 0 ? (
          <Table responsive>
            <thead>
              <tr>
                <th className="hand" onClick={sort('id')}>
                  ID <FontAwesomeIcon icon={getSortIconByFieldName('id')} />
                </th>
                <th className="hand" onClick={sort('source')}>
                  Source <FontAwesomeIcon icon={getSortIconByFieldName('source')} />
                </th>
                <th className="hand" onClick={sort('entryDate')}>
                  Entry Date <FontAwesomeIcon icon={getSortIconByFieldName('entryDate')} />
                </th>
                <th className="hand" onClick={sort('historyDeclarations')}>
                  History Declarations <FontAwesomeIcon icon={getSortIconByFieldName('historyDeclarations')} />
                </th>
                <th>
                  Cattle <FontAwesomeIcon icon="sort" />
                </th>
                <th>
                  Initial Pen <FontAwesomeIcon icon="sort" />
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {herdEntryList.map(herdEntry => (
                <tr key={`entity-${herdEntry.id}`} data-cy="entityTable">
                  <td>
                    <Button as={Link as any} to={`/herd-entry/${herdEntry.id}`} variant="link" size="sm">
                      {herdEntry.id}
                    </Button>
                  </td>
                  <td>{herdEntry.source}</td>
                  <td>
                    {herdEntry.entryDate ? <TextFormat type="date" value={herdEntry.entryDate} format={APP_LOCAL_DATE_FORMAT} /> : null}
                  </td>
                  <td>{herdEntry.historyDeclarations}</td>
                  <td>{herdEntry.cattle ? <Link to={`/cattle/${herdEntry.cattle.id}`}>{herdEntry.cattle.id}</Link> : ''}</td>
                  <td>{herdEntry.initialPen ? <Link to={`/pen/${herdEntry.initialPen.id}`}>{herdEntry.initialPen.id}</Link> : ''}</td>
                  <td className="text-end">
                    <div className="btn-group flex-btn-group-container">
                      <Button as={Link as any} to={`/herd-entry/${herdEntry.id}`} variant="info" size="sm" data-cy="entityDetailsButton">
                        <FontAwesomeIcon icon="eye" /> <span className="d-none d-md-inline">Xem</span>
                      </Button>
                      <Button
                        as={Link as any}
                        to={`/herd-entry/${herdEntry.id}/edit`}
                        variant="primary"
                        size="sm"
                        data-cy="entityEditButton"
                      >
                        <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
                      </Button>
                      <Button
                        onClick={() => (globalThis.location.href = `/herd-entry/${herdEntry.id}/delete`)}
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
          !loading && <div className="alert alert-warning">No Herd Entries found</div>
        )}
      </div>
    </div>
  );
};

export default HerdEntry;
