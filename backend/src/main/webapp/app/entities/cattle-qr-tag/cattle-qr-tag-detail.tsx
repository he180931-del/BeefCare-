import React, { useEffect } from 'react';
import { Button, Col, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { Link, useParams } from 'react-router';
import {} from 'react-jhipster';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './cattle-qr-tag.reducer';

export const CattleQrTagDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const cattleQrTagEntity = useAppSelector(state => state.cattleQrTag.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="cattleQrTagDetailsHeading">Cattle Qr Tag</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{cattleQrTagEntity.id}</dd>
          <dt>
            <span id="tagCode">Tag Code</span>
          </dt>
          <dd>{cattleQrTagEntity.tagCode}</dd>
          <dt>
            <span id="status">Status</span>
            <OverlayTrigger overlay={<Tooltip>ACTIVE | REPLACED</Tooltip>}>
              <span id="status" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>{cattleQrTagEntity.status}</dd>
          <dt>Cattle</dt>
          <dd>{cattleQrTagEntity.cattle ? cattleQrTagEntity.cattle.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/cattle-qr-tag" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/cattle-qr-tag/${cattleQrTagEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default CattleQrTagDetail;
