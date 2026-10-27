import React, { useEffect } from 'react';
import { Button, Col, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { TextFormat } from 'react-jhipster';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './subscription.reducer';

export const SubscriptionDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const subscriptionEntity = useAppSelector(state => state.subscription.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="subscriptionDetailsHeading">Subscription</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{subscriptionEntity.id}</dd>
          <dt>
            <span id="entitlementStatus">Entitlement Status</span>
          </dt>
          <dd>{subscriptionEntity.entitlementStatus}</dd>
          <dt>
            <span id="latestEnd">Latest End</span>
            <OverlayTrigger
              overlay={<Tooltip>ERD: varchar(255) NOT NULL; đổi sang thời điểm và để trống được vì farm mới chưa có kỳ đã trả</Tooltip>}
            >
              <span id="latestEnd" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>
            {subscriptionEntity.latestEnd ? <TextFormat value={subscriptionEntity.latestEnd} type="date" format={APP_DATE_FORMAT} /> : null}
          </dd>
          <dt>Farm</dt>
          <dd>{subscriptionEntity.farm ? subscriptionEntity.farm.id : ''}</dd>
          <dt>Plan Version</dt>
          <dd>{subscriptionEntity.planVersion ? subscriptionEntity.planVersion.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/subscription" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/subscription/${subscriptionEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default SubscriptionDetail;
