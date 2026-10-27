import React, { useEffect } from 'react';
import { Button, Col, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { TextFormat } from 'react-jhipster';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './notification.reducer';

export const NotificationDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const notificationEntity = useAppSelector(state => state.notification.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="notificationDetailsHeading">Notification</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{notificationEntity.id}</dd>
          <dt>
            <span id="targetType">Target Type</span>
            <OverlayTrigger overlay={<Tooltip>ERD: target_type + target_id - tách 2 cột</Tooltip>}>
              <span id="targetType" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>{notificationEntity.targetType}</dd>
          <dt>
            <span id="targetId">Target Id</span>
          </dt>
          <dd>{notificationEntity.targetId}</dd>
          <dt>
            <span id="createdTime">Created Time</span>
          </dt>
          <dd>
            {notificationEntity.createdTime ? (
              <TextFormat value={notificationEntity.createdTime} type="date" format={APP_DATE_FORMAT} />
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
            {notificationEntity.readTime ? <TextFormat value={notificationEntity.readTime} type="date" format={APP_DATE_FORMAT} /> : null}
          </dd>
          <dt>Recipient</dt>
          <dd>{notificationEntity.recipient ? notificationEntity.recipient.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/notification" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/notification/${notificationEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default NotificationDetail;
