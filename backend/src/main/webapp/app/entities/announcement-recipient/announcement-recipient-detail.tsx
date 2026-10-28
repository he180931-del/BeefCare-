import React, { useEffect } from 'react';
import { Button, Col, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { TextFormat } from 'react-jhipster';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './announcement-recipient.reducer';

export const AnnouncementRecipientDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const announcementRecipientEntity = useAppSelector(state => state.announcementRecipient.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="announcementRecipientDetailsHeading">Announcement Recipient</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{announcementRecipientEntity.id}</dd>
          <dt>
            <span id="deliveredTime">Delivered Time</span>
          </dt>
          <dd>
            {announcementRecipientEntity.deliveredTime ? (
              <TextFormat value={announcementRecipientEntity.deliveredTime} type="date" format={APP_DATE_FORMAT} />
            ) : null}
          </dd>
          <dt>
            <span id="readTime">Read Time</span>
            <OverlayTrigger overlay={<Tooltip>ERD: NOT NULL; để trống được vì chưa đọc thì chưa có thời điểm đọc</Tooltip>}>
              <span id="readTime" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>
            {announcementRecipientEntity.readTime ? (
              <TextFormat value={announcementRecipientEntity.readTime} type="date" format={APP_DATE_FORMAT} />
            ) : null}
          </dd>
          <dt>Version</dt>
          <dd>{announcementRecipientEntity.version ? announcementRecipientEntity.version.id : ''}</dd>
          <dt>Membership</dt>
          <dd>{announcementRecipientEntity.membership ? announcementRecipientEntity.membership.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/announcement-recipient" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/announcement-recipient/${announcementRecipientEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default AnnouncementRecipientDetail;
