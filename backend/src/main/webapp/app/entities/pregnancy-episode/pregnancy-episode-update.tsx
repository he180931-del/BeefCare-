import React, { useEffect } from 'react';
import { Button, Col, FormText, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { ValidatedField, ValidatedForm, isNumber } from 'react-jhipster';
import { Link, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { getEntities as getCattles } from 'app/entities/cattle/cattle.reducer';
import { getEntities as getReproductionEvents } from 'app/entities/reproduction-event/reproduction-event.reducer';

import { createEntity, getEntity, reset, updateEntity } from './pregnancy-episode.reducer';

export const PregnancyEpisodeUpdate = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { id } = useParams<'id'>();
  const isNew = id === undefined;

  const reproductionEvents = useAppSelector(state => state.reproductionEvent.entities);
  const cattles = useAppSelector(state => state.cattle.entities);
  const pregnancyEpisodeEntity = useAppSelector(state => state.pregnancyEpisode.entity);
  const loading = useAppSelector(state => state.pregnancyEpisode.loading);
  const updating = useAppSelector(state => state.pregnancyEpisode.updating);
  const updateSuccess = useAppSelector(state => state.pregnancyEpisode.updateSuccess);

  const handleClose = () => {
    navigate('/pregnancy-episode');
  };

  useEffect(() => {
    if (isNew) {
      dispatch(reset());
    } else {
      dispatch(getEntity(id));
    }

    dispatch(getReproductionEvents({}));
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
    if (values.parity !== undefined && typeof values.parity !== 'number') {
      values.parity = Number(values.parity);
    }

    const entity = {
      ...pregnancyEpisodeEntity,
      ...values,
      confirmingCheck: reproductionEvents.find(it => it.id.toString() === values.confirmingCheck?.toString()),
      cattle: cattles.find(it => it.id.toString() === values.cattle?.toString()),
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
          ...pregnancyEpisodeEntity,
          confirmingCheck: pregnancyEpisodeEntity?.confirmingCheck?.id,
          cattle: pregnancyEpisodeEntity?.cattle?.id,
        };

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="beefcareApp.pregnancyEpisode.home.createOrEditLabel" data-cy="PregnancyEpisodeCreateUpdateHeading">
            Thêm mới hoặc cập nhật Pregnancy Episode
          </h2>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col md="8">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ValidatedForm defaultValues={defaultValues()} onSubmit={saveEntity}>
              {!isNew && <ValidatedField name="id" required readOnly id="pregnancy-episode-id" label="ID" validate={{ required: true }} />}
              <ValidatedField
                label="Expected Calving Date"
                id="pregnancy-episode-expectedCalvingDate"
                name="expectedCalvingDate"
                data-cy="expectedCalvingDate"
                type="date"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField
                label="Parity"
                id="pregnancy-episode-parity"
                name="parity"
                data-cy="parity"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  validate: v => isNumber(v) || 'Trường này phải là một số.',
                }}
              />
              <ValidatedField
                label="Status"
                id="pregnancy-episode-status"
                name="status"
                data-cy="status"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <OverlayTrigger overlay={<Tooltip>OPEN | CALVED | LOST</Tooltip>}>
                <span id="statusLabel" className="d-inline-block">
                  ?
                </span>
              </OverlayTrigger>
              <ValidatedField
                id="pregnancy-episode-confirmingCheck"
                name="confirmingCheck"
                data-cy="confirmingCheck"
                label="Confirming Check"
                type="select"
                required
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
              <FormText>Trường này bắt buộc phải nhập.</FormText>
              <ValidatedField id="pregnancy-episode-cattle" name="cattle" data-cy="cattle" label="Cattle" type="select" required>
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
              <Button as={Link as any} id="cancel-save" data-cy="entityCreateCancelButton" to="/pregnancy-episode" replace variant="info">
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

export default PregnancyEpisodeUpdate;
