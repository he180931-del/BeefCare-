import React, { useEffect } from 'react';
import { Button, Col, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { TextFormat } from 'react-jhipster';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_DATE_FORMAT, APP_LOCAL_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './vaccination.reducer';

export const VaccinationDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const vaccinationEntity = useAppSelector(state => state.vaccination.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="vaccinationDetailsHeading">Vaccination</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{vaccinationEntity.id}</dd>
          <dt>
            <span id="vaccinationDate">Vaccination Date</span>
          </dt>
          <dd>
            {vaccinationEntity.vaccinationDate ? (
              <TextFormat value={vaccinationEntity.vaccinationDate} type="date" format={APP_LOCAL_DATE_FORMAT} />
            ) : null}
          </dd>
          <dt>
            <span id="entryTime">Entry Time</span>
          </dt>
          <dd>
            {vaccinationEntity.entryTime ? <TextFormat value={vaccinationEntity.entryTime} type="date" format={APP_DATE_FORMAT} /> : null}
          </dd>
          <dt>
            <span id="dose">Dose</span>
          </dt>
          <dd>{vaccinationEntity.dose}</dd>
          <dt>
            <span id="batchNo">Batch No</span>
          </dt>
          <dd>{vaccinationEntity.batchNo}</dd>
          <dt>
            <span id="source">Source</span>
            <OverlayTrigger overlay={<Tooltip>ON_FARM | HISTORICAL</Tooltip>}>
              <span id="source" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>{vaccinationEntity.source}</dd>
          <dt>
            <span id="vaccinator">Vaccinator</span>
          </dt>
          <dd>{vaccinationEntity.vaccinator}</dd>
          <dt>Cattle</dt>
          <dd>{vaccinationEntity.cattle ? vaccinationEntity.cattle.id : ''}</dd>
          <dt>Vaccine</dt>
          <dd>{vaccinationEntity.vaccine ? vaccinationEntity.vaccine.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/vaccination" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/vaccination/${vaccinationEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default VaccinationDetail;
