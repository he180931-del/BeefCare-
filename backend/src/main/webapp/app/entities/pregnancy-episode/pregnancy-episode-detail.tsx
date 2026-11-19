import React, { useEffect } from 'react';
import { Button, Col, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { TextFormat } from 'react-jhipster';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_LOCAL_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './pregnancy-episode.reducer';

export const PregnancyEpisodeDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const pregnancyEpisodeEntity = useAppSelector(state => state.pregnancyEpisode.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="pregnancyEpisodeDetailsHeading">Pregnancy Episode</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{pregnancyEpisodeEntity.id}</dd>
          <dt>
            <span id="expectedCalvingDate">Expected Calving Date</span>
          </dt>
          <dd>
            {pregnancyEpisodeEntity.expectedCalvingDate ? (
              <TextFormat value={pregnancyEpisodeEntity.expectedCalvingDate} type="date" format={APP_LOCAL_DATE_FORMAT} />
            ) : null}
          </dd>
          <dt>
            <span id="parity">Parity</span>
          </dt>
          <dd>{pregnancyEpisodeEntity.parity}</dd>
          <dt>
            <span id="status">Status</span>
            <OverlayTrigger overlay={<Tooltip>OPEN | CALVED | LOST</Tooltip>}>
              <span id="status" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>{pregnancyEpisodeEntity.status}</dd>
          <dt>Confirming Check</dt>
          <dd>{pregnancyEpisodeEntity.confirmingCheck ? pregnancyEpisodeEntity.confirmingCheck.id : ''}</dd>
          <dt>Cattle</dt>
          <dd>{pregnancyEpisodeEntity.cattle ? pregnancyEpisodeEntity.cattle.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/pregnancy-episode" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/pregnancy-episode/${pregnancyEpisodeEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default PregnancyEpisodeDetail;
