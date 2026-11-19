import React, { useEffect } from 'react';
import { Button, Col, Row } from 'react-bootstrap';
import { TextFormat } from 'react-jhipster';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './pregnancy-update.reducer';

export const PregnancyUpdateDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const pregnancyUpdateEntity = useAppSelector(state => state.pregnancyUpdate.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="pregnancyUpdateDetailsHeading">Pregnancy Update</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{pregnancyUpdateEntity.id}</dd>
          <dt>
            <span id="type">Type</span>
          </dt>
          <dd>{pregnancyUpdateEntity.type}</dd>
          <dt>
            <span id="occurredTime">Occurred Time</span>
          </dt>
          <dd>
            {pregnancyUpdateEntity.occurredTime ? (
              <TextFormat value={pregnancyUpdateEntity.occurredTime} type="date" format={APP_DATE_FORMAT} />
            ) : null}
          </dd>
          <dt>
            <span id="details">Details</span>
          </dt>
          <dd>{pregnancyUpdateEntity.details}</dd>
          <dt>Episode</dt>
          <dd>{pregnancyUpdateEntity.episode ? pregnancyUpdateEntity.episode.id : ''}</dd>
          <dt>Health Case</dt>
          <dd>{pregnancyUpdateEntity.healthCase ? pregnancyUpdateEntity.healthCase.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/pregnancy-update" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/pregnancy-update/${pregnancyUpdateEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default PregnancyUpdateDetail;
