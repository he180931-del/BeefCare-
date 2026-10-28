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

import { getEntities } from './announcement-recipient.reducer';

export const AnnouncementRecipient = () => {
  const dispatch = useAppDispatch();

  const pageLocation = useLocation();
  const navigate = useNavigate();

  const [sortState, setSortState] = useState(overrideSortStateWithQueryParams(getSortState(pageLocation, 'id'), pageLocation.search));

  const announcementRecipientList = useAppSelector(state => state.announcementRecipient.entities);
  const loading = useAppSelector(state => state.announcementRecipient.loading);

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
      <h2 id="announcement-recipient-heading" data-cy="AnnouncementRecipientHeading">
        Announcement Recipients
        <div className="d-flex justify-content-end">
          <Button className="me-2" variant="info" onClick={handleSyncList} disabled={loading}>
            <FontAwesomeIcon icon="sync" spin={loading} /> Refresh list
          </Button>
          <Link
            to="/announcement-recipient/new"
            className="btn btn-primary jh-create-entity"
            id="jh-create-entity"
            data-cy="entityCreateButton"
          >
            <FontAwesomeIcon icon="plus" />
            &nbsp; Thêm mới một Announcement Recipient
          </Link>
        </div>
      </h2>
      <div className="table-responsive">
        {announcementRecipientList?.length > 0 ? (
          <Table responsive>
            <thead>
              <tr>
                <th className="hand" onClick={sort('id')}>
                  ID <FontAwesomeIcon icon={getSortIconByFieldName('id')} />
                </th>
                <th className="hand" onClick={sort('deliveredTime')}>
                  Delivered Time <FontAwesomeIcon icon={getSortIconByFieldName('deliveredTime')} />
                </th>
                <th className="hand" onClick={sort('readTime')}>
                  Read Time <FontAwesomeIcon icon={getSortIconByFieldName('readTime')} />
                </th>
                <th>
                  Version <FontAwesomeIcon icon="sort" />
                </th>
                <th>
                  Membership <FontAwesomeIcon icon="sort" />
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {announcementRecipientList.map(announcementRecipient => (
                <tr key={`entity-${announcementRecipient.id}`} data-cy="entityTable">
                  <td>
                    <Button as={Link as any} to={`/announcement-recipient/${announcementRecipient.id}`} variant="link" size="sm">
                      {announcementRecipient.id}
                    </Button>
                  </td>
                  <td>
                    {announcementRecipient.deliveredTime ? (
                      <TextFormat type="date" value={announcementRecipient.deliveredTime} format={APP_DATE_FORMAT} />
                    ) : null}
                  </td>
                  <td>
                    {announcementRecipient.readTime ? (
                      <TextFormat type="date" value={announcementRecipient.readTime} format={APP_DATE_FORMAT} />
                    ) : null}
                  </td>
                  <td>
                    {announcementRecipient.version ? (
                      <Link to={`/announcement-version/${announcementRecipient.version.id}`}>{announcementRecipient.version.id}</Link>
                    ) : (
                      ''
                    )}
                  </td>
                  <td>
                    {announcementRecipient.membership ? (
                      <Link to={`/farm-membership/${announcementRecipient.membership.id}`}>{announcementRecipient.membership.id}</Link>
                    ) : (
                      ''
                    )}
                  </td>
                  <td className="text-end">
                    <div className="btn-group flex-btn-group-container">
                      <Button
                        as={Link as any}
                        to={`/announcement-recipient/${announcementRecipient.id}`}
                        variant="info"
                        size="sm"
                        data-cy="entityDetailsButton"
                      >
                        <FontAwesomeIcon icon="eye" /> <span className="d-none d-md-inline">Xem</span>
                      </Button>
                      <Button
                        as={Link as any}
                        to={`/announcement-recipient/${announcementRecipient.id}/edit`}
                        variant="primary"
                        size="sm"
                        data-cy="entityEditButton"
                      >
                        <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
                      </Button>
                      <Button
                        onClick={() => (globalThis.location.href = `/announcement-recipient/${announcementRecipient.id}/delete`)}
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
          !loading && <div className="alert alert-warning">No Announcement Recipients found</div>
        )}
      </div>
    </div>
  );
};

export default AnnouncementRecipient;
