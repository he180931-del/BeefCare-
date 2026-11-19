import React, { useEffect } from 'react';
import { Button, Col, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { TextFormat } from 'react-jhipster';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_LOCAL_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './cattle.reducer';

export const CattleDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const cattleEntity = useAppSelector(state => state.cattle.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="cattleDetailsHeading">Cattle</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{cattleEntity.id}</dd>
          <dt>
            <span id="displayCode">Display Code</span>
          </dt>
          <dd>{cattleEntity.displayCode}</dd>
          <dt>
            <span id="earTag">Ear Tag</span>
          </dt>
          <dd>{cattleEntity.earTag}</dd>
          <dt>
            <span id="sex">Sex</span>
            <OverlayTrigger overlay={<Tooltip>MALE | FEMALE</Tooltip>}>
              <span id="sex" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>{cattleEntity.sex}</dd>
          <dt>
            <span id="birthDate">Birth Date</span>
          </dt>
          <dd>
            {cattleEntity.birthDate ? <TextFormat value={cattleEntity.birthDate} type="date" format={APP_LOCAL_DATE_FORMAT} /> : null}
          </dd>
          <dt>
            <span id="lifeStage">Life Stage</span>
          </dt>
          <dd>{cattleEntity.lifeStage}</dd>
          <dt>
            <span id="herdStatus">Herd Status</span>
            <OverlayTrigger overlay={<Tooltip>ACTIVE | EXITED</Tooltip>}>
              <span id="herdStatus" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>{cattleEntity.herdStatus}</dd>
          <dt>Farm</dt>
          <dd>{cattleEntity.farm ? cattleEntity.farm.id : ''}</dd>
          <dt>Breed</dt>
          <dd>{cattleEntity.breed ? cattleEntity.breed.id : ''}</dd>
          <dt>Purpose</dt>
          <dd>{cattleEntity.purpose ? cattleEntity.purpose.id : ''}</dd>
          <dt>Dam</dt>
          <dd>{cattleEntity.dam ? cattleEntity.dam.id : ''}</dd>
          <dt>Sire</dt>
          <dd>{cattleEntity.sire ? cattleEntity.sire.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/cattle" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/cattle/${cattleEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default CattleDetail;
