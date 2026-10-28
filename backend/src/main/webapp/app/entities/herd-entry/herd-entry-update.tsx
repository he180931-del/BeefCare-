import React, { useEffect } from 'react';
import { Button, Col, FormText, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { ValidatedField, ValidatedForm } from 'react-jhipster';
import { Link, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { getEntities as getCattles } from 'app/entities/cattle/cattle.reducer';
import { getEntities as getPens } from 'app/entities/pen/pen.reducer';

import { createEntity, getEntity, reset, updateEntity } from './herd-entry.reducer';

export const HerdEntryUpdate = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { id } = useParams<'id'>();
  const isNew = id === undefined;

  const cattles = useAppSelector(state => state.cattle.entities);
  const pens = useAppSelector(state => state.pen.entities);
  const herdEntryEntity = useAppSelector(state => state.herdEntry.entity);
  const loading = useAppSelector(state => state.herdEntry.loading);
  const updating = useAppSelector(state => state.herdEntry.updating);
  const updateSuccess = useAppSelector(state => state.herdEntry.updateSuccess);

  const handleClose = () => {
    navigate('/herd-entry');
  };

  useEffect(() => {
    if (isNew) {
      dispatch(reset());
    } else {
      dispatch(getEntity(id));
    }

    dispatch(getCattles({}));
    dispatch(getPens({}));
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

    const entity = {
      ...herdEntryEntity,
      ...values,
      cattle: cattles.find(it => it.id.toString() === values.cattle?.toString()),
      initialPen: pens.find(it => it.id.toString() === values.initialPen?.toString()),
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
          ...herdEntryEntity,
          cattle: herdEntryEntity?.cattle?.id,
          initialPen: herdEntryEntity?.initialPen?.id,
        };

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="beefcareApp.herdEntry.home.createOrEditLabel" data-cy="HerdEntryCreateUpdateHeading">
            Thêm mới hoặc cập nhật Herd Entry
          </h2>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col md="8">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ValidatedForm defaultValues={defaultValues()} onSubmit={saveEntity}>
              {!isNew && <ValidatedField name="id" required readOnly id="herd-entry-id" label="ID" validate={{ required: true }} />}
              <ValidatedField
                label="Source"
                id="herd-entry-source"
                name="source"
                data-cy="source"
                type="text"
                validate={{
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <OverlayTrigger overlay={<Tooltip>EXTERNAL | FARM_BORN</Tooltip>}>
                <span id="sourceLabel" className="d-inline-block">
                  ?
                </span>
              </OverlayTrigger>
              <ValidatedField
                label="Entry Date"
                id="herd-entry-entryDate"
                name="entryDate"
                data-cy="entryDate"
                type="date"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField
                label="History Declarations"
                id="herd-entry-historyDeclarations"
                name="historyDeclarations"
                data-cy="historyDeclarations"
                type="text"
                validate={{
                  maxLength: { value: 255, message: 'Trường này không được vượt quá 255 ký tự.' },
                }}
              />
              <ValidatedField id="herd-entry-cattle" name="cattle" data-cy="cattle" label="Cattle" type="select" required>
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
              <ValidatedField id="herd-entry-initialPen" name="initialPen" data-cy="initialPen" label="Initial Pen" type="select" required>
                <option value="" key="0" />
                {pens
                  ? pens.map(otherEntity => (
                      <option value={otherEntity.id} key={otherEntity.id}>
                        {otherEntity.id}
                      </option>
                    ))
                  : null}
              </ValidatedField>
              <FormText>Trường này bắt buộc phải nhập.</FormText>
              <Button as={Link as any} id="cancel-save" data-cy="entityCreateCancelButton" to="/herd-entry" replace variant="info">
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

export default HerdEntryUpdate;
