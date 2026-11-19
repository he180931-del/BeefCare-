import React, { useEffect } from 'react';
import { Button, Col, Row } from 'react-bootstrap';
import { Link, useParams } from 'react-router';
import {} from 'react-jhipster';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './farm-announcement.reducer';

export const FarmAnnouncementDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const farmAnnouncementEntity = useAppSelector(state => state.farmAnnouncement.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="farmAnnouncementDetailsHeading">Farm Announcement</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{farmAnnouncementEntity.id}</dd>
          <dt>
            <span id="state">State</span>
          </dt>
          <dd>{farmAnnouncementEntity.state}</dd>
          <dt>Farm</dt>
          <dd>{farmAnnouncementEntity.farm ? farmAnnouncementEntity.farm.id : ''}</dd>
          <dt>Author</dt>
          <dd>{farmAnnouncementEntity.author ? farmAnnouncementEntity.author.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/farm-announcement" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/farm-announcement/${farmAnnouncementEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default FarmAnnouncementDetail;
