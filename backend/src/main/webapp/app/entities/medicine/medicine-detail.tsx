import React, { useEffect } from 'react';
import { Button, Col, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './medicine.reducer';

export const MedicineDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const medicineEntity = useAppSelector(state => state.medicine.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="medicineDetailsHeading">Medicine</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{medicineEntity.id}</dd>
          <dt>
            <span id="code">Code</span>
          </dt>
          <dd>{medicineEntity.code}</dd>
          <dt>
            <span id="name">Name</span>
          </dt>
          <dd>{medicineEntity.name}</dd>
          <dt>
            <span id="description">Description</span>
          </dt>
          <dd>{medicineEntity.description}</dd>
          <dt>
            <span id="dose">Dose</span>
            <OverlayTrigger overlay={<Tooltip>ERD: dose / route - tách 2 cột</Tooltip>}>
              <span id="dose" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>{medicineEntity.dose}</dd>
          <dt>
            <span id="route">Route</span>
          </dt>
          <dd>{medicineEntity.route}</dd>
          <dt>
            <span id="withdrawalInfo">Withdrawal Info</span>
          </dt>
          <dd>{medicineEntity.withdrawalInfo}</dd>
          <dt>
            <span id="available">Available</span>
          </dt>
          <dd>{medicineEntity.available ? 'true' : 'false'}</dd>
          <dt>Farm</dt>
          <dd>{medicineEntity.farm ? medicineEntity.farm.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/medicine" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/medicine/${medicineEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default MedicineDetail;
