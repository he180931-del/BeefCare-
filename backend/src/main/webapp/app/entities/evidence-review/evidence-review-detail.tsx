import React, { useEffect } from 'react';
import { Button, Col, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { TextFormat } from 'react-jhipster';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './evidence-review.reducer';

export const EvidenceReviewDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const evidenceReviewEntity = useAppSelector(state => state.evidenceReview.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="evidenceReviewDetailsHeading">Evidence Review</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{evidenceReviewEntity.id}</dd>
          <dt>
            <span id="decision">Decision</span>
          </dt>
          <dd>{evidenceReviewEntity.decision}</dd>
          <dt>
            <span id="reason">Reason</span>
          </dt>
          <dd>{evidenceReviewEntity.reason}</dd>
          <dt>
            <span id="reviewedAt">Reviewed At</span>
            <OverlayTrigger overlay={<Tooltip>ERD: time</Tooltip>}>
              <span id="reviewedAt" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>
            {evidenceReviewEntity.reviewedAt ? (
              <TextFormat value={evidenceReviewEntity.reviewedAt} type="date" format={APP_DATE_FORMAT} />
            ) : null}
          </dd>
          <dt>Evidence</dt>
          <dd>{evidenceReviewEntity.evidence ? evidenceReviewEntity.evidence.id : ''}</dd>
          <dt>Pm User</dt>
          <dd>{evidenceReviewEntity.pmUser ? evidenceReviewEntity.pmUser.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/evidence-review" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/evidence-review/${evidenceReviewEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default EvidenceReviewDetail;
