import React, { useEffect } from 'react';
import { Button, Col, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { Link, useParams } from 'react-router';
import {} from 'react-jhipster';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './vaccine.reducer';

export const VaccineDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const vaccineEntity = useAppSelector(state => state.vaccine.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="vaccineDetailsHeading">Vaccine</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{vaccineEntity.id}</dd>
          <dt>
            <span id="code">Code</span>
          </dt>
          <dd>{vaccineEntity.code}</dd>
          <dt>
            <span id="name">Name</span>
          </dt>
          <dd>{vaccineEntity.name}</dd>
          <dt>
            <span id="diseasePrevented">Disease Prevented</span>
          </dt>
          <dd>{vaccineEntity.diseasePrevented}</dd>
          <dt>
            <span id="manufacturer">Manufacturer</span>
          </dt>
          <dd>{vaccineEntity.manufacturer}</dd>
          <dt>
            <span id="dose">Dose</span>
            <OverlayTrigger overlay={<Tooltip>ERD: dose / route - tách 2 cột</Tooltip>}>
              <span id="dose" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>{vaccineEntity.dose}</dd>
          <dt>
            <span id="route">Route</span>
          </dt>
          <dd>{vaccineEntity.route}</dd>
          <dt>
            <span id="boosterInterval">Booster Interval</span>
          </dt>
          <dd>{vaccineEntity.boosterInterval}</dd>
          <dt>
            <span id="withdrawalInfo">Withdrawal Info</span>
          </dt>
          <dd>{vaccineEntity.withdrawalInfo}</dd>
          <dt>
            <span id="available">Available</span>
          </dt>
          <dd>{vaccineEntity.available ? 'true' : 'false'}</dd>
          <dt>Farm</dt>
          <dd>{vaccineEntity.farm ? vaccineEntity.farm.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/vaccine" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/vaccine/${vaccineEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default VaccineDetail;
