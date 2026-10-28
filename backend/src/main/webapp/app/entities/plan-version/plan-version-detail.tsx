import React, { useEffect } from 'react';
import { Button, Col, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { TextFormat } from 'react-jhipster';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './plan-version.reducer';

export const PlanVersionDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const planVersionEntity = useAppSelector(state => state.planVersion.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="planVersionDetailsHeading">Plan Version</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{planVersionEntity.id}</dd>
          <dt>
            <span id="price1y">Price 1 Y</span>
            <OverlayTrigger overlay={<Tooltip>ERD: price_1y / 2y / 3y - tách thành 3 cột</Tooltip>}>
              <span id="price1y" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>{planVersionEntity.price1y}</dd>
          <dt>
            <span id="price2y">Price 2 Y</span>
          </dt>
          <dd>{planVersionEntity.price2y}</dd>
          <dt>
            <span id="price3y">Price 3 Y</span>
          </dt>
          <dd>{planVersionEntity.price3y}</dd>
          <dt>
            <span id="terms">Terms</span>
          </dt>
          <dd>{planVersionEntity.terms}</dd>
          <dt>
            <span id="effectiveAt">Effective At</span>
          </dt>
          <dd>
            {planVersionEntity.effectiveAt ? (
              <TextFormat value={planVersionEntity.effectiveAt} type="date" format={APP_DATE_FORMAT} />
            ) : null}
          </dd>
        </dl>
        <Button as={Link as any} to="/plan-version" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/plan-version/${planVersionEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default PlanVersionDetail;
