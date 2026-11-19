import React, { useEffect } from 'react';
import { Button, Col, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { TextFormat } from 'react-jhipster';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_LOCAL_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './herd-entry.reducer';

export const HerdEntryDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const herdEntryEntity = useAppSelector(state => state.herdEntry.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="herdEntryDetailsHeading">Herd Entry</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{herdEntryEntity.id}</dd>
          <dt>
            <span id="source">Source</span>
            <OverlayTrigger overlay={<Tooltip>EXTERNAL | FARM_BORN</Tooltip>}>
              <span id="source" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>{herdEntryEntity.source}</dd>
          <dt>
            <span id="entryDate">Entry Date</span>
          </dt>
          <dd>
            {herdEntryEntity.entryDate ? <TextFormat value={herdEntryEntity.entryDate} type="date" format={APP_LOCAL_DATE_FORMAT} /> : null}
          </dd>
          <dt>
            <span id="historyDeclarations">History Declarations</span>
          </dt>
          <dd>{herdEntryEntity.historyDeclarations}</dd>
          <dt>Cattle</dt>
          <dd>{herdEntryEntity.cattle ? herdEntryEntity.cattle.id : ''}</dd>
          <dt>Initial Pen</dt>
          <dd>{herdEntryEntity.initialPen ? herdEntryEntity.initialPen.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/herd-entry" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/herd-entry/${herdEntryEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default HerdEntryDetail;
