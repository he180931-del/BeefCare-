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

import { getEntities } from './pregnancy-episode.reducer';

export const PregnancyEpisode = () => {
  const dispatch = useAppDispatch();

  const pageLocation = useLocation();
  const navigate = useNavigate();

  const [sortState, setSortState] = useState(overrideSortStateWithQueryParams(getSortState(pageLocation, 'id'), pageLocation.search));

  const pregnancyEpisodeList = useAppSelector(state => state.pregnancyEpisode.entities);
  const loading = useAppSelector(state => state.pregnancyEpisode.loading);

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
      <h2 id="pregnancy-episode-heading" data-cy="PregnancyEpisodeHeading">
        Pregnancy Episodes
        <div className="d-flex justify-content-end">
          <Button className="me-2" variant="info" onClick={handleSyncList} disabled={loading}>
            <FontAwesomeIcon icon="sync" spin={loading} /> Refresh list
          </Button>
          <Link to="/pregnancy-episode/new" className="btn btn-primary jh-create-entity" id="jh-create-entity" data-cy="entityCreateButton">
            <FontAwesomeIcon icon="plus" />
            &nbsp; Thêm mới một Pregnancy Episode
          </Link>
        </div>
      </h2>
      <div className="table-responsive">
        {pregnancyEpisodeList?.length > 0 ? (
          <Table responsive>
            <thead>
              <tr>
                <th className="hand" onClick={sort('id')}>
                  ID <FontAwesomeIcon icon={getSortIconByFieldName('id')} />
                </th>
                <th className="hand" onClick={sort('expectedCalvingDate')}>
                  Expected Calving Date <FontAwesomeIcon icon={getSortIconByFieldName('expectedCalvingDate')} />
                </th>
                <th className="hand" onClick={sort('parity')}>
                  Parity <FontAwesomeIcon icon={getSortIconByFieldName('parity')} />
                </th>
                <th className="hand" onClick={sort('status')}>
                  Status <FontAwesomeIcon icon={getSortIconByFieldName('status')} />
                </th>
                <th>
                  Confirming Check <FontAwesomeIcon icon="sort" />
                </th>
                <th>
                  Cattle <FontAwesomeIcon icon="sort" />
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pregnancyEpisodeList.map(pregnancyEpisode => (
                <tr key={`entity-${pregnancyEpisode.id}`} data-cy="entityTable">
                  <td>
                    <Button as={Link as any} to={`/pregnancy-episode/${pregnancyEpisode.id}`} variant="link" size="sm">
                      {pregnancyEpisode.id}
                    </Button>
                  </td>
                  <td>
                    {pregnancyEpisode.expectedCalvingDate ? (
                      <TextFormat type="date" value={pregnancyEpisode.expectedCalvingDate} format={APP_LOCAL_DATE_FORMAT} />
                    ) : null}
                  </td>
                  <td>{pregnancyEpisode.parity}</td>
                  <td>{pregnancyEpisode.status}</td>
                  <td>
                    {pregnancyEpisode.confirmingCheck ? (
                      <Link to={`/reproduction-event/${pregnancyEpisode.confirmingCheck.id}`}>{pregnancyEpisode.confirmingCheck.id}</Link>
                    ) : (
                      ''
                    )}
                  </td>
                  <td>
                    {pregnancyEpisode.cattle ? <Link to={`/cattle/${pregnancyEpisode.cattle.id}`}>{pregnancyEpisode.cattle.id}</Link> : ''}
                  </td>
                  <td className="text-end">
                    <div className="btn-group flex-btn-group-container">
                      <Button
                        as={Link as any}
                        to={`/pregnancy-episode/${pregnancyEpisode.id}`}
                        variant="info"
                        size="sm"
                        data-cy="entityDetailsButton"
                      >
                        <FontAwesomeIcon icon="eye" /> <span className="d-none d-md-inline">Xem</span>
                      </Button>
                      <Button
                        as={Link as any}
                        to={`/pregnancy-episode/${pregnancyEpisode.id}/edit`}
                        variant="primary"
                        size="sm"
                        data-cy="entityEditButton"
                      >
                        <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
                      </Button>
                      <Button
                        onClick={() => (globalThis.location.href = `/pregnancy-episode/${pregnancyEpisode.id}/delete`)}
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
          !loading && <div className="alert alert-warning">No Pregnancy Episodes found</div>
        )}
      </div>
    </div>
  );
};

export default PregnancyEpisode;
