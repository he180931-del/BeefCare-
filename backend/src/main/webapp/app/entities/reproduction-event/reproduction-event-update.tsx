import React, { useEffect } from 'react';
import { Button, Col, FormText, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { ValidatedField, ValidatedForm } from 'react-jhipster';
import { Link, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { getEntities as getCattles } from 'app/entities/cattle/cattle.reducer';
import { getEntities as getReproductionEvents } from 'app/entities/reproduction-event/reproduction-event.reducer';
import { convertDateTimeFromServer, convertDateTimeToServer, displayDefaultDateTime } from 'app/shared/util/date-utils';

import { createEntity, getEntity, reset, updateEntity } from './reproduction-event.reducer';

export const ReproductionEventUpdate = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { id } = useParams<'id'>();
  const isNew = id === undefined;

  const cattles = useAppSelector(state => state.cattle.entities);
  const reproductionEvents = useAppSelector(state => state.reproductionEvent.entities);
  const reproductionEventEntity = useAppSelector(state => state.reproductionEvent.entity);
  const loading = useAppSelector(state => state.reproductionEvent.loading);
  const updating = useAppSelector(state => state.reproductionEvent.updating);
  const updateSuccess = useAppSelector(state => state.reproductionEvent.updateSuccess);

  const handleClose = () => {
    navigate('/reproduction-event');
  };

  useEffect(() => {
    if (isNew) {
      dispatch(reset());
    } else {
      dispatch(getEntity(id));
    }

    dispatch(getCattles({}));
    dispatch(getReproductionEvents({}));
  }, []);

  useEffect(() => {
    if (updateSuccess) {
      handleClose();
    }
  }, [updateSuccess]);

  const saveEntity = values => {
    if (values.id !== undefined && typeof values.id !== 'number') {
      values.id = Number(values.id);
    }
    values.eventTime = convertDateTimeToServer(values.eventTime);

    const entity = {
      ...reproductionEventEntity,
      ...values,
      cattle: cattles.find(it => it.id.toString() === values.cattle?.toString()),
      linkedEvent: reproductionEvents.find(it => it.id.toString() === values.linkedEvent?.toString()),
    };

    if (isNew) {
      dispatch(createEntity(entity));
    } else {
      dispatch(updateEntity(entity));
    }
  };

  const defaultValues = () =>
    isNew
      ? {
          eventTime: displayDefaultDateTime(),
        }
      : {
          ...reproductionEventEntity,
          eventTime: convertDateTimeFromServer(reproductionEventEntity.eventTime),
          cattle: reproductionEventEntity?.cattle?.id,
          linkedEvent: reproductionEventEntity?.linkedEvent?.id,
        };

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="beefcareApp.reproductionEvent.home.createOrEditLabel" data-cy="ReproductionEventCreateUpdateHeading">
            Thêm mới hoặc cập nhật Reproduction Event
          </h2>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col md="8">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ValidatedForm defaultValues={defaultValues()} onSubmit={saveEntity}>
              {!isNew && <ValidatedField name="id" required readOnly id="reproduction-event-id" label="ID" validate={{ required: true }} />}
              <ValidatedField
                label="Type"
                id="reproduction-event-type"
                name="type"
                data-cy="type"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <OverlayTrigger overlay={<Tooltip>ESTRUS | BREEDING | PREGNANCY_CHECK</Tooltip>}>
                <span id="typeLabel" className="d-inline-block">
                  ?
                </span>
              </OverlayTrigger>
              <ValidatedField
                label="Event Time"
                id="reproduction-event-eventTime"
                name="eventTime"
                data-cy="eventTime"
                type="datetime-local"
                placeholder="YYYY-MM-DD HH:mm"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField
                label="Method"
                id="reproduction-event-method"
                name="method"
                data-cy="method"
                type="text"
                validate={{
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <ValidatedField
                label="Result"
                id="reproduction-event-result"
                name="result"
                data-cy="result"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <ValidatedField
                label="Source"
                id="reproduction-event-source"
                name="source"
                data-cy="source"
                type="text"
                validate={{
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <ValidatedField id="reproduction-event-cattle" name="cattle" data-cy="cattle" label="Cattle" type="select" required>
                <option value="" key="0" />
                {cattles
                  ? cattles.map(otherEntity => (
                      <option value={otherEntity.id} key={otherEntity.id}>
                        {otherEntity.id}
                      </option>
                    ))
                  : null}
              </ValidatedField>
              <FormText>Trường này bắt buộc phải nhập.</FormText>
              <ValidatedField
                id="reproduction-event-linkedEvent"
                name="linkedEvent"
                data-cy="linkedEvent"
                label="Linked Event"
                type="select"
              >
                <option value="" key="0" />
                {reproductionEvents
                  ? reproductionEvents.map(otherEntity => (
                      <option value={otherEntity.id} key={otherEntity.id}>
                        {otherEntity.id}
                      </option>
                    ))
                  : null}
              </ValidatedField>
              <Button as={Link as any} id="cancel-save" data-cy="entityCreateCancelButton" to="/reproduction-event" replace variant="info">
                <FontAwesomeIcon icon="arrow-left" />
                &nbsp;
                <span className="d-none d-md-inline">Quay lại</span>
              </Button>
              &nbsp;
              <Button variant="primary" id="save-entity" data-cy="entityCreateSaveButton" type="submit" disabled={updating}>
                <FontAwesomeIcon icon="save" />
                &nbsp; Lưu
              </Button>
            </ValidatedForm>
          )}
        </Col>
      </Row>
    </div>
  );
};

export default ReproductionEventUpdate;
