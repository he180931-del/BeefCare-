import React, { useEffect } from 'react';
import { Button, Col, Row } from 'react-bootstrap';
import { TextFormat } from 'react-jhipster';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_LOCAL_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './pen-reception-criteria.reducer';

export const PenReceptionCriteriaDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const penReceptionCriteriaEntity = useAppSelector(state => state.penReceptionCriteria.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="penReceptionCriteriaDetailsHeading">Pen Reception Criteria</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{penReceptionCriteriaEntity.id}</dd>
          <dt>
            <span id="versionNo">Version No</span>
          </dt>
          <dd>{penReceptionCriteriaEntity.versionNo}</dd>
          <dt>
            <span id="acceptedPurposes">Accepted Purposes</span>
          </dt>
          <dd>{penReceptionCriteriaEntity.acceptedPurposes}</dd>
          <dt>
            <span id="acceptedStages">Accepted Stages</span>
          </dt>
          <dd>{penReceptionCriteriaEntity.acceptedStages}</dd>
          <dt>
            <span id="thresholds">Thresholds</span>
          </dt>
          <dd>{penReceptionCriteriaEntity.thresholds}</dd>
          <dt>
            <span id="effectiveFrom">Effective From</span>
          </dt>
          <dd>
            {penReceptionCriteriaEntity.effectiveFrom ? (
              <TextFormat value={penReceptionCriteriaEntity.effectiveFrom} type="date" format={APP_LOCAL_DATE_FORMAT} />
            ) : null}
          </dd>
          <dt>Pen</dt>
          <dd>{penReceptionCriteriaEntity.pen ? penReceptionCriteriaEntity.pen.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/pen-reception-criteria" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/pen-reception-criteria/${penReceptionCriteriaEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default PenReceptionCriteriaDetail;
