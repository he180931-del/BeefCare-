import React, { useEffect } from 'react';
import { Button, Col, Row } from 'react-bootstrap';
import { TextFormat } from 'react-jhipster';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './announcement-version.reducer';

export const AnnouncementVersionDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const announcementVersionEntity = useAppSelector(state => state.announcementVersion.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="announcementVersionDetailsHeading">Announcement Version</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{announcementVersionEntity.id}</dd>
          <dt>
            <span id="versionNo">Version No</span>
          </dt>
          <dd>{announcementVersionEntity.versionNo}</dd>
          <dt>
            <span id="title">Title</span>
          </dt>
          <dd>{announcementVersionEntity.title}</dd>
          <dt>
            <span id="body">Body</span>
          </dt>
          <dd>{announcementVersionEntity.body}</dd>
          <dt>
            <span id="publishedTime">Published Time</span>
          </dt>
          <dd>
            {announcementVersionEntity.publishedTime ? (
              <TextFormat value={announcementVersionEntity.publishedTime} type="date" format={APP_DATE_FORMAT} />
            ) : null}
          </dd>
          <dt>Announcement</dt>
          <dd>{announcementVersionEntity.announcement ? announcementVersionEntity.announcement.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/announcement-version" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/announcement-version/${announcementVersionEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default AnnouncementVersionDetail;
