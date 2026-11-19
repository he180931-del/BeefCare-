import React, { useEffect } from 'react';
import { Button, Col, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { TextFormat } from 'react-jhipster';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_DATE_FORMAT, APP_LOCAL_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './growth.reducer';

export const GrowthDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const growthEntity = useAppSelector(state => state.growth.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="growthDetailsHeading">Growth</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{growthEntity.id}</dd>
          <dt>
            <span id="checkDate">Check Date</span>
          </dt>
          <dd>
            {growthEntity.checkDate ? <TextFormat value={growthEntity.checkDate} type="date" format={APP_LOCAL_DATE_FORMAT} /> : null}
          </dd>
          <dt>
            <span id="entryTime">Entry Time</span>
          </dt>
          <dd>{growthEntity.entryTime ? <TextFormat value={growthEntity.entryTime} type="date" format={APP_DATE_FORMAT} /> : null}</dd>
          <dt>
            <span id="weightKg">Weight Kg</span>
          </dt>
          <dd>{growthEntity.weightKg}</dd>
          <dt>
            <span id="weightType">Weight Type</span>
            <OverlayTrigger overlay={<Tooltip>MEASURED | ESTIMATED</Tooltip>}>
              <span id="weightType" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>{growthEntity.weightType}</dd>
          <dt>
            <span id="bcs">Bcs</span>
          </dt>
          <dd>{growthEntity.bcs}</dd>
          <dt>
            <span id="status">Status</span>
            <OverlayTrigger overlay={<Tooltip>VALID | CORRECTED | EXCLUDED</Tooltip>}>
              <span id="status" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>{growthEntity.status}</dd>
          <dt>
            <span id="correctionReason">Correction Reason</span>
          </dt>
          <dd>{growthEntity.correctionReason}</dd>
          <dt>Cattle</dt>
          <dd>{growthEntity.cattle ? growthEntity.cattle.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/growth" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/growth/${growthEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default GrowthDetail;
