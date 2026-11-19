import React, { useEffect } from 'react';
import { Button, Col, FormText, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { ValidatedField, ValidatedForm } from 'react-jhipster';
import { Link, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { getEntities as getCalvingEvents } from 'app/entities/calving-event/calving-event.reducer';
import { getEntities as getCattles } from 'app/entities/cattle/cattle.reducer';

import { createEntity, getEntity, reset, updateEntity } from './calf-outcome.reducer';

export const CalfOutcomeUpdate = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { id } = useParams<'id'>();
  const isNew = id === undefined;

  const calvingEvents = useAppSelector(state => state.calvingEvent.entities);
  const cattles = useAppSelector(state => state.cattle.entities);
  const calfOutcomeEntity = useAppSelector(state => state.calfOutcome.entity);
  const loading = useAppSelector(state => state.calfOutcome.loading);
  const updating = useAppSelector(state => state.calfOutcome.updating);
  const updateSuccess = useAppSelector(state => state.calfOutcome.updateSuccess);

  const handleClose = () => {
    navigate('/calf-outcome');
  };

  useEffect(() => {
    if (isNew) {
      dispatch(reset());
    } else {
      dispatch(getEntity(id));
    }

    dispatch(getCalvingEvents({}));
    dispatch(getCattles({}));
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
    if (values.birthWeight !== undefined && typeof values.birthWeight !== 'number') {
      values.birthWeight = Number(values.birthWeight);
    }

    const entity = {
      ...calfOutcomeEntity,
      ...values,
      calving: calvingEvents.find(it => it.id.toString() === values.calving?.toString()),
      registeredCattle: cattles.find(it => it.id.toString() === values.registeredCattle?.toString()),
    };

    if (isNew) {
      dispatch(createEntity(entity));
    } else {
      dispatch(updateEntity(entity));
    }
  };

  const defaultValues = () =>
    isNew
      ? {}
      : {
          ...calfOutcomeEntity,
          calving: calfOutcomeEntity?.calving?.id,
          registeredCattle: calfOutcomeEntity?.registeredCattle?.id,
        };

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="beefcareApp.calfOutcome.home.createOrEditLabel" data-cy="CalfOutcomeCreateUpdateHeading">
            Thêm mới hoặc cập nhật Calf Outcome
          </h2>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col md="8">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ValidatedForm defaultValues={defaultValues()} onSubmit={saveEntity}>
              {!isNew && <ValidatedField name="id" required readOnly id="calf-outcome-id" label="ID" validate={{ required: true }} />}
              <ValidatedField
                label="Outcome"
                id="calf-outcome-outcome"
                name="outcome"
                data-cy="outcome"
                type="text"
                validate={{
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <OverlayTrigger overlay={<Tooltip>LIVE | STILLBORN</Tooltip>}>
                <span id="outcomeLabel" className="d-inline-block">
                  ?
                </span>
              </OverlayTrigger>
              <ValidatedField
                label="Sex"
                id="calf-outcome-sex"
                name="sex"
                data-cy="sex"
                type="text"
                validate={{
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <ValidatedField label="Birth Weight" id="calf-outcome-birthWeight" name="birthWeight" data-cy="birthWeight" type="text" />
              <ValidatedField
                label="Registration State"
                id="calf-outcome-registrationState"
                name="registrationState"
                data-cy="registrationState"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <ValidatedField id="calf-outcome-calving" name="calving" data-cy="calving" label="Calving" type="select" required>
                <option value="" key="0" />
                {calvingEvents
                  ? calvingEvents.map(otherEntity => (
                      <option value={otherEntity.id} key={otherEntity.id}>
                        {otherEntity.id}
                      </option>
                    ))
                  : null}
              </ValidatedField>
              <FormText>Trường này bắt buộc phải nhập.</FormText>
              <ValidatedField
                id="calf-outcome-registeredCattle"
                name="registeredCattle"
                data-cy="registeredCattle"
                label="Registered Cattle"
                type="select"
              >
                <option value="" key="0" />
                {cattles
                  ? cattles.map(otherEntity => (
                      <option value={otherEntity.id} key={otherEntity.id}>
                        {otherEntity.id}
                      </option>
                    ))
                  : null}
              </ValidatedField>
              <Button as={Link as any} id="cancel-save" data-cy="entityCreateCancelButton" to="/calf-outcome" replace variant="info">
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

export default CalfOutcomeUpdate;
